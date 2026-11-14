<script setup lang="ts">
import { useElementSize, useMediaQuery } from '@vueuse/core';
import { computed, onUnmounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useCallFormFactor } from '@/composables/useCallFormFactor';
import {
  type Corner,
  DEFAULT_TILE_ASPECT,
  type MeetingViewMode,
  fitGridColumns,
  fitTilesInRows,
  gridCells,
  mainVideoFills,
  nearestCorner,
  selectCallLayout,
} from '@/lib/meeting-layout';
import { swallowNextClick } from '@/lib/swallow-next-click';
import type { UserStatus } from '@/services/social-api';
import type { Participant } from '@/xstate/machines/webrtc/types';

import ParticipantTile from './ParticipantTile.vue';

const props = defineProps<{
  activeSpeakerId: string | null;
  participants: Participant[];
  pinnedParticipantId: string | null;
  /** The person's layout choice; null follows the automatic layout for the call's size and form factor. */
  viewMode: MeetingViewMode | null;
  /** Statuses of registered participants, by participant ID. Guests have none. */
  participantStatuses?: Record<string, UserStatus>;
  /** Avatar image URLs of registered participants, keyed by participant ID. */
  participantAvatars?: Record<string, string>;
  /** Full screen: the media fills the whole screen on a near-black background, with nothing around it. */
  fullscreen?: boolean;
  /** Full screen controls are showing, so the strip moves up to stay above them. */
  controlsShown?: boolean;
}>();

const emit = defineEmits<{
  togglePin: [participantId: string];
  toggleFullscreen: [];
}>();
const { t } = useI18n();

const TILE_GAP = 12;
const PHONE_TILE_GAP = 8;
/** Height of the strip that floats over the main video with everyone else; it shrinks to fit, then scrolls. */
const STRIP_TILE_HEIGHT = 96;
const WIDE_STRIP_TILE_HEIGHT = 128;
const MIN_STRIP_TILE_HEIGHT = 64;
const STRIP_GAP = 8;
/** Two taps this close together are a double tap, which toggles full screen instead of pinning. */
const DOUBLE_TAP_MS = 280;
/** A touch held this long is a long-press, which opens the layout menu instead of pinning. */
const LONG_PRESS_MS = 500;
/** The phone 1:1 self view: a portrait picture about a quarter of the screen wide, inset from the edges. */
const SELF_VIEW_WIDTH_SHARE = 0.28;
const SELF_VIEW_MIN_WIDTH = 88;
const SELF_VIEW_MAX_WIDTH = 144;
const SELF_VIEW_ASPECT = 3 / 4;
const SELF_VIEW_INSET = 12;
/** Moving the self view further than this is a drag, not a tap. */
const DRAG_THRESHOLD_PX = 6;

const isWide = useMediaQuery('(min-width: 768px)');
const formFactor = useCallFormFactor();
// Phone call screens centre the name tags and open each person's menu from their name tag.
const isPhone = computed(() => formFactor.value !== 'desktop');
const hasParticipants = computed(() => props.participants.length > 0);
const layout = computed(() =>
  selectCallLayout({
    participants: props.participants,
    formFactor: formFactor.value,
    viewMode: props.viewMode,
    pinnedParticipantId: props.pinnedParticipantId,
    activeSpeakerId: props.activeSpeakerId,
  }),
);
const byId = computed(() => new Map(props.participants.map((participant) => [participant.id, participant])));
const participantsOf = (ids: readonly string[]) =>
  ids.map((id) => byId.value.get(id)).filter((participant): participant is Participant => !!participant);

const speakerParticipant = computed(() =>
  layout.value.kind === 'speaker' ? (byId.value.get(layout.value.mainId) ?? null) : null,
);
const secondaryParticipants = computed(() =>
  layout.value.kind === 'speaker' ? participantsOf(layout.value.stripIds) : [],
);
const gridParticipants = computed(() => (layout.value.kind === 'grid' ? participantsOf(layout.value.ids) : []));
const selfViewMain = computed(() =>
  layout.value.kind === 'self-view' ? (byId.value.get(layout.value.mainId) ?? null) : null,
);
const selfViewSelf = computed(() =>
  layout.value.kind === 'self-view' ? (byId.value.get(layout.value.selfId) ?? null) : null,
);
const isSpeaking = (participant: Participant) =>
  props.participants.length > 1 && props.activeSpeakerId === participant.id;
