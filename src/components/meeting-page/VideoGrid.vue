<script setup lang="ts">
import { computed, ref } from 'vue';

import type { Participant } from '@/xstate/machines/webrtc/types';

import ParticipantTile from './ParticipantTile.vue';

interface Props {
  participants: Participant[];
}

const props = defineProps<Props>();

const focusedParticipantId = ref<string | null>(null);

const hasParticipants = computed(() => props.participants.length > 0);
const isSingleParticipant = computed(() => props.participants.length === 1);
const shouldUseTwoColumnsOnMobile = computed(() => props.participants.length > 3);

const focusedParticipant = computed(() => {
  if (!focusedParticipantId.value) return null;
  return props.participants.find((p) => p.id === focusedParticipantId.value);
});

const minimizedParticipants = computed(() => {
  if (!focusedParticipantId.value) return [];
  return props.participants.filter((p) => p.id !== focusedParticipantId.value);
});

const toggleFocus = (participantId: string) => {
  console.log('[VideoGrid] toggleFocus called with:', participantId);
  console.log('[VideoGrid] Current focusedParticipantId:', focusedParticipantId.value);

  if (focusedParticipantId.value === participantId) {
    focusedParticipantId.value = null;
  } else {
    focusedParticipantId.value = participantId;
  }

  console.log('[VideoGrid] New focusedParticipantId:', focusedParticipantId.value);
};
</script>

<template>
  <div class="flex-1 relative bg-[hsl(0,0%,8%)] w-full h-full">
    <!-- Single participant -->
    <div v-if="isSingleParticipant" class="absolute h-[78vh] inset-0 flex items-center justify-center p-8">
      <div class="relative w-full h-full max-w-6xl">
        <ParticipantTile :participant="participants[0]" size="full" :show-expand-icon="false" />
      </div>
    </div>

    <!-- Multiple participants -->
    <div v-else-if="hasParticipants" class="h-[68vh] mt-3 md:h-[84vh] w-full relative">
      <!-- Equal grid layout (no one focused) -->
      <div v-if="!focusedParticipantId" class="h-[82vh] sm:h-[84vh] w-full flex items-center justify-center p-4">
        <div
          :class="[
            'grid gap-4 w-full h-full max-w-7xl',
            shouldUseTwoColumnsOnMobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2',
          ]"
        >
          <ParticipantTile
            v-for="participant in participants"
            :key="participant.id"
            :participant="participant"
            size="grid"
            @click="toggleFocus(participant.id)"
          />
        </div>
      </div>

      <!-- Desktop: Expanded layout with sidebar -->
      <div v-else class="hidden md:flex h-full w-full gap-4 p-4">
        <!-- Main expanded video -->
        <div class="flex-1 relative min-w-0">
          <div class="h-full flex items-center justify-center">
            <div v-if="focusedParticipant" class="relative w-full h-full max-h-full">
              <ParticipantTile
                :participant="focusedParticipant"
                size="full"
                :is-expanded="true"
                @click="toggleFocus(focusedParticipant.id)"
              />
            </div>
          </div>
        </div>

        <!-- Desktop sidebar with minimized videos -->
        <div class="w-80 flex flex-col gap-4 overflow-y-auto justify-center">
          <ParticipantTile
            v-for="participant in minimizedParticipants"
            :key="participant.id"
            :participant="participant"
            size="sidebar"
            @click="toggleFocus(participant.id)"
          />
        </div>
      </div>

      <!-- Mobile: Expanded layout with bottom strip -->
      <div v-if="focusedParticipantId" class="md:hidden h-full w-full">
        <!-- Expanded video -->
        <div class="absolute inset-0 flex items-center justify-center">
          <div v-if="focusedParticipant" class="relative w-full h-full">
            <ParticipantTile
              :participant="focusedParticipant"
              size="full"
              :is-expanded="true"
              @click="toggleFocus(focusedParticipant.id)"
            />
          </div>
        </div>

        <!-- Mobile: Horizontal strip with minimized participants -->
        <div
          class="fixed bottom-24 left-0 right-0 h-20 flex gap-2 overflow-x-auto px-4 pb-2 bg-[hsl(0,0%,8%)] z-10 justify-center"
        >
          <ParticipantTile
            v-for="participant in minimizedParticipants"
            :key="participant.id"
            :participant="participant"
            size="mobile"
            @click="toggleFocus(participant.id)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
