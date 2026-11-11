// Zoom and pan for the media viewer. The image is transformed with `translate(x, y) scale(scale)` around its
// center, so points and the translate are in CSS pixels relative to the element's center.

export interface ZoomState {
  scale: number;
  x: number;
  y: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const DOUBLE_TAP_ZOOM = 2.5;
export const IDENTITY_ZOOM: ZoomState = Object.freeze({ scale: 1, x: 0, y: 0 });

interface Size {
  width: number;
  height: number;
}

/** Keeps the zoomed image covering its box: it never pans past its own edges. At 1x there is no pan. */
export function clampPan(state: ZoomState, size: Size): ZoomState {
  if (state.scale <= MIN_ZOOM) return { ...IDENTITY_ZOOM };
  const maxX = (size.width * (state.scale - 1)) / 2;
  const maxY = (size.height * (state.scale - 1)) / 2;
  return {
    scale: state.scale,
    x: Math.min(maxX, Math.max(-maxX, state.x)),
    y: Math.min(maxY, Math.max(-maxY, state.y)),
  };
}

/** Zooms to `nextScale` so the image point under `point` stays under it, as a pinch or wheel expects. */
export function zoomAt(state: ZoomState, nextScale: number, point: { x: number; y: number }, size: Size): ZoomState {
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextScale));
  const ratio = scale / state.scale;
  return clampPan({ scale, x: point.x - (point.x - state.x) * ratio, y: point.y - (point.y - state.y) * ratio }, size);
}