const isTileFullscreen = (participant: Participant) =>
  !!props.fullscreen && props.pinnedParticipantId === participant.id;

// Each video reports its own shape, so the speaker layout keeps portrait phone cameras and screens uncropped.
const aspects = reactive(new Map<string, number>());
function setAspect(participantId: string, aspect: number) {
  if (Math.abs((aspects.get(participantId) ?? 0) - aspect) > 0.01) aspects.set(participantId, aspect);
}
const aspectOf = (participant: Participant) =>
  participant.stream && participant.videoEnabled
    ? (aspects.get(participant.id) ?? DEFAULT_TILE_ASPECT)
    : DEFAULT_TILE_ASPECT;

// Grid: equal cells fill the area and the videos cover them, so no space is wasted. Tiles are absolutely placed
// in one keyed list, so a new arrangement moves them instead of remounting their videos.
const gridArea = ref<HTMLElement | null>(null);
const { width: gridWidth, height: gridHeight } = useElementSize(gridArea);
const gridGap = computed(() => (formFactor.value === 'phone-portrait' ? PHONE_TILE_GAP : TILE_GAP));
const gridColumns = computed(() => {
  if (layout.value.kind !== 'grid') return 1;
  return (
    layout.value.columns ??
    fitGridColumns(gridParticipants.value.length, gridWidth.value, gridHeight.value, gridGap.value)
  );
});
const gridBoxes = computed(() => {
  const cells = gridCells(
    gridParticipants.value.length,
    gridColumns.value,
    gridWidth.value,
    gridHeight.value,
    gridGap.value,
    layout.value.kind === 'grid' && layout.value.columns !== null,
  );
  return new Map(gridParticipants.value.map((participant, index) => [participant.id, cells[index]]));
});
const gridStyle = (participant: Participant) => {
  const box = gridBoxes.value.get(participant.id);
  return box
    ? { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` }
    : { visibility: 'hidden' as const };
};

// Speaker view: the main video takes the whole stage. It fills it when it has the stage's orientation, and
// otherwise fits inside at its own shape; everyone else floats in a strip over its bottom edge.
const stage = ref<HTMLElement | null>(null);
const { width: stageWidth, height: stageHeight } = useElementSize(stage);
const mainFills = computed(() => {
  const participant = speakerParticipant.value;
  if (!participant || participant.screenShareOf) return false;
  return mainVideoFills(aspectOf(participant), stageWidth.value, stageHeight.value, !!props.fullscreen);
});
const mainStyle = computed(() => {
  const participant = speakerParticipant.value;
  if (!participant || mainFills.value) return { width: '100%', height: '100%' };
  const aspect = aspectOf(participant);
  const [row] = fitTilesInRows([aspect], stageWidth.value, stageHeight.value, 0);
  return row ? { width: `${Math.floor(row.height * aspect)}px`, height: `${row.height}px` } : {};
});
const stripHeight = computed(() => {
  const preferred = isWide.value ? WIDE_STRIP_TILE_HEIGHT : STRIP_TILE_HEIGHT;
  const aspectSum = secondaryParticipants.value.reduce((sum, participant) => sum + aspectOf(participant), 0);
  const available = stageWidth.value - 24 - STRIP_GAP * (secondaryParticipants.value.length - 1);
  if (!aspectSum || available <= 0) return preferred;
  return Math.max(MIN_STRIP_TILE_HEIGHT, Math.min(preferred, Math.floor(available / aspectSum)));
});
const stripStyle = (participant: Participant) => ({
  width: `${Math.floor(stripHeight.value * aspectOf(participant))}px`,
});

// Phone 1:1: the other person fills the area and your own view is a small picture in a corner. Dragging it
// moves it with the finger; letting go snaps it to the nearest corner.
const selfViewArea = ref<HTMLElement | null>(null);
const { width: selfAreaWidth, height: selfAreaHeight } = useElementSize(selfViewArea);
const selfViewCorner = ref<Corner>('bottom-right');
const selfViewWidth = computed(() =>
  Math.round(Math.min(SELF_VIEW_MAX_WIDTH, Math.max(SELF_VIEW_MIN_WIDTH, selfAreaWidth.value * SELF_VIEW_WIDTH_SHARE))),
);
const selfViewHeight = computed(() => Math.round(selfViewWidth.value / SELF_VIEW_ASPECT));
let selfViewDrag: {
  pointerId: number;
  startX: number;
  startY: number;
  /** Centre of the self view at the start, relative to the area. */
  centerX: number;
  centerY: number;
  areaWidth: number;
  areaHeight: number;
} | null = null;
const selfViewOffset = ref<{ x: number; y: number } | null>(null);
const selfViewStyle = computed(() => {
  const [vertical, horizontal] = selfViewCorner.value.split('-');
  const left = horizontal === 'left' ? SELF_VIEW_INSET : selfAreaWidth.value - selfViewWidth.value - SELF_VIEW_INSET;
  const top = vertical === 'top' ? SELF_VIEW_INSET : selfAreaHeight.value - selfViewHeight.value - SELF_VIEW_INSET;
  const offset = selfViewOffset.value;
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${selfViewWidth.value}px`,
    height: `${selfViewHeight.value}px`,
    transform: offset ? `translate(${offset.x}px, ${offset.y}px)` : undefined,
  };
});

