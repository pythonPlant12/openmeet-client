<script setup lang="ts">
import { Maximize2, MicOff, VideoOff } from 'lucide-vue-next';
import { computed, nextTick, onMounted, ref, watch } from 'vue';

import type { Participant } from '@/xstate/machines/webrtc/types';

interface Props {
  participant: Participant;
  size?: 'full' | 'sidebar' | 'mobile' | 'grid';
  isExpanded?: boolean;
  showExpandIcon?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'grid',
  isExpanded: false,
  showExpandIcon: true,
});

const emit = defineEmits<{
  (e: 'click'): void;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);

const initials = computed(() => {
  const name = props.participant.name || 'U';
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'full':
      return 'w-full h-full';
    case 'sidebar':
      return 'aspect-video';
    case 'mobile':
      return 'flex-shrink-0 w-36 h-full';
    case 'grid':
    default:
      return 'w-full h-full';
  }
});

const objectFitClass = computed(() => {
  return props.size === 'full' ? 'object-contain' : 'object-cover';
});

const attachStream = async () => {
  await nextTick();
  if (videoRef.value && props.participant.stream) {
    // Only set srcObject if it's different from what's currently set
    if (videoRef.value.srcObject !== props.participant.stream) {
      console.log(`[ParticipantTile] Attaching stream for ${props.participant.name}`);
      videoRef.value.srcObject = props.participant.stream;

      // Explicitly call play() to ensure video starts
      try {
        await videoRef.value.play();
      } catch {
        // Ignore autoplay errors
        console.log(`[ParticipantTile] Autoplay may be blocked for ${props.participant.name}`);
      }
    }
  }
};

watch(
  () => props.participant.stream,
  async (stream) => {
    console.log(`[ParticipantTile] Stream changed for ${props.participant.name}:`, stream);
    await attachStream();
  },
);

watch(
  () => props.participant.videoEnabled,
  async (enabled) => {
    console.log(`[ParticipantTile] videoEnabled changed for ${props.participant.name}:`, enabled);
    if (enabled) {
      await attachStream();
    }
  },
);

onMounted(async () => {
  console.log(`[ParticipantTile] Mounted for ${props.participant.name}`);
  await attachStream();
});
</script>

<template>
  <div
    :class="['relative cursor-pointer group rounded-lg overflow-hidden bg-[hsl(0,0%,12%)]', sizeClasses]"
    @click="emit('click')"
  >
    <!-- Video element (always present for audio playback, hidden when video disabled) -->
    <video
      v-if="participant.stream"
      ref="videoRef"
      autoplay
      playsinline
      :muted="participant.isLocal"
      :class="[
        'w-full h-full rounded-lg bg-[hsl(0,0%,12%)]',
        objectFitClass,
        { hidden: !participant.videoEnabled },
      ]"
    />

    <!-- Avatar (shown when no stream or video disabled) -->
    <div
      v-if="!participant.stream || !participant.videoEnabled"
      class="absolute inset-0 flex items-center justify-center bg-[hsl(0,0%,12%)]"
    >
      <div
        :class="[
          'rounded-full bg-primary flex items-center justify-center font-bold text-white',
          size === 'sidebar' || size === 'mobile' ? 'w-12 h-12 text-xl' : 'w-24 h-24 text-4xl',
        ]"
      >
        {{ initials }}
      </div>
    </div>

    <!-- Name Badge -->
    <div :class="['absolute left-2 px-2 py-1 bg-black/60 rounded text-white flex items-center gap-1 bottom-0']">
      <span>{{ participant.name }}</span>
      <span v-if="participant.isLocal" class="text-primary">(You)</span>
    </div>

    <!-- Audio/Video Status Indicators -->
    <div :class="['absolute right-2 flex gap-1', size === 'sidebar' || size === 'mobile' ? 'top-1' : 'top-4']">
      <div v-if="!participant.audioEnabled" class="p-1.5 bg-red-500 rounded-full">
        <MicOff :class="size === 'sidebar' || size === 'mobile' ? 'h-3 w-3' : 'h-4 w-4'" class="text-white" />
      </div>
      <div v-if="!participant.videoEnabled" class="p-1.5 bg-red-500 rounded-full">
        <VideoOff :class="size === 'sidebar' || size === 'mobile' ? 'h-3 w-3' : 'h-4 w-4'" class="text-white" />
      </div>
    </div>

    <!-- Hover Overlay with Expand Icon -->
    <div
      v-if="showExpandIcon"
      class="absolute inset-0 bg-black/0 transition-colors rounded-lg items-center justify-center hidden md:flex md:group-hover:bg-black/20"
    >
      <Maximize2
        :class="[
          'text-white opacity-0 group-hover:opacity-100 transition-opacity',
          size === 'sidebar' || size === 'mobile' ? 'h-5 w-5' : 'h-8 w-8',
        ]"
      />
    </div>
  </div>
</template>
