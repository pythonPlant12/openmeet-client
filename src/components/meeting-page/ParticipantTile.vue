<script setup lang="ts">
import { MicOff, MonitorUp, Pin, PinOff, VideoOff } from 'lucide-vue-next';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { LoadingRipple } from '@/components/ui/loading';
import { userStatusOption } from '@/config/user-status.config';
import type { UserStatus } from '@/services/social-api';
import type { Participant } from '@/xstate/machines/webrtc/types';

interface Props {
  participant: Participant;
  /** Only registered participants have a status; guests show none. */
  status?: UserStatus | null;
  /** Image for the name tag's mini avatar; initials show without one. */
  avatarUrl?: string;
  /** The participant is the active speaker. */
  speaking?: boolean;
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
  status: null,
  speaking: false,
});
const { t } = useI18n();

const emit = defineEmits<{
  (e: 'click'): void;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
// A remote camera is "loading" from joining until its first frame renders.
const hasVideoFrames = ref(false);
const isMediaLoading = computed(
  () =>
    !props.participant.isLocal &&
    props.participant.videoEnabled &&
    (!props.participant.stream || (props.participant.stream.getVideoTracks().length > 0 && !hasVideoFrames.value)),
);

function markVideoFrames() {
  if (videoRef.value && videoRef.value.videoWidth > 0) hasVideoFrames.value = true;
}

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

const statusOption = computed(() => (props.status ? userStatusOption(props.status) : null));
// "Appear offline" is a choice the person made; everyone else sees it as plain offline.
const statusLabel = computed(() =>
  props.status === 'offline' ? t('meeting.participant.offline') : (statusOption.value?.label ?? ''),
);
const isCompact = computed(() => props.size === 'sidebar' || props.size === 'mobile');
// Only the large pinned tile has room to spell the status out; the others show its dot.
const showsStatusLabel = computed(() => !!statusOption.value && props.size === 'full');

// Screens are never cropped or mirrored, so their text stays whole and readable.
const isScreen = computed(() => !!props.participant.screenShareOf);
const objectFitClass = computed(() => {
  return props.size === 'full' || isScreen.value ? 'object-contain' : 'object-cover';
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
    hasVideoFrames.value = false;
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
      'relative group overflow-hidden rounded-[1.4rem] border-2 bg-[#E2E8F0] text-left shadow-[0_16px_40px_rgba(16,47,53,0.12)] transition-[border-color,box-shadow] duration-300',
      speaking
        ? 'border-[#0B7A75] shadow-[0_0_0_3px_rgba(11,122,117,0.22),0_16px_40px_rgba(16,47,53,0.12)]'
        : 'border-[#E2E8F0]',
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
    :data-screen-share="isScreen"
    :data-speaking="speaking"
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
      @loadeddata="markVideoFrames"
      @playing="markVideoFrames"
      @resize="markVideoFrames"
      :class="[
        'w-full h-full rounded-[1.25rem] bg-[#E2E8F0]',
        objectFitClass,
        { hidden: !participant.videoEnabled, '-scale-x-100': participant.isLocal && !isScreen },
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
        <MonitorUp v-if="isScreen" :class="size === 'sidebar' || size === 'mobile' ? 'size-5' : 'size-10'" />
        <template v-else>{{ initials }}</template>
      </div>
    </div>

    <!-- Media loading: shown until a remote camera renders its first frame -->
    <div
      v-if="isMediaLoading"
      data-participant-loading
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#E2E8F0]/70 text-[#0B7A75] backdrop-blur-[2px]"
      role="status"
    >
      <LoadingRipple :size="isCompact ? 'sm' : 'lg'" />
      <span v-if="!isCompact" class="text-sm font-semibold text-[#27595D]">{{
        t('meeting.participant.connecting')
      }}</span>
      <span v-else class="sr-only">{{ t('meeting.participant.connecting') }}</span>
    </div>

    <!-- Name tag: kept small and tucked into the corner so it covers little of the video. -->
    <div
      data-participant-name-tag
      :class="[
        'absolute flex items-center rounded-full bg-[#102F35]/75 text-white backdrop-blur',
        isCompact
          ? 'bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] gap-1 py-0.5 pl-0.5 pr-2 text-[11px]'
          : 'bottom-2 left-2 max-w-[calc(100%-1rem)] gap-1.5 py-0.5 pl-0.5 pr-2.5 text-xs',
      ]"
    >
      <span class="relative shrink-0">
        <span
          data-participant-mini-avatar
          :class="[
            'flex items-center justify-center overflow-hidden rounded-full bg-[#0B7A75] font-semibold text-white',
            isCompact ? 'size-4 text-[7px]' : 'size-5 text-[8px]',
          ]"
          aria-hidden="true"
        >
          <MonitorUp v-if="isScreen" class="size-3" />
          <img v-else-if="avatarUrl" :src="avatarUrl" alt="" class="size-full object-cover" />
          <template v-else>{{ initials }}</template>
        </span>
        <span
          v-if="statusOption"
          data-participant-status
          :data-status="status"
          class="absolute -bottom-px -right-px size-2 rounded-full ring-[1.5px] ring-[#102F35]"
          :class="statusOption.dotClass"
          aria-hidden="true"
        />
      </span>
      <span class="truncate font-medium">{{ participant.name }}</span>
      <span v-if="participant.isLocal" class="shrink-0 text-[#66D0C8]">{{ t('meeting.you') }}</span>
      <span v-if="showsStatusLabel" class="shrink-0 border-l border-white/25 pl-1.5 text-white/80">{{
        statusLabel
      }}</span>
      <span v-if="statusOption" class="sr-only">{{ t('meeting.participant.status', { status: statusLabel }) }}</span>
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
      class="absolute inset-0 hidden items-center justify-center rounded-[1.25rem] bg-black/0 transition-colors md:flex md:group-hover:bg-black/20"
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
