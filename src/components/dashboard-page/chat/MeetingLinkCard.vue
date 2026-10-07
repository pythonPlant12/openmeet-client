<script setup lang="ts">
import { useNow } from '@vueuse/core';
import { ChevronRight, Video } from 'lucide-vue-next';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useMeetingRoomSummary } from '@/composables/useMeetingRoomSummary';
import { formatDuration, meetingDuration, participantCountLabel } from '@/lib/meetings';
import type { MeetingReference } from '@/lib/message-links';

const props = defineProps<{ reference: MeetingReference; local: boolean }>();

const route = useRoute();
const router = useRouter();
const state = useMeetingRoomSummary(computed(() => props.reference.roomRef));
const now = useNow({ interval: 30_000 });
const summary = computed(() => state.value.summary);
// A bare ID is only a meeting once the server knows it; a room link is always one.
const visible = computed(() => props.reference.fromLink || state.value.status === 'ready');
const isLive = computed(() => summary.value?.status === 'live');
// Without details (signed-out guests, or a failed request) the card stays a plain link to the room.
const statusLabel = computed(() => {
  if (summary.value) return isLive.value ? 'Live' : 'Ended';
  if (state.value.status === 'loading') return 'Checking';
  return state.value.status === 'missing' ? 'Not started' : null;
});
const details = computed(() => {
  const current = summary.value;
  if (!current) {
    if (state.value.status === 'loading') return 'Loading meeting details';
    return state.value.status === 'missing' ? 'No one has joined yet' : 'Open the meeting room';
  }
  const duration = formatDuration(meetingDuration(current.startedAt, current.endedAt, now.value.getTime()));
  return current.status === 'live'
    ? `${current.liveParticipantCount} in the call · ${duration}`
    : `${participantCountLabel(current.participantCount)} · ${duration}`;
});
const actionLabel = computed(() => (summary.value?.status === 'ended' ? 'Open' : 'Join'));

function openMeeting() {
  // Following a link from inside a meeting would end that call, so it opens beside it instead.
  if (route.name === 'meeting') window.open(props.reference.route, '_blank', 'noopener');
  else void router.push(props.reference.route);
}
</script>

<template>
  <button
    v-if="visible"
    type="button"
    data-meeting-card
    :data-meeting-status="summary?.status ?? state.status"
    class="mt-1.5 flex w-full min-w-[13rem] items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors"
    :class="
      local
        ? 'bg-white/[0.14] text-white [@media(hover:hover)]:hover:bg-white/20'
        : 'bg-[#F1F4F3] text-[#102F35] [@media(hover:hover)]:hover:bg-[#EAEFED]'
    "
    :aria-label="[`${actionLabel} OpenMeet meeting`, statusLabel, details].filter(Boolean).join('. ')"
    @click="openMeeting"
  >
    <span
      class="relative flex size-9 shrink-0 items-center justify-center rounded-full"
      :class="local ? 'bg-white text-[#0B7A75]' : 'bg-[#0B7A75] text-white'"
    >
      <Video class="size-4" />
      <span
        v-if="isLive"
        class="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 bg-[#2DA58F]"
        :class="local ? 'border-[#0B7A75]' : 'border-[#F1F4F3]'"
        aria-hidden="true"
      />
    </span>
    <span class="min-w-0 flex-1">
      <span class="flex items-center gap-1.5 text-xs font-semibold">
        OpenMeet meeting
        <span
          v-if="statusLabel"
          class="rounded-full px-1.5 py-px text-[0.625rem] font-bold uppercase tracking-wide"
          :class="
            isLive
              ? local
                ? 'bg-white text-[#0B7A75]'
                : 'bg-[#EAF7F4] text-[#17645F]'
              : local
                ? 'bg-white/20 text-white'
                : 'bg-[#E5EFEC] text-[#4E6B70]'
          "
          >{{ statusLabel }}</span
        >
      </span>
      <span class="mt-0.5 block truncate text-xs" :class="local ? 'text-white/80' : 'text-[#61777B]'">{{
        details
      }}</span>
    </span>
    <span
      class="flex shrink-0 items-center gap-0.5 text-xs font-bold"
      :class="local ? 'text-white' : 'text-[#0B7A75]'"
      aria-hidden="true"
      >{{ actionLabel }}<ChevronRight class="size-3.5"
    /></span>
  </button>
</template>