function startSelfViewDrag(event: PointerEvent) {
  if (event.button !== 0 || !selfViewArea.value) return;
  // Keeps a held finger from also opening the layout menu, and the page from scrolling under the drag.
  event.preventDefault();
  const element = event.currentTarget as HTMLElement;
  element.setPointerCapture?.(event.pointerId);
  const area = selfViewArea.value.getBoundingClientRect();
  const view = element.getBoundingClientRect();
  selfViewDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    centerX: view.left - area.left + view.width / 2,
    centerY: view.top - area.top + view.height / 2,
    areaWidth: area.width,
    areaHeight: area.height,
  };
}
function moveSelfView(event: PointerEvent) {
  if (!selfViewDrag || event.pointerId !== selfViewDrag.pointerId) return;
  const x = event.clientX - selfViewDrag.startX;
  const y = event.clientY - selfViewDrag.startY;
  if (selfViewOffset.value || Math.hypot(x, y) > DRAG_THRESHOLD_PX) selfViewOffset.value = { x, y };
}
function endSelfViewDrag(event: PointerEvent) {
  const drag = selfViewDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  selfViewDrag = null;
  const offset = selfViewOffset.value;
  if (!offset) return;
  selfViewOffset.value = null;
  selfViewCorner.value = nearestCorner(
    drag.centerX + offset.x,
    drag.centerY + offset.y,
    drag.areaWidth,
    drag.areaHeight,
  );
  // A drag is not a tap: the click that follows must not pin.
  if (event.type === 'pointerup') swallowNextClick();
}

// One tap on a tile pins or unpins that person; a double tap anywhere toggles full screen. The single tap waits
// a moment so a double tap does not also pin. Keyboard presses (no pointer detail) act at once. A touch held
// long enough opens the layout menu instead, so its click does nothing.
let lastTapAt = 0;
let pendingTap: number | undefined;
let touchPressStartedAt = 0;
function handleCanvasPointerDown(event: PointerEvent) {
  touchPressStartedAt = event.pointerType === 'mouse' ? 0 : Date.now();
}
function handleCanvasClick(event: MouseEvent) {
  const participantId = (event.target as Element | null)?.closest<HTMLElement>('[data-testid="participant-tile"]')
    ?.dataset.participantId;
  if (event.detail === 0) {
    if (participantId) emit('togglePin', participantId);
    return;
  }
  const wasLongPress = touchPressStartedAt > 0 && Date.now() - touchPressStartedAt >= LONG_PRESS_MS;
  touchPressStartedAt = 0;
  if (wasLongPress) return;
  const now = Date.now();
  if (now - lastTapAt < DOUBLE_TAP_MS) {
    window.clearTimeout(pendingTap);
    pendingTap = undefined;
    lastTapAt = 0;
    emit('toggleFullscreen');
    return;
  }
  lastTapAt = now;
  window.clearTimeout(pendingTap);
  pendingTap = participantId
    ? window.setTimeout(() => {
        pendingTap = undefined;
        emit('togglePin', participantId);
      }, DOUBLE_TAP_MS)
    : undefined;
}
onUnmounted(() => window.clearTimeout(pendingTap));

