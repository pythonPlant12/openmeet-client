<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAuth } from '@/composables/useAuth';
import { useWebRTC } from '@/composables/useWebRTC';

import JoinMeetingDialog from './JoinMeetingDialog.vue';
import MeetingControls from './MeetingControls.vue';
import VideoGrid from './VideoGrid.vue';

const route = useRoute();
const router = useRouter();
const meetingId = computed(() => route.params.id as string);

const { isAuthenticated, isCheckingSession, currentUser } = useAuth();

const {
  isIdle,
  isInitializingMedia,
  localStream,
  remoteStream,
  connectionState,
  iceConnectionState,
  state,
  initMedia,
  createCall,
  joinCall,
  endCall,
} = useWebRTC();

const isMuted = ref(false);
const isVideoOff = ref(false);
const shouldCreateCall = ref(false);
const shouldJoinCall = ref(false);
const pendingCallId = ref<string | null>(null);

const showJoinDialog = ref(false);
const participantName = ref<string>('');

const hasJoined = computed(() => !!participantName.value);

watch(
  () => state.value,
  (newState) => {
    if (newState === 'mediaReady') {
      if (shouldCreateCall.value && pendingCallId.value) {
        createCall(pendingCallId.value);
        shouldCreateCall.value = false;
      } else if (shouldJoinCall.value && pendingCallId.value) {
        joinCall(pendingCallId.value);
        shouldJoinCall.value = false;
      }
    }
  },
);

const initializeMeeting = async () => {
  const storedName = sessionStorage.getItem('participantName');

  if (isAuthenticated.value) {
    participantName.value = currentUser.value?.name || 'User';
  } else if (storedName) {
    participantName.value = storedName;
  } else {
    showJoinDialog.value = true;
    return;
  }

  if (meetingId.value) {
    const { firebaseService } = await import('@/services/firebase');
    const callData = await firebaseService.getCallDocument(meetingId.value);

    if (callData?.offer) {
      shouldJoinCall.value = true;
      pendingCallId.value = meetingId.value;
    } else {
      shouldCreateCall.value = true;
      pendingCallId.value = meetingId.value;
    }
  }

  if (isIdle.value) {
    initMedia();
  }
};

watch(isCheckingSession, (checking) => {
  if (!checking) {
    initializeMeeting();
  }
});

onMounted(() => {
  if (!isCheckingSession.value) {
    initializeMeeting();
  }
});

const handleJoinMeeting = async (name: string) => {
  participantName.value = name;
  showJoinDialog.value = false;

  if (meetingId.value) {
    const { firebaseService } = await import('@/services/firebase');
    const callData = await firebaseService.getCallDocument(meetingId.value);

    if (callData?.offer) {
      shouldJoinCall.value = true;
      pendingCallId.value = meetingId.value;
    } else {
      shouldCreateCall.value = true;
      pendingCallId.value = meetingId.value;
    }
  }

  if (isIdle.value) {
    initMedia();
  }
};

const handleCancelJoin = () => {
  router.push('/dashboard');
};

const handleToggleMute = () => {
  if (!localStream.value) return;

  const audioTracks = localStream.value.getAudioTracks();
  audioTracks.forEach((track) => {
    track.enabled = !track.enabled;
  });
  isMuted.value = !isMuted.value;
};

const handleToggleVideo = () => {
  if (!localStream.value) return;

  const videoTracks = localStream.value.getVideoTracks();
  videoTracks.forEach((track) => {
    track.enabled = !track.enabled;
  });
  console.log('Toggling video. New state:', !isVideoOff.value);
  isVideoOff.value = !isVideoOff.value;
};

const handleEndCall = () => {
  endCall();
  router.push('/dashboard');
};
</script>

<template>
  <div v-if="isCheckingSession" class="min-h-screen bg-background flex items-center justify-center">
    <div class="text-center">
      <div
        class="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"
      ></div>
      <p class="text-muted-foreground">Checking authentication...</p>
    </div>
  </div>

  <JoinMeetingDialog
    v-else
    :open="showJoinDialog"
    :meeting-id="meetingId"
    @join="handleJoinMeeting"
    @cancel="handleCancelJoin"
  />

  <div v-if="hasJoined && !isCheckingSession" class="min-h-screen bg-background flex flex-col">
    <div class="fixed top-20 right-4 z-50 bg-card border border-border rounded-lg p-3 text-xs space-y-1">
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground">State:</span>
        <span class="font-mono text-primary">{{ state }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground">Connection:</span>
        <span
          class="font-mono"
          :class="{
            'text-green-500': connectionState === 'connected',
            'text-yellow-500': connectionState === 'connecting',
            'text-red-500': connectionState === 'failed' || connectionState === 'disconnected',
            'text-muted-foreground': !connectionState,
          }"
        >
          {{ connectionState || 'none' }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground">ICE:</span>
        <span
          class="font-mono"
          :class="{
            'text-green-500': iceConnectionState === 'connected' || iceConnectionState === 'completed',
            'text-yellow-500': iceConnectionState === 'checking' || iceConnectionState === 'new',
            'text-red-500': iceConnectionState === 'failed' || iceConnectionState === 'disconnected',
            'text-muted-foreground': !iceConnectionState,
          }"
        >
          {{ iceConnectionState || 'none' }}
        </span>
      </div>
    </div>

    <div v-if="isInitializingMedia" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div
          class="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"
        ></div>
        <p class="text-muted-foreground">Setting up your camera and microphone...</p>
      </div>
    </div>

    <div v-else class="flex-1 flex flex-col">
      <VideoGrid :local-stream="localStream" :remote-stream="remoteStream" :is-video-off="isVideoOff" />

      <MeetingControls
        :is-muted="isMuted"
        :is-video-off="isVideoOff"
        :meeting-id="meetingId"
        @toggle-mute="handleToggleMute"
        @toggle-video="handleToggleVideo"
        @end-call="handleEndCall"
      />
    </div>
  </div>
</template>

<style>
body {
  overflow: hidden !important;
}
</style>
