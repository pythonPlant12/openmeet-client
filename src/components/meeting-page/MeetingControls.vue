<script setup lang="ts">
import {
  Check,
  Code,
  Copy,
  Link2,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  Share2,
  Video,
  VideoOff,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  audioAvailable: boolean;
  showConnectionStatus: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  meetingId: string;
  isChatOpen: boolean;
  unreadCount?: number;
  videoAvailable: boolean;
}

interface Emits {
  (e: 'toggle-stats'): void;
  (e: 'toggle-mute'): void;
  (e: 'toggle-video'): void;
  (e: 'toggle-chat'): void;
  (e: 'end-call'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const { t } = useI18n();

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
  <div class="marketing-font fixed bottom-4 left-1/2 z-40 -translate-x-1/2 text-[#102F35] sm:bottom-6">
    <div
      class="flex items-center justify-center gap-1.5 rounded-full border border-[#D8E7E3] bg-white/95 p-2 shadow-[0_18px_50px_rgba(16,47,53,0.22)] backdrop-blur-xl sm:gap-2.5"
    >
      <!-- Connection status Button -->
      <div class="group relative">
        <Button
          :variant="showConnectionStatus ? 'default' : 'secondary'"
          size="icon"
          @click="emit('toggle-stats')"
          class="meeting-control size-10 rounded-full border border-[#D8E7E3] bg-[#E6F4F1] text-[#102F35] shadow-none sm:size-11"
          :class="{ '!bg-[#0B7A75] !text-white': showConnectionStatus }"
          :aria-label="t('meeting.controls.toggleStats')"
        >
          <Code class="h-5 w-5" />
        </Button>
        <span class="meeting-tooltip">{{ t('meeting.tooltips.status') }}</span>
      </div>

      <!-- Share Dropdown -->
      <div class="group relative">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="secondary"
              size="icon"
              class="meeting-control size-10 rounded-full border border-[#D8E7E3] bg-[#E6F4F1] text-[#102F35] shadow-none data-[state=open]:bg-[#0B7A75] data-[state=open]:text-white sm:size-11"
              :aria-label="t('meeting.controls.openShare')"
            >
              <Share2 class="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            class="marketing-font w-60 rounded-2xl border-[#D8E7E3] bg-white p-2 text-[#102F35] shadow-[0_18px_45px_rgba(16,47,53,0.18)]"
          >
            <DropdownMenuItem
              @click="copyMeetingLink"
              class="meeting-share-item cursor-pointer rounded-xl py-2.5 text-[#27595D] focus:bg-[#E6F4F1] focus:text-[#102F35]"
            >
              <Link2 class="mr-2 h-4 w-4" />
              <span>{{ copiedLink ? t('meeting.controls.linkCopied') : t('meeting.controls.copyLink') }}</span>
              <Check v-if="copiedLink" class="ml-auto h-4 w-4 text-[#0B7A75]" />
            </DropdownMenuItem>

            <DropdownMenuItem
              @click="copyMeetingId"
              class="meeting-share-item cursor-pointer rounded-xl py-2.5 text-[#27595D] focus:bg-[#E6F4F1] focus:text-[#102F35]"
            >
              <Copy class="mr-2 h-4 w-4" />
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

      <!-- Chat Button -->
      <div class="group relative">
        <Button
          :variant="props.isChatOpen ? 'default' : 'secondary'"
          size="icon"
          @click="emit('toggle-chat')"
          class="meeting-control relative size-10 rounded-full border border-[#D8E7E3] bg-[#E6F4F1] text-[#102F35] shadow-none sm:size-11"
          :class="{ '!bg-[#0B7A75] !text-white': props.isChatOpen }"
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

      <!-- Microphone Button -->
      <div class="group relative">
        <Button
          :variant="isMuted ? 'destructive' : 'secondary'"
          size="icon"
          :disabled="!audioAvailable"
          @click="emit('toggle-mute')"
          class="meeting-control size-10 rounded-full border border-[#D8E7E3] bg-[#E6F4F1] text-[#102F35] shadow-none sm:size-11"
          :class="{
            '!border-[#F2765F] !bg-[#F2765F] !text-white': isMuted,
            'meeting-control-muted': isMuted,
          }"
          :aria-label="
            t(
              !audioAvailable
                ? 'meeting.actions.audioUnavailable'
                : isMuted
                  ? 'meeting.controls.unmute'
                  : 'meeting.controls.mute',
            )
          "
        >
          <MicOff v-if="isMuted" class="h-5 w-5" />
          <Mic v-else class="h-5 w-5" />
        </Button>
        <span class="meeting-tooltip">{{ t(isMuted ? 'meeting.tooltips.unmute' : 'meeting.tooltips.mute') }}</span>
      </div>

      <!-- Camera Button -->
      <div class="group relative">
        <Button
          :variant="isVideoOff ? 'destructive' : 'secondary'"
          size="icon"
          :disabled="!videoAvailable"
          @click="emit('toggle-video')"
          class="meeting-control size-10 rounded-full border border-[#D8E7E3] bg-[#E6F4F1] text-[#102F35] shadow-none sm:size-11"
          :class="{
            '!border-[#F2765F] !bg-[#F2765F] !text-white': isVideoOff,
            'meeting-control-muted': isVideoOff,
          }"
          :aria-label="
            t(
              !videoAvailable
                ? 'meeting.actions.videoUnavailable'
                : isVideoOff
                  ? 'meeting.controls.turnCameraOn'
                  : 'meeting.controls.turnCameraOff',
            )
          "
        >
          <VideoOff v-if="isVideoOff" class="h-5 w-5" />
          <Video v-else class="h-5 w-5" />
        </Button>
        <span class="meeting-tooltip">{{
          t(isVideoOff ? 'meeting.tooltips.cameraOn' : 'meeting.tooltips.cameraOff')
        }}</span>
      </div>

      <!-- End Call Button -->
      <div class="group relative">
        <Button
          variant="destructive"
          size="icon"
          @click="emit('end-call')"
          class="meeting-control-danger size-10 rounded-full bg-[#F2765F] text-white shadow-none sm:size-11"
          :aria-label="t('meeting.controls.endCall')"
        >
          <PhoneOff class="h-5 w-5" />
        </Button>
        <span class="meeting-tooltip">{{ t('meeting.tooltips.leave') }}</span>
      </div>
    </div>
  </div>
</template>
