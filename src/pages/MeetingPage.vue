<script setup lang="ts">
import { useEventListener, useIntervalFn } from '@vueuse/core';
import { AlertTriangle, ChevronDown, Users } from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import ChatPanel from '@/components/meeting-page/ChatPanel.vue';
import ConnectionErrorDialog from '@/components/meeting-page/ConnectionErrorDialog.vue';
import MeetingActionMenu from '@/components/meeting-page/MeetingActionMenu.vue';
import MeetingControls from '@/components/meeting-page/MeetingControls.vue';
import MeetingEntryDialog, { type EntrySettings } from '@/components/meeting-page/MeetingEntryDialog.vue';
import MeetingInviteDialog from '@/components/meeting-page/MeetingInviteDialog.vue';
import MeetingPermissionSheet from '@/components/meeting-page/MeetingPermissionSheet.vue';
import ScreenAreaPicker from '@/components/meeting-page/ScreenAreaPicker.vue';
import VideoGrid from '@/components/meeting-page/VideoGrid.vue';
import { LoadingRipple } from '@/components/ui/loading';
import { toast } from '@/components/ui/toast';
import { useActiveSpeaker } from '@/composables/useActiveSpeaker';
import { useAuth } from '@/composables/useAuth';
import { useAvatarCache } from '@/composables/useAvatarCache';
import { useFullscreenLock } from '@/composables/useFullscreenLock';
import { useScreenShare } from '@/composables/useScreenShare';
import { useWebrtc } from '@/composables/useWebrtc';
import { MEETING_ACCESS_ERRORS } from '@/config/meeting-access.config';
import { loadCallSettings, saveCallSettings } from '@/lib/call-settings';
import { layoutAfterTileClick } from '@/lib/meeting-layout';
import { loadVideoQuality } from '@/lib/video-quality';
import { followAudioOutput } from '@/services/audio-output';
import { playHaptic } from '@/services/haptics';
import { showSystemNotification } from '@/services/notifications';
import { type MeetingRoomAccess, SocialApiError, type UserStatus, socialApi } from '@/services/social-api';
import { getServices } from '@/xstate/machines/webrtc/actors';
import type { MediaIssue } from '@/services/webrtc-sfu';
import type { Participant } from '@/xstate/machines/webrtc/types';

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
// On phones TheNavbar shows a top bar only to guests; signed-in phones use the bottom account button. The meeting's
// top row sits right under that bar, or at the very top without it, so the video area below gets the space.
const hasPhoneTopBar = computed(() => !isAuthenticated.value);
const phoneTopRowClass = computed(() =>
  hasPhoneTopBar.value ? 'top-20' : 'top-[calc(0.75rem+env(safe-area-inset-top))]',
);
const phoneBelowTopRowClass = computed(() =>
  hasPhoneTopBar.value
    ? 'top-[calc(5rem+var(--meeting-control-size))]'
    : 'top-[calc(1.25rem+var(--meeting-control-size)+env(safe-area-inset-top))]',
);
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
  isReconnecting,
  state,
  error: webrtcError,
  chatMessages,
  hasLoadedChatHistory,
  initMedia,
  joinRoom,
  leaveRoom: endCall,
  toggleParticipantAudio,
  toggleParticipantVideo,
  setCameraEnabled,
  sendChatMessage,
  sendChatReaction,
  retry,
} = useWebrtc();

const { activeSpeakerId, resumeAudioAnalysis } = useActiveSpeaker(participantsArray);
const screenShare = useScreenShare();
// Screen shares join as their own participants. Your own share is shown from the local capture, since the
// SFU never sends it back, and every share is labeled with its presenter's name.
const meetingParticipants = computed<Participant[]>(() => {
  const byId = new Map(participantsArray.value.map((participant) => [participant.id, participant]));
  return participantsArray.value.map((participant) => {
    if (!participant.screenShareOf) return participant;
    const presenter = byId.get(participant.screenShareOf);
    const name = t('meeting.screenShare.label', { name: presenter?.name ?? participant.name });
    const isOwn = participant.screenShareOf === localParticipantId.value;
    return isOwn && screenShare.stream.value
      ? { ...participant, name, isLocal: true, stream: screenShare.stream.value }
      : { ...participant, name };
  });
});
const participantCount = computed(
  () => participantsArray.value.filter((participant) => !participant.screenShareOf).length,
);
// One banner at a time: joining, then reconnecting, then a poor-quality warning.
const connectionBanner = computed<'joining' | 'reconnecting' | null>(() => {
  if (state.value === 'joiningRoom') return 'joining';
  if (isReconnecting.value && state.value === 'inCall') return 'reconnecting';
  return null;
});
const hasPoorConnection = computed(
  () => connectionQuality.value === 'poor' && state.value === 'inCall' && !connectionBanner.value,
);
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
// Why the call has no microphone or camera, such as a refused permission; the button warns and asks again.
const audioIssue = ref<MediaIssue | null>(null);
const videoIssue = ref<MediaIssue | null>(null);
const audioWarning = computed(() => !!audioIssue.value && !audioAvailable.value);
const videoWarning = computed(() => !!videoIssue.value && !videoAvailable.value);
const permissionSheetKind = ref<'audio' | 'video' | null>(null);
const isPermissionSheetOpen = ref(false);
const showConnectionStatus = ref(false);
const showConnectionQualityDetails = ref(false);
const shouldJoinRoom = ref(false);
const pendingRoomId = ref<string | null>(null);
const sfuRoomId = ref<string | null>(null);
const pendingMediaSettings = ref<{ audioEnabled: boolean; videoEnabled: boolean } | null>(null);

