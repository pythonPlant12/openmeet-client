<script setup lang="ts">
import { ArrowUp, ChevronLeft, ChevronUp, Lock, Mic, Pause, Play, Trash2 } from 'lucide-vue-next';
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';

import { toast } from '@/components/ui/toast';
import { useVoicePlayback } from '@/composables/useVoicePlayback';
import { type VoiceRecorderFrame, type VoiceRecording, useVoiceRecorder } from '@/composables/useVoiceRecorder';
import { playHaptic, prepareHaptics } from '@/services/haptics';

import VoiceWaveform from './VoiceWaveform.vue';
import { formatRecordingTime, formatVoiceDuration } from './voice-message';

// The composer's microphone button. Hold to record and release to send; slide left to cancel or up
// to lock, then send or stop to listen before sending. Its bar covers the composer row (the parent
// form is `relative`), and the button stays in the row so pointer capture survives every state.
const props = defineProps<{
  disabled: boolean;
  prefersReducedMotion: boolean;
  /** False while the composer offers its send button instead; the recorder stays mounted. */
  visible: boolean;
}>();
const emit = defineEmits<{ (event: 'send', file: File): void }>();
const active = defineModel<boolean>('active', { default: false });

type RecorderState = 'idle' | 'pressing' | 'holding' | 'locked' | 'preview';

// A press shorter than this is a tap, which only explains the gesture.
const HOLD_DELAY_MS = 180;
const CANCEL_DISTANCE = 110;
const LOCK_DISTANCE = 80;
const MIN_DURATION_MS = 600;
const MAX_DURATION_MS = 10 * 60 * 1000;
// Live waveform bars: 2px wide every 4px, in the Harbor teal.
const LIVE_BAR_WIDTH = 2;
const LIVE_BAR_PITCH = 4;
const LIVE_BAR_COLOR = '#0B7A75';
// The slide hint follows the finger at this fraction of its travel.
const SLIDE_HINT_FOLLOW = 0.6;
const LOCK_HINT_FOLLOW = 0.35;

const state = ref<RecorderState>('idle');
// Drag offsets move elements through their style directly: a reactive value per pointer move would
// re-render the recorder and restart its animations, which stutters in the iOS web view.
let dragX = 0;
let dragY = 0;
const cancelArmed = ref(false);
const circle = ref<HTMLElement | null>(null);
const slideHint = ref<HTMLElement | null>(null);
const lockHint = ref<HTMLElement | null>(null);
const timer = ref<HTMLElement | null>(null);
const recorder = useVoiceRecorder({ maxDurationMs: MAX_DURATION_MS, onLimit: reachLimit, onFrame: drawFrame });
const liveCanvas = ref<HTMLCanvasElement | null>(null);
const preview = shallowRef<VoiceRecording | null>(null);
const previewUrl = ref<string | undefined>();
const previewDuration = computed(() => preview.value?.durationMs ?? 0);
const playback = useVoicePlayback(previewUrl, previewDuration);
let gesture: {
  pointerId: number;
  startX: number;
  startY: number;
} | null = null;
let holdTimer: number | undefined;
let finishing = false;
// Set when the microphone failed to open, which already explains itself to the person.
let startFailed = false;
// The browser follows every pointerup with a click on the captured button. That click belongs to the
// gesture, so it must not also send a recording the gesture just locked.
let ignoreGestureClick = false;

const recording = computed(() => state.value === 'holding' || state.value === 'locked');
const previewLevels = computed(() => preview.value?.levels ?? []);
const previewClock = computed(() =>
  formatVoiceDuration(
    playback.playing.value || playback.positionMs.value ? playback.positionMs.value : previewDuration.value,
  ),
);
// Every part of the recorder is rendered up front and only shown or hidden with CSS: creating them
// when a press starts, together with opening the microphone, stuttered in the iOS web view. The
// transitions touch opacity and transform only, which stay on the compositor.
function layer(shown: boolean) {
  return shown ? 'visible opacity-100 scale-100' : 'pointer-events-none invisible opacity-0 scale-90';
}

