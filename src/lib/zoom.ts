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

export interface Size {
  width: number;
  height: number;
}

/**
 * Pans only as far as the zoomed media overflows the stage, so its edges never come inside the stage and a
 * letterboxed image does not slide into the empty space beside it. At 1x there is no pan.
 */
export function clampPan(state: ZoomState, media: Size, stage: Size): ZoomState {
  if (state.scale <= MIN_ZOOM) return { ...IDENTITY_ZOOM };
  const maxX = Math.max(0, (media.width * state.scale - stage.width) / 2);
  const maxY = Math.max(0, (media.height * state.scale - stage.height) / 2);
  return {
    scale: state.scale,
    x: Math.min(maxX, Math.max(-maxX, state.x)),
    y: Math.min(maxY, Math.max(-maxY, state.y)),
  };
}

/** Zooms to `nextScale` so the image point under `point` stays under it, as a pinch or wheel expects. */
export function zoomAt(
  state: ZoomState,
  nextScale: number,
  point: { x: number; y: number },
  media: Size,
  stage: Size,
): ZoomState {
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextScale));
  const ratio = scale / state.scale;
  return clampPan(
    { scale, x: point.x - (point.x - state.x) * ratio, y: point.y - (point.y - state.y) * ratio },
    media,
    stage,
  );
}