const showEntryDialog = ref(false);
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
    const updateAvailability = () => readMediaAvailability(stream);
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
  window.dispatchEvent(new CustomEvent('openmeet:meeting-chat-state', { detail: isOpen }));
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

// A new screen share from someone else takes the stage, unless the viewer pinned someone themselves.
// When it ends, the layout goes back to how it was.
const autoPinnedScreenId = ref<string | null>(null);
watch(
  () =>
    meetingParticipants.value
      .filter((participant) => participant.screenShareOf && !participant.isLocal)
      .map((participant) => participant.id),
  (screenIds, previousIds = []) => {
    const added = screenIds.find((id) => !previousIds.includes(id));
    if (added && (!pinnedParticipantId.value || pinnedParticipantId.value === autoPinnedScreenId.value)) {
      viewMode.value = 'speaker';
      pinnedParticipantId.value = added;
      autoPinnedScreenId.value = added;
    }
    if (autoPinnedScreenId.value && !screenIds.includes(autoPinnedScreenId.value)) {
      if (!pinnedParticipantId.value || pinnedParticipantId.value === autoPinnedScreenId.value) {
        pinnedParticipantId.value = null;
        viewMode.value = 'grid';
      }
      autoPinnedScreenId.value = null;
    }
  },
);

// Each other person gets their own copy of your video from the SFU, so auto quality aims lower as the
// meeting grows.
watch(
  [participantCount, () => state.value],
  ([count]) => {
    const otherPeople = Math.max(count - 1, 0);
    getServices().webrtcService?.setAudienceSize(otherPeople);
    screenShare.setAudienceSize(otherPeople);
  },
  { immediate: true },
);

// A rejoin gives this tab a new participant ID, which the old screen share no longer belongs to.
watch(localParticipantId, (current, previous) => {
  if (previous && current !== previous) screenShare.stop();
});

async function handleStartScreenShare(options?: { selectArea: boolean }) {
  if (!localParticipantId.value) return;
  await screenShare.start({
    selectArea: options?.selectArea,
    roomId: sfuRoomId.value ?? meetingId.value,
    presenterId: localParticipantId.value,
    presenterName: participantName.value,
    password: joinPassword,
  });
  // The share joins as a participant, so the audience size it starts with is set now.
  screenShare.setAudienceSize(Math.max(participantCount.value - 1, 0));
}

// Statuses of registered participants, keyed by participant ID. The server records joins a moment
// after they happen, so a roster change is followed by a short delay before asking again.
const PARTICIPANT_STATUS_POLL_MS = 20_000;
const PARTICIPANT_STATUS_SETTLE_MS = 1_500;
const participantStatuses = ref<Record<string, UserStatus>>({});
// Avatar paths of registered participants; the cache turns them into images, since avatars need the token.
const participantAvatarPaths = ref<Record<string, string>>({});
const avatarCache = useAvatarCache((path) => socialApi.loadAvatar(accessToken.value ?? '', path));
const participantAvatars = computed(() =>
  Object.fromEntries(
    Object.entries(participantAvatarPaths.value).flatMap(([participantId, path]) => {
      const url = avatarCache.urls.value[path];
      return url ? [[participantId, url]] : [];
    }),
  ),
);
let participantStatusTimer: number | undefined;

async function refreshParticipantStatuses() {
  const roomId = sfuRoomId.value ?? meetingId.value;
  if (!isAuthenticated.value || state.value !== 'inCall' || !roomId) return;
  try {
    const presence = await socialApi.listMeetingRoomPresence(accessToken.value ?? '', roomId);
    participantStatuses.value = Object.fromEntries(
      presence.flatMap((entry) => (entry.status ? [[entry.participantId, entry.status]] : [])),
    );
    participantAvatarPaths.value = Object.fromEntries(
      presence.flatMap((entry) => (entry.avatarUrl ? [[entry.participantId, entry.avatarUrl]] : [])),
    );
    void avatarCache.ensure(Object.values(participantAvatarPaths.value));
  } catch (error) {
    // Not recorded yet right after joining; the next roster change or poll tries again.
    if (!(error instanceof SocialApiError && error.status === 404)) {
      console.error('[MeetingRoom] Failed to load participant statuses:', error);
    }
  }
}

