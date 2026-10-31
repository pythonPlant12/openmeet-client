<script setup lang="ts">
import { useElementSize, useMediaQuery } from '@vueuse/core';
import { MoreHorizontal } from 'lucide-vue-next';
import { computed, onUnmounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { DEFAULT_TILE_ASPECT, fitTilesInRows, mainVideoFills, speakerViewMainId } from '@/lib/meeting-layout';
import type { UserStatus } from '@/services/social-api';
import type { Participant } from '@/xstate/machines/webrtc/types';

import ParticipantTile from './ParticipantTile.vue';

type MeetingViewMode = 'grid' | 'speaker';

const props = defineProps<{
  activeSpeakerId: string | null;
  participants: Participant[];
  pinnedParticipantId: string | null;
  viewMode: MeetingViewMode;
  /** Statuses of registered participants, by participant ID. Guests have none. */
  participantStatuses?: Record<string, UserStatus>;
  /** Avatar image URLs of registered participants, keyed by participant ID. */
  participantAvatars?: Record<string, string>;
  /** Phones show the navbar at the top (guests), so the video area starts below it and the meeting's top row. */
  phoneTopBar?: boolean;
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
/** Height of the strip that floats over the main video with everyone else; it shrinks to fit, then scrolls. */
const STRIP_TILE_HEIGHT = 96;
const WIDE_STRIP_TILE_HEIGHT = 128;
const MIN_STRIP_TILE_HEIGHT = 64;
const STRIP_GAP = 8;
/** Two taps this close together are a double tap, which toggles full screen instead of pinning. */
const DOUBLE_TAP_MS = 280;

const isWide = useMediaQuery('(min-width: 768px)');
const hasParticipants = computed(() => props.participants.length > 0);
const speakerParticipant = computed(() => {
  const mainId = speakerViewMainId(
    props.participants.map((participant) => participant.id),
    props.pinnedParticipantId,
    props.activeSpeakerId,
  );
  return props.participants.find((participant) => participant.id === mainId) ?? null;
});
const secondaryParticipants = computed(() =>
  props.participants.filter((participant) => participant.id !== speakerParticipant.value?.id),
);
const isSpeaking = (participant: Participant) =>
  props.participants.length > 1 && props.activeSpeakerId === participant.id;

// Each video reports its own shape, so portrait phone cameras stay portrait and screens stay landscape.
const aspects = reactive(new Map<string, number>());
function setAspect(participantId: string, aspect: number) {
  if (Math.abs((aspects.get(participantId) ?? 0) - aspect) > 0.01) aspects.set(participantId, aspect);
}
const aspectOf = (participant: Participant) =>
  participant.stream && participant.videoEnabled
    ? (aspects.get(participant.id) ?? DEFAULT_TILE_ASPECT)
    : DEFAULT_TILE_ASPECT;

// Grid: tiles are absolutely placed in one keyed list, so a new arrangement moves them instead of remounting
// their videos.
const gridArea = ref<HTMLElement | null>(null);
const { width: gridWidth, height: gridHeight } = useElementSize(gridArea);
const gridBoxes = computed(() => {
  const aspectList = props.participants.map(aspectOf);
  const rows = fitTilesInRows(aspectList, gridWidth.value, gridHeight.value, TILE_GAP);
  const boxes = new Map<string, { left: number; top: number; width: number; height: number }>();
  const totalHeight = rows.reduce((sum, row) => sum + row.height, 0) + TILE_GAP * Math.max(rows.length - 1, 0);
  let top = (gridHeight.value - totalHeight) / 2;
  for (const row of rows) {
    const widths = row.indices.map((index) => Math.floor(row.height * aspectList[index]!));
    let left = (gridWidth.value - widths.reduce((sum, width) => sum + width, 0) - TILE_GAP * (widths.length - 1)) / 2;
    row.indices.forEach((index, position) => {
      boxes.set(props.participants[index]!.id, { left, top, width: widths[position]!, height: row.height });
      left += widths[position]! + TILE_GAP;
    });
    top += row.height + TILE_GAP;
  }
  return boxes;
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

// One tap on a tile pins or unpins that person; a double tap anywhere toggles full screen. The single tap waits
// a moment so a double tap does not also pin. Keyboard presses (no pointer detail) act at once.
let lastTapAt = 0;
let pendingTap: number | undefined;
function handleCanvasClick(event: MouseEvent) {
  const participantId = (event.target as Element | null)?.closest<HTMLElement>('[data-testid="participant-tile"]')
    ?.dataset.participantId;
  if (event.detail === 0) {
    if (participantId) emit('togglePin', participantId);
    return;
  }
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

// Strip tiles on phones hide names to keep the small videos clear; the ⋯ button reveals one.
const revealedNames = reactive(new Set<string>());
function toggleName(participantId: string) {
  if (revealedNames.has(participantId)) revealedNames.delete(participantId);
  else revealedNames.add(participantId);
}
</script>

<template>
  <div
    class="relative h-full w-full flex-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0B7A75]"
    data-testid="meeting-video-canvas"
    :data-view-mode="viewMode"
    :data-fullscreen="fullscreen ? 'true' : undefined"
    tabindex="0"
    :aria-label="t('meeting.actions.videoCanvas')"
    @click="handleCanvasClick"
  >
    <!-- The video area fills the space between the top row (participants and actions buttons) and the bottom
         control bar, so no tile hides under either. In full screen it takes the whole screen. -->
    <div
      v-if="hasParticipants"
      class="fixed inset-x-0"
      :class="
        fullscreen
          ? 'inset-y-0 z-[35] bg-[#0B0F10]'
          : [
              'bottom-[5.5rem] sm:bottom-[6.5rem] sm:top-[10rem]',
              phoneTopBar === false ? 'top-[calc(4.25rem+env(safe-area-inset-top))]' : 'top-[8.5rem]',
            ]
      "
    >
      <Transition name="meeting-layout" mode="out-in">
        <div v-if="viewMode === 'grid'" key="grid" class="absolute inset-0 p-2 sm:p-4">
          <div ref="gridArea" class="relative size-full">
            <ParticipantTile
              v-for="participant in participants"
              :key="participant.id"
              class="meeting-grid-tile !absolute"
              :style="gridStyle(participant)"
              :participant="participant"
              :status="participantStatuses?.[participant.id]"
              :avatar-url="participantAvatars?.[participant.id]"
              :speaking="isSpeaking(participant)"
              :dark="fullscreen"
              size="grid"
              @aspect="setAspect(participant.id, $event)"
            />
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
              :bleed="fullscreen"
              size="full"
              :is-expanded="pinnedParticipantId === speakerParticipant.id"
              @aspect="setAspect(speakerParticipant.id, $event)"
            />
          </div>

          <!-- Everyone else floats over the bottom of the main video, on phones and desktops alike. -->
          <div
            v-if="secondaryParticipants.length"
            class="pointer-events-none absolute inset-x-0 flex justify-center px-3 transition-[bottom] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            :class="fullscreen && controlsShown ? 'bottom-[5.5rem] sm:bottom-[6.5rem]' : 'bottom-4 sm:bottom-6'"
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
                    size="mobile"
                    :show-name-tag="isWide || revealedNames.has(participant.id)"
                    :is-expanded="pinnedParticipantId === participant.id"
                    @aspect="setAspect(participant.id, $event)"
                  />
                  <button
                    v-if="!isWide"
                    type="button"
                    class="meeting-glass-bubble absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-full"
                    data-testid="participant-name-toggle"
                    :aria-label="
                      t(
                        revealedNames.has(participant.id)
                          ? 'meeting.participant.hideName'
                          : 'meeting.participant.showName',
                      )
                    "
                    :aria-pressed="revealedNames.has(participant.id)"
                    @click.stop="toggleName(participant.id)"
                  >
                    <MoreHorizontal class="size-3.5" />
                  </button>
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

.meeting-layout-enter-active,
.meeting-layout-leave-active {
  transition:
    opacity 0.32s ease,
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.meeting-layout-leave-active {
  pointer-events: none;
}

.meeting-layout-enter-from {
  opacity: 0;
  transform: scale(0.97);
}

.meeting-layout-leave-to {
  opacity: 0;
  transform: scale(1.025);
}

@media (prefers-reduced-motion: reduce) {
  .meeting-grid-tile,
  .meeting-layout-enter-active,
  .meeting-layout-leave-active {
    transition: none;
  }
}
</style>
