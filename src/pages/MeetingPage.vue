<script setup lang="ts">
import { AlertTriangle, ChevronDown, Users } from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import ChatPanel from '@/components/meeting-page/ChatPanel.vue';
import ConnectionErrorDialog from '@/components/meeting-page/ConnectionErrorDialog.vue';
import JoinMeetingDialog from '@/components/meeting-page/JoinMeetingDialog.vue';
import MeetingActionMenu from '@/components/meeting-page/MeetingActionMenu.vue';
import MeetingControls from '@/components/meeting-page/MeetingControls.vue';
import VideoGrid from '@/components/meeting-page/VideoGrid.vue';
import { LoadingRipple } from '@/components/ui/loading';
import { useActiveSpeaker } from '@/composables/useActiveSpeaker';
import { useAuth } from '@/composables/useAuth';
import { useFullscreenLock } from '@/composables/useFullscreenLock';
import { useWebrtc } from '@/composables/useWebrtc';
import { showSystemNotification } from '@/services/notifications';
import { socialApi } from '@/services/social-api';

// Lock viewport to prevent scrolling and zooming on mobile
useFullscreenLock();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const meetingId = computed(() => route.params.id as string);
const conversationId = computed(() => {
  const conversation = route.query.conversation;
  return typeof conversation === 'string' && conversation.trim() ? conversation : null;
});
const isConversationCall = computed(() => conversationId.value !== null);

const { isAuthenticated, isCheckingSession, currentUser, accessToken } = useAuth();
const meetingExitRoute = computed(() => (isAuthenticated.value ? '/dashboard' : '/'));

const {
  isIdle,
  isInitializingMedia,
  localStream,
  participantsArray,
  localParticipantId,
  connectionState,
  iceConnectionState,
  connectionQuality,
  connectionQualityReason,
  packetLossRatio,
  state,
  error: webrtcError,
  chatMessages,
  hasLoadedChatHistory,
  initMedia,
  joinRoom,
  leaveRoom: endCall,
  toggleParticipantAudio,
  toggleParticipantVideo,
  sendChatMessage,
  retry,
} = useWebrtc();

const { activeSpeakerId, resumeAudioAnalysis } = useActiveSpeaker(participantsArray);
const participantCount = computed(() => participantsArray.value.length);
const hasPoorConnection = computed(() => connectionQuality.value === 'poor' && state.value === 'inCall');
const packetLossPercent = computed(() => Math.round((packetLossRatio.value || 0) * 100));
const statusKeys: Record<string, string> = {
  idle: 'meeting.status.idle',
  initializingMedia: 'meeting.status.initializingMedia',
  mediaReady: 'meeting.status.mediaReady',
  joiningRoom: 'meeting.status.joiningRoom',
  inCall: 'meeting.status.inCall',
  endingCall: 'meeting.status.endingCall',
  error: 'meeting.status.error',
  new: 'meeting.status.new',
  connecting: 'meeting.status.connecting',
  checking: 'meeting.status.checking',
  connected: 'meeting.status.connected',
  completed: 'meeting.status.completed',
  disconnected: 'meeting.status.disconnected',
  failed: 'meeting.status.failed',
  closed: 'meeting.status.closed',
};

const statusLabel = (status: string | null | undefined) => {
  if (!status) return t('meeting.none');
  return t(statusKeys[status] ?? 'meeting.status.unknown', { value: status });
};

const isMuted = ref(false);
const isVideoOff = ref(false);
const viewMode = ref<'grid' | 'speaker'>('grid');
const pinnedParticipantId = ref<string | null>(null);
const audioAvailable = ref(false);
const videoAvailable = ref(false);
const showConnectionStatus = ref(false);
const showConnectionQualityDetails = ref(false);
const shouldJoinRoom = ref(false);
const pendingRoomId = ref<string | null>(null);
const sfuRoomId = ref<string | null>(null);
const pendingMediaSettings = ref<{ audioEnabled: boolean; videoEnabled: boolean } | null>(null);

