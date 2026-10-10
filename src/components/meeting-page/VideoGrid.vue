<script setup lang="ts">
import { useElementSize } from '@vueuse/core';
import { MoreHorizontal } from 'lucide-vue-next';
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { DEFAULT_TILE_ASPECT, fitTilesInRows } from '@/lib/meeting-layout';
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
}>();

const emit = defineEmits<{
  togglePin: [participantId: string];
}>();
const { t } = useI18n();

const TILE_GAP = 12;
/** Height of the phone strip that holds everyone except the pinned person; it shrinks to fit, then scrolls. */
const STRIP_TILE_HEIGHT = 96;
const MIN_STRIP_TILE_HEIGHT = 64;
const STRIP_GAP = 8;
/** Height of the desktop sidebar tiles beside the pinned person. */
const SIDEBAR_TILE_HEIGHT = 176;
const SIDEBAR_WIDTH = 320;

const hasParticipants = computed(() => props.participants.length > 0);
const speakerParticipant = computed(() => {
  const requestedId = props.pinnedParticipantId || props.activeSpeakerId;
  return props.participants.find((participant) => participant.id === requestedId) ?? props.participants[0] ?? null;
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

// Speaker view: the pinned video is sized to its own shape inside the stage instead of letterboxed.
const desktopStage = ref<HTMLElement | null>(null);
const mobileStage = ref<HTMLElement | null>(null);
const { width: desktopStageWidth, height: desktopStageHeight } = useElementSize(desktopStage);
const { width: mobileStageWidth, height: mobileStageHeight } = useElementSize(mobileStage);
function stageStyle(width: number, height: number) {
  const participant = speakerParticipant.value;
  if (!participant) return {};
  const aspect = aspectOf(participant);
  const [row] = fitTilesInRows([aspect], width, height, 0);
  return row ? { width: `${Math.floor(row.height * aspect)}px`, height: `${row.height}px` } : {};
}
const desktopStageStyle = computed(() => stageStyle(desktopStageWidth.value, desktopStageHeight.value));
const mobileStageStyle = computed(() => stageStyle(mobileStageWidth.value, mobileStageHeight.value));
const sidebarStyle = (participant: Participant) => ({
  width: `${Math.min(SIDEBAR_WIDTH, Math.floor(SIDEBAR_TILE_HEIGHT * aspectOf(participant)))}px`,
  height: `${SIDEBAR_TILE_HEIGHT}px`,
});
const stripHeight = computed(() => {
  const aspectSum = secondaryParticipants.value.reduce((sum, participant) => sum + aspectOf(participant), 0);
  const available = mobileStageWidth.value - STRIP_GAP * (secondaryParticipants.value.length - 1);
  if (!aspectSum || available <= 0) return STRIP_TILE_HEIGHT;
  return Math.max(MIN_STRIP_TILE_HEIGHT, Math.min(STRIP_TILE_HEIGHT, Math.floor(available / aspectSum)));
});
const stripStyle = (participant: Participant) => ({
  width: `${Math.floor(stripHeight.value * aspectOf(participant))}px`,
});

// Strip tiles on phones hide names to keep the small videos clear; the ⋯ button reveals one.
const revealedNames = reactive(new Set<string>());
function toggleName(participantId: string) {
  if (revealedNames.has(participantId)) revealedNames.delete(participantId);
  else revealedNames.add(participantId);
}
</script>

<template>
  <div
    class="relative h-full w-full flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0B7A75]"
    data-testid="meeting-video-canvas"
    :data-view-mode="viewMode"
    tabindex="0"
    :aria-label="t('meeting.actions.videoCanvas')"
  >
    <!-- The video area fills the space between the top row (participants and actions buttons) and the bottom
         control bar, so no tile hides under either. -->
    <div v-if="hasParticipants" class="fixed inset-x-0 bottom-[5.5rem] top-[9.5rem] sm:bottom-[6.5rem] sm:top-[10rem]">
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
              size="grid"
              @aspect="setAspect(participant.id, $event)"
              @click="emit('togglePin', participant.id)"
            />
          </div>
        </div>

        <div v-else key="speaker" class="absolute inset-0 h-full w-full">
          <div class="hidden h-full w-full gap-4 p-4 md:flex">
            <div ref="desktopStage" class="relative flex min-w-0 flex-1 items-center justify-center">
              <ParticipantTile
                v-if="speakerParticipant"
                :style="desktopStageStyle"
                :participant="speakerParticipant"
                :status="participantStatuses?.[speakerParticipant.id]"
                :avatar-url="participantAvatars?.[speakerParticipant.id]"
                :speaking="isSpeaking(speakerParticipant)"
                size="full"
                :is-expanded="pinnedParticipantId === speakerParticipant.id"
                @aspect="setAspect(speakerParticipant.id, $event)"
                @click="emit('togglePin', speakerParticipant.id)"
              />
            </div>
            <div
              v-if="secondaryParticipants.length"
              class="flex w-80 flex-col items-center justify-center gap-4 overflow-y-auto"
            >
              <ParticipantTile
                v-for="participant in secondaryParticipants"
                :key="participant.id"
                class="shrink-0"
                :style="sidebarStyle(participant)"
                :participant="participant"
                :status="participantStatuses?.[participant.id]"
                :avatar-url="participantAvatars?.[participant.id]"
                :speaking="isSpeaking(participant)"
                size="sidebar"
                :is-expanded="pinnedParticipantId === participant.id"
                @aspect="setAspect(participant.id, $event)"
                @click="emit('togglePin', participant.id)"
              />
            </div>
          </div>

          <div class="flex h-full w-full flex-col gap-2 p-2 md:hidden">
            <div ref="mobileStage" class="relative flex min-h-0 flex-1 items-center justify-center">
              <ParticipantTile
                v-if="speakerParticipant"
                :style="mobileStageStyle"
                :participant="speakerParticipant"
                :status="participantStatuses?.[speakerParticipant.id]"
                :avatar-url="participantAvatars?.[speakerParticipant.id]"
                :speaking="isSpeaking(speakerParticipant)"
                size="full"
                :is-expanded="pinnedParticipantId === speakerParticipant.id"
                @aspect="setAspect(speakerParticipant.id, $event)"
                @click="emit('togglePin', speakerParticipant.id)"
              />
            </div>
            <div v-if="secondaryParticipants.length" class="shrink-0 overflow-x-auto" data-testid="participant-strip">
              <div class="mx-auto flex w-max gap-2" :style="{ height: `${stripHeight}px` }">
                <div
                  v-for="participant in secondaryParticipants"
                  :key="participant.id"
                  class="relative h-full shrink-0"
                  :style="stripStyle(participant)"
                >
                  <ParticipantTile
                    :participant="participant"
                    :status="participantStatuses?.[participant.id]"
                    :avatar-url="participantAvatars?.[participant.id]"
                    :speaking="isSpeaking(participant)"
                    size="mobile"
                    :show-name-tag="revealedNames.has(participant.id)"
                    :is-expanded="pinnedParticipantId === participant.id"
                    @aspect="setAspect(participant.id, $event)"
                    @click="emit('togglePin', participant.id)"
                  />
                  <button
                    type="button"
                    class="absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-lg bg-[#102F35]/75 text-white backdrop-blur"
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
