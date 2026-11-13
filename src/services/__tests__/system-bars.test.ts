import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startSystemBarSync } from '@/services/system-bars';

const tauri = vi.hoisted(() => ({ isTauri: vi.fn(() => false), invoke: vi.fn(() => Promise.resolve()) }));
vi.mock('@tauri-apps/api/core', () => tauri);

type Edge = 'top' | 'bottom';

function themeColor() {
  return document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content;
}

/** A page layer that covers the given screen edges; later layers stack on top, as in the DOM. */
function addLayer(backgroundColor: string, edges: Edge[] = ['top', 'bottom']) {
  const layer = document.createElement('div');
  layer.style.backgroundColor = backgroundColor;
  layer.dataset.edges = edges.join(' ');
  document.body.append(layer);
  return layer;
}

// jsdom has no layout, so hit testing returns the layers that cover the probed edge, topmost first.
function stubHitTesting() {
  document.elementsFromPoint = (_x: number, y: number) => {
    const edge: Edge = y < window.innerHeight / 2 ? 'top' : 'bottom';
    const layers = [...document.body.querySelectorAll<HTMLElement>('[data-edges]')]
      .filter((layer) => layer.dataset.edges?.split(' ').includes(edge))
      .reverse();
    return [...layers, document.body, document.documentElement];
  };
}

describe('system bars', () => {
  let stop: () => void = () => {};

  beforeEach(() => {
    stubHitTesting();
    document.body.style.backgroundColor = 'rgb(251, 252, 248)';
  });

  afterEach(() => {
    stop();
    document.body.replaceChildren();
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
    document.querySelector('meta[name="theme-color"]')?.remove();
    vi.clearAllMocks();
    tauri.isTauri.mockReturnValue(false);
  });

  it('paints the bars with the page background', async () => {
    addLayer('rgb(247, 248, 250)');

    stop = startSystemBarSync();

    await vi.waitFor(() => expect(themeColor()).toBe('#f7f8fa'));
    expect(document.documentElement.style.backgroundColor).toBe('rgb(247, 248, 250)');
  });

  it('follows a page that turns black and returns when it leaves', async () => {
    addLayer('rgb(255, 255, 255)');
    stop = startSystemBarSync();
    await vi.waitFor(() => expect(themeColor()).toBe('#ffffff'));

    const stage = addLayer('rgb(0, 0, 0)');
    await vi.waitFor(() => expect(themeColor()).toBe('#000000'));

    stage.remove();
    await vi.waitFor(() => expect(themeColor()).toBe('#ffffff'));
  });

  it('follows a background that changes through a class', async () => {
    const style = document.createElement('style');
    style.textContent = '.page { background-color: rgb(255, 255, 255); } .stage { background-color: rgb(0, 0, 0); }';
    document.head.append(style);
    const page = addLayer('');
    page.className = 'page';
    stop = startSystemBarSync();
    await vi.waitFor(() => expect(themeColor()).toBe('#ffffff'));

    page.className = 'stage';

    await vi.waitFor(() => expect(themeColor()).toBe('#000000'));
    style.remove();
  });

  it('blends translucent layers over the page', async () => {
    addLayer('rgb(0, 0, 0)');
    addLayer('rgba(255, 255, 255, 0.5)');

    stop = startSystemBarSync();

    await vi.waitFor(() => expect(themeColor()).toBe('#808080'));
  });

  it('falls back to the body when nothing covers the edge', async () => {
    stop = startSystemBarSync();

    await vi.waitFor(() => expect(themeColor()).toBe('#fbfcf8'));
  });

  it('ignores the colour it gives the document itself', async () => {
    const page = addLayer('rgb(0, 0, 0)');
    stop = startSystemBarSync();
    await vi.waitFor(() => expect(themeColor()).toBe('#000000'));

    page.remove();

    await vi.waitFor(() => expect(themeColor()).toBe('#fbfcf8'));
  });

  it('gives the native app separate top and bottom colours', async () => {
    tauri.isTauri.mockReturnValue(true);
    addLayer('rgb(255, 255, 255)');
    addLayer('rgb(17, 27, 33)', ['bottom']);

    stop = startSystemBarSync();

    await vi.waitFor(() =>
      expect(tauri.invoke).toHaveBeenLastCalledWith('set_system_bars', { top: '#ffffff', bottom: '#111b21' }),
    );
  });

  it('tells the native app only about changes', async () => {
    tauri.isTauri.mockReturnValue(true);
    const page = addLayer('rgb(255, 255, 255)');
    stop = startSystemBarSync();
    await vi.waitFor(() => expect(tauri.invoke).toHaveBeenCalledTimes(1));

    page.className = 'restyled-without-a-colour-change';
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);

    expect(tauri.invoke).toHaveBeenCalledTimes(1);
  });
});
