<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Participant } from '@/xstate/machines/webrtc/types';

import ParticipantTile from './ParticipantTile.vue';

type MeetingViewMode = 'grid' | 'speaker';

const props = defineProps<{
  activeSpeakerId: string | null;
  participants: Participant[];
  pinnedParticipantId: string | null;
  viewMode: MeetingViewMode;
}>();

const emit = defineEmits<{
  togglePin: [participantId: string];
}>();
const { t } = useI18n();

const hasParticipants = computed(() => props.participants.length > 0);
const shouldUseTwoColumnsOnMobile = computed(() => props.participants.length > 3);
const speakerParticipant = computed(() => {
  const requestedId = props.pinnedParticipantId || props.activeSpeakerId;
  return props.participants.find((participant) => participant.id === requestedId) ?? props.participants[0] ?? null;
});
const secondaryParticipants = computed(() =>
  props.participants.filter((participant) => participant.id !== speakerParticipant.value?.id),
);
</script>

<template>
  <div
    class="relative h-full w-full flex-1 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0B7A75]"
    data-testid="meeting-video-canvas"
    :data-view-mode="viewMode"
    tabindex="0"
    :aria-label="t('meeting.actions.videoCanvas')"
  >
    <div v-if="hasParticipants" class="relative mt-3 h-[68vh] w-full bg-white md:h-[84vh]">
      <Transition name="meeting-layout" mode="out-in">
        <div
          v-if="viewMode === 'grid'"
          key="grid"
          class="absolute inset-0 flex h-[82vh] w-full items-center justify-center p-4 sm:h-[84vh]"
        >
          <div
            :class="[
              'grid h-full w-full auto-rows-fr gap-3 sm:gap-4',
              participants.length === 1
                ? 'max-w-6xl grid-cols-1'
                : `max-w-7xl ${shouldUseTwoColumnsOnMobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`,
            ]"
          >
            <ParticipantTile
              v-for="participant in participants"
              :key="participant.id"
              :participant="participant"
              size="grid"
              :interactive="false"
              :show-expand-icon="false"
            />
          </div>
        </div>

        <div v-else key="speaker" class="absolute inset-0 h-full w-full">
          <div class="hidden h-full w-full gap-4 p-4 md:flex">
            <div class="relative min-w-0 flex-1">
              <ParticipantTile
                v-if="speakerParticipant"
                :participant="speakerParticipant"
                size="full"
                :is-expanded="pinnedParticipantId === speakerParticipant.id"
                @click="emit('togglePin', speakerParticipant.id)"
              />
            </div>
            <div v-if="secondaryParticipants.length" class="flex w-80 flex-col justify-center gap-4 overflow-y-auto">
              <ParticipantTile
                v-for="participant in secondaryParticipants"
                :key="participant.id"
                :participant="participant"
                size="sidebar"
                :is-expanded="pinnedParticipantId === participant.id"
                @click="emit('togglePin', participant.id)"
              />
            </div>
          </div>

          <div class="h-full w-full md:hidden">
            <div class="absolute inset-0 flex items-center justify-center p-3">
              <ParticipantTile
                v-if="speakerParticipant"
                :participant="speakerParticipant"
                size="full"
                :is-expanded="pinnedParticipantId === speakerParticipant.id"
                @click="emit('togglePin', speakerParticipant.id)"
              />
            </div>
            <div
              v-if="secondaryParticipants.length"
              class="fixed bottom-24 left-0 right-0 z-10 flex h-20 justify-center gap-2 overflow-x-auto border-t border-[#D8E7E3] bg-white/90 px-4 pb-2 pt-2 backdrop-blur"
            >
              <ParticipantTile
                v-for="participant in secondaryParticipants"
                :key="participant.id"
                :participant="participant"
                size="mobile"
                :is-expanded="pinnedParticipantId === participant.id"
                @click="emit('togglePin', participant.id)"
              />
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
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
  .meeting-layout-enter-active,
  .meeting-layout-leave-active {
    transition: none;
  }
}
</style>
