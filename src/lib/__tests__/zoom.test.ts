import { describe, expect, it } from 'vitest';

import { IDENTITY_ZOOM, MAX_ZOOM, clampPan, zoomAt } from '@/lib/zoom';

const size = { width: 400, height: 300 };

describe('zoom', () => {
  it('keeps the point under the cursor in place', () => {
    const next = zoomAt(IDENTITY_ZOOM, 2, { x: 100, y: 50 }, size);
    expect(next).toEqual({ scale: 2, x: -100, y: -50 });
  });

  it('clamps the scale between 1 and 4', () => {
    expect(zoomAt(IDENTITY_ZOOM, 9, { x: 0, y: 0 }, size).scale).toBe(MAX_ZOOM);
    expect(zoomAt({ scale: 2, x: 40, y: 0 }, 0.2, { x: 0, y: 0 }, size)).toEqual(IDENTITY_ZOOM);
  });

  it('keeps the zoomed image covering its box', () => {
    expect(clampPan({ scale: 2, x: 999, y: -999 }, size)).toEqual({ scale: 2, x: 200, y: -150 });
  });
});
