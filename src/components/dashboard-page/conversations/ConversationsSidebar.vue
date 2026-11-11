<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import {
  Check,
  ChevronDown,
  CircleUserRound,
  LockKeyhole,
  LogOut,
  Mail,
  MailOpen,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import PaneHeader from '@/components/dashboard-page/PaneHeader.vue';
import SectionBadge from '@/components/dashboard-page/SectionBadge.vue';
import ChatFilterControls from '@/components/dashboard-page/conversations/ChatFilterControls.vue';
import {
  CHAT_FILTER_VIEWS,
  type ChatFilter,
  type ChatFilterAction,
  nextChatFilter,
  previousChatFilter,
} from '@/components/dashboard-page/conversations/chat-filter';
import { Avatar } from '@/components/ui/avatar';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ListHeading, ListRow } from '@/components/ui/list-row';
import { LoadingRipple } from '@/components/ui/loading';
import { PresenceDot } from '@/components/ui/presence-dot';
import { RoundButton } from '@/components/ui/round-button';
import { SearchPill } from '@/components/ui/search-pill';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { useHorizontalSwipe } from '@/composables/useHorizontalSwipe';
import { userStatusOption } from '@/config/user-status.config';
import type { Conversation, DirectMessageRequest, GroupInvitation, UserStatus } from '@/services/social-api';

const props = defineProps<{
  activeContextMenuId: string | null;
  conversations: Conversation[];
  directRequests: DirectMessageRequest[];
  groupInvitations: GroupInvitation[];
  expanded: boolean;
  /** Conversations with unread messages or pending requests. */
  badge: number;
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
  directStatus: (conversation: Conversation) => UserStatus | null | undefined;
  isFriendAvatarLoading: (userId: string) => boolean;
  isGroupAvatarLoading: (groupId: string) => boolean;
  directInitials: (conversation: Conversation) => string;
  /** Time of the last activity: the clock today, then a weekday, then a date. */
  activityTime?: (conversation: Conversation) => string;
  contextMenuKey: (id: string) => string;
}>();

const emit = defineEmits<{
  (event: 'update:searchOpen', value: boolean): void;
  (event: 'update:query', value: string): void;
  (event: 'create-group'): void;
  (event: 'join-group'): void;
  (event: 'start-meeting'): void;
  (event: 'add-friend'): void;
  (event: 'join-meeting'): void;
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
  (event: 'group-invitation-details', invitation: GroupInvitation): void;
  (event: 'toggle-read', conversation: Conversation): void;
}>();

const SWIPE_ACTION_WIDTH = 80;

const query = defineModel<string>('query', { required: true });
const filter = defineModel<ChatFilter>('filter', { required: true });
const view = computed(() => CHAT_FILTER_VIEWS[filter.value]);
const headerRef = ref<HTMLElement | null>(null);
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const titleMotion = computed(() =>
  prefersReducedMotion.value
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.2 },
      },
);

// A horizontal swipe over the header moves between Chats, Group chats, and Friends chats.
useHorizontalSwipe(headerRef, {
  onSwipe: (direction) =>
    (filter.value = direction === 'next' ? nextChatFilter(filter.value) : previousChatFilter(filter.value)),
});

function runAction(action: ChatFilterAction) {
  if (action === 'start-meeting') emit('start-meeting');
  else if (action === 'create-group') emit('create-group');
  else emit('add-friend');
}
const searchInput = ref<InstanceType<typeof SearchPill> | null>(null);
let longPressTimer: number | undefined;
let suppressClick = false;

watch(
  () => props.searchOpen,
  (open) => open && nextTick(() => searchInput.value?.focus({ preventScroll: true })),
);

// The search field is always shown; it counts as open while focused or holding a query.
function handleSearchFocus() {
  if (!props.searchOpen) emit('update:searchOpen', true);
}

function handleSearchBlur() {
  if (!query.value && props.searchOpen) emit('update:searchOpen', false);
}