function drawFrame(frame: VoiceRecorderFrame) {
  // Updating the existing text node avoids replacing the timer's children on every frame.
  const timerText = timer.value?.firstChild;
  if (timerText) {
    const text = formatRecordingTime(frame.elapsedMs);
    if (timerText.nodeValue !== text) timerText.nodeValue = text;
  }
  drawLiveWaveform(frame);
}

// The newest bar grows with the voice at the right edge while the strip glides left between samples,
// so the waveform scrolls continuously instead of stepping one bar at a time.
function drawLiveWaveform(frame: VoiceRecorderFrame) {
  const canvas = liveCanvas.value;
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  const scale = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) {
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
  }
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = LIVE_BAR_COLOR;
  const offset = props.prefersReducedMotion ? 0 : (1 - frame.samplePhase) * LIVE_BAR_PITCH;
  const count = Math.ceil(width / LIVE_BAR_PITCH) + 1;
  for (let index = 0; index < count; index += 1) {
    // Index 0 is the bar still coming in; bars before the recording started draw as silence.
    const level = index === 0 ? frame.pendingLevel : (frame.levels[frame.levels.length - index] ?? 0);
    const barHeight = Math.max(0.08, level) * height;
    const x = width - LIVE_BAR_WIDTH - index * LIVE_BAR_PITCH + offset;
    context.beginPath();
    context.roundRect?.(x, (height - barHeight) / 2, LIVE_BAR_WIDTH, barHeight, 1);
    if (!context.roundRect) context.rect(x, (height - barHeight) / 2, LIVE_BAR_WIDTH, barHeight);
    context.fill();
  }
}

function applyDrag() {
  const following = dragX !== 0 || dragY !== 0;
  if (circle.value) {
    circle.value.style.transition = following ? 'none' : 'transform 160ms cubic-bezier(0.22, 1, 0.36, 1)';
    circle.value.style.transform = `translate3d(${dragX}px, ${dragY}px, 0)`;
  }
  if (slideHint.value) {
    slideHint.value.style.transform = `translate3d(${dragX * SLIDE_HINT_FOLLOW}px, 0, 0)`;
    slideHint.value.style.opacity = String(1 - Math.min(1, -dragX / CANCEL_DISTANCE) * 0.85);
  }
  if (lockHint.value) lockHint.value.style.transform = `translate3d(0, ${dragY * LOCK_HINT_FOLLOW}px, 0)`;
  const armed = -dragX / CANCEL_DISTANCE > 0.6;
  if (armed !== cancelArmed.value) cancelArmed.value = armed;
}

watch(state, (next) => (active.value = !['idle', 'pressing'].includes(next)), { immediate: true });

function resetGesture() {
  window.clearTimeout(holdTimer);
  holdTimer = undefined;
  gesture = null;
  dragX = 0;
  dragY = 0;
  applyDrag();
}

// The timer and waveform are drawn outside Vue. A new recording clears them by hand; a finished one
// keeps its last values, so the bar fades out without the timer flicking back to zero.
function clearLiveDisplay() {
  const timerText = timer.value?.firstChild;
  if (timerText) timerText.nodeValue = formatRecordingTime(0);
  const canvas = liveCanvas.value;
  canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
}

function startsImmediatelyOnMobile() {
  return window.matchMedia?.('(max-width: 639px), (pointer: coarse)').matches ?? false;
}

function resetAll() {
  resetGesture();
  playback.reset();
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = undefined;
  preview.value = null;
  state.value = 'idle';
}

function onPointerDown(event: PointerEvent) {
  // A recording that is still being finished in the background owns the recorder.
  if (props.disabled || finishing || state.value !== 'idle' || event.button !== 0) return;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  const startsImmediately = startsImmediatelyOnMobile();
  gesture = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
  };
  ignoreGestureClick = true;
  state.value = 'pressing';
  // iOS starts audio only from inside a gesture handler, so the context opens with pointer-down.
  recorder.prepare();
  recorder.openMicrophone();
  prepareHaptics();
  if (startsImmediately) void beginRecording(false);
  else holdTimer = window.setTimeout(() => void beginRecording(false), HOLD_DELAY_MS);
}