useIntervalFn(() => void refreshParticipantStatuses(), PARTICIPANT_STATUS_POLL_MS);

watch([() => participantsArray.value.map((participant) => participant.id).join(','), () => state.value], () => {
  window.clearTimeout(participantStatusTimer);
  participantStatusTimer = window.setTimeout(() => void refreshParticipantStatuses(), PARTICIPANT_STATUS_SETTLE_MS);
});

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

      // The room refused the join (wrong password, access changed): ask for the password again.
      if (MEETING_ACCESS_ERRORS.includes(webrtcError.value.message)) {
        accessError.value = webrtcError.value.message;
        joinPassword = null;
        participantName.value = '';
        void loadMeetingAccess();
        showEntryDialog.value = true;
        isJoining.value = false;
        return;
      }

      showConnectionError.value = true;
    }
  },
);

watch(
  () => state.value,
  (newState) => {
    if (newState === 'mediaReady') {
      const service = getServices().webrtcService;
      if (service) service.onLocalTrackLost = handleLocalTrackLost;
      refreshMediaAvailability();

      // Apply initial media settings before joining
      if (pendingMediaSettings.value && localStream.value) {
        // A call without a microphone, such as a refused permission, starts muted and listen-only.
        const audioEnabled = pendingMediaSettings.value.audioEnabled && localStream.value.getAudioTracks().length > 0;
        const { videoEnabled } = pendingMediaSettings.value;

        // Apply audio setting
        localStream.value.getAudioTracks().forEach((track) => {
          track.enabled = audioEnabled;
        });
        isMuted.value = !audioEnabled;

        // The camera was already released when media started; its sender stays for turning it on.
        isVideoOff.value = !videoEnabled;

        // Store for sending after joining if not default (both enabled)
        if (!audioEnabled || !videoEnabled) {
          pendingInitialMediaState.value = { audioEnabled, videoEnabled };
        }

        pendingMediaSettings.value = null;
      }

      if (shouldJoinRoom.value && pendingRoomId.value) {
        joinRoom(pendingRoomId.value, participantName.value, joinPassword ?? undefined);
        shouldJoinRoom.value = false;
      }
    }

    // Send initial media state to other participants after joining
    if (newState === 'inCall') {
      if (!hasPlayedJoinedHaptic) {
        hasPlayedJoinedHaptic = true;
        playHaptic('success');
      }
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

  if (!isConversationCall.value) await loadMeetingAccess();

  // Signed-in people and guests who already gave their name enter directly. Only a missing name or a room
  // password needs asking first.
  const name = isAuthenticated.value
    ? currentUser.value?.name || t('meeting.fallbackUser')
    : (sessionStorage.getItem('participantName') ?? '');
  initialDialogName.value = name;
  showNameInput.value = !isAuthenticated.value;

  const access = isConversationCall.value ? null : meetingAccess.value;
  const needsAsking = !name || !!access?.requiresPassword || (!!access && !access.canJoin);
  if (needsAsking) {
    showEntryDialog.value = true;
    return;
  }
  enterCall(name);
};

watch(isCheckingSession, (checking) => {
  if (!checking) {
    void initializeMeeting();
  }
});

// A caller who leaves a call nobody else is in, including before joining it, stops it ringing for
// everyone. The server ignores the request from anyone else, or while someone is still in the call.
// The call ID is kept from when the page opened: by unmount the route already shows the next page.
const openedCallSessionId = isConversationCall.value ? meetingId.value : null;

function cancelRingingCall(keepalive = false) {
  const token = accessToken.value;
  if (!openedCallSessionId || !token) return;
  socialApi
    .cancelCallSession(token, openedCallSessionId, { keepalive })
    .catch((error) => console.error('[MeetingRoom] Failed to stop the call ringing:', error));
}

const handlePageHide = () => cancelRingingCall(true);
// The chosen speaker applies to every participant's audio as their media appears.
let stopFollowingAudioOutput: (() => void) | null = null;

onMounted(() => {
  stopFollowingAudioOutput = followAudioOutput();
  window.addEventListener('openmeet:close-meeting-chat', closeMeetingChat);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('keydown', handleFullscreenKeydown);
  if (!isCheckingSession.value) {
    void initializeMeeting();
  }
});

onUnmounted(() => {
  stopFollowingAudioOutput?.();
  screenShare.stop();
  window.clearTimeout(participantStatusTimer);
  window.removeEventListener('openmeet:close-meeting-chat', closeMeetingChat);
  window.removeEventListener('pagehide', handlePageHide);
  window.removeEventListener('keydown', handleFullscreenKeydown);
  window.clearTimeout(fullscreenControlsTimer);
  if (isFullscreen.value) setFullscreen(false);
  document.documentElement.classList.remove('meeting-immersive');
  window.dispatchEvent(new CustomEvent<boolean>('openmeet:meeting-fullscreen', { detail: false }));
  cancelRingingCall();
  window.dispatchEvent(new CustomEvent('openmeet:meeting-chat-state', { detail: false }));
  endCall();
});

function closeMeetingChat() {
  isChatOpen.value = false;
}

// Room access: who may join a hosted meeting, checked before media starts so a refusal keeps the dialog.
const meetingAccess = ref<MeetingRoomAccess | null>(null);
const accessError = ref('');
const isJoining = ref(false);
const isInviteOpen = ref(false);
let joinPassword: string | null = null;
const inviteMode = computed<'enabled' | 'signedOut' | 'hidden'>(() => {
  if (isConversationCall.value) return 'hidden';
  return isAuthenticated.value ? 'enabled' : 'signedOut';
});

async function loadMeetingAccess() {
  try {
    meetingAccess.value = await socialApi.getMeetingRoomAccess(meetingId.value);
  } catch (error) {
    // The server enforces access on join anyway; without the check the dialog simply asks nothing extra.
    console.error('[MeetingRoom] Failed to load meeting access:', error);
  }
}

const handleEntry = async (settings: EntrySettings) => {
  accessError.value = '';
  if (!isConversationCall.value && settings.password !== undefined) {
    isJoining.value = true;
    try {
      await socialApi.checkMeetingRoomPassword(meetingId.value, settings.password);
      joinPassword = settings.password;
    } catch (error) {
      accessError.value = error instanceof SocialApiError ? error.message : t('meeting.join.accessFailed');
      return;
    } finally {
      isJoining.value = false;
    }
  }
  enterCall(settings.name);
};

let hasPlayedJoinedHaptic = false;

// Every meeting and call starts the same way: one capture asks for microphone and camera permission, the saved
// devices and mic state come back, and the camera always starts off.
function enterCall(name: string) {
  void resumeAudioAnalysis().catch(() => undefined);
  participantName.value = name;
  showEntryDialog.value = false;
  hasPlayedJoinedHaptic = false;

  const saved = loadCallSettings();
  pendingMediaSettings.value = { audioEnabled: saved.micOn, videoEnabled: false };

  if (meetingId.value) {
    // In SFU architecture, everyone just "joins" the room
    shouldJoinRoom.value = true;
    pendingRoomId.value = sfuRoomId.value ?? meetingId.value;
  }

  if (!isIdle.value) {
    retry();
  }

  initMedia(participantName.value, {
    audioDeviceId: saved.microphoneId,
    videoDeviceId: saved.cameraId,
    videoQuality: loadVideoQuality(),
    cameraOff: true,
  });
}

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
  saveCallSettings({ micOn: !newMutedState });
  toggleParticipantAudio(localParticipantId.value, !newMutedState);
};

let isTogglingCamera = false;

const handleToggleVideo = async () => {
  if (!localStream.value || !localParticipantId.value || isTogglingCamera) return;

  const turnOn = isVideoOff.value;
  isTogglingCamera = true;
  try {
    await setCameraEnabled(turnOn);
  } catch (error) {
    console.error('[MeetingRoom] Failed to toggle the camera:', error);
    toast({
      title: t('meeting.controls.cameraFailed'),
      description: error instanceof Error ? error.message : undefined,
      variant: 'destructive',
    });
    return;
  } finally {
    isTogglingCamera = false;
  }

  isVideoOff.value = !turnOn;
  refreshMediaAvailability();
  if (localParticipantId.value) toggleParticipantVideo(localParticipantId.value, turnOn);
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

// Every layout change ticks, including automatic ones such as a screen share taking the stage.
watch([viewMode, pinnedParticipantId], () => playHaptic('selection'));

const handleSetViewMode = (mode: 'grid' | 'speaker') => {
  viewMode.value = mode;
};

const handleTogglePin = (participantId: string) => {
  const layout = layoutAfterTileClick(
    { viewMode: viewMode.value, pinnedParticipantId: pinnedParticipantId.value },
    participantId,
  );
  viewMode.value = layout.viewMode;
  pinnedParticipantId.value = layout.pinnedParticipantId;
};

// Full screen works in grid and speaker view alike: only the media shows, on a near-black background. The navbar,
// top row, and controls hide; the controls come back with a swipe up on phones, or the mouse at the bottom edge.
const FULLSCREEN_SWIPE_PX = 40;
const FULLSCREEN_CONTROLS_EDGE_PX = 140;
const FULLSCREEN_CONTROLS_HIDE_MS = 2500;
const isFullscreen = ref(false);
const areFullscreenControlsShown = ref(false);
const showsControls = computed(() => !isFullscreen.value || areFullscreenControlsShown.value);
let swipeStart: { x: number; y: number } | null = null;
let fullscreenControlsTimer: number | undefined;

function setFullscreen(fullscreen: boolean) {
  isFullscreen.value = fullscreen;
  areFullscreenControlsShown.value = false;
  window.clearTimeout(fullscreenControlsTimer);
}

const handleToggleFullscreen = () => setFullscreen(!isFullscreen.value);

watch(isFullscreen, (fullscreen) => {
  // Menus open in portals outside the page, so the dark theme for them hangs off the document.
  document.documentElement.classList.toggle('meeting-immersive', fullscreen);
  window.dispatchEvent(new CustomEvent<boolean>('openmeet:meeting-fullscreen', { detail: fullscreen }));
});

function handleFullscreenTouchStart(event: TouchEvent) {
  const touch = event.touches[0];
  swipeStart = isFullscreen.value && touch ? { x: touch.clientX, y: touch.clientY } : null;
}

// A mostly vertical swipe anywhere: up brings the controls in from the bottom, down hides them again.
function handleFullscreenTouchEnd(event: TouchEvent) {
  const touch = event.changedTouches[0];
  if (!swipeStart || !touch) return;
  const dx = touch.clientX - swipeStart.x;
  const dy = touch.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dy) < FULLSCREEN_SWIPE_PX || Math.abs(dy) < Math.abs(dx)) return;
  areFullscreenControlsShown.value = dy < 0;
}

