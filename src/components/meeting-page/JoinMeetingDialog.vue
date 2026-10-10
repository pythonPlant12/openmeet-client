<script setup lang="ts">
import { Lock, Mic, MicOff, ShieldAlert, User, Video, VideoOff } from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingRipple } from '@/components/ui/loading';
import { useMediaDevices } from '@/composables/useMediaDevices';
import type { GroupAccessPolicy, MeetingRoomAccess, MeetingRoomSettings } from '@/services/social-api';

import MeetingAccessPicker from './MeetingAccessPicker.vue';
import MeetingSelect from './MeetingSelect.vue';

interface Props {
  open: boolean;
  meetingId: string;
  initialName?: string;
  showNameInput?: boolean;
  /** Access rules of the room; null while loading and for conversation calls. */
  access?: MeetingRoomAccess | null;
  /** Why the last join attempt was refused, such as a wrong password. */
  accessError?: string;
  joining?: boolean;
}

export interface JoinSettings {
  name: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioDeviceId: string | null;
  videoDeviceId: string | null;
  /** The password a password-protected room asked for. */
  password?: string;
  /** New access settings the host chose; omitted when unchanged. */
  accessSettings?: MeetingRoomSettings;
}

interface Emits {
  (e: 'join', settings: JoinSettings): void;
  (e: 'cancel'): void;
}

const props = withDefaults(defineProps<Props>(), {
  initialName: '',
  showNameInput: true,
  access: null,
  accessError: '',
  joining: false,
});
const emit = defineEmits<Emits>();
const { t } = useI18n();

// Form state
const participantName = ref(props.initialName);
const audioEnabled = ref(true);
const videoEnabled = ref(true);
const error = ref('');

// Device selection
const selectedAudioDeviceId = ref('');
const selectedVideoDeviceId = ref('');

// Preview
const previewStream = ref<MediaStream | null>(null);
const videoPreviewRef = ref<HTMLVideoElement | null>(null);
const isLoadingPreview = ref(false);
let previewRequestId = 0;
let isUnmounted = false;

// Media devices composable
const {
  audioDevices,
  videoDevices,
  isAudioDenied,
  isVideoDenied,
  hasAllPermissions,
  requestPermissions,
  // checkPermissions,
} = useMediaDevices();

// Room access: the host chooses who may join; everyone else may need the password.
const accessPolicy = ref<GroupAccessPolicy>(props.access?.accessPolicy ?? 'open');
const accessPassword = ref('');
const joinPassword = ref('');
watch(
  () => props.access?.accessPolicy,
  (policy) => {
    if (policy) accessPolicy.value = policy;
  },
);
const isHost = computed(() => !!props.access?.managed && props.access.isOwner);
const isRefused = computed(() => !!props.access && !props.access.canJoin && !props.access.requiresPassword);
const needsNewAccessPassword = computed(
  () => isHost.value && accessPolicy.value === 'password' && props.access?.accessPolicy !== 'password',
);
const accessReady = computed(() => {
  if (isRefused.value) return false;
  if (props.access?.requiresPassword) return joinPassword.value.length > 0;
  if (accessPolicy.value === 'password' && accessPassword.value) return accessPassword.value.length >= 4;
  return !needsNewAccessPassword.value;
});

const canJoin = computed(() => {
  return participantName.value.trim().length >= 2 && hasAllPermissions.value && accessReady.value && !props.joining;
});

// Start/stop preview based on video toggle
watch(videoEnabled, (enabled) => {
  if (enabled) {
    startPreview();
  } else {
    stopPreview();
  }
});

// Restart preview when device changes
watch(selectedVideoDeviceId, () => {
  if (videoEnabled.value) startPreview();
});

