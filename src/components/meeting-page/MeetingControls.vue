<script setup lang="ts">
import { CopyAnimated, Link2Animated, UserRoundPlusAnimated } from '@respeak/lucide-motion-vue';
import { Check, Code, MessageSquare, PhoneOff, Share2 } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import LiquidGlassSurface from '@/components/layout/LiquidGlassSurface.vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import LiquidMenuIcon from '@/components/ui/liquid-menu/LiquidMenuIcon.vue';

import MeetingMediaControl from './MeetingMediaControl.vue';
import MeetingScreenShareControl from './MeetingScreenShareControl.vue';

interface Props {
  audioAvailable: boolean;
  showConnectionStatus: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  meetingId: string;
  isChatOpen: boolean;
  unreadCount?: number;
  videoAvailable: boolean;
  /** Inviting needs a session; conversation calls invite through their conversation instead. */
  inviteMode?: 'enabled' | 'signedOut' | 'hidden';
  /** Browsers without screen capture, such as most phones, get no present button. */
  canPresent?: boolean;
  /** Full screen shows the bar as dark glass over the near-black stage. */
  dark?: boolean;
  /** The call could not get the microphone or camera; its button shows a warning that asks again. */
  audioWarning?: boolean;
  videoWarning?: boolean;
}

interface Emits {
  (e: 'toggle-stats'): void;
  (e: 'toggle-mute'): void;
  (e: 'toggle-video'): void;
  (e: 'toggle-chat'): void;
  (e: 'end-call'): void;
  (e: 'invite'): void;
  /** A microphone or camera switch replaced a local track. */
  (e: 'media-changed'): void;
  /** Preview camera was chosen in the camera menu. */
  (e: 'preview-camera'): void;
  (e: 'request-access', kind: 'audio' | 'video'): void;
  (e: 'start-screen-share', options?: { selectArea: boolean }): void;
  (e: 'stop-screen-share'): void;
}

const props = withDefaults(defineProps<Props>(), {
  unreadCount: 0,
  inviteMode: 'hidden',
  canPresent: false,
  dark: false,
  audioWarning: false,
  videoWarning: false,
});
const emit = defineEmits<Emits>();
const { t } = useI18n();

// The liquid drop rests on an open menu, else on the open chat or stats panel, and follows the mouse.
const openMenuKey = ref<string | null>(null);
const dropTargetKey = computed(
  () => openMenuKey.value ?? (props.isChatOpen ? 'chat' : props.showConnectionStatus ? 'stats' : null),
);
const measureKey = computed(() => `${props.canPresent}|${props.inviteMode}`);

function setMenuOpen(key: string, open: boolean) {
  if (open) openMenuKey.value = key;
  else if (openMenuKey.value === key) openMenuKey.value = null;
}

const copiedLink = ref(false);
const copiedId = ref(false);
const chatAriaLabel = computed(() => {
  if (props.isChatOpen) return t('meeting.controls.closeChat');
  if (props.unreadCount) return t('meeting.controls.openChatWithUnread', { count: props.unreadCount });
  return t('meeting.controls.openChat');
});

const copyMeetingLink = async () => {
  const link = `${window.location.origin}/room/${props.meetingId}`;
  await navigator.clipboard.writeText(link);
  copiedLink.value = true;
  setTimeout(() => {
    copiedLink.value = false;
  }, 2000);
};

const copyMeetingId = async () => {
  await navigator.clipboard.writeText(props.meetingId);
  copiedId.value = true;
  setTimeout(() => {
    copiedId.value = false;
  }, 2000);
};

