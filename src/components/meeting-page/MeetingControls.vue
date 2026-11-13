<script setup lang="ts">
import { Maximize, MessageSquare, Minimize, PhoneOff } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import LiquidGlassSurface from '@/components/layout/LiquidGlassSurface.vue';
import { Button } from '@/components/ui/button';
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
  /** Full screen shows the bar as dark glass over the near-black stage. */
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

// The liquid drop rests on an open menu, else on the open chat, and follows the mouse.
const openMenuKey = ref<string | null>(null);
const dropTargetKey = computed(() => openMenuKey.value ?? (props.isChatOpen ? 'chat' : null));
const measureKey = computed(() => `${props.canPresent}`);

function setMenuOpen(key: string, open: boolean) {
  if (open) openMenuKey.value = key;
  else if (openMenuKey.value === key) openMenuKey.value = null;
}

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
  <!-- The controls sit on the same liquid glass as the navbar: round transparent buttons, with the drop on the
       hovered button or open menu. -->
  <!-- A full-width row centers the bar, so the full screen slide-in can animate its transform freely. -->
  <div
    class="marketing-font pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center text-harbor-ink sm:bottom-6"
    :class="{ 'meeting-controls-dark': dark }"
    data-meeting-controls
  >
    <LiquidGlassSurface
      class="pointer-events-auto flex items-center justify-center gap-1 rounded-full p-1.5 sm:gap-2 sm:p-2"
      :data-tone="dark ? 'dark' : undefined"
      :target-key="dropTargetKey"
      :measure-key="measureKey"
      follow-hover
    >
      <MeetingMediaControl
        kind="audio"
        data-liquid-key="audio"
        @open-change="setMenuOpen('audio', $event)"
        :off="isMuted"
        :available="audioAvailable"
        :warning="audioWarning"
        @toggle="emit('toggle-mute')"
        @request-access="emit('request-access', 'audio')"
        @media-changed="emit('media-changed')"
      />

      <MeetingMediaControl
        kind="video"
        data-liquid-key="video"
        @open-change="setMenuOpen('video', $event)"
        :off="isVideoOff"
        :available="videoAvailable"
        :warning="videoWarning"
        @toggle="emit('toggle-video')"
        @request-access="emit('request-access', 'video')"
        @media-changed="emit('media-changed')"
        @preview-camera="emit('preview-camera')"
      />

      <span aria-hidden="true" class="h-6 w-px shrink-0 bg-harbor-line" data-controls-separator />

      <MeetingScreenShareControl
        v-if="canPresent"
        data-liquid-key="present"
        @open-change="setMenuOpen('present', $event)"
        @start="emit('start-screen-share')"
        @start-area="emit('start-screen-share', { selectArea: true })"
        @stop="emit('stop-screen-share')"
      />

      <div class="group relative" data-liquid-key="chat">
        <Button
          variant="secondary"
          size="icon"
          @click="emit('toggle-chat')"
          class="meeting-control relative size-[var(--meeting-control-size)] rounded-full border-0 bg-transparent text-harbor-ink shadow-none [&_svg]:size-[var(--meeting-control-icon)]"
          :class="{ '!text-harbor-ink': props.isChatOpen }"
          :aria-label="chatAriaLabel"
          data-chat-trigger
        >
          <MessageSquare class="h-5 w-5" />
          <span
            v-if="props.unreadCount && props.unreadCount > 0 && !props.isChatOpen"
            class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-harbor-ink text-xs font-bold text-white"
          >
            {{ props.unreadCount > 9 ? '9+' : props.unreadCount }}
          </span>
        </Button>
        <span class="meeting-tooltip">{{ t('meeting.tooltips.chat') }}</span>
      </div>

      <div class="group relative" data-liquid-key="more">
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
          @open-change="setMenuOpen('more', $event)"
          @set-view-mode="emit('set-view-mode', $event)"
          @toggle-pin="emit('toggle-pin', $event)"
          @invite="emit('invite')"
          @start-screen-share="emit('start-screen-share', $event)"
          @stop-screen-share="emit('stop-screen-share')"
          @toggle-stats="emit('toggle-stats')"
        />
      </div>

      <span aria-hidden="true" class="h-6 w-px shrink-0 bg-harbor-line" data-controls-separator />

      <div class="group relative" data-liquid-key="leave">
        <Button
          variant="danger"
          size="icon"
          @click="onLeave"
          class="meeting-control-danger size-[var(--meeting-control-size)] border-0 [&_svg]:size-[var(--meeting-control-icon)]"
          :aria-label="t('meeting.controls.endCall')"
        >
          <PhoneOff class="h-5 w-5" />
        </Button>
        <span class="meeting-tooltip">{{ t('meeting.tooltips.leave') }}</span>
      </div>
    </LiquidGlassSurface>

    <LiquidGlassSurface
      class="pointer-events-auto absolute right-6 flex rounded-full p-1.5 sm:p-2"
      :data-tone="dark ? 'dark' : undefined"
      :target-key="null"
      follow-hover
    >
      <div class="group relative" data-liquid-key="fullscreen">
        <Button
          variant="secondary"
          size="icon"
          class="meeting-control size-[var(--meeting-control-size)] rounded-full border-0 bg-transparent text-harbor-ink shadow-none [&_svg]:size-[var(--meeting-control-icon)]"
          :aria-label="t(fullscreen ? 'meeting.actions.exitFullscreen' : 'meeting.actions.fullscreen')"
          :aria-pressed="fullscreen"
          data-fullscreen-toggle
          @click="emit('toggle-fullscreen')"
        >
          <Minimize v-if="fullscreen" class="h-5 w-5" />
          <Maximize v-else class="h-5 w-5" />
        </Button>
        <span class="meeting-tooltip">{{
          t(fullscreen ? 'meeting.actions.exitFullscreen' : 'meeting.actions.fullscreen')
        }}</span>
      </div>
    </LiquidGlassSurface>
  </div>
</template>
