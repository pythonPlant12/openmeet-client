<script setup lang="ts">
import { BellRing, Send } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  type SystemNotificationPermission,
  getSystemNotificationPermission,
  requestSystemNotificationPermission,
} from '@/services/notifications';

import SheetDescription from '../ui/sheet/SheetDescription.vue';

export interface ChatMessage {
  participantId: string;
  participantName: string;
  message: string;
  timestamp: number;
}

interface Props {
  open: boolean;
  messages: ChatMessage[];
  localParticipantId: string | null;
}

interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'send', message: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const { locale, t } = useI18n();

const messageInput = ref('');
const messagesContainerRef = ref<HTMLDivElement | null>(null);
const notificationPermission = ref<SystemNotificationPermission>(getSystemNotificationPermission());

const enableNotifications = async () => {
  notificationPermission.value = await requestSystemNotificationPermission();
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' });
};

const handleSend = () => {
  const message = messageInput.value.trim();
  if (message) {
    emit('send', message);
    messageInput.value = '';
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
};

const scrollToBottom = () => {
  setTimeout(() => {
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight + 1000;
    }
  }, 50);
};

const preventOutsideDismiss = (event: Event) => event.preventDefault();
const restoreChatTriggerFocus = (event: Event) => {
  event.preventDefault();
  window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-chat-trigger]')?.focus());
};

// Auto-scroll to bottom when new messages arrive
watch(() => props.messages.length, scrollToBottom);

// Auto-scroll to bottom when chat is opened
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      scrollToBottom();
    }
  },
);
</script>

<template>
  <Sheet :open="open" :modal="false" @update:open="emit('update:open', $event)">
    <SheetContent
      :show-overlay="false"
      class="marketing-font w-full h-[75vh] top-auto sm:bottom-20 sm:right-4 border border-[#D8E7E3] bg-[#E6F4F1] text-[#102F35] rounded-xl flex flex-col p-0 sm:mb-4"
      @interact-outside="preventOutsideDismiss"
      @close-auto-focus="restoreChatTriggerFocus"
    >
      <SheetHeader class="flex-row items-center justify-between space-y-0 border-b border-[#D8E7E3] p-4">
        <SheetTitle class="text-[#102F35]">{{ t('meeting.chat.title') }}</SheetTitle>
        <Button
          v-if="notificationPermission === 'default'"
          variant="ghost"
          size="sm"
          class="rounded-full text-[#0B7A75] hover:bg-[#D8E7E3]"
          @click="enableNotifications"
        >
          <BellRing class="size-4" />
          {{ t('notifications.enableChat') }}
        </Button>
      </SheetHeader>

      <!-- Messages -->
      <div ref="messagesContainerRef" class="flex-1 overflow-y-auto p-4">
        <div class="space-y-3">
          <SheetDescription v-if="messages.length === 0" class="text-center text-[#4E6B70] text-sm py-8">
            {{ t('meeting.chat.empty') }}
          </SheetDescription>
          <div
            v-for="(msg, index) in messages"
            :key="index"
            :class="[
              'rounded-lg p-3 max-w-[85%]',
              msg.participantId === localParticipantId
                ? 'bg-[#0B7A75] text-white ml-auto'
                : 'bg-[#D8E7E3] text-[#102F35]',
            ]"
          >
            <div
              :class="[
                'mb-1 text-xs font-medium',
                msg.participantId === localParticipantId ? 'text-white/70' : 'text-[#4E6B70]',
              ]"
            >
              {{ msg.participantName }}
            </div>
            <p class="text-sm break-words whitespace-pre-wrap">{{ msg.message }}</p>
            <div
              :class="['text-xs mt-1', msg.participantId === localParticipantId ? 'text-white/70' : 'text-[#4E6B70]']"
            >
              {{ formatTime(msg.timestamp) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="p-4 border-t border-[#D8E7E3]">
        <div class="flex gap-2">
          <Input
            v-model="messageInput"
            :placeholder="t('meeting.chat.placeholder')"
            maxlength="2000"
            @keydown="handleKeydown"
            class="flex-1 border-[#D8E7E3] bg-white text-[#102F35] placeholder:text-[#4E6B70]"
          />
          <Button
            size="icon"
            @click="handleSend"
            :disabled="!messageInput.trim()"
            class="bg-[#0B7A75] text-white hover:bg-[#08645F]"
            :aria-label="t('meeting.chat.send')"
          >
            <Send class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
