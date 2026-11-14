<script setup lang="ts">
import { Maximize, Minimize, PhoneOff, UserRoundPlus } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { playHaptic } from '@/services/haptics';
import type { Participant } from '@/xstate/machines/webrtc/types';

import MeetingActionMenu from './MeetingActionMenu.vue';
import MeetingMediaControl from './MeetingMediaControl.vue';
import MeetingScreenShareControl from './MeetingScreenShareControl.vue';

// The desktop controls bar: [mic▾][camera▾] · [share][⋮] · [leave], with invite on the far left and Full screen
// on the far right. The chat sits in the top bar.
interface Props {
  audioAvailable: boolean;
  showConnectionStatus: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  meetingId: string;
  videoAvailable: boolean;
  participants: Participant[];
  pinnedParticipantId: string | null;
  viewMode: 'grid' | 'speaker';
  /** Inviting needs a session; conversation calls invite through their conversation instead. */
  inviteMode?: 'enabled' | 'signedOut' | 'hidden';
  /** Browsers without screen capture, such as most phones, get no present button. */
  canPresent?: boolean;
  canSelectArea?: boolean;
  isPresenting?: boolean;
  /** Full screen shows the bar dark over the near-black stage. */
  dark?: boolean;
  fullscreen?: boolean;
  /** The call could not get the microphone or camera; its button shows a warning that asks again. */
  audioWarning?: boolean;
  videoWarning?: boolean;
}

interface Emits {
  (e: 'toggle-stats'): void;
  (e: 'toggle-mute'): void;
  (e: 'toggle-video'): void;
  (e: 'toggle-fullscreen'): void;
  (e: 'end-call'): void;
  (e: 'invite'): void;
  /** A microphone or camera switch replaced a local track. */
  (e: 'media-changed'): void;
  /** Preview camera was chosen in the camera menu. */
  (e: 'preview-camera'): void;
  (e: 'request-access', kind: 'audio' | 'video'): void;
  (e: 'start-screen-share', options?: { selectArea: boolean }): void;
  (e: 'stop-screen-share'): void;
  (e: 'set-view-mode', mode: 'grid' | 'speaker'): void;
  (e: 'toggle-pin', participantId: string): void;
}

withDefaults(defineProps<Props>(), {
  inviteMode: 'hidden',
  canPresent: false,
  canSelectArea: false,
  isPresenting: false,
  dark: false,
  fullscreen: false,
  audioWarning: false,
  videoWarning: false,
});
const emit = defineEmits<Emits>();
const { t } = useI18n();

function onLeave() {
  playHaptic('medium');
  emit('end-call');
}
</script>

<template>
  <!-- Solid trays: [mic▾ camera▾] [share ⋮] then Leave in red, with invite on the far left and Full screen on the far
       right. -->
  <div
    class="marketing-font pointer-events-none fixed inset-x-0 bottom-4 z-40 flex items-center justify-center gap-2 text-harbor-ink sm:bottom-6"
    :class="{ 'meeting-controls-dark': dark }"
    data-meeting-controls
  >
    <div class="call-tray pointer-events-auto" data-controls-group="media">
      <MeetingMediaControl
        kind="audio"
        :off="isMuted"
        :available="audioAvailable"
        :warning="audioWarning"
        @toggle="emit('toggle-mute')"
        @request-access="emit('request-access', 'audio')"
        @media-changed="emit('media-changed')"
      />

      <MeetingMediaControl
        kind="video"
        :off="isVideoOff"
        :available="videoAvailable"
        :warning="videoWarning"
        @toggle="emit('toggle-video')"
        @request-access="emit('request-access', 'video')"
        @media-changed="emit('media-changed')"
        @preview-camera="emit('preview-camera')"
      />
    </div>

    <div class="call-tray pointer-events-auto" data-controls-group="actions">
      <MeetingScreenShareControl
        v-if="canPresent"
        @start="emit('start-screen-share')"
        @start-area="emit('start-screen-share', { selectArea: true })"
        @stop="emit('stop-screen-share')"
      />

      <div class="group relative">
        <MeetingActionMenu
          :participants="participants"
          :pinned-participant-id="pinnedParticipantId"
          :view-mode="viewMode"
          :meeting-id="meetingId"
          :invite-mode="inviteMode"
          :can-present="canPresent"
          :can-select-area="canSelectArea"
          :is-presenting="isPresenting"
          :show-connection-status="showConnectionStatus"
          @set-view-mode="emit('set-view-mode', $event)"
          @toggle-pin="emit('toggle-pin', $event)"
          @invite="emit('invite')"
          @start-screen-share="emit('start-screen-share', $event)"
          @stop-screen-share="emit('stop-screen-share')"
          @toggle-stats="emit('toggle-stats')"
        />
      </div>
    </div>

    <div class="group pointer-events-auto relative">
      <button
        type="button"
        class="call-button call-button-leave call-button-tall"
        :aria-label="t('meeting.controls.endCall')"
        @click="onLeave"
      >
        <PhoneOff />
      </button>
      <span class="meeting-tooltip">{{ t('meeting.tooltips.leave') }}</span>
    </div>

    <div v-if="inviteMode !== 'hidden'" class="group pointer-events-auto absolute left-6">
      <button
        type="button"
        class="call-button call-chip"
        :aria-label="t('meeting.controls.invitePeople')"
        data-invite-trigger
        @click="emit('invite')"
      >
        <UserRoundPlus />
      </button>
      <span class="meeting-tooltip">{{ t('meeting.controls.invitePeople') }}</span>
    </div>

    <div class="call-tray pointer-events-auto absolute right-6">
      <div class="group relative">
        <button
          type="button"
          class="call-button"
          :aria-label="t(fullscreen ? 'meeting.actions.exitFullscreen' : 'meeting.actions.fullscreen')"
          :aria-pressed="fullscreen"
          data-fullscreen-toggle
          @click="emit('toggle-fullscreen')"
        >
          <Minimize v-if="fullscreen" />
          <Maximize v-else />
        </button>
        <span class="meeting-tooltip">{{
          t(fullscreen ? 'meeting.actions.exitFullscreen' : 'meeting.actions.fullscreen')
        }}</span>
      </div>
    </div>
  </div>
</template>
