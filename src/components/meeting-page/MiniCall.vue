<script lang="ts">
import { ref } from 'vue';

import type { Corner } from '@/lib/meeting-layout';

// Module state, so the corner survives collapsing and expanding for the rest of the session.
const rememberedCorner = ref<Corner>('bottom-right');
</script>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core';
import { Maximize2, Mic, MicOff, PhoneOff } from 'lucide-vue-next';
import { computed, onBeforeUnmount, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import CallAudio from '@/components/meeting-page/CallAudio.vue';
import ParticipantTile from '@/components/meeting-page/ParticipantTile.vue';
import { useActiveSpeaker } from '@/composables/useActiveSpeaker';
import { useCornerDrag } from '@/composables/useCornerDrag';
import type { UserStatus } from '@/services/social-api';
import type { Participant } from '@/xstate/machines/webrtc/types';

/** A touch held this long shows the controls instead of expanding. */
const PRESS_MS = 350;
/** Controls shown by a press hide again after this long without another press. */
const CONTROLS_SHOWN_MS = 4_000;
/** A finger that moves further than this while pressed is dragging, not pressing. */
const PRESS_SLOP_PX = 8;

// The mini call: the collapsed active call as one small tile over the workspace (ADR 0001). It shows a screen
// share, else the person speaking among the others, else the last speaker, else your own view when alone.
// Everyone's audio keeps playing from here while the call screen is away. It drags to any corner; mute, leave
// and expand show on hover with a mouse and on a press with a finger.
const props = defineProps<{
  participants: Participant[];
  localParticipantId: string | null;
  isMuted?: boolean;
  statuses?: Record<string, UserStatus>;
  avatarUrls?: Record<string, string>;
}>();
const emit = defineEmits<{ (e: 'expand'): void; (e: 'mute'): void; (e: 'leave'): void }>();
const { t } = useI18n();

const participants = toRef(props, 'participants');
const { activeSpeakerId } = useActiveSpeaker(participants);
const others = computed(() => props.participants.filter((participant) => !participant.isLocal));
const lastSpeakerId = ref<string | null>(null);
watch(activeSpeakerId, (id) => {
  if (id && others.value.some((participant) => participant.id === id)) lastSpeakerId.value = id;
});
const shown = computed<Participant | null>(() => {
  const share = props.participants.find((participant) => participant.screenShareOf);
  if (share) return share;
  const other = (id: string | null) => others.value.find((participant) => participant.id === id);
  return (
    other(activeSpeakerId.value) ??
    other(lastSpeakerId.value) ??
    others.value[0] ??
    props.participants.find((participant) => participant.isLocal) ??
    null
  );
});

// Position: a corner of the area, which is the screen inset by the safe areas and the phone's bottom bar.
const area = ref<HTMLElement | null>(null);
const root = ref<HTMLElement | null>(null);
const { width: areaWidth, height: areaHeight } = useElementSize(area);
const { width: tileWidth, height: tileHeight } = useElementSize(root);
let swallowNextTap = false;
const drag = useCornerDrag({
  element: root,
  area,
  initialCorner: rememberedCorner.value,
  onDragEnd: () => {
    swallowNextTap = true;
  },
});
watch(drag.corner, (corner) => (rememberedCorner.value = corner));
const rootStyle = computed(() => {
  const [vertical, horizontal] = drag.corner.value.split('-');
  return {
    left: `${horizontal === 'left' ? 0 : Math.max(0, areaWidth.value - tileWidth.value)}px`,
    top: `${vertical === 'top' ? 0 : Math.max(0, areaHeight.value - tileHeight.value)}px`,
    ...drag.style.value,
  };
});

// A press (a finger held still) shows the controls; the tap that would follow does not expand.
const controlsShown = ref(false);
let pressTimer: number | undefined;
let hideTimer: number | undefined;
let press: { pointerId: number; x: number; y: number } | null = null;
function showControls() {
  controlsShown.value = true;
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => (controlsShown.value = false), CONTROLS_SHOWN_MS);
}
function onPointerDown(event: PointerEvent) {
  drag.start(event);
  if (event.pointerType !== 'touch') return;
  press = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  window.clearTimeout(pressTimer);
  pressTimer = window.setTimeout(() => {
    press = null;
    swallowNextTap = true;
    showControls();
  }, PRESS_MS);
}
function onPointerMove(event: PointerEvent) {
  drag.move(event);
  if (press && event.pointerId === press.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > PRESS_SLOP_PX) {
    press = null;
    window.clearTimeout(pressTimer);
  }
}
function onPointerEnd(event: PointerEvent) {
  void drag.end(event);
  press = null;
  window.clearTimeout(pressTimer);
}
function onTileClick() {
  if (swallowNextTap) {
    swallowNextTap = false;
    return;
  }
  emit('expand');
}
function onControl(action: 'mute' | 'leave' | 'expand') {
  showControls();
  if (action === 'mute') emit('mute');
  else if (action === 'leave') emit('leave');
  else emit('expand');
}
onBeforeUnmount(() => {
  window.clearTimeout(pressTimer);
  window.clearTimeout(hideTimer);
});
</script>

