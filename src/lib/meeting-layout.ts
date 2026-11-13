export type MeetingViewMode = 'grid' | 'speaker';

/** Phone portrait, phone landscape, or desktop; a narrow desktop window counts as a phone. */
export type CallFormFactor = 'phone-portrait' | 'phone-landscape' | 'desktop';

/** Below this width the call screen uses the phone layout. */
export const PHONE_BREAKPOINT = 768;
/** A landscape window this short is a phone on its side. */
const PHONE_LANDSCAPE_MAX_HEIGHT = 500;
/** From this many tiles a phone in portrait shows the speaker layout instead of the grid. */
const PHONE_SPEAKER_FROM = 5;

export function callFormFactor(width: number, height: number): CallFormFactor {
  const portrait = height >= width;
  if (portrait && width < PHONE_BREAKPOINT) return 'phone-portrait';
  if (!portrait && (width < PHONE_BREAKPOINT || height < PHONE_LANDSCAPE_MAX_HEIGHT)) return 'phone-landscape';
  return 'desktop';
}

/**
 * The person's own layout choice and pin. `viewMode` null follows the automatic layout for the call's size and
 * form factor. The pin is local and single; `viewModeBeforePin` is where unpinning returns to.
 */
export interface MeetingLayoutState {
  viewMode: MeetingViewMode | null;
  pinnedParticipantId: string | null;
  viewModeBeforePin: MeetingViewMode | null;
}

/** Tapping a tile pins that person in the speaker layout; tapping the pinned person unpins them. */
export function layoutAfterTileClick(state: MeetingLayoutState, participantId: string): MeetingLayoutState {
  if (state.pinnedParticipantId === participantId) return layoutWithoutPin(state);
  return {
    viewMode: 'speaker',
    pinnedParticipantId: participantId,
    viewModeBeforePin: state.pinnedParticipantId ? state.viewModeBeforePin : state.viewMode,
  };
}

/** Removes the pin and returns to the layout from before it. */
export function layoutWithoutPin(state: MeetingLayoutState): MeetingLayoutState {
  if (!state.pinnedParticipantId) return state;
  return { viewMode: state.viewModeBeforePin, pinnedParticipantId: null, viewModeBeforePin: null };
}

/** Grid has no stage, so picking it drops the pin; Speaker keeps the pinned person on stage. */
export function layoutAfterViewModeChoice(state: MeetingLayoutState, viewMode: MeetingViewMode): MeetingLayoutState {
  if (viewMode === 'grid') return { viewMode, pinnedParticipantId: null, viewModeBeforePin: null };
  return { ...state, viewMode };
}

export interface LayoutParticipant {
  id: string;
  isLocal: boolean;
  /** Set when the tile is someone's screen share. */
  screenShareOf?: string | null;
}

export interface CallLayoutInput {
  participants: readonly LayoutParticipant[];
  formFactor: CallFormFactor;
  viewMode: MeetingViewMode | null;
  pinnedParticipantId: string | null;
  activeSpeakerId: string | null;
}

export type CallLayout =
  /** Equal cells; `columns` null fits the column count to the area's shape. */
  | { kind: 'grid'; ids: string[]; columns: number | null }
  /** One tile on stage, everyone else in a strip. */
  | { kind: 'speaker'; mainId: string; stripIds: string[] }
  /** Phone 1:1: the other person fills the screen, your own view is a small picture in a corner. */
  | { kind: 'self-view'; mainId: string; selfId: string };

/**
 * The call screen's layout, from the number of tiles, the form factor, the pin and screen share:
 * a pin, or someone else's screen share, takes the stage (a share unless the person picked Grid). Otherwise a
 * phone in portrait shows a 1:1 call with a small self view, 2-4 tiles in a filled grid, and 5 or more in the
 * speaker layout; phone landscape and desktop show a grid that fits the window.
 */
