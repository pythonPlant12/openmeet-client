import { describe, expect, it } from 'vitest';

import { layoutAfterTileClick } from '@/lib/meeting-layout';

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

  it('returns to the grid when the pinned person is clicked', () => {
    expect(layoutAfterTileClick({ viewMode: 'speaker', pinnedParticipantId: 'ada' }, 'ada')).toEqual({
      viewMode: 'grid',
      pinnedParticipantId: null,
    });
  });
});
