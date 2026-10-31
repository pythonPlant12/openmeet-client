<script setup lang="ts">
import { CheckCheck, EyeOff, Info, PhoneMissed, UserRound, Video } from 'lucide-vue-next';
import { computed } from 'vue';

import SectionBadge from '@/components/dashboard-page/SectionBadge.vue';
import { Button } from '@/components/ui/button';
import { LoadingRipple } from '@/components/ui/loading';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { formatDuration, meetingDuration, meetingTitle, meetingType, participantCountLabel } from '@/lib/meetings';
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
  (event: 'toggle-read', meeting: MeetingSession): void;
  (event: 'load-more'): void;
}>();
const SWIPE_ACTION_WIDTH = 80;

const expanded = computed(() => props.panel !== 'collapsed');
const sections = computed(() => {
  const groups: { label: string; meetings: MeetingSession[] }[] = [];
  for (const meeting of props.meetings) {
    const label = dayLabel(meeting.startedAt);
    const group = groups[groups.length - 1];
    if (group?.label === label) group.meetings.push(meeting);
    else groups.push({ label, meetings: [meeting] });
  }
  return groups;
});

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date(props.now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function durationOf(meeting: MeetingSession) {
  return formatDuration(meetingDuration(meeting.startedAt, meeting.endedAt, props.now));
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
    class="flex min-h-0 flex-col overflow-hidden border-t border-[#E5EFEC] px-3 pt-3 transition-[flex-basis,flex-grow,opacity,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
    :class="panel === 'top' ? 'flex-1' : 'shrink-0 pb-[calc(0.75rem+var(--sidebar-bottom-inset,0px))]'"
    aria-labelledby="calls-heading"
  >
    <div class="flex h-9 items-center justify-between gap-2 px-2">
      <h2
        id="calls-heading"
        class="flex flex-1 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#61777B]"
      >
        <span>Calls</span><SectionBadge :count="badge" singular="missed call" plural="missed calls" />
      </h2>
    </div>
    <div
      class="min-h-0 flex-1 overflow-y-auto transition-[flex-basis,flex-grow,margin,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      :class="
        expanded
          ? 'mt-1 pb-[calc(0.75rem+var(--sidebar-bottom-inset,0px))] opacity-100'
          : 'pointer-events-none mt-0 flex-none basis-0 opacity-0'
      "
      :aria-hidden="!expanded"
      data-calls-list
    >
      <div v-if="isLoading && !meetings.length" class="flex h-16 items-center justify-center">
        <LoadingRipple class="size-4 text-[#0B7A75]" />
      </div>
      <p v-else-if="error" class="mx-2 rounded-xl bg-[#FFF0EA] px-3 py-2.5 text-xs text-[#9D4636]">{{ error }}</p>
      <div
        v-else-if="!meetings.length"
        class="mx-2 mt-1 flex flex-col items-center rounded-2xl border border-dashed border-[#D8E7E3] bg-white px-4 py-6 text-center"
      >
        <span class="flex size-11 items-center justify-center rounded-full bg-[#E6F4F1] text-[#0B7A75]"
          ><Video class="size-5"
        /></span>
        <p class="mt-3 text-sm font-semibold">No calls yet</p>
        <p class="mt-1 text-xs leading-5 text-[#61777B]">Meetings and calls you join appear here.</p>
      </div>
      <template v-else>
        <section v-for="section in sections" :key="section.label">
          <h3 class="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A9C9E]">
            {{ section.label }}
          </h3>
          <div class="space-y-1">
            <SwipeableRow
              v-for="meeting in section.meetings"
              :id="`call-${meeting.id}`"
              :key="meeting.id"
              class="rounded-xl"
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
                  :class="armed ? 'bg-[#08635F]' : 'bg-[#0B7A75]'"
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
                  :class="armed ? 'bg-[#08635F]' : 'bg-[#0B7A75]'"
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
                  class="flex h-full w-full items-center justify-end bg-[#E6F4F1] text-[#102F35]"
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
              <button
                type="button"
                data-call-item
                class="harbor-ghost-action flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left"
                @click="emit('open', meeting)"
              >
                <span class="relative flex h-9 w-11 shrink-0 items-center">
                  <span
                    v-for="(person, index) in meeting.participants.slice(0, 2)"
                    :key="`${person.userId ?? person.name}-${index}`"
                    class="absolute flex size-8 items-center justify-center overflow-hidden rounded-[28%] border-2 border-[#FBFCF8] bg-[#DDF1ED] text-[10px] font-semibold text-[#0B7A75]"
                    :style="{ left: `${index * 12}px`, zIndex: 2 - index }"
                    ><img
                      v-if="avatarFor(person)"
                      :src="avatarFor(person)"
                      alt=""
                      class="size-full object-cover"
                    /><template v-else>{{ initials(person.name) }}</template></span
                  >
                  <span
                    v-if="!meeting.participants.length"
                    class="flex size-8 items-center justify-center rounded-[28%] bg-[#DDF1ED] text-[#0B7A75]"
                    ><UserRound class="size-4"
                  /></span>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-1.5">
                    <span class="truncate text-sm font-semibold">{{
                      meetingTitle(meeting.participants, meeting.participantCount)
                    }}</span>
                    <span
                      v-if="!meeting.endedAt"
                      class="shrink-0 rounded-full bg-[#EAF7F4] px-1.5 py-px text-[0.625rem] font-bold uppercase tracking-wide text-[#17645F]"
                      >Live</span
                    >
                  </span>
                  <span
                    v-if="meeting.missed"
                    data-call-missed
                    class="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold text-[#C4513D]"
                    ><PhoneMissed class="size-3 shrink-0" aria-hidden="true" />Missed ·
                    {{ formatTime(meeting.startedAt) }}</span
                  >
                  <span v-else class="mt-0.5 flex items-center gap-1 truncate text-[11px] text-[#61777B]"
                    ><component :is="meetingType(meeting).icon" class="size-3 shrink-0" aria-hidden="true" />{{
                      formatTime(meeting.startedAt)
                    }}
                    · {{ durationOf(meeting) }} · {{ participantCountLabel(meeting.participantCount) }}</span
                  >
                </span>
                <LoadingRipple v-if="callingId === meeting.id" class="size-4 text-[#0B7A75]" />
                <span
                  v-else-if="meeting.unread"
                  data-call-unread
                  class="size-2.5 shrink-0 rounded-full bg-[#0B7A75]"
                  role="img"
                  aria-label="Unread"
                />
              </button>
            </SwipeableRow>
          </div>
        </section>
        <div v-if="hasMore" class="flex justify-center py-2">
          <Button
            variant="ghost"
            size="sm"
            class="harbor-ghost-action rounded-full px-4 font-semibold text-[#0B7A75]"
            :disabled="isLoadingMore"
            @click="emit('load-more')"
          >
            <LoadingRipple v-if="isLoadingMore" size="sm" />
            <template v-else>Load earlier calls</template>
          </Button>
        </div>
      </template>
    </div>
  </section>
</template>
