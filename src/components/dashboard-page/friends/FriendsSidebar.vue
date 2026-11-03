<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import {
  Check,
  CircleUserRound,
  Ellipsis,
  MessageCircle,
  Phone,
  Search,
  UserCheck,
  UserMinus,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-vue-next';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import PaneHeader from '@/components/dashboard-page/PaneHeader.vue';
import SectionBadge from '@/components/dashboard-page/SectionBadge.vue';
import { Avatar } from '@/components/ui/avatar';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ListHeading, ListRow } from '@/components/ui/list-row';
import { LoadingRipple } from '@/components/ui/loading';
import { PresenceDot } from '@/components/ui/presence-dot';
import { RoundButton } from '@/components/ui/round-button';
import { SearchPill } from '@/components/ui/search-pill';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { userStatusOption } from '@/config/user-status.config';
import type { Friend, FriendRequest, UserSearchResult } from '@/services/social-api';

const props = defineProps<{
  activeContextMenuId: string | null;
  expanded: boolean;
  /** Incoming friend requests. */
  badge: number;
  friendAvatarUrls: Record<string, string>;
  isAvatarLoading: (userId: string) => boolean;
  friends: Friend[];
  incomingRequests: FriendRequest[];
  isAdding: boolean;
  isLoading: boolean;
  isOpening: string | null;
  isRefreshing: boolean;
  isResponding: string | null;
  isSearching: boolean;
  peopleSearchActive: boolean;
  results: UserSearchResult[];
  resultAvatarUrls: Record<string, string>;
  searchOpen: boolean;
  contextMenuKey: (id: string) => string;
}>();
const emit = defineEmits<{
  (event: 'update:searchOpen', value: boolean): void;
  (event: 'update:query', value: string): void;
  (event: 'open', friend: Friend): void;
  (event: 'profile', friend: Friend): void;
  (event: 'call', friend: Friend): void;
  (event: 'remove', friend: Friend): void;
  (event: 'add', result: UserSearchResult): void;
  (event: 'open-result', result: UserSearchResult): void;
  (event: 'respond', request: FriendRequest, accept: boolean): void;
  (event: 'context-open', id: string, open: boolean): void;
  (event: 'context-activate', id: string): void;
}>();
const query = defineModel<string>('query', { required: true });
const SWIPE_ACTION_WIDTH = 80;
const hasHover = useMediaQuery('(hover: hover) and (pointer: fine)');
const input = ref<InstanceType<typeof SearchPill> | null>(null);
let longPressTimer: number | undefined;
let suppressClick = false;
watch(
  () => props.searchOpen,
  (open) => open && nextTick(() => input.value?.focus({ preventScroll: true })),
);

// The search field is always shown; it counts as open while focused or holding a query.
function handleSearchFocus() {
  if (!props.searchOpen) emit('update:searchOpen', true);
}

function handleSearchBlur() {
  if (!query.value && props.searchOpen) emit('update:searchOpen', false);
}

// "+" and the empty state both start a people search. iOS keeps the keyboard only for focus inside the tap itself.
function findPeople() {
  emit('update:searchOpen', true);
  input.value?.focus({ preventScroll: true });
}

// The hover action opens the row's own context menu beside it, so both share one menu.
function openRowMenu(event: MouseEvent, friend: Friend) {
  const button = event.currentTarget as HTMLElement;
  const row = button.closest('.group\\/row')?.querySelector<HTMLElement>('[data-friend-row]');
  if (!row) return;
  const rect = button.getBoundingClientRect();
  emit('context-activate', `friend-${friend.id}`);
  row.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.left, clientY: rect.bottom + 4 }),
  );
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function startLongPress(event: PointerEvent, friend: Friend) {
  if (event.pointerType === 'mouse') return;
  longPressTimer = window.setTimeout(() => {
    suppressClick = true;
    emit('context-activate', `friend-${friend.id}`);
  }, 500);
}

function clearLongPress() {
  window.clearTimeout(longPressTimer);
  longPressTimer = undefined;
}

function openFriend(friend: Friend) {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  emit('open', friend);
}

function openRequesterProfile(request: FriendRequest) {
  emit('profile', request.user);
}