function onPointerMove(event: PointerEvent) {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  if (state.value !== 'holding') return;
  const dx = Math.min(0, event.clientX - gesture.startX);
  const dy = Math.min(0, event.clientY - gesture.startY);
  // The finger moves one way at a time: whichever direction leads takes the gesture.
  if (-dx > -dy) {
    dragX = dx;
    dragY = 0;
  } else {
    dragX = 0;
    dragY = dy;
  }
  applyDrag();
  if (-dragX >= CANCEL_DISTANCE) cancelRecording();
  else if (-dragY >= LOCK_DISTANCE) lock();
}

function endGestureClick() {
  window.setTimeout(() => (ignoreGestureClick = false));
}

function onPointerUp(event: PointerEvent) {
  endGestureClick();
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  if (state.value === 'pressing') {
    resetGesture();
    recorder.cancel();
    state.value = 'idle';
    playHaptic('light');
    toast({ title: 'Hold to record a voice message, release to send.' });
  } else if (state.value === 'holding') {
    resetGesture();
    void sendRecording();
  }
}

function onPointerCancel(event: PointerEvent) {
  endGestureClick();
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  if (state.value === 'pressing' || state.value === 'holding') cancelRecording();
}

function onButtonClick(event: MouseEvent) {
  if (ignoreGestureClick) {
    ignoreGestureClick = false;
    return;
  }
  if (state.value === 'locked' || state.value === 'preview') {
    void sendRecording();
    return;
  }
  // Keyboard activation has no hold, so it starts a locked recording.
  if (state.value === 'idle' && event.detail === 0 && !props.disabled && !finishing) {
    recorder.prepare();
    void beginRecording(true);
  }
}

// The recording UI and its counter appear the moment the hold completes; the audio joins as soon as
// the microphone (already opening since the press) is ready.
async function beginRecording(locked: boolean) {
  holdTimer = undefined;
  startFailed = false;
  clearLiveDisplay();
  state.value = locked ? 'locked' : 'holding';
  playHaptic('medium');
  try {
    await recorder.start();
  } catch (error) {
    console.error('[VoiceRecorder] Failed to start recording:', error);
    startFailed = true;
    recorder.cancel();
    resetAll();
    playHaptic('error');
    const denied = error instanceof DOMException && error.name === 'NotAllowedError';
    toast({
      title: denied
        ? 'Allow microphone access to record voice messages.'
        : 'Could not start recording. Check your microphone.',
      variant: 'destructive',
    });
  }
}

function lock() {
  resetGesture();
  state.value = 'locked';
  playHaptic('success');
}

function cancelRecording() {
  recorder.cancel();
  resetAll();
  playHaptic('warning');
}

async function finishRecording() {
  if (finishing) return null;
  finishing = true;
  try {
    const result = await recorder.stop();
    if (!result || result.durationMs < MIN_DURATION_MS) {
      if (state.value !== 'idle') resetAll();
      if (!startFailed) {
        playHaptic('warning');
        toast({ title: 'Voice message too short. Hold the microphone to keep recording.' });
      }
      return null;
    }
    return result;
  } finally {
    finishing = false;
  }
}

async function sendRecording() {
  if (state.value === 'preview') {
    const file = preview.value?.file;
    resetAll();
    if (file) emit('send', file);
    return;
  }
  // The recording UI leaves at once; the file is finished in the background and sent when ready.
  resetAll();
  const result = await finishRecording();
  if (result) emit('send', result.file);
}

async function stopToPreview() {
  const result = await finishRecording();
  if (!result) return;
  resetGesture();
  preview.value = result;
  previewUrl.value = URL.createObjectURL(result.file);
  state.value = 'preview';
  playHaptic('light');
}

function reachLimit() {
  toast({ title: 'Voice messages can be up to 10 minutes long.' });
  playHaptic('warning');
  void stopToPreview();
}