const startPreview = async () => {
  isLoadingPreview.value = true;
  stopPreview();
  const requestId = ++previewRequestId;

  try {
    const constraints: MediaStreamConstraints = {
      video: selectedVideoDeviceId.value ? { deviceId: { exact: selectedVideoDeviceId.value } } : true,
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (isUnmounted || requestId !== previewRequestId) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    previewStream.value = stream;

    if (videoPreviewRef.value && previewStream.value) {
      videoPreviewRef.value.srcObject = previewStream.value;
      await videoPreviewRef.value.play().catch(() => {});
    }
  } catch (err) {
    if (isUnmounted || requestId !== previewRequestId) return;
    if (err instanceof Error && err.name === 'NotAllowedError') {
      videoEnabled.value = false;
    } else {
      console.error('[JoinMeetingDialog] Failed to start preview:', err);
    }
  } finally {
    if (requestId === previewRequestId) isLoadingPreview.value = false;
  }
};

const stopPreview = () => {
  previewRequestId += 1;
  previewStream.value?.getTracks().forEach((track) => track.stop());
  previewStream.value = null;
  if (videoPreviewRef.value) videoPreviewRef.value.srcObject = null;
};

const handleJoin = () => {
  const name = participantName.value.trim();

  if (!name || name.length < 2) {
    error.value = name ? t('meeting.join.nameTooShort') : t('meeting.join.nameRequired');
    return;
  }
  if (name.length > 50) {
    error.value = t('meeting.join.nameTooLong');
    return;
  }
  if (!hasAllPermissions.value) {
    error.value = t('meeting.join.permissionsValidation');
    return;
  }

  if (!accessReady.value) return;

  sessionStorage.setItem('participantName', name);
  // The preview keeps running while the parent checks access, so a refused join keeps the dialog usable.

  const accessChanged =
    isHost.value && (accessPolicy.value !== props.access?.accessPolicy || accessPassword.value.length > 0);
  emit('join', {
    name,
    audioEnabled: audioEnabled.value,
    videoEnabled: videoEnabled.value,
    audioDeviceId: selectedAudioDeviceId.value || null,
    videoDeviceId: selectedVideoDeviceId.value || null,
    ...(props.access?.requiresPassword ? { password: joinPassword.value } : {}),
    ...(accessChanged
      ? {
          accessSettings: {
            accessPolicy: accessPolicy.value,
            ...(accessPolicy.value === 'password' && accessPassword.value ? { password: accessPassword.value } : {}),
          },
        }
      : {}),
  });
};

const handleCancel = () => {
  stopPreview();
  emit('cancel');
};

const toggleAudio = () => {
  if (!isAudioDenied.value) audioEnabled.value = !audioEnabled.value;
};

const toggleVideo = () => {
  if (!isVideoDenied.value) videoEnabled.value = !videoEnabled.value;
};

const initials = computed(() => {
  const name = participantName.value || t('meeting.fallbackUser');
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

onMounted(async () => {
  await requestPermissions();
  if (isUnmounted) return;

  // Set default devices
  if (audioDevices.value.length > 0) {
    selectedAudioDeviceId.value = audioDevices.value[0].deviceId;
  }
  if (videoDevices.value.length > 0) {
    selectedVideoDeviceId.value = videoDevices.value[0].deviceId;
  }

  if (videoEnabled.value) {
    startPreview();
  }
});

onUnmounted(() => {
  isUnmounted = true;
  stopPreview();
});
</script>

<template>
  <Dialog :open="open" :modal="false">
    <DialogContent
      overlay-class="pointer-events-none bg-white/55 backdrop-blur-[2px]"
      class="marketing-font fixed left-1/2 top-[calc(50%+2.25rem)] max-h-[calc(100dvh-6rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border-transparent bg-white text-[#102F35] shadow-[0_24px_70px_rgba(16,47,53,0.14)] sm:max-w-lg"
    >
      <DialogHeader>
        <DialogTitle class="flex items-center justify-center sm:justify-start gap-2">
          <User class="h-5 w-5" />
          {{ t('meeting.join.title') }}
        </DialogTitle>
        <DialogDescription class="text-[#4E6B70]">
          {{ t('meeting.join.description') }}
          <span class="font-mono text-xs block mt-1 text-[#4E6B70]">{{ meetingId }}</span>
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- Camera Preview -->
        <div class="relative aspect-video overflow-hidden rounded-2xl bg-[#E2E8F0]">
          <video
            v-show="videoEnabled && previewStream && !isVideoDenied"
            ref="videoPreviewRef"
            autoplay
            playsinline
            muted
            class="w-full h-full object-cover mirror"
          />

          <!-- Avatar when video is off -->
          <div
            v-if="!videoEnabled || !previewStream || isVideoDenied"
            class="absolute inset-0 flex items-center justify-center bg-[#E2E8F0]"
          >
            <div class="w-20 h-20 rounded-[28%] bg-[#0B7A75] flex items-center justify-center">
              <span class="text-2xl font-bold text-white">{{ initials }}</span>
            </div>
          </div>

          <!-- Loading indicator -->
          <div
            v-if="isLoadingPreview && videoEnabled && !isVideoDenied"
            class="absolute inset-0 flex items-center justify-center bg-[#CBD5E1]/80"
          >
            <LoadingRipple class="size-8 text-[#0B7A75]" />
          </div>

          <!-- Video status overlays -->
          <div
            v-if="isVideoDenied"
            class="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#F2765F]/90 px-3 py-1.5 rounded text-sm text-white flex items-center gap-2"
          >
            <VideoOff class="h-4 w-4" />
            {{ t('meeting.join.cameraBlocked') }}
          </div>
          <div
            v-else-if="!videoEnabled"
            class="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded text-sm text-white"
          >
            {{ t('meeting.join.cameraOff') }}
          </div>
        </div>

        <!-- Media Controls Row -->
        <div class="flex gap-3">
          <!-- Audio Button -->
          <Button
            v-if="!isAudioDenied"
            variant="outline"
            size="lg"
            :class="[
              'meeting-setting-action min-w-0 flex-1 h-14 px-3 flex items-center justify-center gap-2 !border-transparent transition-colors focus-visible:ring-0 focus-visible:ring-offset-0',
              audioEnabled
                ? 'meeting-setting-on border-transparent bg-[#E6F4F1] text-[#102F35]'
                : 'meeting-setting-off border-transparent bg-[#F2765F]/10 text-[#F2765F]',
            ]"
            @click="toggleAudio"
          >
            <Mic v-if="audioEnabled" class="h-5 w-5" />
            <MicOff v-else class="h-5 w-5" />
            <span class="text-sm">{{ audioEnabled ? t('meeting.join.micOn') : t('meeting.join.micOff') }}</span>
          </Button>

          <!-- Audio Permission Denied -->
          <div v-else class="flex-1 relative group">
            <Button
              variant="outline"
              size="lg"
              class="h-14 w-full min-w-0 px-3 flex items-center justify-center gap-2 border-[#F2765F] bg-[#F2765F]/10 text-[#F2765F] cursor-not-allowed"
              disabled
            >
              <MicOff class="h-5 w-5" />
              <span class="text-sm">{{ t('meeting.join.micBlocked') }}</span>
            </Button>
            <div
              class="marketing-font absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#E6F4F1] border border-[#D8E7E3] rounded-lg shadow-lg text-xs text-[#102F35] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
            >
              {{ t('meeting.join.browserPermission') }}
            </div>
          </div>

          <!-- Video Button -->
          <Button
            v-if="!isVideoDenied"
            variant="outline"
            size="lg"
            :class="[
              'meeting-setting-action min-w-0 flex-1 h-14 px-3 flex items-center justify-center gap-2 !border-transparent transition-colors focus-visible:ring-0 focus-visible:ring-offset-0',
              videoEnabled
                ? 'meeting-setting-on bg-[#E6F4F1] text-[#102F35]'
                : 'meeting-setting-off bg-[#F2765F]/10 text-[#F2765F]',
            ]"
            @click="toggleVideo"
          >
            <Video v-if="videoEnabled" class="h-5 w-5" />
            <VideoOff v-else class="h-5 w-5" />
            <span class="text-sm">
              {{ videoEnabled ? t('meeting.join.cameraOn') : t('meeting.join.cameraToggleOff') }}
            </span>
          </Button>

          <!-- Video Permission Denied -->
          <div v-else class="flex-1 relative group">
            <Button
              variant="outline"
              size="lg"
              class="h-14 w-full min-w-0 px-3 flex items-center justify-center gap-2 border-[#F2765F] bg-[#F2765F]/10 text-[#F2765F] cursor-not-allowed"
              disabled
            >
              <VideoOff class="h-5 w-5" />
              <span class="text-sm">{{ t('meeting.join.cameraBlocked') }}</span>
            </Button>
            <div
              class="marketing-font absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#E6F4F1] border border-[#D8E7E3] rounded-lg shadow-lg text-xs text-[#102F35] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
            >
              {{ t('meeting.join.browserPermission') }}
            </div>
          </div>
        </div>

        <!-- Device Selection -->
        <div v-if="hasAllPermissions" class="grid grid-cols-2 gap-3">
          <!-- Microphone Select -->
          <div class="space-y-1.5">
            <Label class="text-xs text-[#4E6B70]">{{ t('meeting.join.microphone') }}</Label>
            <MeetingSelect
              v-model="selectedAudioDeviceId"
              :options="
                audioDevices.map((device, index) => ({
                  value: device.deviceId,
                  label: device.label || t('meeting.join.microphoneFallback', { number: index + 1 }),
                }))
              "
              :placeholder="t('meeting.join.noMicrophones')"
            />
          </div>

          <!-- Camera Select -->
          <div class="space-y-1.5">
            <Label class="text-xs text-[#4E6B70]">{{ t('meeting.join.camera') }}</Label>
            <MeetingSelect
              v-model="selectedVideoDeviceId"
              :options="
                videoDevices.map((device, index) => ({
                  value: device.deviceId,
                  label: device.label || t('meeting.join.cameraFallback', { number: index + 1 }),
                }))
              "
              :placeholder="t('meeting.join.noCameras')"
            />
          </div>
        </div>

        <!-- Room access -->
        <MeetingAccessPicker
          v-if="isHost"
          v-model:policy="accessPolicy"
          v-model:password="accessPassword"
          :has-password="access?.accessPolicy === 'password'"
          :disabled="joining"
        />
        <div v-else-if="access?.requiresPassword" class="space-y-1.5" data-meeting-password>
          <Label for="meeting-password" class="flex items-center gap-1.5">
            <Lock class="size-3.5 text-[#0B7A75]" />{{ t('meeting.join.passwordLabel') }}
          </Label>
          <Input
            id="meeting-password"
            v-model="joinPassword"
            type="password"
            autocomplete="off"
            maxlength="256"
            :placeholder="t('meeting.join.passwordPlaceholder')"
            class="border-[#D8E7E3] bg-white text-[#102F35] placeholder:text-[#4E6B70]"
            @keyup.enter="handleJoin"
          />
        </div>
        <p
          v-else-if="isRefused"
          class="flex items-start gap-2 rounded-xl bg-[#FFF0EA] px-3 py-2.5 text-sm text-[#9D4636]"
          data-meeting-refused
        >
          <ShieldAlert class="mt-0.5 size-4 shrink-0" />{{ access?.deniedReason }}
        </p>
        <p v-if="accessError" class="text-sm text-[#F2765F]" data-meeting-access-error>{{ accessError }}</p>

        <!-- Name input -->
        <div v-if="showNameInput" class="space-y-2">
          <Label for="participant-name">{{ t('meeting.join.yourName') }}</Label>
          <Input
            id="participant-name"
            v-model="participantName"
            type="text"
            :placeholder="t('meeting.join.namePlaceholder')"
            class="border-[#D8E7E3] bg-white text-[#102F35] placeholder:text-[#4E6B70]"
            maxlength="50"
            @keyup.enter="handleJoin"
            @input="error = ''"
          />
          <p v-if="error" class="text-sm text-[#F2765F]">{{ error }}</p>
        </div>
      </div>

      <DialogFooter class="flex-col gap-3 sm:flex-row sm:justify-between">
        <p v-if="!hasAllPermissions" class="w-full text-center text-sm text-[#F2765F] sm:text-left">
          {{ t('meeting.join.permissionsRequired') }}
        </p>
        <div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:justify-end">
          <Button
            variant="outline"
            class="meeting-setting-action meeting-setting-on w-full border-transparent bg-[#E6F4F1] text-[#102F35] sm:w-auto"
            @click="handleCancel"
          >
            {{ t('common.cancel') }}
          </Button>
          <Button
            class="meeting-primary-action w-full bg-[#0B7A75] text-white sm:w-auto"
            @click="handleJoin"
            :disabled="!canJoin"
          >
            <LoadingRipple v-if="joining" size="sm" />
            <template v-else>{{ t('meeting.join.title') }}</template>
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.mirror {
  transform: scaleX(-1);
}
</style>