const showJoinDialog = ref(false);
const showConnectionError = ref(false);
const participantName = ref<string>('');
const initialDialogName = ref<string>('');
const showNameInput = ref(true);

// Chat state
const isChatOpen = ref(false);
const unreadCount = ref(0);
const observedMessageCount = ref(0);
const isTrackingLiveMessages = ref(false);

// Track unread messages for chat
watch(chatMessages, (messages) => {
  if (!isTrackingLiveMessages.value || messages.length < observedMessageCount.value) {
    observedMessageCount.value = messages.length;
    return;
  }

  const newMessages = messages.slice(observedMessageCount.value);
  observedMessageCount.value = messages.length;
  const messagesFromOthers = newMessages.filter((message) => message.participantId !== localParticipantId.value);

  if (!isChatOpen.value) {
    unreadCount.value += messagesFromOthers.length;
  } else {
    unreadCount.value = 0;
  }

  if (document.hidden && messagesFromOthers.length) {
    showSystemNotification(
      t('notifications.newMessageTitle'),
      {
        body: t('notifications.newMessageBody'),
        icon: '/favicon.svg',
        tag: `openmeet-chat-${meetingId.value}`,
      },
      () => {
        isChatOpen.value = true;
      },
    );
  }
});

watch(
  hasLoadedChatHistory,
  (hasLoaded) => {
    isTrackingLiveMessages.value = hasLoaded;
    observedMessageCount.value = chatMessages.value.length;
  },
  { immediate: true },
);

watch(
  localStream,
  (stream, _, onCleanup) => {
    const observedTracks = new Set<MediaStreamTrack>();
    const updateAvailability = () => {
      audioAvailable.value = stream?.getAudioTracks().some((track) => track.readyState === 'live') ?? false;
      videoAvailable.value = stream?.getVideoTracks().some((track) => track.readyState === 'live') ?? false;
    };
    const observeTrack = (track: MediaStreamTrack) => {
      if (observedTracks.has(track)) return;
      observedTracks.add(track);
      track.addEventListener('ended', updateAvailability);
    };
    const handleAddTrack = (event: MediaStreamTrackEvent) => {
      observeTrack(event.track);
      updateAvailability();
    };

    stream?.getTracks().forEach(observeTrack);
    stream?.addEventListener('addtrack', handleAddTrack);
    stream?.addEventListener('removetrack', updateAvailability);
    updateAvailability();

    onCleanup(() => {
      for (const track of observedTracks) track.removeEventListener('ended', updateAvailability);
      stream?.removeEventListener('addtrack', handleAddTrack);
      stream?.removeEventListener('removetrack', updateAvailability);
    });
  },
  { immediate: true },
);

// Reset unread count when chat is opened
watch(isChatOpen, (isOpen) => {
  if (isOpen) {
    unreadCount.value = 0;
  }
});

watch(
  () => participantsArray.value.map((participant) => participant.id),
  (participantIds) => {
    if (pinnedParticipantId.value && !participantIds.includes(pinnedParticipantId.value)) {
      pinnedParticipantId.value = null;
    }
  },
);

const hasJoined = computed(() => !!participantName.value && state.value !== 'idle');

// Track if we need to send initial media state after joining
const pendingInitialMediaState = ref<{ audioEnabled: boolean; videoEnabled: boolean } | null>(null);
const hasRecordedMeeting = ref(false);
const isRecordingMeeting = ref(false);

async function recordMeetingHistory() {
  const token = accessToken.value;
  const roomId = meetingId.value;
  if (isConversationCall.value || !token || !roomId || hasRecordedMeeting.value || isRecordingMeeting.value) return;

  isRecordingMeeting.value = true;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await socialApi.recordMeeting(token, roomId);
        hasRecordedMeeting.value = true;
        return;
      } catch (error) {
        console.error('[MeetingRoom] Failed to record meeting history:', error);
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1)));
      }
    }
  } finally {
    isRecordingMeeting.value = false;
  }
}

