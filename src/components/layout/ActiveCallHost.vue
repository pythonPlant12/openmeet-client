<script setup lang="ts">
import { useEventListener } from '@vueuse/core';
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';

import MiniCall from '@/components/meeting-page/MiniCall.vue';
import { useAuth } from '@/composables/useAuth';
import { useScreenShare } from '@/composables/useScreenShare';
import { useWebrtc } from '@/composables/useWebrtc';
import { saveCallSettings } from '@/lib/call-settings';
import { lastWorkspaceRoute } from '@/lib/workspace-return';
import { followAudioOutput } from '@/services/audio-output';
import { socialApi } from '@/services/social-api';
import type { Participant } from '@/xstate/machines/webrtc/types';

// The active call's owner (ADR 0001): what used to end with the call screen now lives for the whole call. The
// chosen speaker follows the call's audio wherever it plays, the screen share stops when the call ends, a
// conversation call stops ringing when its call ends or the tab closes, and the collapsed call shows as the
// mini call over every page.
const router = useRouter();
const { isAuthenticated, accessToken } = useAuth();
const {
  isConnected,
  collapsed,
  callSessionId,
  activeCallRoute,
  participantsArray,
  localParticipant,
  localParticipantId,
  localStream,
  collapse,
  expand,
  leaveRoom,
  toggleParticipantAudio,
} = useWebrtc();
const screenShare = useScreenShare();

// Leaving the call screen while the call runs collapses it to the mini call (ADR 0001): browser Back, the
// system back gesture and the collapse button alike. Only Leave ends the call, before the route changes.
router.beforeEach((to, from) => {
  if (from.name === 'meeting' && to.name !== 'meeting' && isAuthenticated.value && isConnected.value) collapse();
});
router.afterEach((to) => {
  if (to.name !== 'meeting') lastWorkspaceRoute.value = to.fullPath;
});

let stopFollowingAudioOutput: (() => void) | null = null;
watch(
  isConnected,
  (connected) => {
    if (connected) {
      stopFollowingAudioOutput ??= followAudioOutput();
      return;
    }
    stopFollowingAudioOutput?.();
    stopFollowingAudioOutput = null;
    screenShare.stop();
  },
  { immediate: true },
);

// A caller who leaves a call nobody else is in stops it ringing for everyone. The server ignores the request
// from anyone else, or while someone is still in the call.
function cancelRinging(sessionId: string, keepalive = false) {
  const token = accessToken.value;
  if (!token) return;
  socialApi
    .cancelCallSession(token, sessionId, { keepalive })
    .catch((error) => console.error('[ActiveCall] Failed to stop the call ringing:', error));
}
watch(callSessionId, (current, previous) => {
  if (previous && !current) cancelRinging(previous);
});
useEventListener(window, 'pagehide', () => {
  if (callSessionId.value) cancelRinging(callSessionId.value, true);
});

const showsMiniCall = computed(() => isAuthenticated.value && isConnected.value && collapsed.value);
// Your own screen share is shown from the local capture, since the SFU never sends it back.
const miniParticipants = computed<Participant[]>(() =>
  participantsArray.value.map((participant) =>
    participant.screenShareOf === localParticipantId.value && screenShare.stream.value
      ? { ...participant, isLocal: true, stream: screenShare.stream.value }
      : participant,
  ),
);

const isMuted = computed(() => !(localParticipant.value?.audioEnabled ?? true));

function handleExpand() {
  expand();
  if (activeCallRoute.value) void router.push(activeCallRoute.value);
}

// Mute from the mini call works like the call screen's mic button: the tracks, the saved setting, the room.
function handleMute() {
  const stream = localStream.value;
  const participantId = localParticipantId.value;
  if (!stream || !participantId) return;
  const micOn = isMuted.value;
  stream.getAudioTracks().forEach((track) => (track.enabled = micOn));
  saveCallSettings({ micOn });
  toggleParticipantAudio(participantId, micOn);
}

function handleLeave() {
  screenShare.stop();
  leaveRoom();
}
</script>

<template>
  <MiniCall
    v-if="showsMiniCall"
    :participants="miniParticipants"
    :local-participant-id="localParticipantId"
    :is-muted="isMuted"
    @expand="handleExpand"
    @mute="handleMute"
    @leave="handleLeave"
  />
</template>
