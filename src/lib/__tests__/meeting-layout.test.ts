import { describe, expect, it } from 'vitest';

import {
  type CallFormFactor,
  type MeetingLayoutState,
  callFormFactor,
  fitGridColumns,
  fitTilesInRows,
  gridCells,
  layoutAfterTileClick,
  layoutAfterViewModeChoice,
  layoutWithoutPin,
  mainVideoFills,
  nearestCorner,
  selectCallLayout,
} from '@/lib/meeting-layout';

const me = { id: 'me', isLocal: true };
const person = (id: string) => ({ id, isLocal: false });
const screenOf = (id: string) => ({ id: `${id}-screen`, isLocal: false, screenShareOf: id });

function layoutFor(
  participants: { id: string; isLocal: boolean; screenShareOf?: string }[],
  formFactor: CallFormFactor,
  options: Partial<{ viewMode: 'grid' | 'speaker' | null; pinned: string | null; speaker: string | null }> = {},
) {
  return selectCallLayout({
    participants,
    formFactor,
    viewMode: options.viewMode ?? null,
    pinnedParticipantId: options.pinned ?? null,
    activeSpeakerId: options.speaker ?? null,
  });
}

describe('selectCallLayout', () => {
  it('shows a phone 1:1 call as the other person with your own view as a small picture', () => {
    expect(layoutFor([me, person('ada')], 'phone-portrait')).toEqual({
      kind: 'self-view',
      mainId: 'ada',
      selfId: 'me',
    });
  });

  it('keeps the small picture when the person picks Grid on a phone 1:1 call', () => {
    expect(layoutFor([me, person('ada')], 'phone-portrait', { viewMode: 'grid' }).kind).toBe('self-view');
  });

  it('fills a phone with one column for yourself alone', () => {
    expect(layoutFor([me], 'phone-portrait')).toEqual({ kind: 'grid', ids: ['me'], columns: 1 });
  });

  it('uses a 2-column grid for 3 and 4 people on a phone', () => {
    expect(layoutFor([me, person('ada'), person('bob')], 'phone-portrait')).toEqual({
      kind: 'grid',
      ids: ['me', 'ada', 'bob'],
      columns: 2,
    });
    expect(layoutFor([me, person('ada'), person('bob'), person('cy')], 'phone-portrait')).toMatchObject({
      kind: 'grid',
      columns: 2,
    });
  });

  it('switches a phone to the speaker layout from 5 people, with the speaker on stage', () => {
    const people = [me, person('ada'), person('bob'), person('cy'), person('dee')];
    expect(layoutFor(people, 'phone-portrait', { speaker: 'cy' })).toEqual({
      kind: 'speaker',
      mainId: 'cy',
      stripIds: ['me', 'ada', 'bob', 'dee'],
    });
    expect(layoutFor(people, 'phone-portrait')).toMatchObject({ kind: 'speaker', mainId: 'ada' });
  });

  it('still shows a 2-column grid of 5 or more on a phone when the person picks Grid', () => {
    const people = [me, person('ada'), person('bob'), person('cy'), person('dee')];
    expect(layoutFor(people, 'phone-portrait', { viewMode: 'grid' })).toMatchObject({ kind: 'grid', columns: 2 });
  });

  it('fits the grid to the window shape on phone landscape and desktop', () => {
    for (const formFactor of ['phone-landscape', 'desktop'] as const) {
      expect(layoutFor([me, person('ada')], formFactor)).toEqual({ kind: 'grid', ids: ['me', 'ada'], columns: null });
      expect(
        layoutFor([me, person('ada'), person('bob'), person('cy'), person('dee'), person('eve')], formFactor),
      ).toMatchObject({ kind: 'grid', columns: null });
    }
  });

  it('puts a pinned person on stage in the speaker layout on every form factor', () => {
    for (const formFactor of ['phone-portrait', 'phone-landscape', 'desktop'] as const) {
      expect(layoutFor([me, person('ada'), person('bob')], formFactor, { pinned: 'bob', speaker: 'ada' })).toEqual({
        kind: 'speaker',
        mainId: 'bob',
        stripIds: ['me', 'ada'],
      });
    }
  });

  it('ignores a pin on someone who left', () => {
    expect(layoutFor([me, person('ada'), person('bob')], 'desktop', { pinned: 'gone' }).kind).toBe('grid');
  });

  it('lets a screen share take the stage with the people in a strip', () => {
    for (const formFactor of ['phone-portrait', 'phone-landscape', 'desktop'] as const) {
      expect(layoutFor([me, person('ada'), screenOf('ada')], formFactor, { speaker: 'ada' })).toEqual({
        kind: 'speaker',
        mainId: 'ada-screen',
        stripIds: ['me', 'ada'],
      });
    }
  });

  it('keeps your own screen share off the stage', () => {
    const ownScreen = { id: 'me-screen', isLocal: true, screenShareOf: 'me' };
    expect(layoutFor([me, ownScreen, person('ada')], 'desktop').kind).toBe('grid');
  });

  it('keeps the grid during a screen share when the person picks Grid', () => {
    expect(layoutFor([me, person('ada'), screenOf('ada')], 'desktop', { viewMode: 'grid' }).kind).toBe('grid');
  });

  it('shows the speaker layout when the person picks Speaker, with someone else on stage by default', () => {
    expect(layoutFor([me, person('ada'), person('bob')], 'desktop', { viewMode: 'speaker' })).toEqual({
      kind: 'speaker',
      mainId: 'ada',
      stripIds: ['me', 'bob'],
    });
    expect(layoutFor([me, person('ada')], 'phone-portrait', { viewMode: 'speaker', speaker: 'me' })).toMatchObject({
      kind: 'speaker',
      mainId: 'me',
    });
  });

  it('shows an empty grid without participants', () => {
    expect(layoutFor([], 'desktop')).toEqual({ kind: 'grid', ids: [], columns: null });
  });
});