// The hover arrow opens the row's own context menu under the arrow, so both share one menu.
function openRowMenu(event: MouseEvent, conversation: Conversation) {
  const button = event.currentTarget as HTMLElement;
  const row = button.closest('.group\\/row')?.querySelector<HTMLElement>('[data-conversation-row]');
  if (!row) return;
  const rect = button.getBoundingClientRect();
  emit('context-activate', `conversation-${conversation.id}`);
  row.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.left, clientY: rect.bottom + 4 }),
  );
}

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
  <!-- Vertical pans stay with the page; horizontal ones are the view swipe. -->
  <div ref="headerRef" class="touch-pan-y">
    <PaneHeader :title="view.title">
      <template #title
        ><AnimatePresence mode="popLayout" :initial="false"
          ><motion.span :key="filter" v-bind="titleMotion" class="inline-block">{{
            view.title
          }}</motion.span></AnimatePresence
        ></template
      >
      <template #badge
        ><SectionBadge :count="badge" singular="conversation needs attention" plural="conversations need attention"
      /></template>
      <template #trailing>
        <ChatFilterControls :filter="filter" @action="runAction" @switch="filter = $event" />
      </template>
      <SearchPill
        id="conversation-search"
        ref="searchInput"
        v-model="query"
        :label="view.searchLabel"
        :placeholder="view.searchLabel"
        clear-label="Clear conversation search"
        @focus="handleSearchFocus"
        @blur="handleSearchBlur"
      />
    </PaneHeader>
  </div>
  <div
    class="flex min-h-0 flex-col overflow-hidden transition-[flex-grow,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
    :class="expanded ? 'flex-1 opacity-100' : 'pointer-events-none flex-none basis-0 opacity-0'"
    :aria-hidden="!expanded"
  >
    <!-- On phones the workspace tabs float over the list, so its end scrolls clear of them. -->
    <div
      id="messages-panel"
      class="h-full min-h-0 overflow-y-auto px-2 pb-[calc(0.5rem+var(--sidebar-bottom-inset,0px))] pt-1"
      aria-live="polite"
    >
      <section v-if="filter !== 'direct' && groupInvitations.length" class="mb-2">
        <ListHeading class="pt-1">Group invitations</ListHeading>
        <ListRow
          v-for="invitation in groupInvitations"
          :key="invitation.id"
          as="div"
          role="button"
          tabindex="0"
          :aria-label="`View ${invitation.groupTitle} group info`"
          class="cursor-pointer"
          @click="emit('group-invitation-details', invitation)"
          @keydown.enter.prevent="emit('group-invitation-details', invitation)"
          @keydown.space.prevent="emit('group-invitation-details', invitation)"
        >
          <template #avatar
            ><Avatar :src="groupAvatarUrls[invitation.groupId]" :loading="isGroupAvatarLoading(invitation.groupId)"
              ><UsersRound /></Avatar
          ></template>
          {{ invitation.groupTitle }}
          <template #subtitle>Invited by {{ invitation.inviterName }}</template>
          <template #end
            ><span class="flex shrink-0 gap-2 pl-1"
              ><RoundButton
                tone="soft"
                size="sm"
                class="text-harbor-accent"
                :aria-label="`Join ${invitation.groupTitle}`"
                @click.stop="emit('accept-group-invitation', invitation)"
                ><Check /></RoundButton
              ><RoundButton
                tone="soft"
                size="sm"
                class="text-harbor-danger"
                :aria-label="`Decline invitation to ${invitation.groupTitle}`"
                @click.stop="emit('decline-group-invitation', invitation)"
                ><X /></RoundButton></span
          ></template>
        </ListRow>
      </section>
      <section v-if="filter !== 'groups' && directRequests.length" class="mb-2">
        <ListHeading class="pt-1">Message requests</ListHeading>
        <ListRow v-for="request in directRequests" :key="request.id" as="div">
          <template #avatar
            ><Avatar><CircleUserRound /></Avatar
          ></template>
          Request from account {{ request.requesterId.slice(0, 8) }}
          <template #end
            ><span class="flex shrink-0 gap-2 pl-1"
              ><RoundButton
                tone="soft"
                size="sm"
                class="text-harbor-accent"
                aria-label="Accept message request"
                @click="emit('respond-direct-request', request, true)"
                ><Check /></RoundButton
              ><RoundButton
                tone="soft"
                size="sm"
                class="text-harbor-danger"
                aria-label="Decline message request"
                @click="emit('respond-direct-request', request, false)"
                ><X /></RoundButton></span
          ></template>
        </ListRow>
      </section>
      <!-- Background refreshes keep the list mounted; replacing it would reset rows mid-swipe and flash a spinner. -->
      <div
        v-if="(isLoading || isRefreshing) && !conversations.length"
        class="flex min-h-44 items-center justify-center"
      >
        <LoadingRipple class="size-6 text-harbor-icon" /><span class="sr-only">Loading conversations</span>
      </div>
      <p v-else-if="!conversations.length" class="px-3 py-8 text-center text-sm text-harbor-muted">
        {{ query ? view.noMatchText : view.emptyText }}
      </p>
      <nav v-else aria-label="Persistent conversations">
        <SwipeableRow
          v-for="conversation in conversations"
          :id="`conversation-${conversation.id}`"
          :key="conversation.id"
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
              :class="armed ? 'bg-harbor-ink-soft' : 'bg-harbor-icon'"
              :aria-label="isUnread(conversation) ? 'Mark as read' : 'Mark as unread'"
              @click="
                close();
                emit('toggle-read', conversation);
              "
            >
              <span
                class="flex w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
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
              class="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden bg-harbor-line text-[11px] font-semibold text-harbor-ink"
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
              class="flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-harbor-danger text-white"
              :aria-label="conversation.kind === 'direct' ? 'Delete conversation' : 'Quit from group'"
              @click="
                close();
                emit('delete', conversation);
              "
            >
              <span
                class="flex w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
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
              ><ListRow
                data-conversation-row
                :selected="
                  selectedConversationId === conversation.id ||
                  activeContextMenuId === `conversation-${conversation.id}`
                "
                :actions-visible="activeContextMenuId === `conversation-${conversation.id}`"
                actions-placement="beside"
                @click="selectConversation(conversation)"
                @contextmenu="emit('context-activate', `conversation-${conversation.id}`)"
                @pointerdown="startLongPress($event, conversation)"
                @pointermove="clearLongPress"
                @pointerup="clearLongPress"
                @pointercancel="clearLongPress"
              >
                <template #avatar
                  ><span class="relative block"
                    ><Avatar
                      data-conversation-avatar
                      :src="
                        conversation.kind === 'group' ? groupAvatarUrls[conversation.id] : directAvatarUrl(conversation)
                      "
                      :loading="
                        conversation.kind === 'group'
                          ? isGroupAvatarLoading(conversation.id)
                          : !!conversation.otherUserId && isFriendAvatarLoading(conversation.otherUserId)
                      "
                      :class="
                        conversation.kind === 'direct'
                          ? [
                              'border-2',
                              userStatusOption(isDirectOnline(conversation) ? directStatus(conversation) : 'offline')
                                .borderClass,
                            ]
                          : []
                      "
                      ><UsersRound v-if="conversation.kind === 'group'" /><template v-else>{{
                        directInitials(conversation)
                      }}</template></Avatar
                    ><PresenceDot
                      surface="directMessages"
                      :online="conversation.kind === 'direct' && isDirectOnline(conversation)"
                      :status="directStatus(conversation)"
                      class="size-3.5 border-[3px] border-white" /></span
                ></template>
                {{ conversationName(conversation) }}
                <template v-if="activityTime" #meta
                  ><time
                    data-conversation-time
                    :class="isUnread(conversation) ? 'font-semibold text-harbor-accent' : undefined"
                    >{{ activityTime(conversation) }}</time
                  ></template
                >
                <template #subtitle>{{ conversationIdentifier(conversation) }}</template>
                <template #trailing
                  ><LockKeyhole
                    v-if="conversation.accessPolicy === 'password'"
                    class="size-4 shrink-0 text-harbor-subtle"
                    aria-label="Password protected" /><span
                    v-if="unreadCount(conversation)"
                    class="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-harbor-accent px-1.5 text-[11px] font-semibold text-white"
                    >{{ unreadCount(conversation) > 99 ? '99+' : unreadCount(conversation) }}</span
                  ><span
                    v-else-if="conversation.markedUnread"
                    data-marked-unread
                    class="size-3 shrink-0 rounded-full bg-harbor-accent"
                    role="img"
                    aria-label="Marked as unread"
                /></template>
                <!-- Desktop only: the arrow appears on hover and opens the same menu; touch opens it by long press. -->
                <template #actions
                  ><button
                    type="button"
                    data-conversation-menu-button
                    tabindex="-1"
                    class="flex size-6 items-center justify-center rounded-full text-harbor-subtle transition-colors hover:text-harbor-ink-soft"
                    :aria-label="`More options for ${conversationName(conversation)}`"
                    @click.stop="openRowMenu($event, conversation)"
                  >
                    <ChevronDown class="size-5" /></button
                ></template> </ListRow
            ></ContextMenuTrigger>
            <ContextMenuContent class="min-w-56"
              ><ContextMenuItem @select="emit('toggle-read', conversation)"
                ><MailOpen v-if="isUnread(conversation)" /><Mail v-else />{{
                  isUnread(conversation) ? 'Mark as read' : 'Mark as unread'
                }}</ContextMenuItem
              ><ContextMenuSeparator /><ContextMenuItem @select="emit('details', conversation)"
                ><CircleUserRound v-if="conversation.kind === 'direct'" /><UsersRound v-else />{{
                  conversation.kind === 'direct' ? 'See profile' : 'Group info'
                }}</ContextMenuItem
              ><ContextMenuItem v-if="canManageGroup(conversation)" @select="emit('add-members', conversation)"
                ><UserPlus />Add participants</ContextMenuItem
              ><template v-if="canManageGroup(conversation) || canDeleteOrLeave(conversation)"
                ><ContextMenuSeparator /><ContextMenuItem
                  v-if="canManageGroup(conversation)"
                  variant="danger"
                  @select="emit('remove-group', conversation)"
                  ><Trash2 />Delete group</ContextMenuItem
                ><ContextMenuItem
                  v-if="canDeleteOrLeave(conversation)"
                  variant="danger"
                  @select="emit('delete', conversation)"
                  ><Trash2 v-if="conversation.kind === 'direct'" /><LogOut v-else />{{
                    conversation.kind === 'direct' ? 'Delete conversation' : 'Quit from group'
                  }}</ContextMenuItem
                ></template
              ></ContextMenuContent
            >
          </ContextMenu>
        </SwipeableRow>
      </nav>
    </div>
  </div>
</template>
