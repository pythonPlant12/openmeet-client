import { describe, expect, it } from 'vitest';

import { fitTilesInRows, layoutAfterTileClick, mainVideoFills, speakerViewMainId } from '@/lib/meeting-layout';

describe('layoutAfterTileClick', () => {
  it('pins the clicked person and switches the grid to speaker view', () => {
    expect(layoutAfterTileClick({ viewMode: 'grid', pinnedParticipantId: null }, 'ada')).toEqual({
      viewMode: 'speaker',
      pinnedParticipantId: 'ada',
    });
  });

  it('pins another person in speaker view', () => {
    expect(layoutAfterTileClick({ viewMode: 'speaker', pinnedParticipantId: 'ada' }, 'bob')).toEqual({
      viewMode: 'speaker',
      pinnedParticipantId: 'bob',
    });
  });

  it('pins the shown speaker when nobody is pinned yet', () => {
    expect(layoutAfterTileClick({ viewMode: 'speaker', pinnedParticipantId: null }, 'ada')).toEqual({
      viewMode: 'speaker',
      pinnedParticipantId: 'ada',
    });
  });

  it('unpins the pinned person and stays in speaker view', () => {
    expect(layoutAfterTileClick({ viewMode: 'speaker', pinnedParticipantId: 'ada' }, 'ada')).toEqual({
      viewMode: 'speaker',
      pinnedParticipantId: null,
    });
  });
});

describe('speakerViewMainId', () => {
  it('shows the pinned person, else whoever speaks, else the first participant', () => {
    expect(speakerViewMainId(['ada', 'bob'], 'bob', 'ada')).toBe('bob');
    expect(speakerViewMainId(['ada', 'bob'], null, 'bob')).toBe('bob');
    expect(speakerViewMainId(['ada', 'bob'], 'gone', null)).toBe('ada');
    expect(speakerViewMainId([], null, null)).toBeNull();
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
