<script setup lang="ts">
import { ChevronDown, Mic, MicOff, User, Video, VideoOff } from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

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
import { useMediaDevices } from '@/composables/useMediaDevices';

interface Props {
  open: boolean;
  meetingId: string;
  initialName?: string;
  showNameInput?: boolean;
}

interface JoinSettings {
  name: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioDeviceId: string | null;
  videoDeviceId: string | null;
}

interface Emits {
  (e: 'join', settings: JoinSettings): void;
  (e: 'cancel'): void;
}

const props = withDefaults(defineProps<Props>(), {
  initialName: '',
  showNameInput: true,
});
const emit = defineEmits<Emits>();

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

// Media devices composable
const {
  audioPermission,
  videoPermission,
  audioDevices,
  videoDevices,
  isAudioDenied,
  isVideoDenied,
  hasAllPermissions,
  requestPermissions,
  checkPermissions,
} = useMediaDevices();

const canJoin = computed(() => {
  return participantName.value.trim().length >= 2 && hasAllPermissions.value;
});

// Set default devices when they become available
watch(audioDevices, (devices) => {
  if (!selectedAudioDeviceId.value && devices.length > 0) {
    selectedAudioDeviceId.value = devices[0].deviceId;
  }
});

watch(videoDevices, (devices) => {
  if (!selectedVideoDeviceId.value && devices.length > 0) {
    selectedVideoDeviceId.value = devices[0].deviceId;
  }
});

// Handle permission changes
watch(audioPermission, (state) => {
  if (state === 'denied') audioEnabled.value = false;
});

watch(videoPermission, (state) => {
  if (state === 'denied') {
    videoEnabled.value = false;
    stopPreview();
  } else if (state === 'granted' && videoEnabled.value) {
    startPreview();
  }
});

// Update name when prop changes
watch(
  () => props.initialName,
  (name) => {
    if (name) participantName.value = name;
  },
);

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
  if (!videoEnabled.value) {
    stopPreview();
    return;
  }

  isLoadingPreview.value = true;
  stopPreview();

  try {
    const constraints: MediaStreamConstraints = {
      video: selectedVideoDeviceId.value ? { deviceId: { exact: selectedVideoDeviceId.value } } : true,
      audio: false,
    };

    previewStream.value = await navigator.mediaDevices.getUserMedia(constraints);

    if (videoPreviewRef.value && previewStream.value) {
      videoPreviewRef.value.srcObject = previewStream.value;
      await videoPreviewRef.value.play().catch(() => {});
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      videoEnabled.value = false;
    } else {
      console.error('[JoinMeetingDialog] Failed to start preview:', err);
    }
  } finally {
    isLoadingPreview.value = false;
  }
};

const stopPreview = () => {
  previewStream.value?.getTracks().forEach((track) => track.stop());
  previewStream.value = null;
  if (videoPreviewRef.value) videoPreviewRef.value.srcObject = null;
};

