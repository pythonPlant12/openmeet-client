// Shares part of a captured screen. Browsers can only capture a whole screen, window, or tab, so each frame
// is cropped before it is sent. Insertable streams do this off the main thread and keep running while the
// meeting tab is hidden, which a canvas redraw loop does not, so the option exists only where they do
// (Chromium browsers).

/** A part of the captured picture, as fractions of its width and height from the top left. */
export interface ScreenArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TrackProcessor {
  readable: ReadableStream<VideoFrame>;
}
interface TrackGenerator extends MediaStreamTrack {
  writable: WritableStream<VideoFrame>;
}
type ProcessorConstructor = new (init: { track: MediaStreamTrack }) => TrackProcessor;
type GeneratorConstructor = new (init: { kind: 'video' }) => TrackGenerator;

function insertableStreams() {
  const scope = globalThis as unknown as {
    MediaStreamTrackProcessor?: ProcessorConstructor;
    MediaStreamTrackGenerator?: GeneratorConstructor;
    VideoFrame?: unknown;
  };
  if (!scope.MediaStreamTrackProcessor || !scope.MediaStreamTrackGenerator || !scope.VideoFrame) return null;
  return { Processor: scope.MediaStreamTrackProcessor, Generator: scope.MediaStreamTrackGenerator };
}

export function canShareScreenArea() {
  return insertableStreams() !== null;
}

// Shares smaller than this would be unreadable; the picker keeps selections above it too.
export const MIN_AREA_FRACTION = 0.05;

/** Clamps an area into the picture and to the minimum size. */
export function normalizeArea(area: ScreenArea): ScreenArea {
  const width = Math.min(1, Math.max(MIN_AREA_FRACTION, area.width));
  const height = Math.min(1, Math.max(MIN_AREA_FRACTION, area.height));
  return {
    x: Math.min(1 - width, Math.max(0, area.x)),
    y: Math.min(1 - height, Math.max(0, area.y)),
    width,
    height,
  };
}

// Video frames store color at half resolution, so crop edges must fall on even pixels.
const even = (value: number) => Math.max(0, Math.floor(value / 2) * 2);

/** Pixel rectangle of `area` inside a frame's visible picture. */
export function cropRect(area: ScreenArea, visible: { x: number; y: number; width: number; height: number }) {
  const width = Math.max(2, even(area.width * visible.width));
  const height = Math.max(2, even(area.height * visible.height));
  const x = Math.min(even(visible.width - width), even(area.x * visible.width));
  const y = Math.min(even(visible.height - height), even(area.y * visible.height));
  return { x: visible.x + x, y: visible.y + y, width, height };
}

export interface CroppedTrack {
  track: MediaStreamTrack;
  stop: () => void;
}

/** A track that carries only `area` of `source`. Stopping it leaves the source to its owner. */
export function cropVideoTrack(source: MediaStreamTrack, area: ScreenArea): CroppedTrack {
  const streams = insertableStreams();
  if (!streams) throw new Error('Sharing part of the screen is not supported in this browser');
  const selected = normalizeArea(area);
  const processor = new streams.Processor({ track: source });
  const generator = new streams.Generator({ kind: 'video' });
  const abort = new AbortController();

  const crop = new TransformStream<VideoFrame, VideoFrame>({
    transform(frame, controller) {
      const visible = frame.visibleRect ?? { x: 0, y: 0, width: frame.codedWidth, height: frame.codedHeight };
      const rect = cropRect(selected, visible);
      try {
        controller.enqueue(
          new VideoFrame(frame, { visibleRect: rect, displayWidth: rect.width, displayHeight: rect.height }),
        );
      } finally {
        frame.close();
      }
    },
  });
  processor.readable
    .pipeThrough(crop, { signal: abort.signal })
    .pipeTo(generator.writable, { signal: abort.signal })
    .catch((error: unknown) => {
      if (!abort.signal.aborted) console.error('[ScreenCrop] Cropping the screen share stopped:', error);
    });

  return {
    track: generator,
    stop() {
      abort.abort();
      generator.stop();
    },
  };
}
