<script setup lang="ts">
import { UserRoundCheckAnimated, UsersRoundAnimated } from '@respeak/lucide-motion-vue';
import { useIntersectionObserver, useMediaQuery } from '@vueuse/core';
import {
  Check,
  CircleUserRound,
  Ellipsis,
  LockKeyhole,
  MessageCircle,
  Phone,
  Plus,
  Search,
  UserCheck,
  UserMinus,
  UsersRound,
  X,
} from 'lucide-vue-next';
import { motion } from 'motion-v';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import PaneHeader from '@/components/dashboard-page/PaneHeader.vue';
import PaneViewSwitch from '@/components/dashboard-page/PaneViewSwitch.vue';
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
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { usePaneTitleSwap } from '@/composables/usePaneTitleSwap';
import { userStatusOption } from '@/config/user-status.config';
import { playHaptic } from '@/services/haptics';
import type { Conversation, Friend, FriendRequest, GroupSearchResult, UserSearchResult } from '@/services/social-api';

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
  /** The group conversations the user belongs to, for the groups view. */
  groups: Conversation[];
  groupAvatarUrls: Record<string, string>;
  isGroupAvatarLoading: (groupId: string) => boolean;
  /** Groups the user is not in that match the groups search, loaded one page at a time. */
  groupResults: GroupSearchResult[];
  groupResultAvatarUrls: Record<string, string>;
  isSearchingGroups: boolean;
  isLoadingMoreGroups: boolean;
  hasMoreGroupResults: boolean;
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
  (event: 'open-group', group: Conversation): void;
  (event: 'open-group-result', group: GroupSearchResult): void;
  (event: 'load-more-groups'): void;
  (event: 'create-group'): void;
}>();
const query = defineModel<string>('query', { required: true });
const SWIPE_ACTION_WIDTH = 80;
const hasHover = useMediaQuery('(hover: hover) and (pointer: fine)');
const input = ref<InstanceType<typeof PaneHeader> | null>(null);
// The pane lists friends or the user's groups; the white header button switches between them, with the icon of the
// view it leads to: groups, or friends (the friend badge's icon).
const CONTACT_VIEWS = {
  friends: {
    title: 'Friends',
    searchLabel: 'Search friends',
    switchLabel: 'Show groups',
    switchIcon: UsersRoundAnimated,
  },
  groups: {
    title: 'Groups',
    searchLabel: 'Search groups',
    switchLabel: 'Show friends',
    switchIcon: UserRoundCheckAnimated,
  },
} as const;
const view = ref<'friends' | 'groups'>('friends');
// Like the Chats pane, the title blurs between the views (see usePaneTitleSwap).
const { shown: shownView, titleMotion } = usePaneTitleSwap(view);
// The groups view has its own search, so switching views never starts or clears a people search.
const groupQuery = defineModel<string>('groupQuery', { default: '' });
// Like people search, groups outside the user's own are searched from two characters, ignoring a code's leading #.
const groupSearchActive = computed(() => groupQuery.value.trim().replace(/^#/, '').replace(/\s/g, '').length >= 2);
// The next page of other groups loads whenever the end of the list is in view. A short page leaves the end visible
// without a new intersection, so the check also runs after every load.
const groupResultsEnd = ref<HTMLElement | null>(null);
const groupResultsEndVisible = ref(false);
useIntersectionObserver(groupResultsEnd, ([entry]) => {
  groupResultsEndVisible.value = entry?.isIntersecting ?? false;
});
watch(
  () =>
    [
      groupResultsEndVisible.value,
      props.hasMoreGroupResults,
      props.isLoadingMoreGroups,
      props.isSearchingGroups,
    ] as const,
  ([visible, hasMore, loadingMore, searching]) => {
    if (visible && hasMore && !loadingMore && !searching) emit('load-more-groups');
  },
);
const headerQuery = computed({
  get: () => (view.value === 'friends' ? query.value : groupQuery.value),
  set: (value: string) => {
    if (view.value === 'friends') query.value = value;
    else groupQuery.value = value;
  },
});
const filteredGroups = computed(() => {
  const needle = groupQuery.value.trim().toLocaleLowerCase();
  if (!needle) return props.groups;
  return props.groups.filter((group) =>
    [group.title ?? '', group.groupCode ?? ''].some((value) => value.toLocaleLowerCase().includes(needle)),
  );
});
let longPressTimer: number | undefined;
let suppressClick = false;
watch(
  () => props.searchOpen,
  (open) => open && nextTick(() => input.value?.focus({ preventScroll: true })),
);

// The people search counts as open while its field is focused or holds a query.
function handleSearchFocus() {
  if (view.value === 'friends' && !props.searchOpen) emit('update:searchOpen', true);
}

function handleSearchBlur() {
  if (view.value === 'friends' && !query.value && props.searchOpen) emit('update:searchOpen', false);
}

// The empty state starts a people search. iOS keeps the keyboard only for focus inside the tap itself.
function findPeople() {
  view.value = 'friends';
  emit('update:searchOpen', true);
  input.value?.focus({ preventScroll: true });
}

// Like the Chats pane's view switch, the change the user makes ticks once.
function toggleView() {
  view.value = view.value === 'friends' ? 'groups' : 'friends';
  playHaptic('selection');
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
    <PaneHeader
      ref="input"
      v-model:query="headerQuery"
      :title="CONTACT_VIEWS[shownView].title"
      :search-label="CONTACT_VIEWS[shownView].searchLabel"
      :search-id="view === 'friends' ? 'people-search' : 'group-search'"
      heading-id="friends-heading"
      @search-focus="handleSearchFocus"
      @search-blur="handleSearchBlur"
    >
      <template #title
        ><motion.span v-bind="titleMotion" class="inline-block">{{
          CONTACT_VIEWS[shownView].title
        }}</motion.span></template
      >
      <template #badge><SectionBadge :count="badge" singular="friend request" plural="friend requests" /></template>
      <template #trailing>
        <PaneViewSwitch
          :view-key="view"
          :icon="CONTACT_VIEWS[view].switchIcon"
          :label="CONTACT_VIEWS[view].switchLabel"
          @click="toggleView"
        />
      </template>
    </PaneHeader>
    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden"
      :class="expanded ? 'opacity-100' : 'pointer-events-none h-0 flex-none opacity-0'"
      :aria-hidden="!expanded"
    >
      <!-- On phones the workspace tabs float over the list, so its end scrolls clear of them. -->
      <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-[calc(0.75rem+var(--sidebar-bottom-inset,0px))] pt-1">
        <template v-if="view === 'groups'">
          <ListRow data-create-group class="mb-1 text-harbor-accent" @click="emit('create-group')">
            <template #avatar
              ><Avatar class="bg-harbor-hover text-harbor-ink"><Plus /></Avatar
            ></template>
            Create group
            <template #subtitle>Start a new group chat</template>
          </ListRow>
          <!-- While other groups are searched, the user's own matches sit under their own heading above them. -->
          <ListHeading v-if="groupSearchActive && filteredGroups.length" data-joined-groups class="pt-5"
            >Joined groups</ListHeading
          >
          <ListRow v-for="group in filteredGroups" :key="group.id" data-group-row @click="emit('open-group', group)">
            <template #avatar
              ><Avatar :src="groupAvatarUrls[group.id]" :loading="isGroupAvatarLoading(group.id)"><UsersRound /></Avatar
            ></template>
            {{ group.title }}
            <template v-if="group.groupCode" #subtitle>#{{ group.groupCode }}</template>
          </ListRow>
          <p
            v-if="!groupQuery.trim() && !filteredGroups.length"
            class="px-3 py-8 text-center text-sm text-harbor-muted"
          >
            You are not in any groups yet.
          </p>
          <template v-else-if="groupQuery.trim()">
            <p v-if="!groupSearchActive" class="px-3 py-2 text-sm text-harbor-muted">
              Keep typing to search groups you are not in.
            </p>
            <template v-else>
              <ListHeading data-other-groups :class="filteredGroups.length ? 'pt-6' : 'pt-1'">Other groups</ListHeading>
              <div v-if="isSearchingGroups" class="flex h-16 items-center justify-center">
                <LoadingRipple class="size-5 text-harbor-icon" />
                <span class="sr-only">Searching groups</span>
              </div>
              <template v-else>
                <ListRow
                  v-for="result in groupResults"
                  :key="result.id"
                  data-group-result
                  :aria-label="`Join ${result.title}`"
                  @click="emit('open-group-result', result)"
                >
                  <template #avatar
                    ><Avatar :src="groupResultAvatarUrls[result.id]"><UsersRound /></Avatar
                  ></template>
                  {{ result.title }}
                  <template #subtitle
                    >#{{ result.groupCode }} · {{ result.memberCount }}
                    {{ result.memberCount === 1 ? 'member' : 'members' }}</template
                  >
                  <template v-if="result.accessPolicy === 'password'" #trailing
                    ><span
                      role="img"
                      aria-label="Password required"
                      title="Password required"
                      class="flex size-6 shrink-0 items-center justify-center rounded-full bg-harbor-hover text-harbor-icon"
                      ><LockKeyhole class="size-3.5" /></span
                  ></template>
                </ListRow>
                <p v-if="!groupResults.length" class="px-3 py-6 text-center text-sm text-harbor-muted">
                  {{ filteredGroups.length ? 'No other groups match your search.' : 'No groups match your search.' }}
                </p>
                <div v-if="isLoadingMoreGroups" class="flex h-12 items-center justify-center">
                  <LoadingRipple class="size-5 text-harbor-icon" />
                  <span class="sr-only">Loading more groups</span>
                </div>
                <div ref="groupResultsEnd" class="h-px" aria-hidden="true" />
              </template>
            </template>
          </template>
        </template>
        <template v-else>
          <template v-if="peopleSearchActive || (query.trim() && query.replace(/\s/g, '').length < 2)">
            <p v-if="query.trim() && query.replace(/\s/g, '').length < 2" class="px-3 py-2 text-sm text-harbor-muted">
              Keep typing to search people outside your friend list.
            </p>
            <div v-else-if="isSearching" class="flex h-16 items-center justify-center">
              <LoadingRipple class="size-5 text-harbor-icon" />
              <span class="sr-only">Searching people</span>
            </div>
            <template v-else>
              <!-- Like the groups search: matching friends first, then people outside the friend list. -->
              <ListHeading v-if="friends.length" data-search-friends class="pt-1">Friends</ListHeading>
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
              <ListHeading data-other-people :class="friends.length ? 'pt-6' : 'pt-1'">Other people</ListHeading>
              <div v-for="result in results" :key="result.id" data-people-result data-list-item>
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
              <p v-if="!results.length" class="px-3 py-6 text-center text-sm text-harbor-muted">
                {{ friends.length ? 'No other people match your search.' : 'No registered accounts found.' }}
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
                    :class="armed ? 'bg-harbor-ink-soft' : 'bg-harbor-icon'"
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
        </template>
      </div>
    </div>
  </section>
</template>
