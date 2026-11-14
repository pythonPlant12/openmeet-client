<script setup lang="ts">
import { MessageSquare } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

// The desktop call screen's top row: the room name on the left and the chat on the right.
const props = defineProps<{
  roomName: string;
  isChatOpen: boolean;
  unreadCount: number;
}>();
const emit = defineEmits<{ (e: 'toggle-chat'): void }>();
const { t } = useI18n();

const chatAriaLabel = computed(() => {
  if (props.isChatOpen) return t('meeting.controls.closeChat');
  if (props.unreadCount) return t('meeting.controls.openChatWithUnread', { count: props.unreadCount });
  return t('meeting.controls.openChat');
});
</script>

<template>
  <div
    class="marketing-font pointer-events-none fixed inset-x-0 top-5 z-50 flex items-center justify-between gap-4 px-6 text-harbor-ink"
    data-call-desktop-top-bar
  >
    <span
      class="call-chip pointer-events-auto flex h-[var(--meeting-control-size)] min-w-0 max-w-[50%] items-center truncate px-4 text-sm font-semibold"
      data-room-name
      >{{ roomName }}</span
    >
    <button
      type="button"
      class="call-button call-chip pointer-events-auto relative"
      :aria-label="chatAriaLabel"
      :aria-pressed="isChatOpen"
      :data-active="isChatOpen"
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
</template>
