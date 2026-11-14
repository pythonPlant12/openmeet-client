<script setup lang="ts">
import { MessageSquare, UserRoundPlus, Users } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import CallInviteMenuItems from './CallInviteMenuItems.vue';

// The phone call screen's top bar: the room name with the number of people, then audio output, invite and chat.
// It sits below the notch; the collapse button joins it with the active call (ADR 0001).
const props = defineProps<{
  roomName: string;
  participantCount: number;
  meetingId: string;
  inviteMode: 'enabled' | 'signedOut' | 'hidden';
  isChatOpen: boolean;
  unreadCount: number;
}>();
const emit = defineEmits<{
  (e: 'toggle-chat'): void;
  (e: 'invite'): void;
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
    <div class="call-chip pointer-events-auto flex h-11 min-w-0 flex-1 items-center gap-3 rounded-[0.875rem] pl-4 pr-3">
      <span class="min-w-0 flex-1 truncate font-semibold">{{ roomName }}</span>
      <span class="flex shrink-0 items-center gap-1 text-sm font-semibold text-harbor-muted">
        <Users class="size-4" aria-hidden="true" />{{ participantCount }}
      </span>
    </div>
    <div class="pointer-events-auto flex items-center gap-2">
      <slot name="audio-output" />
      <DropdownMenu>
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
