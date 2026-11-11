<script setup lang="ts">
import { CheckCheck, EyeOff, Info, Phone, PhoneMissed, Plus, UserRound, UsersRound, Video } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import PaneHeader from '@/components/dashboard-page/PaneHeader.vue';
import SectionBadge from '@/components/dashboard-page/SectionBadge.vue';
import { Avatar } from '@/components/ui/avatar';
import { ListHeading, ListRow } from '@/components/ui/list-row';
import { LoadingRipple } from '@/components/ui/loading';
import { RoundButton } from '@/components/ui/round-button';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { formatListTime } from '@/lib/list-time';
import { callAgainTargets, formatDuration, meetingDuration, meetingTitle, meetingType } from '@/lib/meetings';
import type { CallsPanel } from '@/pages/dashboard-group-state';
import type { MeetingPerson, MeetingSession } from '@/services/social-api';

const props = defineProps<{
  panel: CallsPanel;
  /** Missed calls not read yet. */
  badge: number;
  meetings: MeetingSession[];
  isLoading: boolean;
  error: string;
  hasMore: boolean;
  isLoadingMore: boolean;
  now: number;
  avatarFor: (person: MeetingPerson) => string | undefined;
  callingId: string | null;
}>();
const emit = defineEmits<{
  (event: 'open', meeting: MeetingSession): void;
  (event: 'call', meeting: MeetingSession): void;
  (event: 'toggle-read', meeting: MeetingSession): void;
  (event: 'load-more'): void;
  (event: 'start-meeting'): void;
}>();
const SWIPE_ACTION_WIDTH = 80;

const query = ref('');
const expanded = computed(() => props.panel !== 'collapsed');
// Search matches the names and nicknames a call lists.
const visibleMeetings = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return props.meetings;
  return props.meetings.filter((meeting) =>
    meeting.participants.some(
      (person) => person.name.toLowerCase().includes(needle) || person.nickname?.toLowerCase().includes(needle),
    ),
  );
});

function otherPeople(meeting: MeetingSession) {
  return meeting.participants.filter((person) => !person.isYou);
}

function detailOf(meeting: MeetingSession) {
  return `${meetingType(meeting).label} · ${formatDuration(meetingDuration(meeting.startedAt, meeting.endedAt, props.now))}`;
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?'
  );
}
</script>

