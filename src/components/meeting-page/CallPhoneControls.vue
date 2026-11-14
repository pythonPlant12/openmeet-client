<script setup lang="ts">
import { useElementSize } from '@vueuse/core';
import {
  Bug,
  Check,
  ChevronRight,
  Code,
  LayoutGrid,
  MessageSquare,
  PhoneOff,
  ScanEye,
  ScanFace,
  SquareUser,
  UserRoundPlus,
} from 'lucide-vue-next';
import { computed, onBeforeUnmount, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';

import { buildGitHubIssueUrl } from '@/lib/github-issue';
import { swallowNextClick } from '@/lib/swallow-next-click';
import { playHaptic } from '@/services/haptics';

import MeetingMediaControl from './MeetingMediaControl.vue';
import MeetingScreenShareControl from './MeetingScreenShareControl.vue';

// The phone call screen's bottom bar: camera, mic, share and leave in thumb reach. Its handle (or a swipe up on
// the bar) reveals a panel with the rest of the controls and settings, which snaps open or closed. The panel
// grows under the bar, so the bar rides up with the drag and stays on top of the card.
defineProps<{
  audioAvailable: boolean;
  videoAvailable: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  canPresent: boolean;
  viewMode: 'grid' | 'speaker';
  /** The panel's Invite people row shows only where inviting is possible. */
  canInvite: boolean;
  /** Your own tile shows in the call screen. */
  showOwnCamera?: boolean;
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
  (e: 'toggle-stats'): void;
  (e: 'toggle-chat'): void;
  (e: 'invite'): void;
  (e: 'toggle-own-camera'): void;
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

// The top bar's room name opens the panel too.
defineExpose({ open: () => setOpen(true) });

/** A panel row that does one thing closes the panel, so its result is in view. */
function fromPanel(action: () => void) {
  setOpen(false);
  action();
}

function onLeave() {
  playHaptic('medium');
  emit('end-call');
}
</script>

<template>
  <!-- While the panel is open, a tap anywhere else only closes it and presses nothing underneath. -->
  <div
    v-if="isOpen"
    class="fixed inset-0 z-40 touch-none"
    aria-hidden="true"
    data-controls-backdrop
    @pointerdown.prevent
    @click="setOpen(false)"
  />
  <div
    class="marketing-font pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-harbor-ink"
  >
    <div
      ref="card"
      class="call-tray pointer-events-auto flex w-full max-w-md flex-col items-stretch overflow-hidden rounded-[1.5rem] p-0"
      data-call-phone-controls
      :data-state="isOpen ? 'open' : 'closed'"
    >
      <button
        type="button"
        class="order-1 flex h-5 w-full touch-none items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-harbor-subtle"
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
        class="order-2 flex touch-none items-center justify-between px-4 pb-3"
        data-controls-bar
        @pointerdown="onPointerDown"
      >
        <MeetingMediaControl
          kind="video"
          variant="toggle"
          :off="isVideoOff"
          :available="videoAvailable"
          :warning="videoWarning"
          @toggle="emit('toggle-video')"
          @request-access="emit('request-access', 'video')"
          @media-changed="emit('media-changed')"
        />
        <MeetingMediaControl
          kind="audio"
          variant="toggle"
          :off="isMuted"
          :available="audioAvailable"
          :warning="audioWarning"
          @toggle="emit('toggle-mute')"
          @request-access="emit('request-access', 'audio')"
          @media-changed="emit('media-changed')"
        />
        <MeetingScreenShareControl
          v-if="canPresent"
          @start="emit('start-screen-share')"
          @start-area="emit('start-screen-share', { selectArea: true })"
          @stop="emit('stop-screen-share')"
        />
        <button
          type="button"
          class="call-button call-button-leave w-[var(--meeting-control-size)]"
          :aria-label="t('meeting.controls.endCall')"
          @click="onLeave"
        >
          <PhoneOff />
        </button>
      </div>

      <div
        :id="panelId"
        class="order-3 overflow-hidden"
        :class="draggedHeight === null ? 'transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''"
        :style="{ height: `${revealedHeight}px` }"
        :inert="!isOpen || undefined"
        data-controls-panel
      >
        <div ref="panelContent" class="max-h-[55dvh] space-y-3 overflow-y-auto overscroll-contain px-3 pb-3">
          <div class="call-panel-group">
            <button
              type="button"
              class="call-panel-row"
              data-panel-row="chat"
              @click="fromPanel(() => emit('toggle-chat'))"
            >
              <MessageSquare class="call-panel-row-icon" />
              <span class="flex-1 text-left">{{ t('meeting.controls.showChat') }}</span>
            </button>
          </div>

          <div class="call-panel-group">
            <MeetingMediaControl
              kind="audio"
              variant="row"
              :off="isMuted"
              :available="audioAvailable"
              @media-changed="emit('media-changed')"
            />
            <MeetingMediaControl
              kind="video"
              variant="row"
              :off="isVideoOff"
              :available="videoAvailable"
              @media-changed="emit('media-changed')"
              @preview-camera="fromPanel(() => emit('preview-camera'))"
            />
            <button
              type="button"
              class="call-panel-row"
              data-panel-row="preview-camera"
              @click="fromPanel(() => emit('preview-camera'))"
            >
              <ScanEye class="call-panel-row-icon" />
              <span class="flex-1 text-left">{{ t('meeting.controls.previewCamera') }}</span>
            </button>
          </div>

          <div class="call-panel-group p-2">
            <h3 class="px-1 pb-2 text-xs font-semibold text-harbor-muted">{{ t('meeting.actions.layout') }}</h3>
            <div role="radiogroup" :aria-label="t('meeting.actions.layout')" class="grid grid-cols-2 gap-2">
              <button
                v-for="layout in layouts"
                :key="layout.mode"
                type="button"
                role="radio"
                :aria-checked="viewMode === layout.mode"
                class="flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors"
                :class="viewMode === layout.mode ? 'bg-harbor-line text-harbor-ink' : 'text-harbor-ink-soft'"
                @click="emit('set-view-mode', layout.mode)"
              >
                <component :is="layout.icon" class="size-4" />{{ layout.label }}
              </button>
            </div>
          </div>

          <div class="call-panel-group">
            <button
              type="button"
              role="switch"
              :aria-checked="showOwnCamera"
              class="call-panel-row"
              data-panel-row="own-camera"
              @click="emit('toggle-own-camera')"
            >
              <SquareUser class="call-panel-row-icon" />
              <span class="flex-1 text-left">{{ t('meeting.controls.showOwnCamera') }}</span>
              <span
                aria-hidden="true"
                class="relative h-6 w-10 shrink-0 rounded-full transition-colors"
                :class="showOwnCamera ? 'bg-harbor-accent' : 'bg-harbor-line'"
              >
                <span
                  class="absolute top-0.5 size-5 rounded-full bg-white shadow-harbor-soft transition-[left]"
                  :class="showOwnCamera ? 'left-[1.125rem]' : 'left-0.5'"
                />
              </span>
            </button>
          </div>

          <div v-if="canInvite" class="call-panel-group">
            <button
              type="button"
              class="call-panel-row"
              data-panel-row="invite"
              @click="fromPanel(() => emit('invite'))"
            >
              <UserRoundPlus class="call-panel-row-icon" />
              <span class="flex-1 text-left">{{ t('meeting.controls.invitePeople') }}</span>
              <ChevronRight class="size-4 text-harbor-icon" aria-hidden="true" />
            </button>
          </div>

          <div class="call-panel-group">
            <button
              type="button"
              role="switch"
              :aria-checked="showConnectionStatus"
              class="call-panel-row"
              data-dev-tools
              @click="emit('toggle-stats')"
            >
              <Code class="call-panel-row-icon" />
              <span class="flex-1 text-left">{{ t('meeting.actions.devTools') }}</span>
              <Check v-if="showConnectionStatus" class="size-4" aria-hidden="true" />
            </button>
            <a :href="reportUrl" target="_blank" rel="noreferrer" class="call-panel-row">
              <Bug class="call-panel-row-icon" />{{ t('meeting.actions.reportBug') }}
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
