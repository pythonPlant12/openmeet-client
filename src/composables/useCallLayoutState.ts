import { computed, ref } from 'vue';

import {
  type MeetingLayoutState,
  type MeetingViewMode,
  layoutAfterTileClick,
  layoutAfterViewModeChoice,
  layoutWithoutPin,
} from '@/lib/meeting-layout';
import { playHaptic } from '@/services/haptics';

/**
 * The person's own layout choice and local pin on the call screen. Their own pin, unpin and layout changes play
 * a `selection` haptic; changes caused by other people, such as a screen share or someone leaving, play none.
 */
export function useCallLayoutState() {
  const state = ref<MeetingLayoutState>({ viewMode: null, pinnedParticipantId: null, viewModeBeforePin: null });

  function apply(next: MeetingLayoutState, haptic: boolean) {
    const current = state.value;
    const changed = next.viewMode !== current.viewMode || next.pinnedParticipantId !== current.pinnedParticipantId;
    state.value = next;
    if (changed && haptic) playHaptic('selection');
  }

  return {
    viewMode: computed(() => state.value.viewMode),
    pinnedParticipantId: computed(() => state.value.pinnedParticipantId),
    togglePin: (participantId: string) => apply(layoutAfterTileClick(state.value, participantId), true),
    setViewMode: (viewMode: MeetingViewMode) => apply(layoutAfterViewModeChoice(state.value, viewMode), true),
    /** Someone else's new screen share takes the stage, unless the person pinned someone themselves. */
    followScreenShare: () => {
      if (!state.value.pinnedParticipantId) apply({ ...state.value, viewMode: null }, false);
    },
    /** Drops the pin when that person leaves, returning to the layout from before it. */
    keepPinAmong: (participantIds: readonly string[]) => {
      const pinned = state.value.pinnedParticipantId;
      if (pinned && !participantIds.includes(pinned)) apply(layoutWithoutPin(state.value), false);
    },
  };
}