function deletePreview() {
  resetAll();
  playHaptic('warning');
}

function togglePreviewPlayback() {
  playHaptic('selection');
  void playback.toggle();
}

function cancelOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !active.value) return;
  event.preventDefault();
  if (state.value === 'preview') deletePreview();
  else cancelRecording();
}

watch(active, (isActive) => {
  if (isActive) document.addEventListener('keydown', cancelOnEscape);
  else document.removeEventListener('keydown', cancelOnEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', cancelOnEscape);
  recorder.cancel();
  resetAll();
});
</script>

<template>
  <!-- Covers the attachment button, text field, and emoji button while a voice message is in progress. -->
  <div
    data-voice-recorder-bar
    :data-visible="active"
    :inert="!active"
    class="absolute inset-y-0 left-0 right-[3.25rem] z-20 flex items-end bg-white transition-[opacity,visibility] duration-150 ease-out motion-reduce:transition-none"
    :class="active ? 'visible opacity-100' : 'pointer-events-none invisible opacity-0'"
  >
    <div
      v-show="state !== 'preview'"
      class="flex h-11 min-w-0 flex-1 items-center gap-2.5 overflow-hidden rounded-xl bg-[#F3F5F4] pl-3 pr-2 text-sm text-[#102F35]"
      role="status"
      :aria-label="
        recording ? `Recording voice message, ${formatVoiceDuration(recorder.elapsedSeconds.value * 1000)}` : undefined
      "
    >
      <span
        class="size-2 shrink-0 rounded-full bg-[#C4513D]"
        :class="{ 'animate-pulse': recording && !prefersReducedMotion }"
        aria-hidden="true"
      />
      <span ref="timer" data-voice-recorder-time class="w-[4.25rem] shrink-0 font-semibold tabular-nums">0:00,00</span>
      <canvas
        ref="liveCanvas"
        data-voice-live-waveform
        role="img"
        aria-label="Live voice level"
        class="h-6 min-w-0 flex-1"
        :class="state === 'locked' ? 'block' : 'hidden min-[420px]:block'"
      />
      <span
        v-show="state !== 'locked'"
        ref="slideHint"
        data-voice-slide-hint
        class="ml-auto flex shrink-0 items-center gap-0.5 whitespace-nowrap font-medium text-[#4E6B70] will-change-transform"
        ><ChevronLeft class="size-4" />Slide to cancel</span
      >
      <button
        v-show="state === 'locked'"
        type="button"
        class="harbor-ghost-action ml-auto shrink-0 rounded-lg px-2 py-1 font-semibold text-[#C4513D]"
        @click="cancelRecording"
      >
        Cancel
      </button>
    </div>
    <div v-show="state === 'preview'" class="flex h-11 min-w-0 flex-1 items-center gap-2">
      <button
        type="button"
        class="harbor-soft-action flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#D8E7E3] bg-[#F3F5F4] text-[#C4513D]"
        aria-label="Delete voice message"
        title="Delete voice message"
        @pointerdown.prevent
        @click="deletePreview"
      >
        <Trash2 class="size-5" />
      </button>
      <div
        data-voice-preview
        :data-visible="state === 'preview'"
        class="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#D8E7E3] bg-[#F3F5F4] pl-1.5 pr-3"
      >
        <button
          type="button"
          class="harbor-ghost-action flex size-8 shrink-0 items-center justify-center rounded-full text-[#0B7A75]"
          :aria-label="playback.playing.value ? 'Pause voice message' : 'Play voice message'"
          @pointerdown.prevent
          @click="togglePreviewPlayback"
        >
          <Pause v-show="playback.playing.value" class="size-3.5 fill-current" /><Play
            v-show="!playback.playing.value"
            class="ml-0.5 size-3.5 fill-current"
          />
        </button>
        <VoiceWaveform
          :levels="previewLevels"
          :progress="playback.progress.value"
          :playing="playback.playing.value"
          seekable
          played-class="bg-[#0B7A75]"
          unplayed-class="bg-[#B8C6C5]"
          class="h-6"
          @seek="playback.seek"
        />
        <span class="shrink-0 text-xs font-semibold tabular-nums text-[#27595D]">{{ previewClock }}</span>
      </div>
    </div>
  </div>

  <!-- Showing the button after display: none replays its entrance animation; hiding it is instant. -->
  <div
    v-show="visible"
    class="relative size-11 shrink-0 duration-150 animate-in fade-in-0 zoom-in-75 motion-reduce:animate-none"
  >
    <!-- Lock target: sliding up past it keeps recording without holding. -->
    <div
      data-voice-lock-hint
      :data-visible="state === 'holding'"
      aria-hidden="true"
      class="pointer-events-none absolute bottom-[calc(100%+2rem)] left-0 z-30 w-11 transition-[opacity,transform,visibility] duration-150 ease-out motion-reduce:transition-none"
      :class="layer(state === 'holding')"
    >
      <div
        ref="lockHint"
        class="flex flex-col items-center gap-1 rounded-xl border border-[#D8E7E3] bg-[#F3F5F4] py-2.5 text-[#27595D] will-change-transform"
      >
        <Lock class="size-5" />
        <ChevronUp class="size-4" />
      </div>
    </div>
    <button
      type="button"
      data-voice-stop
      :data-visible="state === 'locked'"
      :inert="state !== 'locked'"
      class="harbor-soft-action absolute bottom-[calc(100%+2rem)] left-0 z-30 flex size-11 items-center justify-center rounded-xl border border-[#D8E7E3] bg-[#F3F5F4] text-[#27595D] transition-[opacity,transform,visibility] duration-150 ease-out motion-reduce:transition-none"
      :class="layer(state === 'locked')"
      aria-label="Stop recording and listen"
      title="Stop and listen"
      @pointerdown.prevent
      @click="stopToPreview"
    >
      <Pause class="size-5 fill-current" />
    </button>

    <!-- The enlarged button shares the composer button's center, so its icon lines up with the row.
           The outer layer shows and hides it; the inner one follows the finger through its style. -->
    <div
      data-voice-circle
      :data-visible="recording"
      class="pointer-events-none absolute inset-0 z-30 transition-[opacity,transform,visibility] duration-150 ease-out motion-reduce:transition-none"
      :class="layer(recording)"
    >
      <div ref="circle" class="size-full will-change-transform">
        <button
          type="button"
          tabindex="-1"
          data-voice-send-locked
          :inert="state !== 'locked'"
          class="harbor-soft-action flex size-full items-center justify-center rounded-xl bg-[#F3F5F4] transition-colors duration-150"
          :class="[
            state === 'locked' ? 'pointer-events-auto' : 'pointer-events-none',
            cancelArmed ? 'text-[#C4513D]' : 'text-[#0B7A75]',
          ]"
          aria-label="Send voice message"
          @pointerdown.prevent
          @click="sendRecording"
        >
          <ArrowUp v-show="state === 'locked'" class="size-5" /><Mic v-show="state !== 'locked'" class="size-5" />
        </button>
      </div>
    </div>

    <button
      type="button"
      data-voice-record-button
      class="flex size-11 touch-none select-none items-center justify-center text-[#0B7A75] transition-opacity duration-150 [-webkit-touch-callout:none] disabled:opacity-50"
      :class="[
        state === 'preview'
          ? 'harbor-soft-action rounded-xl border border-[#D8E7E3] bg-[#F3F5F4]'
          : 'harbor-ghost-action rounded-full',
        { 'opacity-0': recording },
      ]"
      :disabled="disabled && state === 'idle'"
      :aria-label="state === 'preview' || state === 'locked' ? 'Send voice message' : 'Record a voice message'"
      :title="state === 'preview' || state === 'locked' ? 'Send voice message' : 'Hold to record'"
      @pointerdown.prevent="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @contextmenu.prevent
      @click="onButtonClick"
    >
      <ArrowUp v-show="state === 'preview'" class="size-5" /><Mic v-show="state !== 'preview'" class="size-5" />
    </button>
  </div>
</template>
