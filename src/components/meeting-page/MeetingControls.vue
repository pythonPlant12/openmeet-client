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
  (e: 'start-screen-share'): void;
  (e: 'stop-screen-share'): void;
}

const props = withDefaults(defineProps<Props>(), {
  unreadCount: 0,
  inviteMode: 'hidden',
  canPresent: false,
  dark: false,
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
    class="marketing-font pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center text-[#102F35] sm:bottom-6"
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
          class="meeting-control size-11 rounded-full border-0 bg-transparent text-[#102F35] shadow-none sm:size-12"
          :class="{ '!text-[#0B7A75]': showConnectionStatus }"
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
              class="meeting-control size-11 rounded-full border-0 bg-transparent text-[#102F35] shadow-none sm:size-12"
              :aria-label="t('meeting.controls.openShare')"
            >
              <Share2 class="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            class="meeting-menu marketing-font w-60 rounded-2xl border-[#D8E7E3] bg-white p-2 text-[#102F35] shadow-[0_18px_45px_rgba(16,47,53,0.18)]"
          >
            <template v-if="inviteMode !== 'hidden'">
              <DropdownMenuItem
                data-invite-people
                :disabled="inviteMode !== 'enabled'"
                class="meeting-share-item cursor-pointer rounded-xl py-2.5 font-semibold text-[#0B7A75] focus:bg-[#E6F4F1] focus:text-[#102F35] data-[disabled]:cursor-not-allowed"
                @select="emit('invite')"
              >
                <LiquidMenuIcon class="mr-2" :animated="UserRoundPlusAnimated" />
                <span class="min-w-0">
                  <span class="block">{{ t('meeting.controls.invitePeople') }}</span>
                  <span v-if="inviteMode === 'signedOut'" class="block text-xs font-normal text-[#61777B]">{{
                    t('meeting.controls.inviteSignIn')
                  }}</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator class="bg-[#D8E7E3]" />
            </template>
            <DropdownMenuItem
              @click="copyMeetingLink"
              class="meeting-share-item cursor-pointer rounded-xl py-2.5 text-[#27595D] focus:bg-[#E6F4F1] focus:text-[#102F35]"
            >
              <LiquidMenuIcon class="mr-2" :animated="Link2Animated" />
              <span>{{ copiedLink ? t('meeting.controls.linkCopied') : t('meeting.controls.copyLink') }}</span>
              <Check v-if="copiedLink" class="ml-auto h-4 w-4 text-[#0B7A75]" />
            </DropdownMenuItem>

            <DropdownMenuItem
              @click="copyMeetingId"
              class="meeting-share-item cursor-pointer rounded-xl py-2.5 text-[#27595D] focus:bg-[#E6F4F1] focus:text-[#102F35]"
            >
              <LiquidMenuIcon class="mr-2" :animated="CopyAnimated" />
              <span>{{ copiedId ? t('meeting.controls.idCopied') : t('meeting.controls.copyId') }}</span>
              <Check v-if="copiedId" class="ml-auto h-4 w-4 text-[#0B7A75]" />
            </DropdownMenuItem>

            <DropdownMenuSeparator class="bg-[#D8E7E3]" />

            <DropdownMenuItem
              @click="shareOnWhatsApp"
              class="meeting-share-item cursor-pointer rounded-xl py-2.5 text-[#27595D] focus:bg-[#E6F4F1] focus:text-[#102F35]"
            >
              <img
                src="/icons/social-media/whatsapp.svg"
                class="mr-2 h-4 w-4"
                :alt="t('meeting.controls.shareWhatsApp')"
              />
              <span>{{ t('meeting.controls.shareWhatsApp') }}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              @click="shareOnTelegram"
              class="meeting-share-item cursor-pointer rounded-xl py-2.5 text-[#27595D] focus:bg-[#E6F4F1] focus:text-[#102F35]"
            >
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
        @stop="emit('stop-screen-share')"
      />

      <!-- Chat Button -->
      <div class="group relative" data-liquid-key="chat">
        <Button
          variant="secondary"
          size="icon"
          @click="emit('toggle-chat')"
          class="meeting-control relative size-11 rounded-full border-0 bg-transparent text-[#102F35] shadow-none sm:size-12"
          :class="{ '!text-[#0B7A75]': props.isChatOpen }"
          :aria-label="chatAriaLabel"
          data-chat-trigger
        >
          <MessageSquare class="h-5 w-5" />
          <span
            v-if="props.unreadCount && props.unreadCount > 0 && !props.isChatOpen"
            class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#F2765F] text-xs font-bold text-white"
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
        @toggle="emit('toggle-mute')"
        @media-changed="emit('media-changed')"
      />

      <MeetingMediaControl
        kind="video"
        data-liquid-key="video"
        @open-change="setMenuOpen('video', $event)"
        :off="isVideoOff"
        :available="videoAvailable"
        @toggle="emit('toggle-video')"
        @media-changed="emit('media-changed')"
      />

      <!-- End Call Button -->
      <div class="group relative" data-liquid-key="leave">
        <Button
          variant="destructive"
          size="icon"
          @click="emit('end-call')"
          class="meeting-control-danger meeting-control-alert size-11 rounded-full border-0 sm:size-12"
          :aria-label="t('meeting.controls.endCall')"
        >
          <PhoneOff class="h-5 w-5" />
        </Button>
        <span class="meeting-tooltip">{{ t('meeting.tooltips.leave') }}</span>
      </div>
    </LiquidGlassSurface>
  </div>
</template>
