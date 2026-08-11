<script setup lang="ts">
import { MicOff, Pin, PinOff, VideoOff } from 'lucide-vue-next';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Participant } from '@/xstate/machines/webrtc/types';

interface Props {
  participant: Participant;
  size?: 'full' | 'sidebar' | 'mobile' | 'grid';
  isExpanded?: boolean;
  showExpandIcon?: boolean;
  interactive?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'grid',
  isExpanded: false,
  showExpandIcon: true,
  interactive: true,
});
const { t } = useI18n();

const emit = defineEmits<{
  (e: 'click'): void;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);

const playAttachedVideo = async () => {
  const video = videoRef.value;
  if (!video || !props.participant.stream) {
    return;
  }

  try {
    await video.play();
  } catch {
    // Ignore autoplay errors. Browser policy can require a user gesture for audio.
    console.log(`[ParticipantTile] Autoplay may be blocked for ${props.participant.name}`);
  }
};

const initials = computed(() => {
  const name = props.participant.name || t('meeting.fallbackUser');
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
    }

    props.participant.stream.getTracks().forEach((track) => {
      track.onunmute = () => {
        void playAttachedVideo();
      };
    });

    await playAttachedVideo();
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
  <component
    :is="interactive ? 'button' : 'div'"
    :type="interactive ? 'button' : undefined"
    :class="[
      'relative group rounded-[1.6rem] overflow-hidden border-[6px] border-[#CBD5E1] bg-[#E2E8F0] text-left shadow-[0_16px_40px_rgba(16,47,53,0.12)]',
      interactive ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9BCFC7]' : '',
      sizeClasses,
    ]"
    data-testid="participant-tile"
    :aria-label="
      interactive
        ? t(isExpanded ? 'meeting.participant.unpin' : 'meeting.participant.pin', { name: participant.name })
        : undefined
    "
    :aria-pressed="interactive ? isExpanded : undefined"
    :data-participant-id="participant.id"
    :data-participant-local="participant.isLocal"
    @click="interactive && emit('click')"
  >
    <!-- Video element (always present for audio playback, hidden when video disabled) -->
    <video
      v-if="participant.stream"
      ref="videoRef"
      data-testid="participant-video"
      :data-participant-id="participant.id"
      :data-participant-local="participant.isLocal"
      autoplay
      playsinline
      :muted="participant.isLocal"
      @loadedmetadata="playAttachedVideo"
      @canplay="playAttachedVideo"
      :class="[
        'w-full h-full rounded-[1.2rem] bg-[#E2E8F0]',
        objectFitClass,
        { hidden: !participant.videoEnabled, '-scale-x-100': participant.isLocal },
      ]"
    />

    <!-- Avatar (shown when no stream or video disabled) -->
    <div
      v-if="!participant.stream || !participant.videoEnabled"
      class="absolute inset-0 flex items-center justify-center bg-[#E2E8F0]"
    >
      <div
        :class="[
          'rounded-full bg-[#0B7A75] flex items-center justify-center font-bold text-white',
          size === 'sidebar' || size === 'mobile' ? 'w-12 h-12 text-xl' : 'w-24 h-24 text-4xl',
        ]"
      >
        {{ initials }}
      </div>
    </div>

    <!-- Name Badge -->
    <div
      :class="[
        'absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-[#102F35]/80 px-3 py-1 text-white backdrop-blur',
      ]"
    >
      <span>{{ participant.name }}</span>
      <span v-if="participant.isLocal" class="text-[#66D0C8]">{{ t('meeting.you') }}</span>
    </div>

    <!-- Audio/Video Status Indicators -->
    <div :class="['absolute right-2 flex gap-1', size === 'sidebar' || size === 'mobile' ? 'top-1' : 'top-4']">
      <div v-if="!participant.audioEnabled" class="p-1.5 bg-[#F2765F] rounded-full">
        <MicOff :class="size === 'sidebar' || size === 'mobile' ? 'h-3 w-3' : 'h-4 w-4'" class="text-white" />
      </div>
      <div v-if="!participant.videoEnabled" class="p-1.5 bg-[#F2765F] rounded-full">
        <VideoOff :class="size === 'sidebar' || size === 'mobile' ? 'h-3 w-3' : 'h-4 w-4'" class="text-white" />
      </div>
    </div>

    <!-- Hover Overlay with Pin Icon -->
    <div
      v-if="showExpandIcon"
      class="absolute inset-0 hidden items-center justify-center rounded-[1.2rem] bg-black/0 transition-colors md:flex md:group-hover:bg-black/20"
    >
      <PinOff
        v-if="isExpanded"
        :class="[
          'text-white opacity-0 group-hover:opacity-100 transition-opacity',
          size === 'sidebar' || size === 'mobile' ? 'h-5 w-5' : 'h-8 w-8',
        ]"
      />
      <Pin
        v-else
        :class="[
          'text-white opacity-0 group-hover:opacity-100 transition-opacity',
          size === 'sidebar' || size === 'mobile' ? 'h-5 w-5' : 'h-8 w-8',
        ]"
      />
    </div>
  </component>
</template>
