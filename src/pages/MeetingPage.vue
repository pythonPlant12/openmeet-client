<script setup lang="ts">
import { Users } from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import ChatPanel from '@/components/meeting-page/ChatPanel.vue';
import ConnectionErrorDialog from '@/components/meeting-page/ConnectionErrorDialog.vue';
import JoinMeetingDialog from '@/components/meeting-page/JoinMeetingDialog.vue';
import MeetingControls from '@/components/meeting-page/MeetingControls.vue';
import VideoGrid from '@/components/meeting-page/VideoGrid.vue';
import { useAuth } from '@/composables/useAuth';
import { useFullscreenLock } from '@/composables/useFullscreenLock';
import { useWebrtc } from '@/composables/useWebrtc';

// Lock viewport to prevent scrolling and zooming on mobile
useFullscreenLock();

const route = useRoute();
const router = useRouter();
const meetingId = computed(() => route.params.id as string);

const { isAuthenticated, isCheckingSession, currentUser } = useAuth();

const {
  isIdle,
  isInitializingMedia,
  localStream,
  participantsArray,
  localParticipantId,
  connectionState,
  iceConnectionState,
  state,
  error: webrtcError,
  chatMessages,
  initMedia,
  joinRoom,
  leaveRoom: endCall,
  toggleParticipantAudio,
  toggleParticipantVideo,
  sendChatMessage,
} = useWebrtc();

const participantCount = computed(() => participantsArray.value.length);

const isMuted = ref(false);
const isVideoOff = ref(false);
const showStats = ref(false);
const shouldJoinRoom = ref(false);
const pendingRoomId = ref<string | null>(null);
const pendingMediaSettings = ref<{ audioEnabled: boolean; videoEnabled: boolean } | null>(null);

const showJoinDialog = ref(false);
const showConnectionError = ref(false);
const participantName = ref<string>('');
const initialDialogName = ref<string>('');
const showNameInput = ref(true);

// Chat state
const isChatOpen = ref(false);
const unreadCount = ref(0);
const lastReadMessageCount = ref(0);

// Track unread messages when chat is closed
watch(chatMessages, (messages) => {
  if (!isChatOpen.value && messages.length > lastReadMessageCount.value) {
    unreadCount.value = messages.length - lastReadMessageCount.value;
  }
});

// Reset unread count when chat is opened
watch(isChatOpen, (isOpen) => {
  if (isOpen) {
    unreadCount.value = 0;
    lastReadMessageCount.value = chatMessages.value.length;
  }
});

const hasJoined = computed(() => !!participantName.value && state.value !== 'idle');

// Track if we need to send initial media state after joining
const pendingInitialMediaState = ref<{ audioEnabled: boolean; videoEnabled: boolean } | null>(null);

// Redirect to Join Dialog if media initialization fails (permission denied)
watch(
  () => state.value,
  (newState) => {
    if (newState === 'error' && webrtcError.value) {
      console.error('[MeetingRoom] WebRTC error:', webrtcError.value.message);
      showJoinDialog.value = true;
      participantName.value = '';
    }
  },
);

watch(
  () => state.value,
  (newState) => {
    if (newState === 'mediaReady') {
      // Apply initial media settings before joining
      if (pendingMediaSettings.value && localStream.value) {
        const { audioEnabled, videoEnabled } = pendingMediaSettings.value;

        // Apply audio setting
        localStream.value.getAudioTracks().forEach((track) => {
          track.enabled = audioEnabled;
        });
        isMuted.value = !audioEnabled;

        // Apply video setting
        localStream.value.getVideoTracks().forEach((track) => {
          track.enabled = videoEnabled;
        });
        isVideoOff.value = !videoEnabled;

        // Store for sending after joining if not default (both enabled)
        if (!audioEnabled || !videoEnabled) {
          pendingInitialMediaState.value = { audioEnabled, videoEnabled };
        }

        pendingMediaSettings.value = null;
      }

      if (shouldJoinRoom.value && pendingRoomId.value) {
        joinRoom(pendingRoomId.value, participantName.value);
        shouldJoinRoom.value = false;
      }
    }

    // Send initial media state to other participants after joining
    if (newState === 'inCall' && pendingInitialMediaState.value && localParticipantId.value) {
      const { audioEnabled, videoEnabled } = pendingInitialMediaState.value;
      toggleParticipantAudio(localParticipantId.value, audioEnabled);
      toggleParticipantVideo(localParticipantId.value, videoEnabled);
      pendingInitialMediaState.value = null;
    }
  },
);

// Show connection error dialog when connection fails or disconnects
watch(connectionState, (newState) => {
  if (newState === 'failed' || newState === 'disconnected') {
    showConnectionError.value = true;
  }
});