// Redirect to Join Dialog if media initialization fails (permission denied)
watch(
  () => state.value,
  (newState) => {
    if (newState === 'error' && webrtcError.value) {
      console.error('[MeetingRoom] WebRTC error:', webrtcError.value.message);

      if (localParticipantId.value || connectionState.value || iceConnectionState.value) {
        showConnectionError.value = true;
      } else {
        showJoinDialog.value = true;
        participantName.value = '';
      }
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
    if (newState === 'inCall') {
      if (pendingInitialMediaState.value && localParticipantId.value) {
        const { audioEnabled, videoEnabled } = pendingInitialMediaState.value;
        toggleParticipantAudio(localParticipantId.value, audioEnabled);
        toggleParticipantVideo(localParticipantId.value, videoEnabled);
        pendingInitialMediaState.value = null;
      }

      void recordMeetingHistory();
    }
  },
);

// Show connection error dialog when the peer connection reaches a terminal failure.
watch(connectionState, (newState) => {
  if (newState === 'failed') {
    showConnectionError.value = true;
  }
});

watch(connectionQuality, (newQuality) => {
  if (newQuality === 'good') {
    showConnectionQualityDetails.value = false;
  }
});

let hasInitializedMeeting = false;

const initializeMeeting = async () => {
  if (hasInitializedMeeting) return;
  hasInitializedMeeting = true;

  if (isConversationCall.value) {
    const token = accessToken.value;
    if (!isAuthenticated.value || !token) {
      await router.replace('/login');
      return;
    }

    try {
      // Callers already accepted when they start the session; invitees accept here.
      try {
        sfuRoomId.value = (await socialApi.getCallSession(token, meetingId.value)).roomId;
      } catch {
        const response = await socialApi.respondToCallSession(token, meetingId.value, true);
        if (!response.accepted || !response.roomId) {
          throw new Error('Call session was not accepted');
        }
        sfuRoomId.value = response.roomId;
      }
    } catch (error) {
      console.error('[MeetingRoom] Failed to join conversation call:', error);
      await router.replace('/dashboard');
      return;
    }
  }

  const storedName = sessionStorage.getItem('participantName');

  // Always show the join dialog for media settings
  // Pre-fill name for authenticated users or from session storage
  if (isAuthenticated.value) {
    initialDialogName.value = currentUser.value?.name || t('meeting.fallbackUser');
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
    void initializeMeeting();
  }
});