// The controls stay while the mouse is near the bottom edge or over a menu, and hide a moment after it leaves.
// Menus open in portals outside the page, so the document listens rather than the page.
function scheduleFullscreenControlsHide() {
  window.clearTimeout(fullscreenControlsTimer);
  fullscreenControlsTimer = window.setTimeout(() => {
    if (document.querySelector('[role="menu"]')) scheduleFullscreenControlsHide();
    else areFullscreenControlsShown.value = false;
  }, FULLSCREEN_CONTROLS_HIDE_MS);
}

function handleFullscreenPointerMove(event: PointerEvent) {
  if (!isFullscreen.value || event.pointerType !== 'mouse') return;
  const nearBottom = window.innerHeight - event.clientY <= FULLSCREEN_CONTROLS_EDGE_PX;
  const overMenu = event.target instanceof Element && !!event.target.closest('[role="menu"]');
  if (nearBottom || overMenu) {
    areFullscreenControlsShown.value = true;
    window.clearTimeout(fullscreenControlsTimer);
  } else if (areFullscreenControlsShown.value) {
    scheduleFullscreenControlsHide();
  }
}

useEventListener(document, 'pointermove', handleFullscreenPointerMove, { passive: true });

// Escape first closes an open menu, chat, or dialog; only with none open does it leave full screen.
function handleFullscreenKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !isFullscreen.value || event.defaultPrevented) return;
  if (document.querySelector('[role="menu"], [role="dialog"]')) return;
  setFullscreen(false);
}

