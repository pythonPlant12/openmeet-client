<script setup lang="ts">
import { ChevronRight, MessageSquare, SwitchCamera, UserRoundPlus } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import CallInviteMenuItems from './CallInviteMenuItems.vue';

// The phone call screen's top bar: the room name, which opens the controls panel, then audio output, invite, the
// camera flip while the camera is on, and chat. It sits below the notch; the collapse button joins it with the
// mobile mini call (ADR 0001).
const props = defineProps<{
  roomName: string;
  /** The camera flip shows only while your camera is on. */
  cameraOn?: boolean;
  meetingId: string;
  inviteMode: 'enabled' | 'signedOut' | 'hidden';
  isChatOpen: boolean;
  unreadCount: number;
}>();
const emit = defineEmits<{
  (e: 'toggle-chat'): void;
  (e: 'invite'): void;
  (e: 'open-panel'): void;
  (e: 'flip-camera'): void;
}>();
const { t } = useI18n();

const chatAriaLabel = computed(() => {
  if (props.isChatOpen) return t('meeting.controls.closeChat');
  if (props.unreadCount) return t('meeting.controls.openChatWithUnread', { count: props.unreadCount });
  return t('meeting.controls.openChat');
});
</script>

<template>
  <div
    class="marketing-font pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-50 flex items-center gap-2 px-3 text-harbor-ink"
    data-call-phone-top-bar
  >
    <div class="flex min-w-0 flex-1">
      <button
        type="button"
        class="call-chip pointer-events-auto flex h-11 min-w-0 max-w-full items-center gap-1 pl-4 pr-2.5 text-sm font-semibold"
        :aria-label="t('meeting.controls.moreControls')"
        data-room-name
        @click="emit('open-panel')"
      >
        <span class="min-w-0 truncate">{{ roomName }}</span>
        <ChevronRight class="size-4 shrink-0 text-harbor-icon" aria-hidden="true" />
      </button>
    </div>
    <div class="pointer-events-auto flex items-center gap-2">
      <slot name="audio-output" />
      <button
        v-if="inviteMode === 'enabled'"
        type="button"
        class="call-button call-chip size-11"
        :aria-label="t('meeting.controls.invitePeople')"
        data-invite-trigger
        @click="emit('invite')"
      >
        <UserRoundPlus />
      </button>
      <DropdownMenu v-else>
        <DropdownMenuTrigger as-child>
          <button type="button" class="call-button call-chip size-11" :aria-label="t('meeting.controls.openShare')">
            <UserRoundPlus />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" :side-offset="10" class="meeting-menu marketing-font w-60">
          <CallInviteMenuItems :meeting-id="meetingId" :invite-mode="inviteMode" @invite="emit('invite')" />
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        v-if="cameraOn"
        type="button"
        class="call-button call-chip size-11"
        :aria-label="t('meeting.controls.flipCamera')"
        data-flip-camera
        @click="emit('flip-camera')"
      >
        <SwitchCamera />
      </button>
      <button
        type="button"
        class="call-button call-chip relative size-11"
        :aria-label="chatAriaLabel"
        :aria-pressed="isChatOpen"
        data-chat-trigger
        @click="emit('toggle-chat')"
      >
        <MessageSquare />
        <span
          v-if="unreadCount > 0 && !isChatOpen"
          class="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-harbor-accent text-[0.6875rem] font-bold text-white"
        >
          {{ unreadCount > 9 ? '9+' : unreadCount }}
        </span>
      </button>
    </div>
  </div>
</template>
