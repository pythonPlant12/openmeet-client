<script setup lang="ts">
import { useElementSize } from '@vueuse/core';
import { PhoneOff, SquareUser } from 'lucide-vue-next';
import { computed, onBeforeUnmount, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';

import { swallowNextClick } from '@/lib/swallow-next-click';
import { playHaptic } from '@/services/haptics';

import MeetingMediaControl from './MeetingMediaControl.vue';
import MeetingScreenShareControl from './MeetingScreenShareControl.vue';

// The phone call screen's bottom bar: camera, mic, share and leave in thumb reach. Its handle (or a swipe up on
// the bar) reveals a panel with the microphone and camera settings, which snaps open or closed. The panel grows
// under the bar, so the bar rides up with the drag and stays on top of the card. Chat, invite, and layout live
// outside it, in the top bar and on the tiles.
defineProps<{
  audioAvailable: boolean;
  videoAvailable: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  canPresent: boolean;
  /** Your own tile shows in the call screen. */
  showOwnCamera?: boolean;
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
  (e: 'toggle-own-camera'): void;
}>();

const { t } = useI18n();
const panelId = `call-controls-panel-${useId()}`;

/** A press that moves this far is a drag of the panel, not a tap. */
const DRAG_THRESHOLD_PX = 6;
/** A flick this fast (px/ms) snaps in its direction, however far it went. */
const FLICK_VELOCITY = 0.4;

const card = ref<HTMLElement | null>(null);
const panelContent = ref<HTMLElement | null>(null);
const { height: panelHeight } = useElementSize(panelContent, undefined, { box: 'border-box' });
const isOpen = ref(false);
// One of the panel's sections shows its settings at a time.
const openSection = ref<'audio' | 'video' | null>(null);
const sectionModel = (section: 'audio' | 'video') =>
  computed({
    get: () => openSection.value === section,
    set: (open: boolean) => {
      if (open) openSection.value = section;
      else if (openSection.value === section) openSection.value = null;
    },
  });
const audioExpanded = sectionModel('audio');
const videoExpanded = sectionModel('video');
// While dragging, how much of the panel shows; null when it rests open or closed.
const draggedHeight = ref<number | null>(null);
const revealedHeight = computed(() => draggedHeight.value ?? (isOpen.value ? panelHeight.value : 0));

function setOpen(open: boolean) {
  if (open !== isOpen.value) playHaptic('selection');
  isOpen.value = open;
  if (!open) openSection.value = null;
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
  <div
    class="marketing-font pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-harbor-ink"
  >
    <!-- While the panel is open, a tap anywhere else only closes it and presses nothing underneath. -->
    <div
      v-if="isOpen"
      class="pointer-events-auto fixed inset-0 touch-none"
      aria-hidden="true"
      data-controls-backdrop
      @pointerdown.prevent
      @click="setOpen(false)"
    />
    <div
      ref="card"
      class="call-tray pointer-events-auto relative flex w-full max-w-md flex-col items-stretch overflow-hidden rounded-[1.5rem] p-0"
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
            <MeetingMediaControl
              v-model:expanded="audioExpanded"
              kind="audio"
              variant="row"
              :off="isMuted"
              :available="audioAvailable"
              @media-changed="emit('media-changed')"
            />
          </div>

          <div class="call-panel-group">
            <MeetingMediaControl
              v-model:expanded="videoExpanded"
              kind="video"
              variant="row"
              :off="isVideoOff"
              :available="videoAvailable"
              @media-changed="emit('media-changed')"
              @preview-camera="fromPanel(() => emit('preview-camera'))"
            >
              <template #extra>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="showOwnCamera"
                  class="call-choice"
                  data-panel-row="own-camera"
                  @click="emit('toggle-own-camera')"
                >
                  <SquareUser class="size-4 shrink-0 text-harbor-icon" aria-hidden="true" />
                  <span class="flex-1 text-left">{{ t('meeting.controls.showOwnCamera') }}</span>
                  <span
                    aria-hidden="true"
                    class="relative h-6 w-10 shrink-0 rounded-full transition-colors"
                    :class="showOwnCamera ? 'bg-harbor-accent' : 'bg-harbor-ink/15'"
                  >
                    <span
                      class="absolute top-0.5 size-5 rounded-full bg-white shadow-harbor-soft transition-[left]"
                      :class="showOwnCamera ? 'left-[1.125rem]' : 'left-0.5'"
                    />
                  </span>
                </button>
              </template>
            </MeetingMediaControl>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