const initializeMeeting = () => {
  const storedName = sessionStorage.getItem('participantName');

  // Always show the join dialog for media settings
  // Pre-fill name for authenticated users or from session storage
  if (isAuthenticated.value) {
    initialDialogName.value = currentUser.value?.name || 'User';
    showNameInput.value = false; // Don't show name input for logged-in users
  } else if (storedName) {
    initialDialogName.value = storedName;
    showNameInput.value = true;
  } else {
    initialDialogName.value = '';
    showNameInput.value = true;
  }

  showJoinDialog.value = true;
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

onUnmounted(() => {
  endCall();
});

interface JoinSettings {
  name: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioDeviceId: string | null;
  videoDeviceId: string | null;
}

const handleJoinMeeting = async (settings: JoinSettings) => {
  participantName.value = settings.name;
  showJoinDialog.value = false;

  // Store media settings to apply after media is initialized
  pendingMediaSettings.value = {
    audioEnabled: settings.audioEnabled,
    videoEnabled: settings.videoEnabled,
  };

  if (meetingId.value) {
    // In SFU architecture, everyone just "joins" the room
    shouldJoinRoom.value = true;
    pendingRoomId.value = meetingId.value;
  }

  if (isIdle.value) {
    // Pass device constraints to initMedia
    initMedia(participantName.value, {
      audioDeviceId: settings.audioDeviceId,
      videoDeviceId: settings.videoDeviceId,
    });
  }
};

const handleCancelJoin = () => {
  router.push('/dashboard');
};

const handleToggleMute = () => {
  if (!localStream.value || !localParticipantId.value) return;

  const audioTracks = localStream.value.getAudioTracks();
  const newMutedState = !isMuted.value;

  audioTracks.forEach((track) => {
    track.enabled = !newMutedState;
  });

  isMuted.value = newMutedState;
  toggleParticipantAudio(localParticipantId.value, !newMutedState);
};

const handleToggleVideo = () => {
  if (!localStream.value || !localParticipantId.value) return;

  const videoTracks = localStream.value.getVideoTracks();
  const newVideoOffState = !isVideoOff.value;

  videoTracks.forEach((track) => {
    track.enabled = !newVideoOffState;
  });

  console.log('Toggling video. New state:', newVideoOffState);
  isVideoOff.value = newVideoOffState;
  toggleParticipantVideo(localParticipantId.value, !newVideoOffState);
};

const handleToggleStats = () => {
  showStats.value = !showStats.value;
};

const handleToggleChat = () => {
  isChatOpen.value = !isChatOpen.value;
};

const handleSendMessage = (message: string) => {
  sendChatMessage(message);
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
    :initial-name="initialDialogName"
    :show-name-input="showNameInput"
    @join="handleJoinMeeting"
    @cancel="handleCancelJoin"
  />

  <div v-if="hasJoined && !isCheckingSession" class="min-h-screen bg-background flex flex-col">
    <!-- Participant Count Badge -->
    <div
      class="fixed top-20 left-4 z-50 bg-primary text-primary-foreground rounded-full px-4 py-2 flex items-center gap-2 shadow-lg"
    >
      <Users class="h-5 w-5" />
      <span class="font-semibold">{{ participantCount }}</span>
    </div>

    <!-- Debug Info Panel -->
    <div
      v-if="showStats"
      class="fixed top-20 right-4 z-50 bg-card border border-border rounded-lg p-3 text-xs space-y-1"
    >
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
      <div class="flex items-center gap-2 pt-1 border-t border-border">
        <span class="text-muted-foreground">Participants:</span>
        <span class="font-mono text-primary font-bold">{{ participantCount }}</span>
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
      <VideoGrid :participants="participantsArray" />

      <MeetingControls
        :is-muted="isMuted"
        :is-video-off="isVideoOff"
        :meeting-id="meetingId"
        :show-stats="showStats"
        :is-chat-open="isChatOpen"
        :unread-count="unreadCount"
        @toggle-mute="handleToggleMute"
        @toggle-video="handleToggleVideo"
        @toggle-stats="handleToggleStats"
        @toggle-chat="handleToggleChat"
        @end-call="handleEndCall"
      />
    </div>

    <!-- Chat Panel -->
    <ChatPanel
      v-model:open="isChatOpen"
      :messages="chatMessages"
      :local-participant-id="localParticipantId"
      @send="handleSendMessage"
    />
  </div>

  <!-- Connection Error Dialog -->
  <ConnectionErrorDialog
    :open="showConnectionError"
    :connection-state="connectionState"
    @leave="handleEndCall"
    @close="showConnectionError = false"
  />
</template>

<style></style>