describe('pin and layout choice', () => {
  const automatic: MeetingLayoutState = { viewMode: null, pinnedParticipantId: null, viewModeBeforePin: null };

  it('pins the tapped person in the speaker layout', () => {
    expect(layoutAfterTileClick(automatic, 'ada')).toEqual({
      viewMode: 'speaker',
      pinnedParticipantId: 'ada',
      viewModeBeforePin: null,
    });
  });

  it('unpins the pinned person and returns to the previous layout', () => {
    const grid = { ...automatic, viewMode: 'grid' as const };
    expect(layoutAfterTileClick(layoutAfterTileClick(grid, 'ada'), 'ada')).toEqual(grid);
    expect(layoutAfterTileClick(layoutAfterTileClick(automatic, 'ada'), 'ada')).toEqual(automatic);
  });

  it('moves the pin to another person and still remembers the layout from before the first pin', () => {
    const grid = { ...automatic, viewMode: 'grid' as const };
    const moved = layoutAfterTileClick(layoutAfterTileClick(grid, 'ada'), 'bob');
    expect(moved).toEqual({ viewMode: 'speaker', pinnedParticipantId: 'bob', viewModeBeforePin: 'grid' });
    expect(layoutAfterTileClick(moved, 'bob')).toEqual(grid);
  });

  it('drops the pin when the person picks Grid, and keeps it for Speaker', () => {
    const pinned = layoutAfterTileClick(automatic, 'ada');
    expect(layoutAfterViewModeChoice(pinned, 'grid')).toEqual({ ...automatic, viewMode: 'grid' });
    expect(layoutAfterViewModeChoice(pinned, 'speaker')).toEqual(pinned);
  });

  it('returns to the previous layout when the pinned person leaves', () => {
    expect(layoutWithoutPin(layoutAfterTileClick(automatic, 'ada'))).toEqual(automatic);
    expect(layoutWithoutPin(automatic)).toEqual(automatic);
  });
});

describe('callFormFactor', () => {
  it('tells phone portrait, phone landscape and desktop apart by the window shape', () => {
    expect(callFormFactor(390, 844)).toBe('phone-portrait');
    expect(callFormFactor(844, 390)).toBe('phone-landscape');
    expect(callFormFactor(700, 500)).toBe('phone-landscape');
    expect(callFormFactor(1280, 800)).toBe('desktop');
    expect(callFormFactor(1024, 1366)).toBe('desktop');
  });

  it('uses the phone layout for a narrow desktop window', () => {
    expect(callFormFactor(600, 900)).toBe('phone-portrait');
  });
});