// A device switch swaps tracks without the browser's track events, so availability is read again.
function refreshMediaAvailability() {
  readMediaAvailability(localStream.value);
}

function readMediaAvailability(stream: MediaStream | null | undefined) {
  const service = getServices().webrtcService;
  audioAvailable.value = stream?.getAudioTracks().some((track) => track.readyState === 'live') ?? false;
  videoAvailable.value = hasCamera(stream);
  audioIssue.value = service?.getMediaIssue('audio') ?? null;
  videoIssue.value = service?.getMediaIssue('video') ?? null;
}

// Tapping a warning asks for the microphone or camera again. A permanently refused permission shows how to allow
// it instead, since the browser would refuse without a prompt.
async function handleRequestAccess(kind: 'audio' | 'video') {
  const service = getServices().webrtcService;
  if (!service) return;
  const issue = await service.requestMedia(kind);
  refreshMediaAvailability();
  if (issue === 'denied') {
    permissionSheetKind.value = kind;
    isPermissionSheetOpen.value = true;
    return;
  }
  if (issue) {
    toast({
      title: t(kind === 'audio' ? 'meeting.permission.unavailableMicrophone' : 'meeting.permission.unavailableCamera'),
      variant: 'destructive',
    });
    return;
  }
  // Allowing a medium is asking to use it, so it turns on.
  if (kind === 'audio') {
    isMuted.value = false;
    saveCallSettings({ micOn: true });
    if (localParticipantId.value) toggleParticipantAudio(localParticipantId.value, true);
  } else {
    isVideoOff.value = false;
    if (localParticipantId.value) toggleParticipantVideo(localParticipantId.value, true);
  }
}

