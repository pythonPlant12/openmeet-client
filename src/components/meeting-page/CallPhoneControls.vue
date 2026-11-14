<script setup lang="ts">
import { onClickOutside, useElementSize } from '@vueuse/core';
import { Bug, Check, Code, LayoutGrid, MicOff, PhoneOff, Pin, PinOff, ScanFace } from 'lucide-vue-next';
import { computed, onBeforeUnmount, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';

import { RoundButton } from '@/components/ui/round-button';
import { buildGitHubIssueUrl } from '@/lib/github-issue';
import { swallowNextClick } from '@/lib/swallow-next-click';
import { playHaptic } from '@/services/haptics';
import type { Participant } from '@/xstate/machines/webrtc/types';

import MeetingMediaControl from './MeetingMediaControl.vue';
import MeetingScreenShareControl from './MeetingScreenShareControl.vue';

// The phone call screen's bottom bar: mic, camera, share and leave in thumb reach. Its handle (or a swipe up on
// the bar) reveals a panel with the rest of the controls and settings, which snaps open or closed.
defineProps<{
  audioAvailable: boolean;
  videoAvailable: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  canPresent: boolean;
  participants: Participant[];
  pinnedParticipantId: string | null;
  viewMode: 'grid' | 'speaker';
  showConnectionStatus: boolean;
  /** The call could not get the microphone or camera; its button shows a warning that asks again. */
  audioWarning?: boolean;
  videoWarning?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-mute'): void;
  (e: 'toggle-video'): void;
  (e: 'end-call'): void;
  (e: 'media-changed'): void;
  (e: 'preview-camera'): void;
  (e: 'request-access', kind: 'audio' | 'video'): void;
  (e: 'start-screen-share', options?: { selectArea: boolean }): void;
  (e: 'stop-screen-share'): void;
  (e: 'set-view-mode', mode: 'grid' | 'speaker'): void;
  (e: 'toggle-pin', participantId: string): void;
  (e: 'toggle-stats'): void;
}>();

const { t } = useI18n();
const panelId = `call-controls-panel-${useId()}`;
const reportUrl = buildGitHubIssueUrl('meeting');
const layouts = computed(() => [
  { mode: 'grid' as const, label: t('meeting.actions.grid'), icon: LayoutGrid },
  { mode: 'speaker' as const, label: t('meeting.actions.speaker'), icon: ScanFace },
]);

/** A press that moves this far is a drag of the panel, not a tap. */
const DRAG_THRESHOLD_PX = 6;
/** A flick this fast (px/ms) snaps in its direction, however far it went. */
const FLICK_VELOCITY = 0.4;

const card = ref<HTMLElement | null>(null);
const panelContent = ref<HTMLElement | null>(null);
const { height: panelHeight } = useElementSize(panelContent, undefined, { box: 'border-box' });
const isOpen = ref(false);
// While dragging, how much of the panel shows; null when it rests open or closed.
const draggedHeight = ref<number | null>(null);
const revealedHeight = computed(() => draggedHeight.value ?? (isOpen.value ? panelHeight.value : 0));

function setOpen(open: boolean) {
  if (open !== isOpen.value) playHaptic('selection');
  isOpen.value = open;
}

function toggleOpen() {
  setOpen(!isOpen.value);
}

onClickOutside(card, () => isOpen.value && setOpen(false), { ignore: ['[role="menu"]'] });

let drag: { startY: number; startHeight: number; lastY: number; lastTime: number; velocity: number } | null = null;
let isDragging = false;

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  // Menu triggers open on press; a swipe that starts on one stays theirs.
  if (event.target instanceof Element && event.target.closest('[aria-haspopup]')) return;
  drag = {
    startY: event.clientY,
    startHeight: revealedHeight.value,
    lastY: event.clientY,
    lastTime: event.timeStamp,
    velocity: 0,
  };
  isDragging = false;
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(event: PointerEvent) {
  if (!drag) return;
  const lift = drag.startY - event.clientY;
  if (!isDragging && Math.abs(lift) < DRAG_THRESHOLD_PX) return;
  isDragging = true;
  const elapsed = event.timeStamp - drag.lastTime;
  if (elapsed > 0) drag.velocity = (drag.lastY - event.clientY) / elapsed;
  drag.lastY = event.clientY;
  drag.lastTime = event.timeStamp;
  draggedHeight.value = Math.min(Math.max(drag.startHeight + lift, 0), panelHeight.value);
}

function onPointerUp() {
  stopListening();
  if (!drag) return;
  const { velocity } = drag;
  drag = null;
  if (!isDragging || draggedHeight.value === null) {
    draggedHeight.value = null;
    return;
  }
  isDragging = false;
  // The drag ends in a click on whatever is under the finger, which must not also toggle or press it.
  swallowNextClick();
  const open = Math.abs(velocity) >= FLICK_VELOCITY ? velocity > 0 : draggedHeight.value > panelHeight.value / 2;
  draggedHeight.value = null;
  setOpen(open);
}

function stopListening() {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
}

onBeforeUnmount(stopListening);

function onLeave() {
  playHaptic('medium');
  emit('end-call');
}
</script>

<template>
  <div
    class="marketing-font pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-harbor-ink"
  >
    <div
      ref="card"
      class="call-tray pointer-events-auto flex-col items-stretch w-full max-w-md overflow-hidden rounded-[1.5rem] p-0"
      data-call-phone-controls
      :data-state="isOpen ? 'open' : 'closed'"
    >
      <button
        type="button"
        class="flex h-5 w-full touch-none items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-harbor-subtle"
        :aria-label="t('meeting.controls.moreControls')"
        :aria-expanded="isOpen"
        :aria-controls="panelId"
        data-controls-handle
        @pointerdown="onPointerDown"
        @click="toggleOpen"
      >
        <span aria-hidden="true" class="h-1 w-9 rounded-full bg-harbor-line" />
      </button>

      <div
        :id="panelId"
        class="overflow-hidden"
        :class="draggedHeight === null ? 'transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''"
        :style="{ height: `${revealedHeight}px` }"
        :inert="!isOpen || undefined"
        data-controls-panel
      >
        <div ref="panelContent" class="max-h-[55dvh] overflow-y-auto overscroll-contain px-3 pb-2">
          <h3 class="px-1 pb-2 text-sm font-semibold text-harbor-muted">{{ t('meeting.actions.layout') }}</h3>
          <div role="radiogroup" :aria-label="t('meeting.actions.layout')" class="grid grid-cols-2 gap-2">
            <button
              v-for="layout in layouts"
              :key="layout.mode"
              type="button"
              role="radio"
              :aria-checked="viewMode === layout.mode"
              class="flex h-11 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-colors [@media(hover:hover)]:hover:bg-harbor-hover"
              :class="viewMode === layout.mode ? '!bg-harbor-hover text-harbor-ink' : 'text-harbor-ink-soft'"
              @click="emit('set-view-mode', layout.mode)"
            >
              <component :is="layout.icon" class="size-4" />{{ layout.label }}
            </button>
          </div>

          <h3 class="px-1 pb-1 pt-4 text-sm font-semibold text-harbor-muted">
            {{ t('meeting.actions.participantsCount', { count: participants.length }) }}
          </h3>
          <ul>
            <li
              v-for="participant in participants"
              :key="participant.id"
              class="flex min-h-11 items-center gap-2 border-b border-harbor-line px-1 last:border-b-0"
            >
              <span class="min-w-0 flex-1 truncate text-sm font-semibold">
                {{ participant.name }}
                <span v-if="participant.isLocal" class="font-normal text-harbor-muted">{{ t('meeting.you') }}</span>
              </span>
              <MicOff v-if="!participant.audioEnabled" class="size-4 shrink-0 text-harbor-danger" />
              <RoundButton
                tone="plain"
                size="sm"
                :aria-label="
                  t(pinnedParticipantId === participant.id ? 'meeting.participant.unpin' : 'meeting.participant.pin', {
                    name: participant.name,
                  })
                "
                :aria-pressed="pinnedParticipantId === participant.id"
                @click="emit('toggle-pin', participant.id)"
              >
                <PinOff v-if="pinnedParticipantId === participant.id" />
                <Pin v-else />
              </RoundButton>
            </li>
          </ul>

          <div class="mt-3 grid gap-1">
            <button
              type="button"
              role="switch"
              :aria-checked="showConnectionStatus"
              class="flex h-11 items-center gap-3 rounded-2xl px-2 text-sm font-semibold [@media(hover:hover)]:hover:bg-harbor-hover"
              data-dev-tools
              @click="emit('toggle-stats')"
            >
              <Code class="size-4 text-harbor-icon" />
              <span class="flex-1 text-left">{{ t('meeting.actions.devTools') }}</span>
              <Check v-if="showConnectionStatus" class="size-4" aria-hidden="true" />
            </button>
            <a
              :href="reportUrl"
              target="_blank"
              rel="noreferrer"
              class="flex h-11 items-center gap-3 rounded-2xl px-2 text-sm font-semibold [@media(hover:hover)]:hover:bg-harbor-hover"
            >
              <Bug class="size-4 text-harbor-icon" />{{ t('meeting.actions.reportBug') }}
            </a>
          </div>
        </div>
      </div>

      <div class="flex touch-none items-center justify-around gap-1 px-2 pb-2" @pointerdown="onPointerDown">
        <MeetingMediaControl
          kind="audio"
          :off="isMuted"
          :available="audioAvailable"
          :warning="audioWarning"
          @toggle="emit('toggle-mute')"
          @request-access="emit('request-access', 'audio')"
          @media-changed="emit('media-changed')"
        />
        <MeetingMediaControl
          kind="video"
          :off="isVideoOff"
          :available="videoAvailable"
          :warning="videoWarning"
          @toggle="emit('toggle-video')"
          @request-access="emit('request-access', 'video')"
          @media-changed="emit('media-changed')"
          @preview-camera="emit('preview-camera')"
        />
        <MeetingScreenShareControl
          v-if="canPresent"
          @start="emit('start-screen-share')"
          @start-area="emit('start-screen-share', { selectArea: true })"
          @stop="emit('stop-screen-share')"
        />
        <button
          type="button"
          class="call-button call-button-leave"
          :aria-label="t('meeting.controls.endCall')"
          @click="onLeave"
        >
          <PhoneOff />
        </button>
      </div>
    </div>
  </div>
</template>