onMounted(() => {
  if (!isCheckingSession.value) {
    void initializeMeeting();
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
  void resumeAudioAnalysis().catch(() => undefined);
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
    pendingRoomId.value = sfuRoomId.value ?? meetingId.value;
  }

  if (!isIdle.value) {
    retry();
  }

  // Pass device constraints to initMedia
  initMedia(participantName.value, {
    audioDeviceId: settings.audioDeviceId,
    videoDeviceId: settings.videoDeviceId,
  });
};

const handleCancelJoin = () => {
  router.push(meetingExitRoute.value);
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
  showConnectionStatus.value = !showConnectionStatus.value;
};

const handleToggleChat = () => {
  if (isChatOpen.value) {
    isChatOpen.value = false;
    return;
  }

  // Let a menu selection finish before mounting the non-modal sheet so the
  // selection's pointer event is not mistaken for an outside interaction.
  window.setTimeout(() => {
    isChatOpen.value = true;
  });
};

const handleSetViewMode = (mode: 'grid' | 'speaker') => {
  viewMode.value = mode;
};

const handleTogglePin = (participantId: string) => {
  if (viewMode.value !== 'speaker') return;
  pinnedParticipantId.value = pinnedParticipantId.value === participantId ? null : participantId;
};

const handleSendMessage = (message: string) => {
  sendChatMessage(message);
};

const handleEndCall = () => {
  endCall();
  router.push(meetingExitRoute.value);
};

const handleGoHome = () => {
  showConnectionError.value = false;
  endCall();
  router.push('/');
};

const handleReconnect = () => {
  window.location.reload();
};
</script>

<template>
  <div class="relative h-[calc(100dvh-84px)] overflow-hidden bg-white p-3 sm:p-5">
    <div
      v-if="isCheckingSession"
      class="marketing-font h-full bg-[#102F35] flex items-center justify-center text-[#E6F4F1]"
    >
      <div class="text-center">
        <LoadingRipple size="lg" class="mb-4 text-[#9BCFC7]" />
        <p class="text-[#D8E7E3]">{{ t('meeting.checkingAuth') }}</p>
      </div>
    </div>

    <div v-if="!hasJoined && !isCheckingSession" class="fixed inset-0 overflow-hidden bg-white" aria-hidden="true">
      <div class="absolute -left-28 top-16 size-96 rounded-full bg-[#9BCFC7]/45 blur-3xl" />
      <div class="absolute -right-24 bottom-0 size-80 rounded-full bg-[#F8D8CC]/65 blur-3xl" />
      <div class="absolute inset-x-8 top-10 h-px bg-[#9BCFC7]/50" />
    </div>

    <JoinMeetingDialog
      v-if="showJoinDialog"
      open
      :meeting-id="meetingId"
      :initial-name="initialDialogName"
      :show-name-input="showNameInput"
      @join="handleJoinMeeting"
      @cancel="handleCancelJoin"
    />

    <div v-if="hasJoined && !isCheckingSession" class="marketing-font h-full bg-white text-[#102F35] flex flex-col">
      <!-- Participant Count Badge -->
      <div
        class="fixed left-7 top-[calc(84px+0.75rem)] z-50 flex items-center gap-2 rounded-full bg-[#0B7A75] px-4 py-2 text-white shadow-lg sm:left-9 sm:top-[calc(84px+1.25rem)]"
      >
        <Users class="h-5 w-5" />
        <span class="font-semibold">{{ participantCount }}</span>
      </div>

      <div
        class="fixed top-[calc(84px+0.75rem)] z-[60] transition-[right] sm:top-[calc(84px+1.25rem)]"
        :class="isChatOpen ? 'right-16' : 'right-7 sm:right-9'"
      >
        <MeetingActionMenu
          :audio-available="audioAvailable"
          :is-chat-open="isChatOpen"
          :is-muted="isMuted"
          :is-video-off="isVideoOff"
          :participants="participantsArray"
          :pinned-participant-id="pinnedParticipantId"
          :video-available="videoAvailable"
          :view-mode="viewMode"
          @disconnect="handleEndCall"
          @set-view-mode="handleSetViewMode"
          @toggle-chat="handleToggleChat"
          @toggle-mute="handleToggleMute"
          @toggle-pin="handleTogglePin"
          @toggle-video="handleToggleVideo"
        />
      </div>

      <button
        v-if="hasPoorConnection"
        type="button"
        class="fixed left-1/2 top-[calc(84px+0.75rem)] z-50 w-[calc(100%-3.5rem)] max-w-md -translate-x-1/2 rounded-xl border border-[#F2B9AE] bg-[#FDE9E4] px-4 py-3 text-left text-sm text-[#7A2E22] shadow-lg sm:top-[calc(84px+1.25rem)]"
        data-testid="connection-quality-warning"
        @click="showConnectionQualityDetails = !showConnectionQualityDetails"
      >
        <div class="flex items-center gap-3">
          <span class="rounded-full bg-white/75 p-1.5 text-[#D95E49]">
            <AlertTriangle class="h-4 w-4" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-[#7A2E22]">{{ t('meeting.poorConnection') }}</span>
              <span class="rounded-full bg-[#F2765F] px-2 py-0.5 text-xs font-medium text-white">
                {{ t('meeting.warning') }}
              </span>
            </div>
            <p v-if="showConnectionQualityDetails" class="mt-1 text-xs text-[#8D4B3E]">
              {{ connectionQualityReason || t('meeting.mediaWarning') }}
              <span v-if="packetLossPercent > 0">
                {{ t('meeting.packetLoss', { percent: packetLossPercent }) }}
              </span>
            </p>
          </div>
          <ChevronDown
            class="h-4 w-4 shrink-0 text-[#A94D3B] transition-transform"
            :class="{ 'rotate-180': showConnectionQualityDetails }"
          />
        </div>
      </button>

      <!-- Debug Info Panel -->
      <div
        v-if="showConnectionStatus"
        class="fixed right-7 top-[calc(84px+5rem)] z-50 space-y-1 rounded-lg border border-[#D8E7E3] bg-[#E6F4F1] p-3 text-xs text-[#102F35] shadow-lg sm:right-9 sm:top-[calc(84px+5.5rem)]"
      >
        <div class="flex items-center gap-2">
          <span class="text-[#4E6B70]">{{ t('meeting.state') }}</span>
          <span class="font-mono text-[#0B7A75]">{{ statusLabel(String(state)) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[#4E6B70]">{{ t('meeting.connection') }}</span>
          <span
            class="font-mono"
            :class="{
              'text-[#0B7A75]': connectionState === 'connected',
              'text-[#F2765F]':
                connectionState === 'connecting' || connectionState === 'failed' || connectionState === 'disconnected',
              'text-[#4E6B70]': !connectionState,
            }"
          >
            {{ statusLabel(connectionState) }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[#4E6B70]">{{ t('meeting.ice') }}</span>
          <span
            class="font-mono"
            :class="{
              'text-[#0B7A75]': iceConnectionState === 'connected' || iceConnectionState === 'completed',
              'text-[#F2765F]':
                iceConnectionState === 'checking' ||
                iceConnectionState === 'new' ||
                iceConnectionState === 'failed' ||
                iceConnectionState === 'disconnected',
              'text-[#4E6B70]': !iceConnectionState,
            }"
          >
            {{ statusLabel(iceConnectionState) }}
          </span>
        </div>
        <div class="flex items-center gap-2 pt-1 border-t border-[#D8E7E3]">
          <span class="text-[#4E6B70]">{{ t('meeting.participants') }}</span>
          <span class="font-mono text-[#0B7A75] font-bold">{{ participantCount }}</span>
        </div>
      </div>

      <div v-if="isInitializingMedia" class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <LoadingRipple size="lg" class="mb-4 text-[#0B7A75]" />
          <p class="text-[#27595D]">{{ t('meeting.settingUpMedia') }}</p>
        </div>
      </div>

      <div v-else class="flex-1 flex flex-col">
        <MeetingActionMenu
          context
          :audio-available="audioAvailable"
          :is-chat-open="isChatOpen"
          :is-muted="isMuted"
          :is-video-off="isVideoOff"
          :participants="participantsArray"
          :pinned-participant-id="pinnedParticipantId"
          :video-available="videoAvailable"
          :view-mode="viewMode"
          @disconnect="handleEndCall"
          @set-view-mode="handleSetViewMode"
          @toggle-chat="handleToggleChat"
          @toggle-mute="handleToggleMute"
          @toggle-pin="handleTogglePin"
          @toggle-video="handleToggleVideo"
        >
          <VideoGrid
            :active-speaker-id="activeSpeakerId"
            :participants="participantsArray"
            :pinned-participant-id="pinnedParticipantId"
            :view-mode="viewMode"
            @toggle-pin="handleTogglePin"
          />
        </MeetingActionMenu>

        <MeetingControls
          :audio-available="audioAvailable"
          :is-muted="isMuted"
          :is-video-off="isVideoOff"
          :meeting-id="meetingId"
          :show-connection-status="showConnectionStatus"
          :is-chat-open="isChatOpen"
          :unread-count="unreadCount"
          :video-available="videoAvailable"
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
      :error-message="webrtcError?.message"
      @leave="handleGoHome"
      @reload="handleReconnect"
      @close="showConnectionError = false"
    />
  </div>
</template>

<style></style>