// A revoked permission or an unplugged device stops the track; the others see it off and the button warns.
function handleLocalTrackLost(kind: 'audio' | 'video') {
  playHaptic('warning');
  refreshMediaAvailability();
  if (kind === 'audio') isMuted.value = true;
  else isVideoOff.value = true;
  if (localParticipantId.value) {
    if (kind === 'audio') toggleParticipantAudio(localParticipantId.value, false);
    else toggleParticipantVideo(localParticipantId.value, false);
  }
}

// A camera turned off has no live track, but it is still there to turn back on.
function hasCamera(stream: MediaStream | null | undefined) {
  const live = stream?.getVideoTracks().some((track) => track.readyState === 'live') ?? false;
  return live || (getServices().webrtcService?.hasCamera() ?? false);
}

const handleSendMessage = (message: string, replyToId?: number) => {
  playHaptic('light');
  sendChatMessage(message, replyToId);
};

const handleChatReaction = (messageId: number, emoji: string) => {
  playHaptic('selection');
  sendChatReaction(messageId, emoji);
};

const handleEndCall = () => {
  screenShare.stop();
  endCall();
  router.push(meetingExitRoute.value);
};

const handleGoHome = () => {
  showConnectionError.value = false;
  screenShare.stop();
  endCall();
  router.push('/');
};

const handleReconnect = () => {
  window.location.reload();
};
</script>