<template>
  <div ref="area" class="mini-call-area pointer-events-none fixed z-[60]">
    <div
      ref="root"
      data-mini-call
      :data-corner="drag.corner.value"
      :data-controls-shown="String(controlsShown)"
      :data-dragging="String(drag.dragging.value)"
      class="group pointer-events-auto absolute h-[11rem] w-[8.25rem] touch-none select-none overflow-hidden rounded-[1.4rem] shadow-[0_10px_28px_rgba(0,0,0,0.35)] sm:h-40 sm:w-56"
      :style="rootStyle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerEnd"
      @pointercancel="onPointerEnd"
    >
      <CallAudio :participants="participants" />
      <button
        type="button"
        class="block size-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-faint"
        :aria-label="t('meeting.miniCall.expand')"
        data-mini-call-tile
        @click="onTileClick"
      >
        <ParticipantTile
          v-if="shown"
          :participant="shown"
          :status="statuses?.[shown.id]"
          :avatar-url="avatarUrls?.[shown.id]"
          :speaking="!!activeSpeakerId && shown.id === activeSpeakerId"
          :interactive="false"
          :show-actions="false"
          dark
          size="mobile"
        />
      </button>
      <div
        class="meeting-controls-dark absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 p-2 transition-opacity duration-200 [--meeting-control-size:2.25rem]"
        :class="
          controlsShown
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:opacity-100'
        "
        data-mini-call-controls
      >
        <button
          type="button"
          class="call-button"
          :data-off="isMuted"
          :aria-label="isMuted ? t('meeting.miniCall.unmute') : t('meeting.miniCall.mute')"
          data-mini-call-mute
          @click.stop="onControl('mute')"
        >
          <MicOff v-if="isMuted" /><Mic v-else />
        </button>
        <button
          type="button"
          class="call-button call-button-leave"
          :aria-label="t('meeting.miniCall.leave')"
          data-mini-call-leave
          @click.stop="onControl('leave')"
        >
          <PhoneOff />
        </button>
        <button
          type="button"
          class="call-button"
          :aria-label="t('meeting.miniCall.expand')"
          data-mini-call-expand
          @click.stop="onControl('expand')"
        >
          <Maximize2 />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The area the tile moves in: the screen minus the safe areas, a margin, and on phones the bottom bar. */
.mini-call-area {
  top: calc(env(safe-area-inset-top, 0px) + 0.75rem);
  right: 1rem;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 1.5rem);
  left: 1rem;
}
@media (max-width: 639px) {
  .mini-call-area {
    bottom: calc(var(--liquid-bar-bottom, env(safe-area-inset-bottom, 0px)) + var(--liquid-bar-height, 0px) + 0.75rem);
  }
}
</style>
