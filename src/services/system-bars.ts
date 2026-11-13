import { invoke, isTauri } from '@tauri-apps/api/core';

// Keeps the areas outside the page (the status bar, the home indicator or navigation bar, and overscroll edges)
// the same colour as the page behind them. The colour is read from what the page paints at its top and bottom
// edges, so pages never set it themselves: a dark scope such as the full screen call stage changes the bars by
// changing its own background.
//
// Browsers get `theme-color` (top) and the document background (bottom and overscroll). The OpenMeet native app
// gets both colours through `set_system_bars` (openmeet-native/src-tauri/src/system_bars.rs), which also picks
// readable status bar icons.

type Rgb = [number, number, number];

interface SystemBarColors {
  top: string;
  bottom: string;
}

/** Inset from the screen edge, so the probe stays inside the page and clears floating bars and rounded corners. */
const PROBE_INSET = 1;

function parseColor(value: string): [...Rgb, number] | null {
  const channels = value.match(/[\d.]+/g)?.map(Number);
  if (!value.startsWith('rgb') || !channels || channels.length < 3) return null;
  const [red = 0, green = 0, blue = 0, alpha = 1] = channels;
  return [red, green, blue, alpha];
}

function toHex([red, green, blue]: Rgb) {
  return `#${[red, green, blue].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The colour the page shows at a point: the topmost opaque background, with any translucent layers above it
 * blended on top. The document element is skipped because this module paints it.
 */
function pageColorAt(x: number, y: number): Rgb {
  const translucent: [...Rgb, number][] = [];
  let base: Rgb | null = null;
  for (const element of document.elementsFromPoint(x, y)) {
    if (element === document.documentElement) continue;
    const color = parseColor(getComputedStyle(element).backgroundColor);
    if (!color || color[3] === 0) continue;
    if (color[3] >= 1) {
      base = [color[0], color[1], color[2]];
      break;
    }
    translucent.push(color);
  }
  base ??= (parseColor(getComputedStyle(document.body).backgroundColor)?.slice(0, 3) as Rgb | undefined) ?? [
    255, 255, 255,
  ];
  return translucent.reduceRight<Rgb>(
    (below, [red, green, blue, alpha]) => [
      red * alpha + below[0] * (1 - alpha),
      green * alpha + below[1] * (1 - alpha),
      blue * alpha + below[2] * (1 - alpha),
    ],
    base,
  );
}

function readPageEdges(): SystemBarColors {
  const x = PROBE_INSET;
  return {
    top: toHex(pageColorAt(x, PROBE_INSET)),
    bottom: toHex(pageColorAt(x, window.innerHeight - 1 - PROBE_INSET)),
  };
}

function themeColorMeta() {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  return meta;
}

function paint(colors: SystemBarColors) {
  themeColorMeta().content = colors.top;
  document.documentElement.style.backgroundColor = colors.bottom;
  if (isTauri()) {
    invoke('set_system_bars', { ...colors }).catch((error) =>
      console.error('[SystemBars] Failed to color the system bars:', error),
    );
  }
}

/** Starts following the page background; returns a function that stops. */
export function startSystemBarSync(): () => void {
  let painted: SystemBarColors | null = null;
  let frame: number | null = null;

  const sync = () => {
    frame = null;
    const colors = readPageEdges();
    if (painted?.top === colors.top && painted.bottom === colors.bottom) return;
    painted = colors;
    paint(colors);
  };
  const schedule = () => {
    frame ??= requestAnimationFrame(sync);
  };

  // Route changes, dark scopes, and dialogs all reach the DOM as added nodes or class changes. Inline styles are
  // not observed: gestures rewrite them every frame. Transitions and animations, including the ones gestures end
  // with, report their end, when the background has its final colour.
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'hidden', 'open'],
  });
  window.addEventListener('resize', schedule);
  document.addEventListener('transitionend', schedule, true);
  document.addEventListener('animationend', schedule, true);
  schedule();

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    document.removeEventListener('transitionend', schedule, true);
    document.removeEventListener('animationend', schedule, true);
    if (frame !== null) cancelAnimationFrame(frame);
  };
}