<template>
  <div
    class="relative h-[calc(100dvh-84px)] overflow-hidden px-3 pb-3 pt-0 sm:px-5 sm:pb-3 sm:pt-0"
    :class="isFullscreen ? 'bg-[#0B0F10]' : 'bg-harbor-surface'"
    :data-fullscreen="isFullscreen ? 'true' : undefined"
    @touchstart.passive="handleFullscreenTouchStart"
    @touchend.passive="handleFullscreenTouchEnd"
  >
    <div
      v-if="isCheckingSession"
      class="marketing-font h-full bg-harbor-ink flex items-center justify-center text-harbor-hover"
    >
      <div class="text-center">
        <LoadingRipple size="lg" class="mb-4 text-harbor-faint" />
        <p class="text-harbor-line">{{ t('meeting.checkingAuth') }}</p>
      </div>
    </div>

    <div
      v-if="!hasJoined && !isCheckingSession"
      class="fixed inset-0 overflow-hidden bg-harbor-surface"
      aria-hidden="true"
    >
      <div class="absolute -left-28 top-16 size-96 rounded-full bg-harbor-faint/45 blur-3xl" />
      <div class="absolute -right-24 bottom-0 size-80 rounded-full bg-harbor-avatar/65 blur-3xl" />
      <div class="absolute inset-x-8 top-10 h-px bg-harbor-faint/50" />
    </div>

    <MeetingEntryDialog
      v-if="showEntryDialog"
      open
      :meeting-id="meetingId"
      :initial-name="initialDialogName"
      :show-name-input="showNameInput"
      :access="isConversationCall ? null : meetingAccess"
      :access-error="accessError"
      :joining="isJoining"
      @join="handleEntry"
      @cancel="handleCancelJoin"
    />

    <div v-if="hasJoined && !isCheckingSession" class="marketing-font h-full text-harbor-ink flex flex-col">
      <!-- Participant Count Badge -->
      <div
        v-if="!isFullscreen"
        class="fixed left-7 z-50 flex h-[var(--meeting-control-size)] items-center gap-2 rounded-full bg-white px-4 text-harbor-ink shadow-[0_1px_2px_rgba(17,27,33,0.06),0_4px_14px_rgba(17,27,33,0.1)] sm:left-9 sm:top-[calc(84px+1.25rem)]"
        :class="phoneTopRowClass"
      >
        <Users class="h-5 w-5" />
        <span class="font-semibold">{{ participantCount }}</span>
      </div>

      <div
        v-if="!isFullscreen"
        class="fixed z-[60] transition-[right] sm:top-[calc(84px+1.25rem)]"
        :class="[phoneTopRowClass, isChatOpen ? 'right-16' : 'right-7 sm:right-9']"
      >
        <MeetingActionMenu
          :audio-available="audioAvailable"
          :is-chat-open="isChatOpen"
          :is-muted="isMuted"
          :is-video-off="isVideoOff"
          :participants="meetingParticipants"
          :pinned-participant-id="pinnedParticipantId"
          :video-available="videoAvailable"
          :view-mode="viewMode"
          :fullscreen="isFullscreen"
          @disconnect="handleEndCall"
          @toggle-fullscreen="handleToggleFullscreen"
          @set-view-mode="handleSetViewMode"
          @toggle-chat="handleToggleChat"
          @toggle-mute="handleToggleMute"
          @toggle-pin="handleTogglePin"
          @toggle-video="handleToggleVideo"
        />
      </div>

      <!-- Motion animates `transform`, which would replace a translate-based centering, so a full-width row centers it.
           Phones place it below the participants and menu buttons, which share the top row there. -->
      <div
        v-if="!isFullscreen"
        class="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 sm:top-[calc(84px+1.25rem)]"
        :class="phoneBelowTopRowClass"
      >
        <AnimatePresence>
          <motion.div
            v-if="connectionBanner"
            :key="connectionBanner"
            data-testid="connection-banner"
            :data-banner="connectionBanner"
            role="status"
            :initial="{ opacity: 0, y: -8 }"
            :animate="{ opacity: 1, y: 0 }"
            :exit="{ opacity: 0, y: -8 }"
            class="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-full border px-4 py-2 text-center text-sm font-semibold shadow-lg"
            :class="
              connectionBanner === 'reconnecting'
                ? 'border-harbor-danger/25 bg-harbor-danger-soft text-harbor-danger-strong'
                : 'border-harbor-line bg-white text-harbor-ink-soft'
            "
          >
            <LoadingRipple
              size="sm"
              class="shrink-0"
              :class="connectionBanner === 'reconnecting' ? 'text-harbor-danger' : 'text-harbor-accent'"
            />
            {{ t(connectionBanner === 'reconnecting' ? 'meeting.reconnecting' : 'meeting.joiningCall') }}
          </motion.div>
        </AnimatePresence>
      </div>

      <button
        v-if="hasPoorConnection && !isFullscreen"
        type="button"
        :class="phoneBelowTopRowClass"
        class="fixed left-1/2 z-50 w-[calc(100%-3.5rem)] max-w-md -translate-x-1/2 rounded-xl border border-harbor-danger/25 bg-harbor-danger-soft px-4 py-3 text-left text-sm text-harbor-danger-strong shadow-lg sm:top-[calc(84px+1.25rem)]"
        data-testid="connection-quality-warning"
        @click="showConnectionQualityDetails = !showConnectionQualityDetails"
      >
        <div class="flex items-center gap-3">
          <span class="rounded-full bg-white/75 p-1.5 text-harbor-danger">
            <AlertTriangle class="h-4 w-4" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-harbor-danger-strong">{{ t('meeting.poorConnection') }}</span>
              <span class="rounded-full bg-harbor-danger px-2 py-0.5 text-xs font-medium text-white">
                {{ t('meeting.warning') }}
              </span>
            </div>
            <p v-if="showConnectionQualityDetails" class="mt-1 text-xs text-harbor-danger-strong">
              {{ connectionQualityReason || t('meeting.mediaWarning') }}
              <span v-if="packetLossPercent > 0">
                {{ t('meeting.packetLoss', { percent: packetLossPercent }) }}
              </span>
            </p>
          </div>
          <ChevronDown
            class="h-4 w-4 shrink-0 text-harbor-danger-strong transition-transform"
            :class="{ 'rotate-180': showConnectionQualityDetails }"
          />
        </div>
      </button>

      <!-- Debug Info Panel -->
      <div
        v-if="showConnectionStatus && !isFullscreen"
        :class="phoneBelowTopRowClass"
        class="fixed right-7 z-50 space-y-1 rounded-lg border border-harbor-line bg-harbor-hover p-3 text-xs text-harbor-ink shadow-lg sm:right-9 sm:top-[calc(84px+2.5rem+var(--meeting-control-size))]"
      >
        <div class="flex items-center gap-2">
          <span class="text-harbor-icon">{{ t('meeting.state') }}</span>
          <span class="font-mono text-harbor-accent">{{ statusLabel(String(state)) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-harbor-icon">{{ t('meeting.connection') }}</span>
          <span
            class="font-mono"
            :class="{
              'text-harbor-accent': connectionState === 'connected',
              'text-harbor-danger':
                connectionState === 'connecting' || connectionState === 'failed' || connectionState === 'disconnected',
              'text-harbor-icon': !connectionState,
            }"
          >
            {{ statusLabel(connectionState) }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-harbor-icon">{{ t('meeting.ice') }}</span>
          <span
            class="font-mono"
            :class="{
              'text-harbor-accent': iceConnectionState === 'connected' || iceConnectionState === 'completed',
              'text-harbor-danger':
                iceConnectionState === 'checking' ||
                iceConnectionState === 'new' ||
                iceConnectionState === 'failed' ||
                iceConnectionState === 'disconnected',
              'text-harbor-icon': !iceConnectionState,
            }"
          >
            {{ statusLabel(iceConnectionState) }}
          </span>
        </div>
        <div class="flex items-center gap-2 pt-1 border-t border-harbor-line">
          <span class="text-harbor-icon">{{ t('meeting.participants') }}</span>
          <span class="font-mono text-harbor-accent font-bold">{{ participantCount }}</span>
        </div>
      </div>

      <div v-if="isInitializingMedia" class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <LoadingRipple size="lg" class="mb-4 text-harbor-accent" />
          <p class="text-harbor-ink-soft">{{ t('meeting.settingUpMedia') }}</p>
        </div>
      </div>

      <div v-else class="flex-1 flex flex-col">
        <MeetingActionMenu
          context
          :audio-available="audioAvailable"
          :is-chat-open="isChatOpen"
          :is-muted="isMuted"
          :is-video-off="isVideoOff"
          :participants="meetingParticipants"
          :pinned-participant-id="pinnedParticipantId"
          :video-available="videoAvailable"
          :view-mode="viewMode"
          :fullscreen="isFullscreen"
          @disconnect="handleEndCall"
          @toggle-fullscreen="handleToggleFullscreen"
          @set-view-mode="handleSetViewMode"
          @toggle-chat="handleToggleChat"
          @toggle-mute="handleToggleMute"
          @toggle-pin="handleTogglePin"
          @toggle-video="handleToggleVideo"
        >
          <VideoGrid
            :active-speaker-id="activeSpeakerId"
            :participants="meetingParticipants"
            :pinned-participant-id="pinnedParticipantId"
            :participant-statuses="participantStatuses"
            :participant-avatars="participantAvatars"
            :view-mode="viewMode"
            :phone-top-bar="hasPhoneTopBar"
            :fullscreen="isFullscreen"
            :controls-shown="areFullscreenControlsShown"
            @toggle-pin="handleTogglePin"
            @toggle-fullscreen="handleToggleFullscreen"
          />
        </MeetingActionMenu>

        <Transition name="meeting-controls">
          <MeetingControls
            v-show="showsControls"
            :dark="isFullscreen"
            :audio-available="audioAvailable"
            :is-muted="isMuted"
            :is-video-off="isVideoOff"
            :meeting-id="meetingId"
            :show-connection-status="showConnectionStatus"
            :is-chat-open="isChatOpen"
            :unread-count="unreadCount"
            :video-available="videoAvailable"
            :audio-warning="audioWarning"
            :video-warning="videoWarning"
            :invite-mode="inviteMode"
            :can-present="screenShare.isSupported"
            @start-screen-share="handleStartScreenShare"
            @stop-screen-share="screenShare.stop()"
            @toggle-mute="handleToggleMute"
            @toggle-video="handleToggleVideo"
            @toggle-stats="handleToggleStats"
            @toggle-chat="handleToggleChat"
            @end-call="handleEndCall"
            @invite="isInviteOpen = true"
            @media-changed="refreshMediaAvailability"
            @request-access="handleRequestAccess"
          />
        </Transition>
      </div>

      <!-- Chat Panel -->
      <ChatPanel
        v-model:open="isChatOpen"
        :room-id="sfuRoomId ?? meetingId"
        :messages="chatMessages"
        :local-participant-id="localParticipantId"
        @send="handleSendMessage"
        @react="handleChatReaction"
      />
    </div>

    <MeetingPermissionSheet
      v-if="permissionSheetKind"
      v-model:open="isPermissionSheetOpen"
      :kind="permissionSheetKind"
    />

    <MeetingInviteDialog
      v-if="inviteMode === 'enabled'"
      v-model:open="isInviteOpen"
      :room-id="meetingId"
      :access="meetingAccess"
      @access-updated="meetingAccess = $event"
    />

    <ScreenAreaPicker />

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

<style>
/* Full screen controls slide up from the bottom and back down. Only the bar's own layers fade: an ancestor
   below full opacity would stop the glass from blurring the video behind it until the fade ended, which mobile
   browsers show as the blur popping in. */
.meeting-controls-enter-active,
.meeting-controls-leave-active {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.meeting-controls-enter-active .liquid-surface > *,
.meeting-controls-leave-active .liquid-surface > * {
  transition: opacity 0.24s ease;
}

.meeting-controls-enter-from,
.meeting-controls-leave-to {
  transform: translateY(1.5rem);
}

.meeting-controls-enter-from .liquid-surface > *,
.meeting-controls-leave-to .liquid-surface > * {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .meeting-controls-enter-active,
  .meeting-controls-leave-active,
  .meeting-controls-enter-active .liquid-surface > *,
  .meeting-controls-leave-active .liquid-surface > * {
    transition: none;
  }
}
</style>
