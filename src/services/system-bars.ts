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

/** Reads an `rgb()`/`rgba()` colour, which may be followed by a gradient stop position. */
function parseColor(value: string): [...Rgb, number] | null {
  const channels = value
    .trim()
    .match(/^rgba?\(([^)]*)\)/)?.[1]
    ?.match(/[\d.]+/g)
    ?.map(Number);
  if (!channels || channels.length < 3) return null;
  const [red = 0, green = 0, blue = 0, alpha = 1] = channels;
  return [red, green, blue, alpha];
}

function toHex([red, green, blue]: Rgb) {
  return `#${[red, green, blue].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

type Rgba = [...Rgb, number];

/** Splits a CSS list at its top-level commas, leaving the commas inside `rgb(...)` alone. */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}

/**
 * The colour of a top-to-bottom `linear-gradient` background at `y`, such as the chat header's fade, which is
 * translucent white over the messages. Other gradients and images return null and are skipped.
 */
function verticalGradientColorAt(image: string, element: Element, y: number): Rgba | null {
  const match = image.match(/^linear-gradient\((.*)\)$/);
  if (!match?.[1]) return null;
  const parts = splitTopLevel(match[1]);
  if (parts[0] && !parts[0].startsWith('rgb')) {
    if (parts[0] !== 'to bottom' && parts[0] !== '180deg') return null;
    parts.shift();
  }
  const stops = parts.map((part) => {
    const color = parseColor(part);
    const position = part.match(/\)\s+([\d.]+)%$/)?.[1];
    return color ? { color, position: position === undefined ? null : Number(position) / 100 } : null;
  });
  if (stops.length < 2 || stops.some((stop) => !stop)) return null;
  const resolved = stops as { color: Rgba; position: number | null }[];
  // Stops without a position spread evenly between their neighbours, as CSS places them.
  resolved[0]!.position ??= 0;
  resolved[resolved.length - 1]!.position ??= 1;
  for (let index = 1; index < resolved.length - 1; index += 1) {
    if (resolved[index]!.position !== null) continue;
    const before = resolved[index - 1]!.position!;
    let next = index + 1;
    while (resolved[next]!.position === null) next += 1;
    const after = resolved[next]!.position!;
    resolved[index]!.position = before + (after - before) / (next - index + 1);
  }

  const rect = element.getBoundingClientRect();
  const offset = rect.height > 0 ? Math.min(Math.max((y - rect.top) / rect.height, 0), 1) : 0;
  const nextIndex = resolved.findIndex((stop) => stop.position! >= offset);
  if (nextIndex <= 0) return resolved[nextIndex === 0 ? 0 : resolved.length - 1]!.color;
  const from = resolved[nextIndex - 1]!;
  const to = resolved[nextIndex]!;
  const span = to.position! - from.position!;
  const amount = span > 0 ? (offset - from.position!) / span : 1;
  return from.color.map((channel, index) => channel + (to.color[index]! - channel) * amount) as Rgba;
}

/**
 * Overlays that let touches through (`pointer-events: none`), such as the chat header's fade, are invisible to
 * hit testing, so they mark themselves with `data-system-bar-layer` to count. They float above the page, so they
 * come first.
 */
function overlaysAt(x: number, y: number): Element[] {
  return [...document.querySelectorAll('[data-system-bar-layer]')].filter((element) => {
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
  });
}

/**
 * The colour the page shows at a point: the topmost opaque background, with any translucent layers above it
 * blended on top. A vertical gradient counts as a layer above its element's own colour. The document element is
 * skipped because this module paints it.
 */
function pageColorAt(x: number, y: number): Rgb {
  const translucent: Rgba[] = [];
  let base: Rgb | null = null;
  for (const element of [...overlaysAt(x, y), ...document.elementsFromPoint(x, y)]) {
    if (element === document.documentElement) continue;
    const style = getComputedStyle(element);
    const layers = [
      style.backgroundImage === 'none' ? null : verticalGradientColorAt(style.backgroundImage, element, y),
      parseColor(style.backgroundColor),
    ];
    for (const color of layers) {
      if (!color || color[3] === 0) continue;
      if (color[3] >= 1) {
        base = [color[0], color[1], color[2]];
        break;
      }
      translucent.push(color);
    }
    if (base) break;
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

// What wants the page to cover the status bar area, such as an open chat or a full screen call in portrait.
const topCovers = new Set<string>();

/**
 * Lets the page reach under the status bar for `reason` (an open chat, a full screen call), or stops. The OpenMeet
 * iOS app always lets the page cover the home indicator area, and covers the status bar area while any reason
 * holds (`set_screen_edges`); browsers ignore it. What the page draws there pads itself with
 * `env(safe-area-inset-*)`, which reads the real insets of the covered areas.
 */
export function coverScreenTop(reason: string, cover: boolean) {
  const covered = topCovers.size > 0;
  if (cover) topCovers.add(reason);
  else topCovers.delete(reason);
  if (!isTauri() || covered === topCovers.size > 0) return;
  invoke('set_screen_edges', { top: topCovers.size > 0, bottom: true }).catch((error) =>
    console.error('[SystemBars] Failed to change the screen edges:', error),
  );
}

// The screen's corner radius on iPhones with rounded displays, by their size in points (portrait width x height).
// iOS keeps the real value private, so this follows Apple's published screen sizes; where two models share a size,
// the smaller radius is used, which only rounds a little less than the glass.
const IPHONE_CORNER_RADII: Record<string, number> = {
  '375x812': 39,
  '414x896': 39,
  '390x844': 47.33,
  '428x926': 53.33,
  '393x852': 55,
  '430x932': 55,
  '402x874': 62,
  '440x956': 62,
};

/** The corner radius of a phone screen this size, in CSS pixels, or 0 for square corners or an unknown size. */
export function deviceCornerRadius(width: number, height: number): number {
  const [short, long] = width < height ? [width, height] : [height, width];
  return IPHONE_CORNER_RADII[`${Math.round(short)}x${Math.round(long)}`] ?? 0;
}

/** Starts following the page background; returns a function that stops. */
export function startSystemBarSync(): () => void {
  // Lets a full screen call round its video like the glass around it (see VideoGrid).
  if (isTauri()) {
    const radius = deviceCornerRadius(window.screen.width, window.screen.height);
    if (radius) document.documentElement.style.setProperty('--device-corner-radius', `${radius}px`);
  }
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
