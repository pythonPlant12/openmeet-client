<script setup lang="ts">
import { MaximizeAnimated, MinimizeAnimated, PinAnimated, PinOffAnimated } from '@respeak/lucide-motion-vue';
import { Eye, EyeOff, MonitorUp } from 'lucide-vue-next';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ParticipantNameTag from '@/components/meeting-page/ParticipantNameTag.vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import LiquidMenuIcon from '@/components/ui/liquid-menu/LiquidMenuIcon.vue';
import { LoadingRipple } from '@/components/ui/loading';
import { userStatusOption } from '@/config/user-status.config';
import type { UserStatus } from '@/services/social-api';
import type { Participant } from '@/xstate/machines/webrtc/types';

interface Props {
  participant: Participant;
  /** Only registered participants have a status; guests show none. */
  status?: UserStatus | null;
  /** The person's avatar, shown while the camera is off and in the name tag; initials show without one. */
  avatarUrl?: string;
  /** The participant is the active speaker. */
  speaking?: boolean;
  size?: 'full' | 'sidebar' | 'mobile' | 'grid';
  isExpanded?: boolean;
  interactive?: boolean;
  /** Small strip tiles hide the name until it is asked for. */
  showNameTag?: boolean;
  /** How the video fills the tile; by default only large and screen tiles fit whole. */
  fit?: 'cover' | 'contain';
  /** Full screen shows the media on a near-black background. */
  dark?: boolean;
  /** Full screen's main tile runs edge to edge, without corners, border, or shadow. */
  bleed?: boolean;
  /** The name tag opens a menu with pin, full screen, and the participant's options. */
  showActions?: boolean;
  /** This tile is the one shown in full screen, so its menu offers to leave full screen. */
  isFullscreen?: boolean;
  /** The tile's menu can show or hide the name, for small tiles that hide it. */
  nameToggle?: boolean;
  /** The call controls are hidden, so the name tag shrinks to the mic-off icon. */
  collapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'grid',
  isExpanded: false,
  interactive: true,
  status: null,
  speaking: false,
  showNameTag: true,
  fit: undefined,
  dark: false,
  bleed: false,
  showActions: true,
  isFullscreen: false,
  nameToggle: false,
  collapsed: false,
});
const { t } = useI18n();

const emit = defineEmits<{
  (e: 'click'): void;
  /** The video's width / height, so the layout can keep portrait and landscape cameras uncropped. */
  (e: 'aspect', aspect: number): void;
  (e: 'togglePin'): void;
  (e: 'toggleFullscreen'): void;
  (e: 'toggleName'): void;
}>();

// The tile shrinks slightly while pressed, so a touch visibly lands; pointer events work on every platform.
const pressed = ref(false);
const isOptionsOpen = ref(false);

const videoRef = ref<HTMLVideoElement | null>(null);
// A remote camera is "loading" from joining until its first frame renders.
const hasVideoFrames = ref(false);
const isMediaLoading = computed(
  () =>
    !props.participant.isLocal &&
    props.participant.videoEnabled &&
    (!props.participant.stream || (props.participant.stream.getVideoTracks().length > 0 && !hasVideoFrames.value)),
);

function reportAspect() {
  const video = videoRef.value;
  if (video && video.videoWidth > 0 && video.videoHeight > 0) emit('aspect', video.videoWidth / video.videoHeight);
}

function markVideoFrames() {
  if (!videoRef.value || videoRef.value.videoWidth <= 0) return;
  hasVideoFrames.value = true;
  reportAspect();
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
      return 'size-full';
    case 'grid':
    default:
      return 'w-full h-full';
  }
});

const statusOption = computed(() => (props.status ? userStatusOption(props.status) : null));
// While the call controls are hidden only a muted person keeps a (shrunk) name tag.
const showsNameTag = computed(() => props.showNameTag && (!props.collapsed || !props.participant.audioEnabled));
const nameTagProps = computed(() => ({
  name: props.participant.name,
  isLocal: props.participant.isLocal,
  muted: !props.participant.audioEnabled,
  collapsed: props.collapsed,
  align: 'start' as const,
  compact: isCompact.value,
  statusLabel: statusLabel.value,
}));
// "Appear offline" is a choice the person made; everyone else sees it as plain offline.
const statusLabel = computed(() =>
  props.status === 'offline' ? t('meeting.participant.offline') : (statusOption.value?.label ?? ''),
);
const isCompact = computed(() => props.size === 'sidebar' || props.size === 'mobile');

