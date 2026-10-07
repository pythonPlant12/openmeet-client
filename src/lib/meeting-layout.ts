export type MeetingViewMode = 'grid' | 'speaker';

export interface MeetingLayout {
  viewMode: MeetingViewMode;
  pinnedParticipantId: string | null;
}

/**
 * Layout after clicking a participant tile: in the grid it pins that person in speaker view, in speaker
 * view it pins someone else, and clicking the pinned person returns to the grid.
 */
export function layoutAfterTileClick(layout: MeetingLayout, participantId: string): MeetingLayout {
  if (layout.viewMode === 'grid') return { viewMode: 'speaker', pinnedParticipantId: participantId };
  if (layout.pinnedParticipantId === participantId) return { viewMode: 'grid', pinnedParticipantId: null };
  return { viewMode: 'speaker', pinnedParticipantId: participantId };
}