export function selectCallLayout(input: CallLayoutInput): CallLayout {
  const { participants, formFactor, viewMode, pinnedParticipantId, activeSpeakerId } = input;
  const ids = participants.map((participant) => participant.id);
  const speaker = (mainId: string): CallLayout => ({
    kind: 'speaker',
    mainId,
    stripIds: ids.filter((id) => id !== mainId),
  });

  if (pinnedParticipantId && ids.includes(pinnedParticipantId)) return speaker(pinnedParticipantId);

  const screen = participants.find((participant) => participant.screenShareOf && !participant.isLocal);
  const defaultMainId = () =>
    (activeSpeakerId && ids.includes(activeSpeakerId) ? activeSpeakerId : null) ??
    participants.find((participant) => !participant.isLocal)?.id ??
    ids[0]!;
  if (ids.length && (viewMode === 'speaker' || (viewMode === null && screen))) {
    return speaker(screen?.id ?? defaultMainId());
  }

  if (formFactor === 'phone-portrait') {
    const self = participants.find((participant) => participant.isLocal && !participant.screenShareOf);
    const other = participants.find((participant) => participant !== self);
    if (ids.length === 2 && self && other && !other.isLocal && !other.screenShareOf) {
      return { kind: 'self-view', mainId: other.id, selfId: self.id };
    }
    if (ids.length >= PHONE_SPEAKER_FROM && viewMode === null) return speaker(defaultMainId());
    return { kind: 'grid', ids, columns: ids.length <= 2 ? 1 : 2 };
  }
  return { kind: 'grid', ids, columns: null };
}

/** Shape the fitted grid aims its cells at, so most cameras crop little. */
const GRID_TARGET_ASPECT = 16 / 9;

/** Column count whose cells hold the largest video of the target shape in a `width` x `height` area. */
export function fitGridColumns(count: number, width: number, height: number, gap: number) {
  let best = 1;
  let bestArea = -1;
  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);
    const cellWidth = (width - gap * (columns - 1)) / columns;
    const cellHeight = (height - gap * (rows - 1)) / rows;
    if (cellWidth <= 0 || cellHeight <= 0) break;
    const videoWidth = Math.min(cellWidth, cellHeight * GRID_TARGET_ASPECT);
    const area = videoWidth * (videoWidth / GRID_TARGET_ASPECT);
    if (area > bestArea) {
      bestArea = area;
      best = columns;
    }
  }
  return best;
}

export interface TileBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Equal cells that fill a `width` x `height` area, in reading order. A short last row is centred, or stretched
 * across the width with `stretchLastRow` so no space is left empty.
 */
export function gridCells(
  count: number,
  columns: number,
  width: number,
  height: number,
  gap: number,
  stretchLastRow: boolean,
): TileBox[] {
  if (!count || width <= 0 || height <= 0) return [];
  const rows = Math.ceil(count / columns);
  const cellWidth = (width - gap * (columns - 1)) / columns;
  const cellHeight = (height - gap * (rows - 1)) / rows;
  const boxes: TileBox[] = [];
  for (let row = 0; row < rows; row += 1) {
    const inRow = Math.min(columns, count - row * columns);
    const rowCellWidth = inRow < columns && stretchLastRow ? (width - gap * (inRow - 1)) / inRow : cellWidth;
    let left = (width - rowCellWidth * inRow - gap * (inRow - 1)) / 2;
    const top = row * (cellHeight + gap);
    for (let column = 0; column < inRow; column += 1) {
      boxes.push({ left, top, width: rowCellWidth, height: cellHeight });
      left += rowCellWidth + gap;
    }
  }
  return boxes;
}

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** The corner of a `width` x `height` area closest to a point, where a dragged self view snaps. */
export function nearestCorner(x: number, y: number, width: number, height: number): Corner {
  return `${y < height / 2 ? 'top' : 'bottom'}-${x < width / 2 ? 'left' : 'right'}`;
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