const handleJoin = () => {
  const name = participantName.value.trim();

  if (!name || name.length < 2) {
    error.value = name ? 'Name must be at least 2 characters' : 'Please enter your name';
    return;
  }
  if (name.length > 50) {
    error.value = 'Name must be less than 50 characters';
    return;
  }
  if (!hasAllPermissions.value) {
    error.value = 'Camera and microphone permissions are required to join';
    return;
  }

  sessionStorage.setItem('participantName', name);
  stopPreview();

  emit('join', {
    name,
    audioEnabled: audioEnabled.value,
    videoEnabled: videoEnabled.value,
    audioDeviceId: selectedAudioDeviceId.value || null,
    videoDeviceId: selectedVideoDeviceId.value || null,
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
  const name = participantName.value || 'U';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

onMounted(async () => {
  await requestPermissions();
  if (videoEnabled.value) {
    startPreview();
  }
});

onUnmounted(() => {
  stopPreview();
});
</script>

<template>
  <Dialog :open="open">
    <DialogContent class="sm:max-w-lg fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <DialogHeader>
        <DialogTitle class="flex items-center justify-center sm:justify-start gap-2">
          <User class="h-5 w-5" />
          Join Meeting
        </DialogTitle>
        <DialogDescription>
          Configure your settings before joining
          <span class="font-mono text-xs block mt-1 text-muted-foreground">{{ meetingId }}</span>
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- Camera Preview -->
        <div class="relative aspect-video bg-muted rounded-lg overflow-hidden">
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
            class="absolute inset-0 flex items-center justify-center bg-muted"
          >
            <div class="w-20 h-20 rounded-full bg-primary flex items-center justify-center">
              <span class="text-2xl font-bold text-primary-foreground">{{ initials }}</span>
            </div>
          </div>

          <!-- Loading indicator -->
          <div
            v-if="isLoadingPreview && videoEnabled && !isVideoDenied"
            class="absolute inset-0 flex items-center justify-center bg-muted/80"
          >
            <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>

          <!-- Video status overlays -->
          <div
            v-if="isVideoDenied"
            class="absolute bottom-3 left-1/2 -translate-x-1/2 bg-destructive/90 px-3 py-1.5 rounded text-sm text-white flex items-center gap-2"
          >
            <VideoOff class="h-4 w-4" />
            Camera blocked
          </div>
          <div
            v-else-if="!videoEnabled"
            class="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded text-sm text-white"
          >
            Camera is off
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
              'flex-1 h-14 flex items-center justify-center gap-2 transition-colors',
              audioEnabled
                ? 'border-border hover:bg-muted hover:text-muted-foreground'
                : 'border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20',
            ]"
            @click="toggleAudio"
          >
            <Mic v-if="audioEnabled" class="h-5 w-5" />
            <MicOff v-else class="h-5 w-5" />
            <span class="text-sm">{{ audioEnabled ? 'Mic On' : 'Mic Off' }}</span>
          </Button>

          <!-- Audio Permission Denied -->
          <div v-else class="flex-1 relative group">
            <Button
              variant="outline"
              size="lg"
              class="w-full h-14 flex items-center justify-center gap-2 border-destructive bg-destructive/10 text-destructive cursor-not-allowed"
              disabled
            >
              <MicOff class="h-5 w-5" />
              <span class="text-sm">Mic Blocked</span>
            </Button>
            <div
              class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border border-border rounded-lg shadow-lg text-xs text-popover-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
            >
              Click the lock icon in your browser's address bar to allow
            </div>
          </div>

          <!-- Video Button -->
          <Button
            v-if="!isVideoDenied"
            variant="outline"
            size="lg"
            :class="[
              'flex-1 h-14 flex items-center justify-center gap-2 transition-colors',
              videoEnabled
                ? 'border-border hover:bg-muted hover:text-muted-foreground'
                : 'border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20',
            ]"
            @click="toggleVideo"
          >
            <Video v-if="videoEnabled" class="h-5 w-5" />
            <VideoOff v-else class="h-5 w-5" />
            <span class="text-sm">{{ videoEnabled ? 'Camera On' : 'Camera Off' }}</span>
          </Button>

          <!-- Video Permission Denied -->
          <div v-else class="flex-1 relative group">
            <Button
              variant="outline"
              size="lg"
              class="w-full h-14 flex items-center justify-center gap-2 border-destructive bg-destructive/10 text-destructive cursor-not-allowed"
              disabled
            >
              <VideoOff class="h-5 w-5" />
              <span class="text-sm">Camera Blocked</span>
            </Button>
            <div
              class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border border-border rounded-lg shadow-lg text-xs text-popover-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
            >
              Click the lock icon in your browser's address bar to allow
            </div>
          </div>
        </div>

        <!-- Device Selection -->
        <div v-if="hasAllPermissions" class="grid grid-cols-2 gap-3">
          <!-- Microphone Select -->
          <div class="space-y-1.5">
            <Label class="text-xs text-muted-foreground">Microphone</Label>
            <div class="relative">
              <select
                v-model="selectedAudioDeviceId"
                :disabled="audioDevices.length === 0"
                class="w-full h-9 px-3 pr-8 text-sm bg-background border border-input rounded-md appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option v-if="audioDevices.length === 0" value="">No microphones found</option>
                <option v-for="device in audioDevices" :key="device.deviceId" :value="device.deviceId">
                  {{ device.label || `Microphone ${audioDevices.indexOf(device) + 1}` }}
                </option>
              </select>
              <ChevronDown
                class="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              />
            </div>
          </div>

          <!-- Camera Select -->
          <div class="space-y-1.5">
            <Label class="text-xs text-muted-foreground">Camera</Label>
            <div class="relative">
              <select
                v-model="selectedVideoDeviceId"
                :disabled="videoDevices.length === 0"
                class="w-full h-9 px-3 pr-8 text-sm bg-background border border-input rounded-md appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option v-if="videoDevices.length === 0" value="">No cameras found</option>
                <option v-for="device in videoDevices" :key="device.deviceId" :value="device.deviceId">
                  {{ device.label || `Camera ${videoDevices.indexOf(device) + 1}` }}
                </option>
              </select>
              <ChevronDown
                class="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              />
            </div>
          </div>
        </div>

        <!-- Name input -->
        <div v-if="showNameInput" class="space-y-2">
          <Label for="participant-name">Your Name</Label>
          <Input
            id="participant-name"
            v-model="participantName"
            type="text"
            placeholder="Enter your name"
            maxlength="50"
            @keyup.enter="handleJoin"
            @input="error = ''"
          />
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        </div>
      </div>

      <DialogFooter class="flex-col sm:flex-row sm:justify-between gap-2">
        <p v-if="!hasAllPermissions" class="text-sm text-amber-600 text-center sm:text-left">
          Camera and microphone permissions required
        </p>
        <div class="flex gap-2 justify-end">
          <Button variant="outline" @click="handleCancel">Cancel</Button>
          <Button @click="handleJoin" :disabled="!canJoin">Join Meeting</Button>
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