const shareOnWhatsApp = () => {
  const link = `${window.location.origin}/room/${props.meetingId}`;
  const text = t('meeting.controls.shareText', { link });
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

const shareOnTelegram = () => {
  const link = `${window.location.origin}/room/${props.meetingId}`;
  const text = t('meeting.controls.shareTitle');
  window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`, '_blank');
};
</script>

<template>
  <!-- The controls sit on the same liquid glass as the navbar: round transparent buttons, with the drop on the
       hovered button or open menu. On phones the account button sits above the bar (see TheNavbar). -->
  <!-- A full-width row centers the bar, so the full screen slide-in can animate its transform freely. -->
  <div
    class="marketing-font pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center text-harbor-ink sm:bottom-6"
    :class="{ 'meeting-controls-dark': dark }"
  >
    <LiquidGlassSurface
      class="pointer-events-auto flex items-center justify-center gap-1 rounded-full p-1.5 sm:gap-2 sm:p-2"
      :data-tone="dark ? 'dark' : undefined"
      :target-key="dropTargetKey"
      :measure-key="measureKey"
      follow-hover
    >
      <!-- Connection status Button -->
      <div class="group relative" data-liquid-key="stats">
        <Button
          variant="secondary"
          size="icon"
          @click="emit('toggle-stats')"
          class="meeting-control size-[var(--meeting-control-size)] rounded-full border-0 bg-transparent text-harbor-ink shadow-none [&_svg]:size-[var(--meeting-control-icon)]"
          :class="{ '!text-harbor-ink': showConnectionStatus }"
          :aria-label="t('meeting.controls.toggleStats')"
        >
          <Code class="h-5 w-5" />
        </Button>
        <span class="meeting-tooltip">{{ t('meeting.tooltips.status') }}</span>
      </div>

      <!-- Share Dropdown -->
      <div class="group relative" data-liquid-key="share">
        <DropdownMenu @update:open="setMenuOpen('share', $event)">
          <DropdownMenuTrigger as-child>
            <Button
              variant="secondary"
              size="icon"
              class="meeting-control size-[var(--meeting-control-size)] rounded-full border-0 bg-transparent text-harbor-ink shadow-none [&_svg]:size-[var(--meeting-control-icon)]"
              :aria-label="t('meeting.controls.openShare')"
            >
              <Share2 class="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" class="meeting-menu marketing-font w-60">
            <template v-if="inviteMode !== 'hidden'">
              <DropdownMenuItem
                data-invite-people
                :disabled="inviteMode !== 'enabled'"
                class="data-[disabled]:cursor-not-allowed"
                @select="emit('invite')"
              >
                <LiquidMenuIcon class="mr-2" :animated="UserRoundPlusAnimated" />
                <span class="min-w-0">
                  <span class="block">{{ t('meeting.controls.invitePeople') }}</span>
                  <span v-if="inviteMode === 'signedOut'" class="block text-xs font-normal text-harbor-muted">{{
                    t('meeting.controls.inviteSignIn')
                  }}</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </template>
            <DropdownMenuItem @click="copyMeetingLink">
              <LiquidMenuIcon class="mr-2" :animated="Link2Animated" />
              <span>{{ copiedLink ? t('meeting.controls.linkCopied') : t('meeting.controls.copyLink') }}</span>
              <Check v-if="copiedLink" class="ml-auto h-4 w-4 text-harbor-ink" />
            </DropdownMenuItem>

            <DropdownMenuItem @click="copyMeetingId">
              <LiquidMenuIcon class="mr-2" :animated="CopyAnimated" />
              <span>{{ copiedId ? t('meeting.controls.idCopied') : t('meeting.controls.copyId') }}</span>
              <Check v-if="copiedId" class="ml-auto h-4 w-4 text-harbor-ink" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem @click="shareOnWhatsApp">
              <img
                src="/icons/social-media/whatsapp.svg"
                class="mr-2 h-4 w-4"
                :alt="t('meeting.controls.shareWhatsApp')"
              />
              <span>{{ t('meeting.controls.shareWhatsApp') }}</span>
            </DropdownMenuItem>

            <DropdownMenuItem @click="shareOnTelegram">
              <img
                src="/icons/social-media/telegram.svg"
                class="mr-2 h-4 w-4"
                :alt="t('meeting.controls.shareTelegram')"
              />
              <span>{{ t('meeting.controls.shareTelegram') }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span class="meeting-tooltip">{{ t('meeting.tooltips.share') }}</span>
      </div>

      <MeetingScreenShareControl
        v-if="canPresent"
        data-liquid-key="present"
        @open-change="setMenuOpen('present', $event)"
        @start="emit('start-screen-share')"
        @start-area="emit('start-screen-share', { selectArea: true })"
        @stop="emit('stop-screen-share')"
      />

      <!-- Chat Button -->
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

      <!-- End Call Button -->
      <div class="group relative" data-liquid-key="leave">
        <Button
          variant="danger"
          size="icon"
          @click="emit('end-call')"
          class="meeting-control-danger size-[var(--meeting-control-size)] border-0 [&_svg]:size-[var(--meeting-control-icon)]"
          :aria-label="t('meeting.controls.endCall')"
        >
          <PhoneOff class="h-5 w-5" />
        </Button>
        <span class="meeting-tooltip">{{ t('meeting.tooltips.leave') }}</span>
      </div>
    </LiquidGlassSurface>
  </div>
</template>