onBeforeUnmount(clearLongPress);
</script>
<template>
  <section class="flex min-h-0 flex-1 flex-col overflow-hidden" aria-labelledby="friends-heading">
    <PaneHeader title="Friends" heading-id="friends-heading">
      <template #badge><SectionBadge :count="badge" singular="friend request" plural="friend requests" /></template>
      <template #trailing>
        <RoundButton tone="accent" aria-label="Add a friend" title="Add a friend" @click="findPeople"
          ><UserPlus
        /></RoundButton>
      </template>
      <SearchPill
        id="people-search"
        ref="input"
        v-model="query"
        label="Search friends and people"
        clear-label="Clear friend search"
        placeholder="Search friends and people"
        @focus="handleSearchFocus"
        @blur="handleSearchBlur"
      />
    </PaneHeader>
    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden"
      :class="expanded ? 'opacity-100' : 'pointer-events-none h-0 flex-none opacity-0'"
      :aria-hidden="!expanded"
    >
      <!-- On phones the workspace tabs float over the list, so its end scrolls clear of them. -->
      <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-[calc(0.75rem+var(--sidebar-bottom-inset,0px))] pt-1">
        <template v-if="peopleSearchActive || (query.trim() && query.replace(/\s/g, '').length < 2)">
          <p v-if="query.trim() && query.replace(/\s/g, '').length < 2" class="px-3 py-2 text-sm text-harbor-muted">
            Keep typing to search people outside your friend list.
          </p>
          <div v-else-if="isSearching" class="flex h-16 items-center justify-center">
            <LoadingRipple class="size-5 text-harbor-icon" />
            <span class="sr-only">Searching people</span>
          </div>
          <template v-else>
            <ListRow v-for="friend in friends" :key="friend.id" @click="emit('open', friend)">
              <template #avatar
                ><Avatar
                  :src="friendAvatarUrls[friend.id]"
                  :loading="isAvatarLoading(friend.id)"
                  :initials="initials(friend.name)"
              /></template>
              {{ friend.name }}
              <template #subtitle>{{ friend.nickname ? `@${friend.nickname}` : friend.email }}</template>
              <template #trailing
                ><span
                  data-friend-icon
                  role="img"
                  aria-label="Friend"
                  title="Friend"
                  class="flex size-6 shrink-0 items-center justify-center rounded-full bg-harbor-hover text-harbor-icon"
                  ><UserCheck class="size-3.5" /></span
              ></template>
            </ListRow>
            <div v-for="result in results" :key="result.id" data-people-result>
              <ListRow :aria-label="`View ${result.name}'s profile`" @click="emit('open-result', result)">
                <template #avatar
                  ><Avatar :src="resultAvatarUrls[result.id]" :initials="initials(result.name)"
                /></template>
                {{ result.name }}
                <template #subtitle>@{{ result.nickname }}</template>
                <template #actions
                  ><button
                    type="button"
                    :disabled="isAdding"
                    class="harbor-pill-button !h-8 px-4 text-sm disabled:opacity-50"
                    @click="emit('add', result)"
                  >
                    {{ isAdding ? 'Adding...' : 'Add' }}
                  </button></template
                >
              </ListRow>
            </div>
            <p v-if="!friends.length && !results.length" class="px-3 py-6 text-center text-sm text-harbor-muted">
              No registered accounts found.
            </p>
          </template>
        </template>
        <template v-else>
          <section v-if="incomingRequests.length" class="mb-2">
            <ListHeading class="pt-1">Requests</ListHeading>
            <ListRow
              v-for="request in incomingRequests"
              :key="request.id"
              as="div"
              role="button"
              tabindex="0"
              class="cursor-pointer"
              :aria-label="`View ${request.user.name}'s profile`"
              @click="openRequesterProfile(request)"
              @keydown.enter.prevent="openRequesterProfile(request)"
              @keydown.space.prevent="openRequesterProfile(request)"
            >
              <template #avatar
                ><span class="relative block"
                  ><Avatar
                    :src="friendAvatarUrls[request.user.id]"
                    :loading="isAvatarLoading(request.user.id)"
                    :initials="initials(request.user.name)"
                    :class="[
                      'border-2',
                      userStatusOption(request.user.isOnline ? request.user.status : 'offline').borderClass,
                    ]" /><PresenceDot
                    surface="friends"
                    :online="request.user.isOnline"
                    :status="request.user.status"
                    class="size-3.5 border-[3px] border-harbor-surface" /></span
              ></template>
              {{ request.user.name }}
              <template #subtitle>Wants to be your friend</template>
              <template #end
                ><span class="flex shrink-0 gap-2 pl-1"
                  ><RoundButton
                    tone="soft"
                    size="sm"
                    class="text-harbor-accent"
                    :aria-label="`Accept ${request.user.name}`"
                    :disabled="isResponding !== null"
                    @click.stop="emit('respond', request, true)"
                    ><Check /></RoundButton
                  ><RoundButton
                    tone="soft"
                    size="sm"
                    class="text-harbor-danger"
                    :aria-label="`Decline ${request.user.name}`"
                    :disabled="isResponding !== null"
                    @click.stop="emit('respond', request, false)"
                    ><X /></RoundButton></span
              ></template>
            </ListRow>
          </section>
          <section v-if="friends.length">
            <ListHeading v-if="incomingRequests.length" class="pt-1">All friends</ListHeading>
            <SwipeableRow
              v-for="friend in friends"
              :id="`friend-${friend.id}`"
              :key="friend.id"
              :leading-width="SWIPE_ACTION_WIDTH"
              :trailing-width="SWIPE_ACTION_WIDTH"
              full-swipe-leading
              @full-swipe-leading="emit('call', friend)"
            >
              <template #leading="{ armed, close }">
                <button
                  type="button"
                  data-swipe-action
                  class="flex h-full w-full items-center justify-start text-white transition-colors"
                  :class="armed ? 'bg-harbor-accent-hover' : 'bg-harbor-accent'"
                  :aria-label="`Call ${friend.name}`"
                  @click="
                    close();
                    emit('call', friend);
                  "
                >
                  <span
                    class="flex w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
                    ><Phone class="size-4" />Call</span
                  >
                </button>
              </template>
              <template #trailing="{ close }">
                <button
                  type="button"
                  data-swipe-action
                  class="flex h-full w-full items-center justify-end bg-harbor-line text-harbor-ink"
                  :aria-label="`View ${friend.name}'s profile`"
                  @click="
                    close();
                    emit('profile', friend);
                  "
                >
                  <span
                    class="flex w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
                    ><CircleUserRound class="size-4" />Profile</span
                  >
                </button>
              </template>
              <ContextMenu
                :key="contextMenuKey(`friend-${friend.id}`)"
                :press-open-delay="500"
                @update:open="emit('context-open', `friend-${friend.id}`, $event)"
                ><ContextMenuTrigger as-child
                  ><ListRow
                    data-friend-row
                    :disabled="isOpening !== null"
                    :selected="activeContextMenuId === `friend-${friend.id}`"
                    :actions-visible="activeContextMenuId === `friend-${friend.id}`"
                    @click="openFriend(friend)"
                    @contextmenu="emit('context-activate', `friend-${friend.id}`)"
                    @pointerdown="startLongPress($event, friend)"
                    @pointermove="clearLongPress"
                    @pointerup="clearLongPress"
                    @pointercancel="clearLongPress"
                  >
                    <template #avatar
                      ><span class="relative block"
                        ><Avatar
                          data-friend-avatar
                          :src="friendAvatarUrls[friend.id]"
                          :loading="isAvatarLoading(friend.id)"
                          :initials="initials(friend.name)"
                          :class="[
                            'border-2',
                            userStatusOption(friend.isOnline ? friend.status : 'offline').borderClass,
                          ]" /><PresenceDot
                          surface="friends"
                          :online="friend.isOnline"
                          :status="friend.status"
                          class="size-3.5 border-[3px] border-harbor-surface" /></span
                    ></template>
                    {{ friend.name }}
                    <template #subtitle>{{ friend.nickname ? `@${friend.nickname}` : friend.email }}</template>
                    <template v-if="isOpening === friend.id" #meta
                      ><LoadingRipple class="size-4 text-harbor-icon"
                    /></template>
                    <!-- Desktop only: quick actions on hover; touch uses swipes and long press. -->
                    <template #actions
                      ><RoundButton
                        tone="plain"
                        size="sm"
                        :aria-label="`Call ${friend.name}`"
                        title="Call"
                        @click.stop="emit('call', friend)"
                        ><Phone /></RoundButton
                      ><RoundButton
                        tone="plain"
                        size="sm"
                        :aria-label="`More options for ${friend.name}`"
                        title="More options"
                        @click.stop="openRowMenu($event, friend)"
                        ><Ellipsis /></RoundButton
                    ></template> </ListRow></ContextMenuTrigger
                ><ContextMenuContent
                  ><ContextMenuLabel>{{ friend.name }}</ContextMenuLabel
                  ><ContextMenuSeparator /><!-- Desktop shows these on hover, so only touch keeps them here. --><template
                    v-if="!hasHover"
                    ><ContextMenuItem @select="emit('open', friend)"><MessageCircle />Send message</ContextMenuItem
                    ><ContextMenuItem @select="emit('call', friend)"><Phone />Call</ContextMenuItem></template
                  ><ContextMenuItem @select="emit('profile', friend)"><CircleUserRound />View profile</ContextMenuItem
                  ><ContextMenuSeparator /><ContextMenuItem variant="danger" @select="emit('remove', friend)"
                    ><UserMinus />Remove friend</ContextMenuItem
                  ></ContextMenuContent
                ></ContextMenu
              ></SwipeableRow
            >
          </section>
          <div v-else-if="isLoading || isRefreshing" class="flex h-16 items-center justify-center">
            <LoadingRipple class="size-5 text-harbor-icon" />
          </div>
          <div
            v-else
            data-friends-empty
            class="mx-1 mt-2 flex flex-col items-center rounded-2xl bg-harbor-app px-4 py-8 text-center"
          >
            <span
              class="flex size-12 items-center justify-center rounded-full bg-harbor-surface text-harbor-icon shadow-harbor-soft"
              ><UsersRound class="size-5"
            /></span>
            <p class="mt-3 text-sm font-semibold text-harbor-ink">No friends yet</p>
            <p class="mt-1 text-xs leading-5 text-harbor-muted">
              Search by name or @nickname to find people and send a friend request.
            </p>
            <button
              type="button"
              class="harbor-ghost-action mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-harbor-surface px-4 text-sm font-semibold text-harbor-ink shadow-harbor-soft"
              @click="findPeople"
            >
              <Search class="size-4" />Find people
            </button>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
