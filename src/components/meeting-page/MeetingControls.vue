<script setup lang="ts">
import { Maximize, MessageSquare, Minimize, PhoneOff } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { playHaptic } from '@/services/haptics';
import type { Participant } from '@/xstate/machines/webrtc/types';

import MeetingActionMenu from './MeetingActionMenu.vue';
import MeetingMediaControl from './MeetingMediaControl.vue';
import MeetingScreenShareControl from './MeetingScreenShareControl.vue';

// The desktop controls bar: [mic▾][camera▾] · [share][chat][⋮] · [leave], with Full screen on the far right.
interface Props {
  audioAvailable: boolean;
  showConnectionStatus: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  meetingId: string;
  isChatOpen: boolean;
  unreadCount?: number;
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
  (e: 'toggle-chat'): void;
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

const props = withDefaults(defineProps<Props>(), {
  unreadCount: 0,
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

const chatAriaLabel = computed(() => {
  if (props.isChatOpen) return t('meeting.controls.closeChat');
  if (props.unreadCount) return t('meeting.controls.openChatWithUnread', { count: props.unreadCount });
  return t('meeting.controls.openChat');
});

function onLeave() {
  playHaptic('medium');
  emit('end-call');
}
</script>

<template>
  <!-- Solid trays: [mic▾ camera▾] [share chat ⋮] then Leave in red, with Full screen on the far right. -->
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
        <button
          type="button"
          class="call-button relative"
          :aria-label="chatAriaLabel"
          :aria-pressed="isChatOpen"
          :data-active="isChatOpen"
          data-chat-trigger
          @click="emit('toggle-chat')"
        >
          <MessageSquare />
          <span
            v-if="unreadCount > 0 && !isChatOpen"
            class="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-harbor-accent text-[0.625rem] font-bold text-white"
          >
            {{ unreadCount > 9 ? '9+' : unreadCount }}
          </span>
        </button>
        <span class="meeting-tooltip">{{ t('meeting.tooltips.chat') }}</span>
      </div>

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