<template>
  <section
    data-calls-panel
    :data-panel="panel"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    aria-labelledby="calls-heading"
  >
    <PaneHeader v-model:query="query" title="Calls" heading-id="calls-heading" search-label="Search calls">
      <template #badge><SectionBadge :count="badge" singular="missed call" plural="missed calls" /></template>
      <template #trailing>
        <RoundButton
          tone="accent"
          aria-label="Start a meeting"
          title="Start a meeting"
          class="[&_svg]:!size-6"
          @click="emit('start-meeting')"
          ><Plus
        /></RoundButton>
      </template>
    </PaneHeader>
    <!-- On phones the workspace tabs float over the list, so its end scrolls clear of them. -->
    <div
      class="min-h-0 flex-1 overflow-y-auto px-2 pb-[calc(0.75rem+var(--sidebar-bottom-inset,0px))]"
      :class="expanded ? 'opacity-100' : 'pointer-events-none opacity-0'"
      :aria-hidden="!expanded"
      data-calls-list
    >
      <div v-if="isLoading && !meetings.length" class="flex h-16 items-center justify-center">
        <LoadingRipple class="size-5 text-harbor-icon" />
      </div>
      <p
        v-else-if="error"
        class="mx-1 mt-2 rounded-xl bg-harbor-danger-soft px-3 py-2.5 text-sm text-harbor-danger-strong"
      >
        {{ error }}
      </p>
      <div
        v-else-if="!meetings.length"
        class="mx-1 mt-2 flex flex-col items-center rounded-2xl bg-harbor-app px-4 py-8 text-center"
      >
        <span
          class="flex size-12 items-center justify-center rounded-full bg-harbor-surface text-harbor-icon shadow-harbor-soft"
          ><Video class="size-5"
        /></span>
        <p class="mt-3 text-sm font-semibold text-harbor-ink">No calls yet</p>
        <p class="mt-1 text-xs leading-5 text-harbor-muted">Meetings and calls you join appear here.</p>
      </div>
      <p v-else-if="!visibleMeetings.length" class="px-3 py-8 text-center text-sm text-harbor-muted">
        No calls match your search.
      </p>
      <section v-else>
        <ListHeading class="pt-1">Recent</ListHeading>
        <SwipeableRow
          v-for="meeting in visibleMeetings"
          :id="`call-${meeting.id}`"
          :key="meeting.id"
          :leading-width="meeting.missed ? SWIPE_ACTION_WIDTH : 0"
          :trailing-width="SWIPE_ACTION_WIDTH"
          :full-swipe-leading="meeting.missed"
          :full-swipe-trailing="meeting.unread"
          @full-swipe-leading="emit('toggle-read', meeting)"
          @full-swipe-trailing="emit('toggle-read', meeting)"
        >
          <template #leading="{ armed, close }">
            <button
              v-if="meeting.missed"
              type="button"
              data-swipe-action
              class="flex h-full w-full items-center justify-start text-white transition-colors"
              :class="armed ? 'bg-harbor-accent-hover' : 'bg-harbor-accent'"
              :aria-label="meeting.unread ? 'Mark call read' : 'Mark call unread'"
              @click="
                close();
                emit('toggle-read', meeting);
              "
            >
              <span
                class="flex w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
                ><CheckCheck v-if="meeting.unread" class="size-4" /><EyeOff v-else class="size-4" />
                {{ meeting.unread ? 'Read' : 'Unread' }}</span
              >
            </button>
          </template>
          <!-- Swiping an unread missed call left marks it read; read calls offer their details. -->
          <template #trailing="{ armed, close }">
            <button
              v-if="meeting.unread"
              type="button"
              data-swipe-action
              data-call-read-action
              class="flex h-full w-full items-center justify-end text-white transition-colors"
              :class="armed ? 'bg-harbor-accent-hover' : 'bg-harbor-accent'"
              aria-label="Mark call read"
              @click="
                close();
                emit('toggle-read', meeting);
              "
            >
              <span
                class="flex w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
                ><CheckCheck class="size-4" />Read</span
              >
            </button>
            <button
              v-else
              type="button"
              data-swipe-action
              class="flex h-full w-full items-center justify-end bg-harbor-hover text-harbor-ink"
              aria-label="Call details"
              @click="
                close();
                emit('open', meeting);
              "
            >
              <span
                class="flex w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
                ><Info class="size-4" />Info</span
              >
            </button>
          </template>
          <ListRow data-call-item @click="emit('open', meeting)">
            <template #avatar
              ><Avatar v-if="otherPeople(meeting).length > 1"><UsersRound /></Avatar
              ><Avatar
                v-else-if="otherPeople(meeting)[0]"
                :src="avatarFor(otherPeople(meeting)[0]!)"
                :initials="initials(otherPeople(meeting)[0]!.name)" /><Avatar v-else><UserRound /></Avatar
            ></template>
            <span :class="{ 'text-harbor-danger': meeting.missed }">{{
              meetingTitle(meeting.participants, meeting.participantCount)
            }}</span>
            <template #meta>
              <span
                v-if="!meeting.endedAt"
                class="rounded-full bg-harbor-accent px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-white"
                >Live</span
              ><time v-else>{{ formatListTime(Date.parse(meeting.startedAt), new Date(now)) }}</time>
            </template>
            <template #subtitle>
              <template v-if="meeting.missed"
                ><span data-call-missed class="flex items-center gap-1"
                  ><PhoneMissed class="size-3.5 shrink-0" aria-hidden="true" />Missed</span
                ></template
              ><template v-else
                ><component :is="meetingType(meeting).icon" class="size-3.5 shrink-0" aria-hidden="true" /><span
                  class="truncate"
                  >{{ detailOf(meeting) }}</span
                ></template
              >
            </template>
            <template #trailing>
              <LoadingRipple v-if="callingId === meeting.id" class="size-4 text-harbor-icon" />
              <span
                v-else-if="meeting.unread"
                data-call-unread
                class="size-2.5 shrink-0 rounded-full bg-harbor-accent"
                role="img"
                aria-label="Unread"
              />
            </template>
            <!-- Desktop only: call back and details on hover; touch opens the details, which can call back. -->
            <template #actions>
              <RoundButton
                v-if="callAgainTargets(meeting).length"
                tone="plain"
                size="sm"
                aria-label="Call again"
                title="Call again"
                :disabled="callingId !== null"
                @click.stop="emit('call', meeting)"
                ><Phone
              /></RoundButton>
              <RoundButton
                tone="plain"
                size="sm"
                aria-label="Show call info"
                title="Info"
                @click.stop="emit('open', meeting)"
                ><Info
              /></RoundButton>
            </template>
          </ListRow>
        </SwipeableRow>
        <div v-if="hasMore" class="flex justify-center py-3">
          <button
            type="button"
            class="harbor-ghost-action inline-flex h-9 items-center rounded-full bg-harbor-hover px-4 text-sm font-semibold text-harbor-ink"
            :disabled="isLoadingMore"
            @click="emit('load-more')"
          >
            <LoadingRipple v-if="isLoadingMore" size="sm" />
            <template v-else>Load earlier calls</template>
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