// Screens are never cropped or mirrored, so their text stays whole and readable.
const isScreen = computed(() => !!props.participant.screenShareOf);
const objectFitClass = computed(() => {
  if (isScreen.value) return 'object-contain';
  if (props.fit) return props.fit === 'cover' ? 'object-cover' : 'object-contain';
  return props.size === 'full' ? 'object-contain' : 'object-cover';
});
const surfaceClass = computed(() => (props.dark ? 'bg-[#161C1E]' : 'bg-harbor-line'));

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
  <div
    :class="['group relative', sizeClasses]"
    data-testid="participant-tile"
    :data-participant-id="participant.id"
    :data-participant-local="participant.isLocal"
    :data-screen-share="isScreen"
    :data-speaking="speaking"
    :data-pressed="pressed || undefined"
  >
    <component
      :is="interactive ? 'button' : 'div'"
      :type="interactive ? 'button' : undefined"
      :class="[
        'relative size-full overflow-hidden text-left transition-[border-color,box-shadow,transform] duration-300',
        bleed ? 'rounded-none border-0' : 'rounded-[1.4rem] border-2 shadow-[0_16px_40px_rgba(16,47,53,0.12)]',
        surfaceClass,
        speaking
          ? 'border-harbor-accent ring-[3px] ring-harbor-accent/25'
          : dark
            ? 'border-transparent'
            : 'border-harbor-line',
        interactive
          ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-faint'
          : '',
        pressed ? 'scale-[0.97] duration-100' : '',
      ]"
      data-participant-surface
      :aria-label="
        interactive
          ? t(isExpanded ? 'meeting.participant.unpin' : 'meeting.participant.pin', { name: participant.name })
          : undefined
      "
      :aria-pressed="interactive ? isExpanded : undefined"
      @pointerdown="pressed = interactive"
      @pointerup="pressed = false"
      @pointercancel="pressed = false"
      @pointerleave="pressed = false"
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
        @loadedmetadata="
          reportAspect();
          playAttachedVideo();
        "
        @canplay="playAttachedVideo"
        @loadeddata="markVideoFrames"
        @playing="markVideoFrames"
        @resize="markVideoFrames"
        :class="[
          'w-full h-full',
          bleed ? 'rounded-none' : 'rounded-[1.25rem]',
          surfaceClass,
          objectFitClass,
          { hidden: !participant.videoEnabled, '-scale-x-100': participant.isLocal && !isScreen },
        ]"
      />

      <!-- Avatar (shown when no stream or video disabled) -->
      <div
        v-if="!participant.stream || !participant.videoEnabled"
        data-participant-avatar
        class="absolute inset-0 flex items-center justify-center"
        :class="surfaceClass"
      >
        <div
          :class="[
            'flex items-center justify-center overflow-hidden rounded-full bg-harbor-accent font-bold text-harbor-app shadow-[0_8px_24px_rgba(16,47,53,0.25)]',
            size === 'sidebar' || size === 'mobile' ? 'w-12 h-12 text-xl' : 'w-28 h-28 text-4xl',
          ]"
        >
          <MonitorUp v-if="isScreen" :class="size === 'sidebar' || size === 'mobile' ? 'size-5' : 'size-10'" />
          <img v-else-if="avatarUrl" :src="avatarUrl" alt="" class="size-full object-cover" />
          <template v-else>{{ initials }}</template>
        </div>
      </div>

      <!-- Media loading: shown until a remote camera renders its first frame -->
      <div
        v-if="isMediaLoading"
        data-participant-loading
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-harbor-accent backdrop-blur-[2px]"
        :class="dark ? 'bg-[#161C1E]/70' : 'bg-harbor-line/70'"
        role="status"
      >
        <LoadingRipple :size="isCompact ? 'sm' : 'lg'" />
        <span v-if="!isCompact" class="text-sm font-semibold text-harbor-ink-soft">{{
          t('meeting.participant.connecting')
        }}</span>
        <span v-else class="sr-only">{{ t('meeting.participant.connecting') }}</span>
      </div>
    </component>

    <ParticipantNameTag v-if="showsNameTag && !showActions" v-bind="nameTagProps" />

    <!-- Per-person actions open from the name tag; tiles carry no other buttons. -->
    <DropdownMenu v-if="showActions" v-model:open="isOptionsOpen" :modal="false">
      <DropdownMenuTrigger as-child>
        <ParticipantNameTag
          v-show="showsNameTag"
          v-bind="nameTagProps"
          as="button"
          :aria-label="t('meeting.participant.options', { name: participant.name })"
          @click.stop
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" :side-offset="6" class="w-60 max-w-[calc(100vw-1.5rem)]">
        <DropdownMenuItem @select="emit('togglePin')">
          <LiquidMenuIcon v-if="isExpanded" :animated="PinOffAnimated" />
          <LiquidMenuIcon v-else :animated="PinAnimated" />
          <span class="min-w-0 flex-1 truncate">{{
            t(isExpanded ? 'meeting.participant.unpin' : 'meeting.participant.pin', { name: participant.name })
          }}</span>
        </DropdownMenuItem>
        <DropdownMenuItem @select="emit('toggleFullscreen')">
          <LiquidMenuIcon v-if="isFullscreen" :animated="MinimizeAnimated" />
          <LiquidMenuIcon v-else :animated="MaximizeAnimated" />
          {{ t(isFullscreen ? 'meeting.actions.exitFullscreen' : 'meeting.actions.fullscreen') }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="nameToggle" @select="emit('toggleName')">
          <LiquidMenuIcon :fallback="showNameTag ? EyeOff : Eye" />
          {{ t(showNameTag ? 'meeting.participant.hideName' : 'meeting.participant.showName') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
