<script setup lang="ts">
import { Info, Phone, PhoneOff, UserRound, Video } from 'lucide-vue-next';
import { motion } from 'motion-v';
import { computed } from 'vue';

import sidebarSectionControlUrl from '@/assets/sidebar-section-control.svg';
import { Button } from '@/components/ui/button';
import { LoadingRipple } from '@/components/ui/loading';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { formatDuration, meetingDuration, meetingTitle, meetingType, participantCountLabel } from '@/lib/meetings';
import type { CallsPanel } from '@/pages/dashboard-group-state';
import type { MeetingPerson, MeetingSession } from '@/services/social-api';

const props = defineProps<{
  panel: CallsPanel;
  meetings: MeetingSession[];
  isLoading: boolean;
  error: string;
  hasMore: boolean;
  isLoadingMore: boolean;
  now: number;
  avatarFor: (person: MeetingPerson) => string | undefined;
  /** Who is calling: a person or a group name. Null while nothing rings. */
  ringingName: string | null;
  /** More calls ringing behind the one shown. */
  ringingMore: number;
  isAnswering: boolean;
  callingId: string | null;
}>();
const emit = defineEmits<{
  (eventName: 'drag-end', pointerEvent: PointerEvent, info: { offset: { y: number }; velocity: { y: number } }): void;
  (eventName: 'wheel', wheelEvent: WheelEvent): void;
  (event: 'toggle'): void;
  (event: 'open', meeting: MeetingSession): void;
  (event: 'call', meeting: MeetingSession): void;
  (event: 'accept'): void;
  (event: 'decline'): void;
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
    class="flex min-h-0 flex-col overflow-hidden border-t border-[#E5EFEC] p-3 transition-[flex-basis,flex-grow,opacity,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
    :class="panel === 'top' ? 'flex-1' : panel === 'middle' ? 'shrink-0 basis-[45%]' : 'shrink-0 basis-20'"
    aria-labelledby="calls-heading"
  >
    <div
      v-if="ringingName"
      data-incoming-call
      role="alert"
      class="calls-ringing -mx-1 flex shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#0B7A75] to-[#2DA58F] py-2 pl-3 pr-2 text-white"
    >
      <h2 id="calls-heading" class="sr-only">Calls</h2>
      <!-- The banner takes the header's place, so pressing the caller still opens or closes the list. -->
      <button
        type="button"
        data-incoming-toggle
        class="flex min-w-0 flex-1 items-center gap-2 text-left"
        :aria-expanded="expanded"
        :aria-label="`${expanded ? 'Hide' : 'Show'} calls`"
        @click="emit('toggle')"
      >
        <span class="calls-ringing-icon flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20"
          ><Phone class="size-4"
        /></span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-semibold" data-incoming-caller>{{ ringingName }}</span>
          <span class="block truncate text-[11px] text-white/80"
            >Calling you<template v-if="ringingMore"> · {{ ringingMore }} more</template></span
          >
        </span>
      </button>
      <LoadingRipple v-if="isAnswering" class="size-5 text-white" />
      <template v-else>
        <button
          type="button"
          data-incoming-decline
          class="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#C4513D] text-white transition-colors [@media(hover:hover)]:hover:bg-[#A9412F]"
          aria-label="Decline call"
          title="Decline"
          @click="emit('decline')"
        >
          <PhoneOff class="size-4" />
        </button>
        <button
          type="button"
          data-incoming-accept
          class="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0B7A75] transition-colors [@media(hover:hover)]:hover:bg-[#E6F4F1] [@media(hover:hover)]:hover:text-[#102F35]"
          aria-label="Answer call"
          title="Answer"
          @click="emit('accept')"
        >
          <Phone class="size-4" />
        </button>
      </template>
    </div>
    <div v-else class="flex min-h-8 items-center justify-between gap-2 px-2">
      <motion.h2
        id="calls-heading"
        drag="y"
        :drag-constraints="{ top: 0, bottom: 0 }"
        :drag-elastic="0.08"
        :drag-momentum="false"
        role="button"
        tabindex="0"
        :aria-expanded="expanded"
        class="-my-2 flex flex-1 touch-none cursor-ns-resize items-center gap-2 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#61777B]"
        @drag-end="(event, info) => emit('drag-end', event, info)"
        @click="emit('toggle')"
        @wheel.prevent="emit('wheel', $event)"
        @keydown.enter.prevent="emit('toggle')"
        @keydown.space.prevent="emit('toggle')"
        ><img :src="sidebarSectionControlUrl" alt="" class="size-4 opacity-60" /><span>Calls</span></motion.h2
      >
    </div>
    <div
      class="mt-1 min-h-0 flex-1 overflow-y-auto transition-opacity duration-300 motion-reduce:transition-none"
      :class="expanded ? 'opacity-100' : 'pointer-events-none h-0 flex-none opacity-0'"
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
              :leading-width="SWIPE_ACTION_WIDTH"
              :trailing-width="SWIPE_ACTION_WIDTH"
              full-swipe-leading
              @full-swipe-leading="emit('call', meeting)"
            >
              <template #leading="{ armed, close }">
                <button
                  type="button"
                  data-swipe-action
                  class="flex h-full w-full items-center justify-start text-white transition-colors"
                  :class="armed ? 'bg-[#08635F]' : 'bg-[#0B7A75]'"
                  aria-label="Call again"
                  @click="
                    close();
                    emit('call', meeting);
                  "
                >
                  <span class="flex w-20 shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
                    ><Phone class="size-4" />Call</span
                  >
                </button>
              </template>
              <template #trailing="{ close }">
                <button
                  type="button"
                  data-swipe-action
                  class="flex h-full w-full items-center justify-end bg-[#E6F4F1] text-[#102F35]"
                  aria-label="Call details"
                  @click="
                    close();
                    emit('open', meeting);
                  "
                >
                  <span class="flex w-20 shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
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
                    class="absolute flex size-8 items-center justify-center overflow-hidden rounded-full border-2 border-[#FBFCF8] bg-[#DDF1ED] text-[10px] font-semibold text-[#0B7A75]"
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
                    class="flex size-8 items-center justify-center rounded-full bg-[#DDF1ED] text-[#0B7A75]"
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
                  <span class="mt-0.5 flex items-center gap-1 truncate text-[11px] text-[#61777B]"
                    ><component :is="meetingType(meeting).icon" class="size-3 shrink-0" aria-hidden="true" />{{
                      formatTime(meeting.startedAt)
                    }}
                    · {{ durationOf(meeting) }} · {{ participantCountLabel(meeting.participantCount) }}</span
                  >
                </span>
                <LoadingRipple v-if="callingId === meeting.id" class="size-4 text-[#0B7A75]" />
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

<style scoped>
/* A ringing call buzzes like a phone: a short shake, a pause, and a soft green pulse. */
.calls-ringing {
  animation:
    calls-ring-buzz 1.6s ease-in-out infinite,
    calls-ring-pulse 1.6s ease-out infinite;
}
.calls-ringing-icon {
  animation: calls-ring-wiggle 1.6s ease-in-out infinite;
}
@keyframes calls-ring-buzz {
  0%,
  40%,
  100% {
    transform: translateX(0);
  }
  5%,
  15%,
  25%,
  35% {
    transform: translateX(-2px);
  }
  10%,
  20%,
  30% {
    transform: translateX(2px);
  }
}
@keyframes calls-ring-wiggle {
  0%,
  40%,
  100% {
    transform: rotate(0);
  }
  8%,
  24% {
    transform: rotate(-16deg);
  }
  16%,
  32% {
    transform: rotate(16deg);
  }
}
@keyframes calls-ring-pulse {
  0% {
    box-shadow: 0 0 0 0 rgb(45 165 143 / 0.55);
  }
  70%,
  100% {
    box-shadow: 0 0 0 10px rgb(45 165 143 / 0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .calls-ringing,
  .calls-ringing-icon {
    animation: none;
  }
}
</style>
