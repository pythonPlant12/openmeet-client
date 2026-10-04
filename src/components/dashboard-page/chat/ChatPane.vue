<script setup lang="ts">
import { ArrowLeft, MessageCircleMore, Phone, UsersRound, X } from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { computed, nextTick, ref, watch } from 'vue';

import EmojiPickerButton from '@/components/dashboard-page/chat/EmojiPickerButton.vue';
import { Button } from '@/components/ui/button';
import { LoadingRipple } from '@/components/ui/loading';
import { PresenceDot } from '@/components/ui/presence-dot';
import type { Conversation, ConversationMessage, Friend } from '@/services/social-api';

const props = defineProps<{
  conversation: Conversation | null;
  pendingFriend: Friend | null;
  selectedFriend: Friend | null;
  selectedTitle: string;
  selectedIsGroup: boolean;
  groupAvatarUrl?: string;
  friendAvatarUrls: Record<string, string>;
  isFriendAvatarLoading: (userId: string) => boolean;
  isGroupAvatarLoading: (groupId: string) => boolean;
  messages: ConversationMessage[];
  loading: boolean;
  loadingOlder: boolean;
  sending: boolean;
  callActive: boolean;
  notificationWarning: boolean;
  canRequestNotificationPermission: boolean;
  isDesktop: boolean;
  prefersReducedMotion: boolean;
  shouldAnimate: (message: ConversationMessage) => boolean;
  isLocal: (message: ConversationMessage) => boolean;
  formatTime: (value: string) => string;
}>();
const emit = defineEmits<{
  (event: 'back'): void;
  (event: 'profile'): void;
  (event: 'group-info'): void;
  (event: 'call'): void;
  (event: 'scroll-top'): void;
  (event: 'send'): void;
  (event: 'request-notifications'): void;
  (event: 'dismiss-notifications'): void;
}>();
const content = defineModel<string>('content', { required: true });
const pane = ref<HTMLElement | null>(null);
const composer = ref<HTMLTextAreaElement | null>(null);
let pendingBottomScroll: ScrollBehavior | null = null;
const initial = computed(() => (props.prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.99 }));
const exit = computed(() => (props.prefersReducedMotion ? undefined : { opacity: 0, y: -6, scale: 0.99 }));
const directConversationLabel = computed(() =>
  props.selectedFriend?.nickname ? `@${props.selectedFriend.nickname}` : props.selectedTitle,
);
const groupConversationLabel = computed(() =>
  props.conversation?.groupCode ? `#${props.conversation.groupCode}` : props.selectedTitle,
);
function initials(name?: string | null) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?'
  );
}
function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  pendingBottomScroll = props.prefersReducedMotion ? 'auto' : behavior;
  void nextTick(() => {
    requestAnimationFrame(applyPendingBottomScroll);
  });
}
function applyPendingBottomScroll() {
  if (!pane.value || !pendingBottomScroll) return;
  pane.value.scrollTo({ top: pane.value.scrollHeight, behavior: pendingBottomScroll });
  pendingBottomScroll = null;
}
function getScrollState() {
  return pane.value ? { height: pane.value.scrollHeight, top: pane.value.scrollTop } : null;
}
function restoreScroll(state: { height: number; top: number } | null) {
  if (pane.value && state) pane.value.scrollTop = state.top + pane.value.scrollHeight - state.height;
}
function focusComposer() {
  void nextTick(() => composer.value?.focus());
}
watch(
  pane,
  (element) => {
    if (element && pendingBottomScroll) requestAnimationFrame(applyPendingBottomScroll);
  },
  { flush: 'post' },
);
defineExpose({ scrollToBottom, getScrollState, restoreScroll, focusComposer });
</script>
<template>
  <section
    class="flex h-full min-h-0 min-w-0 flex-col bg-white transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
    :class="
      conversation || pendingFriend
        ? 'relative translate-x-0 opacity-100'
        : 'pointer-events-none absolute inset-0 translate-x-3 opacity-0 lg:static lg:translate-x-0 lg:opacity-100 lg:pointer-events-auto'
    "
    aria-labelledby="conversation-title"
  >
    <AnimatePresence mode="wait"
      ><motion.div
        v-if="conversation || pendingFriend"
        :key="conversation?.id ?? `pending-${pendingFriend?.id}`"
        :initial="initial"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :exit="exit"
        :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }"
        class="flex h-full min-h-0 flex-col"
      >
        <header class="flex min-h-16 items-center gap-3 border-b border-[#E5EFEC] px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            class="harbor-ghost-action -ml-2 rounded-full text-[#27595D] lg:hidden"
            aria-label="Back to conversations"
            @click="emit('back')"
            ><ArrowLeft class="size-5" /></Button
          ><button
            v-if="selectedFriend && !pendingFriend"
            type="button"
            class="harbor-ghost-action -mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left"
            @click="emit('profile')"
          >
            <span class="relative shrink-0"
              ><span
                class="flex size-9 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] text-[#0B7A75]"
                ><img
                  v-if="friendAvatarUrls[selectedFriend.id]"
                  :src="friendAvatarUrls[selectedFriend.id]"
                  alt=""
                  class="size-full object-cover"
                /><LoadingRipple
                  v-else-if="isFriendAvatarLoading(selectedFriend.id)"
                  class="size-4 text-[#0B7A75]"
                /><span v-else class="text-xs font-semibold">{{ initials(selectedFriend.name) }}</span></span
              ><PresenceDot
                surface="directMessages"
                :online="selectedFriend.isOnline"
                :status="selectedFriend.status"
                class="size-3 border-2 border-white" /></span
            ><span class="min-w-0"
              ><span id="conversation-title" class="block truncate font-semibold">{{ selectedTitle }}</span
              ><span class="block truncate text-xs text-[#61777B]">{{ directConversationLabel }}</span></span
            ></button
          ><button
            v-else-if="selectedIsGroup"
            type="button"
            class="harbor-ghost-action -mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left"
            @click="emit('group-info')"
          >
            <span class="flex size-9 items-center justify-center overflow-hidden rounded-full bg-[#102F35] text-white"
              ><img v-if="groupAvatarUrl" :src="groupAvatarUrl" alt="" class="size-full object-cover" /><LoadingRipple
                v-else-if="conversation && isGroupAvatarLoading(conversation.id)"
                class="size-4 text-white" /><UsersRound v-else class="size-4" /></span
            ><span class="min-w-0"
              ><span id="conversation-title" class="block truncate font-semibold">{{ selectedTitle }}</span
              ><span class="block truncate text-xs text-[#61777B]">{{ groupConversationLabel }}</span></span
            >
          </button>
          <div v-else class="flex min-w-0 flex-1 items-center gap-3">
            <span class="flex size-9 items-center justify-center rounded-full bg-[#DDF1ED] text-[#0B7A75]"
              ><span class="text-xs font-semibold">{{ initials(selectedFriend?.name) }}</span></span
            >
            <div class="min-w-0">
              <h2 id="conversation-title" class="truncate font-semibold">{{ selectedTitle }}</h2>
              <p class="truncate text-xs text-[#61777B]">Direct-message request pending</p>
            </div>
          </div>
          <Button
            v-if="(selectedFriend && !pendingFriend) || selectedIsGroup"
            variant="ghost"
            size="icon"
            class="harbor-ghost-action rounded-full text-[#0B7A75]"
            :disabled="callActive"
            @click="emit('call')"
            ><Phone class="size-5"
          /></Button>
        </header>
        <div v-if="conversation" class="flex min-h-0 flex-1 flex-col">
          <div
            ref="pane"
            class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
            aria-label="Message history"
            @scroll.passive="pane && pane.scrollTop < 80 && emit('scroll-top')"
          >
            <div
              v-if="notificationWarning"
              class="sticky top-0 z-10 mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#D8E7E3] bg-[#E6F4F1] px-3 py-2.5 text-sm text-[#102F35]"
            >
              <p>
                {{
                  canRequestNotificationPermission
                    ? 'Enable notifications for messages and calls.'
                    : 'Notifications are blocked. Enable them in your browser settings.'
                }}
              </p>
              <div class="flex shrink-0 items-center gap-1">
                <Button
                  v-if="canRequestNotificationPermission"
                  variant="ghost"
                  size="sm"
                  class="harbor-ghost-action h-8 rounded-lg px-2 font-bold text-[#0B7A75]"
                  @click="emit('request-notifications')"
                  >Enable</Button
                >
                <Button
                  variant="ghost"
                  size="icon"
                  class="harbor-ghost-action size-8 rounded-lg text-[#27595D]"
                  aria-label="Dismiss notification notice"
                  title="Dismiss"
                  @click="emit('dismiss-notifications')"
                  ><X class="size-4"
                /></Button>
              </div>
            </div>
            <div v-if="loadingOlder" class="flex justify-center pb-4">
              <LoadingRipple class="size-5 text-[#0B7A75]" />
            </div>
            <div v-if="loading && !messages.length" class="flex h-full items-center justify-center">
              <LoadingRipple class="size-7 text-[#0B7A75]" />
            </div>
            <p v-else-if="!messages.length" class="py-10 text-center text-sm text-[#61777B]">
              No messages yet. Start the conversation.
            </p>
            <ol v-else class="space-y-4">
              <motion.li
                v-for="message in messages"
                :key="message.sequence"
                :initial="
                  shouldAnimate(message) && !prefersReducedMotion
                    ? isLocal(message)
                      ? { opacity: 0, x: 14, y: 18, scale: 0.86 }
                      : { opacity: 0, x: -10, y: 14, scale: 0.92 }
                    : false
                "
                :animate="{ opacity: 1, x: 0, y: 0, scale: 1 }"
                :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.32, ease: 'easeOut' }"
                class="flex"
                :class="isLocal(message) ? 'justify-end' : 'justify-start'"
                ><article
                  class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[70%]"
                  :class="
                    isLocal(message)
                      ? 'rounded-br-md bg-[#0B7A75] text-white'
                      : 'rounded-bl-md border border-[#D8E7E3] bg-[#F6FAF7] text-[#102F35]'
                  "
                >
                  <div
                    class="mb-1 flex items-center gap-2 text-xs"
                    :class="isLocal(message) ? 'text-white/80' : 'text-[#61777B]'"
                  >
                    <span class="font-semibold">{{ isLocal(message) ? 'You' : message.senderName }}</span>
                    <span v-if="!isLocal(message) && message.senderNickname">@{{ message.senderNickname }}</span>
                    <time :datetime="message.createdAt">{{ formatTime(message.createdAt) }}</time>
                  </div>
                  <p class="whitespace-pre-wrap break-words leading-5">{{ message.content }}</p>
                </article></motion.li
              >
            </ol>
          </div>
          <div class="border-t border-[#E5EFEC] bg-[#FBFCF8] px-4 py-3 sm:px-6">
            <p class="mb-2 text-xs text-[#61777B]">Messages stored by OpenMeet</p>
            <form class="flex items-end gap-2" @submit.prevent="emit('send')">
              <textarea
                ref="composer"
                v-model="content"
                rows="1"
                maxlength="2000"
                placeholder="Write a message"
                aria-label="Message"
                class="min-h-11 max-h-32 min-w-0 flex-1 resize-y rounded-xl border border-[#D8E7E3] bg-white px-3 py-2.5 text-sm text-[#102F35] focus-visible:border-[#D8E7E3] focus-visible:outline-none focus-visible:ring-0"
                @keydown.enter.exact.prevent="emit('send')"
              />
              <EmojiPickerButton
                v-model="content"
                :composer="composer"
                :prefers-reduced-motion="prefersReducedMotion"
              />
              <Button
                type="submit"
                class="harbor-primary-action h-11 rounded-xl bg-[#0B7A75] px-4 text-white"
                :disabled="!content.trim() || loading || sending"
                >{{ sending ? 'Sending...' : 'Send' }}</Button
              >
            </form>
          </div>
        </div>
        <div v-else class="flex flex-1 items-center justify-center px-6 py-10 text-center">
          <p class="max-w-sm rounded-xl bg-[#FFF8E8] px-4 py-3 text-sm text-[#80601D]">
            Waiting for {{ pendingFriend?.name }} to accept this direct-message request.
          </p>
        </div> </motion.div
      ><motion.div
        v-else-if="isDesktop"
        key="empty-conversation"
        :initial="initial"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :exit="exit"
        :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }"
        class="flex h-full flex-1 items-center justify-center px-6 py-10 text-center"
        ><div class="max-w-sm">
          <span class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#E6F4F1] text-[#0B7A75]"
            ><MessageCircleMore class="size-7"
          /></span>
          <h2 id="conversation-title" class="mt-5 text-xl font-semibold">Choose a conversation</h2>
          <p class="mt-2 text-sm leading-6 text-[#61777B]">
            Select a conversation or an accepted friend to manage its secure access.
          </p>
        </div></motion.div
      ></AnimatePresence
    >
  </section>
</template>
