export type MeetingViewMode = 'grid' | 'speaker';

export interface MeetingLayout {
  viewMode: MeetingViewMode;
  pinnedParticipantId: string | null;
}

/**
 * Layout after tapping a participant tile: in the grid it pins that person in speaker view. In speaker view it
 * pins someone else, and tapping the pinned person unpins them, so the stage follows whoever speaks.
 */
export function layoutAfterTileClick(layout: MeetingLayout, participantId: string): MeetingLayout {
  if (layout.viewMode === 'grid') return { viewMode: 'speaker', pinnedParticipantId: participantId };
  if (layout.pinnedParticipantId === participantId) return { viewMode: 'speaker', pinnedParticipantId: null };
  return { viewMode: 'speaker', pinnedParticipantId: participantId };
}

/** The speaker view's main person: the pinned one, else the active speaker, else the first participant. */
export function speakerViewMainId(
  participantIds: readonly string[],
  pinnedParticipantId: string | null,
  activeSpeakerId: string | null,
) {
  if (pinnedParticipantId && participantIds.includes(pinnedParticipantId)) return pinnedParticipantId;
  if (activeSpeakerId && participantIds.includes(activeSpeakerId)) return activeSpeakerId;
  return participantIds[0] ?? null;
}

/**
 * The main video fills the stage, cropping slightly, when it has the stage's orientation (a portrait camera on
 * a portrait phone). Otherwise, and in full screen where the speaker must show whole, it fits inside.
 */
export function mainVideoFills(videoAspect: number, stageWidth: number, stageHeight: number, fullscreen: boolean) {
  if (fullscreen || stageWidth <= 0 || stageHeight <= 0) return false;
  return videoAspect < 1 === stageWidth / stageHeight < 1;
}

/** Fallback shape for tiles whose video has not reported its size yet, or that show an avatar. */
export const DEFAULT_TILE_ASPECT = 16 / 9;

export interface TileRow {
  /** Tile positions, in input order. */
  indices: number[];
  /** Row height in pixels; each tile is `height * aspect` wide. */
  height: number;
}

/**
 * Splits tiles into rows that fit a `width` x `height` area while keeping every video's shape (aspect ratio,
 * width / height). Each row count is tried and the one with the largest total tile area wins, so portrait and
 * landscape videos can share a row instead of being cropped into equal cells.
 */
export function fitTilesInRows(aspects: number[], width: number, height: number, gap: number): TileRow[] {
  const count = aspects.length;
  if (!count || width <= 0 || height <= 0) return [];

  let best: TileRow[] = [];
  let bestArea = -1;
  for (let rowCount = 1; rowCount <= count; rowCount += 1) {
    const rowHeightLimit = (height - gap * (rowCount - 1)) / rowCount;
    if (rowHeightLimit <= 0) break;

    const rows: TileRow[] = [];
    let area = 0;
    let start = 0;
    for (let row = 0; row < rowCount; row += 1) {
      const size = Math.ceil((count - start) / (rowCount - row));
      const indices = Array.from({ length: size }, (_, offset) => start + offset);
      start += size;
      const aspectSum = indices.reduce((sum, index) => sum + aspects[index]!, 0);
      const rowHeight = Math.floor(Math.min(rowHeightLimit, (width - gap * (size - 1)) / aspectSum));
      rows.push({ indices, height: rowHeight });
      area += rowHeight * rowHeight * aspectSum;
    }
    if (area > bestArea) {
      bestArea = area;
      best = rows;
    }
  }
  return best;
}
