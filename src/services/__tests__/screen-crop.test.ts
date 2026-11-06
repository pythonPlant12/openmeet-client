import { describe, expect, it } from 'vitest';

import { canShareScreenArea, cropRect, normalizeArea } from '../screen-crop';

describe('screen area cropping', () => {
  it('keeps a selected area inside the picture and above the minimum size', () => {
    expect(normalizeArea({ x: 0.9, y: -0.2, width: 0.3, height: 0.01 })).toEqual({
      x: 0.7,
      y: 0,
      width: 0.3,
      height: 0.05,
    });
    expect(normalizeArea({ x: 0, y: 0, width: 2, height: 2 })).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('crops on even pixels inside the visible picture', () => {
    const visible = { x: 0, y: 0, width: 1921, height: 1081 };
    expect(cropRect({ x: 0.25, y: 0.5, width: 0.5, height: 0.5 }, visible)).toEqual({
      x: 480,
      y: 540,
      width: 960,
      height: 540,
    });
    // A picture with an offset visible rectangle keeps the crop inside it.
    expect(cropRect({ x: 0.9, y: 0.9, width: 0.3, height: 0.3 }, { x: 10, y: 20, width: 100, height: 100 })).toEqual({
      x: 80,
      y: 90,
      width: 30,
      height: 30,
    });
  });

  it('is offered only where frames can be cropped off the main thread', () => {
    expect(canShareScreenArea()).toBe(false);
  });
});
