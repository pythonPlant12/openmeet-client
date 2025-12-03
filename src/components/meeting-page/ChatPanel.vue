<script setup lang="ts">
import { Send } from 'lucide-vue-next';
import { ref, watch } from 'vue';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

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

const messageInput = ref('');
const messagesContainerRef = ref<HTMLDivElement | null>(null);

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent
      class="w-full sm:max-w-md h-[75vh] top-auto sm:bottom-20 sm:left-1/3 sm:right-4 border rounded-xl flex flex-col p-0"
    >
      <SheetHeader class="p-4 pr-12 border-b border-border">
        <SheetTitle>Chat</SheetTitle>
      </SheetHeader>

      <!-- Messages -->
      <div ref="messagesContainerRef" class="flex-1 overflow-y-auto p-4">
        <div class="space-y-3">
          <SheetDescription v-if="messages.length === 0" class="text-center text-muted-foreground text-sm py-8">
            No messages yet.
          </SheetDescription>
          <div
            v-for="(msg, index) in messages"
            :key="index"
            :class="[
              'rounded-lg p-3 max-w-[85%]',
              msg.participantId === localParticipantId ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted',
            ]"
          >
            <div v-if="msg.participantId !== localParticipantId" class="text-xs font-medium text-muted-foreground mb-1">
              {{ msg.participantName }}
            </div>
            <p class="text-sm break-words whitespace-pre-wrap">{{ msg.message }}</p>
            <div
              :class="[
                'text-xs mt-1',
                msg.participantId === localParticipantId ? 'text-primary-foreground/70' : 'text-muted-foreground',
              ]"
            >
              {{ formatTime(msg.timestamp) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="p-4 border-t border-border">
        <div class="flex gap-2">
          <Input v-model="messageInput" placeholder="Type a message..." @keydown="handleKeydown" class="flex-1" />
          <Button size="icon" @click="handleSend" :disabled="!messageInput.trim()">
            <Send class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