// "Full screen" on a tile shows that person alone: it pins them, then enters full screen. On the tile already
// shown in full screen it leaves full screen.
function showTileFullscreen(participant: Participant) {
  if (isTileFullscreen(participant)) {
    emit('toggleFullscreen');
    return;
  }
  if (props.pinnedParticipantId !== participant.id) emit('togglePin', participant.id);
  if (!props.fullscreen) emit('toggleFullscreen');
}

// Strip tiles on phones hide names to keep the small videos clear; the tile's ⋯ menu reveals one.
const revealedNames = reactive(new Set<string>());
function toggleName(participantId: string) {
  if (revealedNames.has(participantId)) revealedNames.delete(participantId);
  else revealedNames.add(participantId);
}
</script>

<template>
  <div
    class="relative h-full w-full flex-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-harbor-accent"
    data-testid="meeting-video-canvas"
    :data-view-mode="layout.kind === 'speaker' ? 'speaker' : 'grid'"
    :data-layout="layout.kind"
    :data-fullscreen="fullscreen ? 'true' : undefined"
    tabindex="0"
    :aria-label="t('meeting.actions.videoCanvas')"
    @pointerdown="handleCanvasPointerDown"
    @click="handleCanvasClick"
  >
    <!-- The video area fills the space between the call screen's top bar and its controls, which the page sets as
         --call-area-top and --call-area-bottom, so no tile hides under either. In full screen it takes the whole
         screen. -->
    <div
      v-if="hasParticipants"
      class="fixed inset-x-0"
      :class="
        fullscreen ? 'inset-y-0 z-[35] bg-[#0B0F10]' : 'bottom-[var(--call-area-bottom)] top-[var(--call-area-top)]'
      "
    >
      <Transition name="meeting-layout" mode="out-in">
        <div v-if="layout.kind === 'grid'" key="grid" class="absolute inset-0 p-2 sm:p-4">
          <div ref="gridArea" class="relative size-full" data-testid="participant-grid" :data-columns="gridColumns">
            <ParticipantTile
              v-for="participant in gridParticipants"
              :key="participant.id"
              class="meeting-grid-tile !absolute"
              :style="gridStyle(participant)"
              :participant="participant"
              :status="participantStatuses?.[participant.id]"
              :avatar-url="participantAvatars?.[participant.id]"
              :speaking="isSpeaking(participant)"
              :dark="fullscreen"
              :phone="isPhone"
              fit="cover"
              size="grid"
              :is-expanded="pinnedParticipantId === participant.id"
              :is-fullscreen="isTileFullscreen(participant)"
              @aspect="setAspect(participant.id, $event)"
              @toggle-pin="emit('togglePin', participant.id)"
              @toggle-fullscreen="showTileFullscreen(participant)"
            />
          </div>
        </div>

        <div
          v-else-if="layout.kind === 'self-view'"
          key="self-view"
          class="absolute inset-0"
          :class="fullscreen ? '' : 'p-2'"
        >
          <div ref="selfViewArea" class="relative size-full">
            <ParticipantTile
              v-if="selfViewMain"
              :participant="selfViewMain"
              :status="participantStatuses?.[selfViewMain.id]"
              :avatar-url="participantAvatars?.[selfViewMain.id]"
              :speaking="isSpeaking(selfViewMain)"
              :dark="fullscreen"
              :phone="isPhone"
              :bleed="fullscreen"
              fit="cover"
              size="full"
              :is-fullscreen="isTileFullscreen(selfViewMain)"
              @aspect="setAspect(selfViewMain.id, $event)"
              @toggle-pin="emit('togglePin', selfViewMain.id)"
              @toggle-fullscreen="showTileFullscreen(selfViewMain)"
            />
            <div
              v-if="selfViewSelf"
              class="absolute z-10 touch-none select-none rounded-[1.4rem] shadow-[0_10px_28px_rgba(0,0,0,0.35)]"
              :class="selfViewOffset ? '' : 'meeting-self-view-snap'"
              :style="selfViewStyle"
              data-testid="self-view"
              :data-corner="selfViewCorner"
              :title="t('meeting.participant.selfView')"
              @pointerdown="startSelfViewDrag"
              @pointermove="moveSelfView"
              @pointerup="endSelfViewDrag"
              @pointercancel="endSelfViewDrag"
            >
              <ParticipantTile
                :participant="selfViewSelf"
                :status="participantStatuses?.[selfViewSelf.id]"
                :avatar-url="participantAvatars?.[selfViewSelf.id]"
                :speaking="isSpeaking(selfViewSelf)"
                :dark="fullscreen"
                :phone="isPhone"
                size="mobile"
                fit="cover"
                :show-name-tag="false"
                :show-actions="false"
                @aspect="setAspect(selfViewSelf.id, $event)"
              />
            </div>
          </div>
        </div>

        <div v-else key="speaker" class="absolute inset-0" :class="fullscreen ? '' : 'p-2 sm:p-4'">
          <div ref="stage" class="relative flex size-full items-center justify-center" data-testid="speaker-stage">
            <ParticipantTile
              v-if="speakerParticipant"
              :style="mainStyle"
              :participant="speakerParticipant"
              :status="participantStatuses?.[speakerParticipant.id]"
              :avatar-url="participantAvatars?.[speakerParticipant.id]"
              :speaking="isSpeaking(speakerParticipant)"
              :fit="mainFills ? 'cover' : 'contain'"
              :dark="fullscreen"
              :phone="isPhone"
              :bleed="fullscreen"
              size="full"
              :is-expanded="pinnedParticipantId === speakerParticipant.id"
              :is-fullscreen="isTileFullscreen(speakerParticipant)"
              @aspect="setAspect(speakerParticipant.id, $event)"
              @toggle-pin="emit('togglePin', speakerParticipant.id)"
              @toggle-fullscreen="showTileFullscreen(speakerParticipant)"
            />
          </div>

          <!-- Everyone else floats over the bottom of the main video, on phones and desktops alike; it scrolls
               sideways when it does not fit. -->
          <div
            v-if="secondaryParticipants.length"
            class="pointer-events-none absolute inset-x-0 flex justify-center px-3 transition-[bottom] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            :class="fullscreen && controlsShown ? 'bottom-[var(--call-area-bottom)]' : 'bottom-4 sm:bottom-6'"
          >
            <div class="pointer-events-auto max-w-full overflow-x-auto" data-testid="participant-strip">
              <div class="flex w-max gap-2" :style="{ height: `${stripHeight}px` }">
                <div
                  v-for="participant in secondaryParticipants"
                  :key="participant.id"
                  class="relative h-full shrink-0 rounded-[1.4rem] shadow-[0_10px_28px_rgba(0,0,0,0.35)]"
                  :style="stripStyle(participant)"
                >
                  <ParticipantTile
                    :participant="participant"
                    :status="participantStatuses?.[participant.id]"
                    :avatar-url="participantAvatars?.[participant.id]"
                    :speaking="isSpeaking(participant)"
                    :dark="fullscreen"
                    :phone="isPhone"
                    size="mobile"
                    :show-name-tag="isWide || revealedNames.has(participant.id)"
                    :name-toggle="!isWide"
                    :is-expanded="pinnedParticipantId === participant.id"
                    :is-fullscreen="isTileFullscreen(participant)"
                    @aspect="setAspect(participant.id, $event)"
                    @toggle-pin="emit('togglePin', participant.id)"
                    @toggle-fullscreen="showTileFullscreen(participant)"
                    @toggle-name="toggleName(participant.id)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.meeting-grid-tile {
  transition:
    left 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    top 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.3s,
    box-shadow 0.3s;
}

.meeting-self-view-snap {
  transition:
    left 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    top 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.meeting-layout-enter-active,
.meeting-layout-leave-active {
  transition: opacity 0.2s ease;
}

.meeting-layout-leave-active {
  pointer-events: none;
}

.meeting-layout-enter-from,
.meeting-layout-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .meeting-grid-tile,
  .meeting-self-view-snap,
  .meeting-layout-enter-active,
  .meeting-layout-leave-active {
    transition: none;
  }
}
</style>