describe('fitGridColumns', () => {
  it('picks the column count whose cells best fit the window shape', () => {
    expect(fitGridColumns(1, 1200, 700, 12)).toBe(1);
    expect(fitGridColumns(2, 1200, 500, 12)).toBe(2);
    expect(fitGridColumns(2, 500, 1000, 12)).toBe(1);
    expect(fitGridColumns(4, 1200, 700, 12)).toBe(2);
    expect(fitGridColumns(6, 1600, 800, 12)).toBe(3);
    expect(fitGridColumns(0, 1200, 700, 12)).toBe(1);
  });
});

describe('gridCells', () => {
  it('fills the whole area with equal cells', () => {
    expect(gridCells(4, 2, 400, 600, 10, false)).toEqual([
      { left: 0, top: 0, width: 195, height: 295 },
      { left: 205, top: 0, width: 195, height: 295 },
      { left: 0, top: 305, width: 195, height: 295 },
      { left: 205, top: 305, width: 195, height: 295 },
    ]);
  });

  it('stretches a short last row across the width, or centres it', () => {
    expect(gridCells(3, 2, 400, 600, 10, true)[2]).toEqual({ left: 0, top: 305, width: 400, height: 295 });
    expect(gridCells(3, 2, 400, 600, 10, false)[2]).toEqual({ left: 102.5, top: 305, width: 195, height: 295 });
  });

  it('returns no cells for an unmeasured area', () => {
    expect(gridCells(2, 1, 0, 0, 10, false)).toEqual([]);
  });
});

describe('nearestCorner', () => {
  it('snaps a point to the closest corner of the area', () => {
    expect(nearestCorner(10, 10, 400, 800)).toBe('top-left');
    expect(nearestCorner(390, 20, 400, 800)).toBe('top-right');
    expect(nearestCorner(30, 700, 400, 800)).toBe('bottom-left');
    expect(nearestCorner(300, 500, 400, 800)).toBe('bottom-right');
  });
});

describe('mainVideoFills', () => {
  it('fills the stage only when the video has its orientation and full screen is off', () => {
    expect(mainVideoFills(9 / 16, 390, 700, false)).toBe(true);
    expect(mainVideoFills(16 / 9, 1200, 700, false)).toBe(true);
    expect(mainVideoFills(16 / 9, 390, 700, false)).toBe(false);
    expect(mainVideoFills(9 / 16, 390, 700, true)).toBe(false);
  });
});

describe('fitTilesInRows', () => {
  const widthOf = (aspects: number[], rows: ReturnType<typeof fitTilesInRows>, gap: number) =>
    rows.map(
      (row) =>
        row.indices.reduce((sum, index) => sum + row.height * aspects[index]!, 0) + gap * (row.indices.length - 1),
    );

  it('keeps a single landscape video as large as the area allows', () => {
    expect(fitTilesInRows([16 / 9], 360, 600, 8)).toEqual([{ indices: [0], height: 202 }]);
  });

  it('stacks two landscape videos on a portrait phone screen', () => {
    const rows = fitTilesInRows([16 / 9, 16 / 9], 360, 600, 8);
    expect(rows.map((row) => row.indices)).toEqual([[0], [1]]);
  });

  it('puts a portrait and a landscape video side by side when that makes them larger', () => {
    const aspects = [9 / 16, 16 / 9];
    const rows = fitTilesInRows(aspects, 1200, 500, 12);
    expect(rows.map((row) => row.indices)).toEqual([[0, 1]]);
    expect(widthOf(aspects, rows, 12)[0]).toBeLessThanOrEqual(1200);
  });

  it('never overflows the area', () => {
    const aspects = [16 / 9, 9 / 16, 4 / 3, 16 / 9, 1];
    for (const [width, height] of [
      [360, 560],
      [768, 900],
      [1280, 700],
    ]) {
      const rows = fitTilesInRows(aspects, width, height, 8);
      expect(rows.flatMap((row) => row.indices)).toEqual([0, 1, 2, 3, 4]);
      for (const rowWidth of widthOf(aspects, rows, 8)) expect(rowWidth).toBeLessThanOrEqual(width);
      expect(rows.reduce((sum, row) => sum + row.height, 0) + 8 * (rows.length - 1)).toBeLessThanOrEqual(height);
    }
  });

  it('returns no rows for an empty or unmeasured area', () => {
    expect(fitTilesInRows([], 360, 600, 8)).toEqual([]);
    expect(fitTilesInRows([1], 0, 600, 8)).toEqual([]);
  });
});
