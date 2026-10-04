<script setup lang="ts">
import {
  Check,
  ChevronRight,
  CircleUserRound,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  MailOpen,
  Plus,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-vue-next';
import { motion } from 'motion-v';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import sidebarSectionControlUrl from '@/assets/sidebar-section-control.svg';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { LoadingRipple } from '@/components/ui/loading';
import { PresenceDot } from '@/components/ui/presence-dot';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import type { Conversation, DirectMessageRequest, GroupInvitation } from '@/services/social-api';

const props = defineProps<{
  activeContextMenuId: string | null;
  conversations: Conversation[];
  directRequests: DirectMessageRequest[];
  groupInvitations: GroupInvitation[];
  expanded: boolean;
  groupAvatarUrls: Record<string, string>;
  isLoading: boolean;
  isRefreshing: boolean;
  searchOpen: boolean;
  selectedConversationId?: string;
  unreadCount: (conversation: Conversation) => number;
  conversationName: (conversation: Conversation) => string;
  conversationIdentifier: (conversation: Conversation) => string;
  directAvatarUrl: (conversation: Conversation) => string | undefined;
  isDirectOnline: (conversation: Conversation) => boolean;
  isFriendAvatarLoading: (userId: string) => boolean;
  isGroupAvatarLoading: (groupId: string) => boolean;
  directInitials: (conversation: Conversation) => string;
  contextMenuKey: (id: string) => string;
}>();

const emit = defineEmits<{
  (event: 'update:searchOpen', value: boolean): void;
  (event: 'update:query', value: string): void;
  (event: 'create-group'): void;
  (event: 'join-group'): void;
  (eventName: 'drag-end', pointerEvent: PointerEvent, info: { offset: { y: number }; velocity: { y: number } }): void;
  (eventName: 'wheel', wheelEvent: WheelEvent): void;
  (event: 'toggle'): void;
  (event: 'select', conversation: Conversation): void;
  (event: 'details', conversation: Conversation): void;
  (event: 'delete', conversation: Conversation): void;
  (event: 'add-members', conversation: Conversation): void;
  (event: 'remove-group', conversation: Conversation): void;
  (event: 'context-open', id: string, open: boolean): void;
  (event: 'context-activate', id: string): void;
  (event: 'respond-direct-request', request: DirectMessageRequest, accept: boolean): void;
  (event: 'accept-group-invitation', invitation: GroupInvitation): void;
  (event: 'decline-group-invitation', invitation: GroupInvitation): void;
  (event: 'toggle-read', conversation: Conversation): void;
}>();

const SWIPE_ACTION_WIDTH = 80;

const query = defineModel<string>('query', { required: true });
const searchInput = ref<HTMLInputElement | null>(null);
let longPressTimer: number | undefined;
let suppressClick = false;

watch(
  () => props.searchOpen,
  (open) => open && nextTick(() => searchInput.value?.focus()),
);

function startLongPress(event: PointerEvent, conversation: Conversation) {
  if (event.pointerType === 'mouse') return;
  longPressTimer = window.setTimeout(() => {
    suppressClick = true;
    emit('context-activate', `conversation-${conversation.id}`);
  }, 500);
}

function clearLongPress() {
  window.clearTimeout(longPressTimer);
  longPressTimer = undefined;
}

function selectConversation(conversation: Conversation) {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  emit('select', conversation);
}

function isUnread(conversation: Conversation) {
  return props.unreadCount(conversation) > 0 || conversation.markedUnread;
}

// Group creators cannot quit, matching the context menu.
function canDeleteOrLeave(conversation: Conversation) {
  return conversation.kind === 'direct' || conversation.role !== 'creator';
}

function canManageGroup(conversation: Conversation) {
  return conversation.kind === 'group' && (conversation.role === 'creator' || conversation.role === 'admin');
}

onBeforeUnmount(clearLongPress);
</script>

<template>
  <div class="border-b border-[#E5EFEC] px-4 py-4 sm:px-5">
    <div class="flex items-center justify-between gap-3">
      <motion.h1
        drag="y"
        :drag-constraints="{ top: 0, bottom: 0 }"
        :drag-elastic="0.08"
        :drag-momentum="false"
        role="button"
        tabindex="0"
        :aria-expanded="expanded"
        class="-my-4 flex flex-1 touch-none cursor-ns-resize items-center gap-2 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#61777B]"
        @drag-end="(event, info) => emit('drag-end', event, info)"
        @click="emit('toggle')"
        @wheel.prevent="emit('wheel', $event)"
        @keydown.enter.prevent="emit('toggle')"
        @keydown.space.prevent="emit('toggle')"
        ><img :src="sidebarSectionControlUrl" alt="" class="size-4 opacity-60" /><span>Messages</span></motion.h1
      >
      <div class="flex shrink-0 items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          class="harbor-ghost-action size-9 rounded-full text-[#0B7A75]"
          :class="{ 'bg-[#E6F4F1] !text-[#102F35]': searchOpen }"
          :aria-expanded="searchOpen"
          aria-controls="conversation-search"
          aria-label="Search conversations"
          title="Search conversations"
          @click="emit('update:searchOpen', !searchOpen)"
          ><Search class="size-4"
        /></Button>
        <DropdownMenu :modal="false">
          <DropdownMenuTrigger as-child>
            <Button
              size="icon"
              class="harbor-primary-action size-9 rounded-full bg-[#0B7A75] text-white"
              aria-label="Group options"
              title="Group options"
              ><Plus class="size-4"
            /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            :side-offset="8"
            class="harbor-action-menu min-w-44 rounded-2xl border-[#D8E7E3] bg-white p-1.5 text-[#102F35] shadow-[0_16px_42px_rgba(16,47,53,0.14)]"
          >
            <DropdownMenuItem
              class="harbor-floating-menu-item cursor-pointer rounded-xl px-3 py-2.5"
              @select="emit('join-group')"
            >
              <LogIn class="size-4" />
              Join group
            </DropdownMenuItem>
            <DropdownMenuItem
              class="harbor-floating-menu-item cursor-pointer rounded-xl px-3 py-2.5"
              @select="emit('create-group')"
            >
              <UsersRound class="size-4" />
              Create group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    <div
      id="conversation-search"
      class="grid transition-[grid-template-rows,margin] duration-300 ease-out motion-reduce:transition-none"
      :class="searchOpen ? 'mt-4 grid-rows-[1fr]' : 'mt-0 grid-rows-[0fr]'"
    >
      <label class="relative min-h-0 overflow-hidden"
        ><span class="sr-only">Search conversations</span
        ><Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#809697]" /><Input
          ref="searchInput"
          v-model="query"
          type="search"
          placeholder="Search conversations"
          class="h-10 rounded-xl border-[#D8E7E3] bg-white pl-9 pr-9 text-[#102F35] placeholder:text-[#809697] focus-visible:border-[#D8E7E3] focus-visible:ring-0 focus-visible:ring-offset-0" /><button
          v-if="query"
          type="button"
          class="harbor-ghost-action absolute right-1.5 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-md p-1 text-[#61777B]"
          aria-label="Clear conversation search"
          @click="
            query = '';
            searchInput?.focus();
          "
        >
          <X class="size-4" /></button
      ></label>
    </div>
  </div>
  <div
    class="min-h-0 overflow-hidden transition-[flex-grow,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
    :class="expanded ? 'flex-1 opacity-100' : 'pointer-events-none flex-none basis-0 opacity-0'"
    :aria-hidden="!expanded"
  >
    <div id="messages-panel" class="h-full min-h-0 overflow-y-auto p-2" aria-live="polite">
      <div v-if="groupInvitations.length" class="mb-3 space-y-1 border-b border-[#E5EFEC] pb-3">
        <p class="px-2 pt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#61777B]">Group invitations</p>
        <div
          v-for="invitation in groupInvitations"
          :key="invitation.id"
          class="flex items-center gap-2 rounded-xl bg-[#EAF7F4] px-2 py-2"
        >
          <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#102F35] text-white"
            ><LockKeyhole class="size-4"
          /></span>
          <span class="min-w-0 flex-1"
            ><span class="block truncate text-xs font-semibold">{{ invitation.groupTitle }}</span
            ><span class="block truncate text-[11px] text-[#61777B]"
              >Invited by {{ invitation.inviterName }}</span
            ></span
          >
          <Button
            size="icon"
            variant="ghost"
            class="harbor-ghost-action size-8 rounded-full text-[#0B7A75]"
            :aria-label="`Join ${invitation.groupTitle}`"
            @click="emit('accept-group-invitation', invitation)"
            ><Check class="size-4" /></Button
          ><Button
            size="icon"
            variant="ghost"
            class="size-8 rounded-full text-[#9D4636] hover:bg-[#FFF0EA]"
            :aria-label="`Decline invitation to ${invitation.groupTitle}`"
            @click="emit('decline-group-invitation', invitation)"
            ><X class="size-4"
          /></Button>
        </div>
      </div>
      <div v-if="directRequests.length" class="mb-3 space-y-1 border-b border-[#E5EFEC] pb-3">
        <div v-for="request in directRequests" :key="request.id" class="flex items-center gap-2 rounded-xl px-2 py-2">
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#E6F4F1] text-xs font-semibold text-[#0B7A75]"
            ><CircleUserRound class="size-4"
          /></span>
          <p class="min-w-0 flex-1 truncate text-xs text-[#4E6B70]">
            Request from account {{ request.requesterId.slice(0, 8) }}
          </p>
          <Button
            size="icon"
            variant="ghost"
            class="harbor-ghost-action size-8 rounded-full text-[#0B7A75]"
            @click="emit('respond-direct-request', request, true)"
            ><Check class="size-4" /></Button
          ><Button
            size="icon"
            variant="ghost"
            class="size-8 rounded-full text-[#9D4636] hover:bg-[#FFF0EA]"
            @click="emit('respond-direct-request', request, false)"
            ><X class="size-4"
          /></Button>
        </div>
      </div>
      <!-- Background refreshes keep the list mounted; replacing it would reset rows mid-swipe and flash a spinner. -->
      <div
        v-if="(isLoading || isRefreshing) && !conversations.length"
        class="flex min-h-44 items-center justify-center"
      >
        <LoadingRipple class="size-6 text-[#0B7A75]" /><span class="sr-only">Loading conversations</span>
      </div>
      <p v-else-if="!conversations.length" class="px-3 py-8 text-center text-sm text-[#61777B]">
        {{ query ? 'No conversations match your search.' : 'No conversations yet.' }}
      </p>
      <nav v-else aria-label="Persistent conversations" class="space-y-1">
        <SwipeableRow
          v-for="conversation in conversations"
          :id="`conversation-${conversation.id}`"
          :key="conversation.id"
          class="rounded-xl"
          :leading-width="SWIPE_ACTION_WIDTH"
          :trailing-width="(canDeleteOrLeave(conversation) ? 2 : 1) * SWIPE_ACTION_WIDTH"
          full-swipe-leading
          @full-swipe-leading="emit('toggle-read', conversation)"
        >
          <template #leading="{ armed, close }">
            <button
              type="button"
              data-swipe-action
              class="flex h-full w-full items-center justify-start text-white transition-colors"
              :class="armed ? 'bg-[#08635F]' : 'bg-[#0B7A75]'"
              :aria-label="isUnread(conversation) ? 'Mark as read' : 'Mark as unread'"
              @click="
                close();
                emit('toggle-read', conversation);
              "
            >
              <span class="flex w-20 shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
                ><MailOpen v-if="isUnread(conversation)" class="size-4" /><Mail v-else class="size-4" />{{
                  isUnread(conversation) ? 'Read' : 'Unread'
                }}</span
              >
            </button>
          </template>
          <template #trailing="{ close }">
            <button
              type="button"
              data-swipe-action
              class="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden bg-[#E6F4F1] text-[11px] font-semibold text-[#102F35]"
              :aria-label="conversation.kind === 'direct' ? 'See profile' : 'Group info'"
              @click="
                close();
                emit('details', conversation);
              "
            >
              <CircleUserRound v-if="conversation.kind === 'direct'" class="size-4 shrink-0" /><UsersRound
                v-else
                class="size-4 shrink-0"
              />{{ conversation.kind === 'direct' ? 'Profile' : 'Info' }}
            </button>
            <button
              v-if="canDeleteOrLeave(conversation)"
              type="button"
              data-swipe-action
              class="flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-[#C4513D] text-white"
              :aria-label="conversation.kind === 'direct' ? 'Delete conversation' : 'Quit from group'"
              @click="
                close();
                emit('delete', conversation);
              "
            >
              <span class="flex w-20 shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
                ><Trash2 v-if="conversation.kind === 'direct'" class="size-4" /><LogOut v-else class="size-4" />{{
                  conversation.kind === 'direct' ? 'Delete' : 'Leave'
                }}</span
              >
            </button>
          </template>
          <ContextMenu
            :key="contextMenuKey(`conversation-${conversation.id}`)"
            :press-open-delay="500"
            @update:open="emit('context-open', `conversation-${conversation.id}`, $event)"
          >
            <ContextMenuTrigger as-child
              ><button
                type="button"
                class="harbor-ghost-action flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-[background-color,border-color,border-width] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                :class="[selectedConversationId === conversation.id ? 'bg-[#E6F4F1] !text-[#102F35]' : '']"
                :aria-current="selectedConversationId === conversation.id ? 'page' : undefined"
                @click="selectConversation(conversation)"
                @contextmenu="emit('context-activate', `conversation-${conversation.id}`)"
                @pointerdown="startLongPress($event, conversation)"
                @pointermove="clearLongPress"
                @pointerup="clearLongPress"
                @pointercancel="clearLongPress"
              >
                <span class="relative shrink-0"
                  ><span
                    class="flex size-10 items-center justify-center overflow-hidden rounded-full"
                    :class="conversation.kind === 'group' ? 'bg-[#102F35] text-white' : 'bg-[#DDF1ED] text-[#0B7A75]'"
                    ><img
                      v-if="conversation.kind === 'group' && groupAvatarUrls[conversation.id]"
                      :src="groupAvatarUrls[conversation.id]"
                      alt=""
                      class="size-full object-cover"
                    /><LoadingRipple
                      v-else-if="conversation.kind === 'group' && isGroupAvatarLoading(conversation.id)"
                      class="size-4 text-white"
                    /><UsersRound v-else-if="conversation.kind === 'group'" class="size-4" /><img
                      v-else-if="directAvatarUrl(conversation)"
                      :src="directAvatarUrl(conversation)"
                      alt=""
                      class="size-full object-cover"
                    /><LoadingRipple
                      v-else-if="conversation.otherUserId && isFriendAvatarLoading(conversation.otherUserId)"
                      class="size-4 text-[#0B7A75]"
                    /><span v-else class="text-xs font-semibold">{{ directInitials(conversation) }}</span></span
                  ><PresenceDot
                    surface="directMessages"
                    :online="conversation.kind === 'direct' && isDirectOnline(conversation)"
                    class="size-3 border-2 border-[#FBFCF8]" /></span
                ><span class="min-w-0 flex-1"
                  ><span class="flex items-center gap-2"
                    ><strong class="truncate text-sm">{{ conversationName(conversation) }}</strong
                    ><LockKeyhole
                      v-if="conversation.accessPolicy === 'password'"
                      class="size-3 shrink-0 text-[#61777B]"
                      aria-label="Password protected" /></span
                  ><span class="mt-0.5 block truncate text-xs text-[#61777B]">{{
                    conversationIdentifier(conversation)
                  }}</span></span
                ><span
                  v-if="unreadCount(conversation)"
                  class="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[#0B7A75] px-1.5 py-0.5 text-[11px] font-semibold text-white"
                  >{{ unreadCount(conversation) > 99 ? '99+' : unreadCount(conversation) }}</span
                ><span
                  v-else-if="conversation.markedUnread"
                  data-marked-unread
                  class="size-2.5 shrink-0 rounded-full bg-[#0B7A75]"
                  role="img"
                  aria-label="Marked as unread"
                /><ChevronRight v-else class="size-4 shrink-0 text-[#809697]" /></button
            ></ContextMenuTrigger>
            <ContextMenuContent
              class="harbor-action-menu min-w-52 rounded-[1.25rem] border-[#D8E7E3] bg-white p-2 text-[#102F35] shadow-[0_20px_55px_rgba(16,47,53,0.16)]"
              ><ContextMenuLabel class="px-3 py-1 text-xs uppercase tracking-[0.12em] text-[#61777B]">{{
                conversationName(conversation)
              }}</ContextMenuLabel
              ><ContextMenuSeparator class="mx-1 my-2 bg-[#E5EFEC]" /><ContextMenuItem
                class="harbor-context-menu-item harbor-floating-menu-item min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                @select="emit('details', conversation)"
                ><CircleUserRound v-if="conversation.kind === 'direct'" class="size-4" /><UsersRound
                  v-else
                  class="size-4"
                />{{ conversation.kind === 'direct' ? 'See profile' : 'Group info' }}</ContextMenuItem
              ><template v-if="canManageGroup(conversation)"
                ><ContextMenuItem
                  class="harbor-context-menu-item harbor-floating-menu-item min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                  @select="emit('add-members', conversation)"
                  ><UserPlus class="size-4" />Add participants</ContextMenuItem
                ><ContextMenuItem
                  class="harbor-context-menu-danger min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-[#C4513D]"
                  @select="emit('remove-group', conversation)"
                  ><Trash2 class="size-4" />Delete group</ContextMenuItem
                ></template
              ><ContextMenuItem
                v-if="conversation.kind === 'direct' || conversation.role !== 'creator'"
                class="harbor-context-menu-danger min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-[#C4513D]"
                @select="emit('delete', conversation)"
                ><Trash2 v-if="conversation.kind === 'direct'" class="size-4" /><LogOut v-else class="size-4" />{{
                  conversation.kind === 'direct' ? 'Delete conversation' : 'Quit from group'
                }}</ContextMenuItem
              ></ContextMenuContent
            >
          </ContextMenu>
        </SwipeableRow>
      </nav>
    </div>
  </div>
</template>
