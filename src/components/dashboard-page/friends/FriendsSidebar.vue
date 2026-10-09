<script setup lang="ts">
import { Check, CircleUserRound, Phone, Search, UserCheck, UserMinus, UsersRound, X } from 'lucide-vue-next';
import { motion } from 'motion-v';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import sidebarSectionControlUrl from '@/assets/sidebar-section-control.svg';
import SectionBadge from '@/components/dashboard-page/SectionBadge.vue';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { LoadingRipple } from '@/components/ui/loading';
import { PresenceDot } from '@/components/ui/presence-dot';
import { SwipeableRow } from '@/components/ui/swipeable-row';
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
  (eventName: 'drag-end', pointerEvent: PointerEvent, info: { offset: { y: number }; velocity: { y: number } }): void;
  (eventName: 'wheel', wheelEvent: WheelEvent): void;
  (event: 'toggle'): void;
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
const input = ref<HTMLInputElement | null>(null);
let longPressTimer: number | undefined;
let suppressClick = false;
watch(
  () => props.searchOpen,
  (open) => open && nextTick(() => input.value?.focus()),
);
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

onBeforeUnmount(clearLongPress);
</script>
<template>
  <section
    class="flex min-h-0 flex-col overflow-hidden border-t border-[#E5EFEC] p-3 transition-[flex-basis,flex-grow,opacity,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
    :class="expanded ? 'flex-1 opacity-100' : 'basis-20 shrink-0 opacity-100'"
    aria-labelledby="friends-heading"
  >
    <div class="flex min-h-8 items-center justify-between gap-2 px-2">
      <motion.h2
        id="friends-heading"
        drag="y"
        :drag-constraints="{ top: 0, bottom: 0 }"
        :drag-elastic="0.08"
        :drag-momentum="false"
        role="button"
        tabindex="0"
        :aria-expanded="expanded"
        class="-my-2 flex flex-1 touch-none cursor-ns-resize items-center gap-2 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#61777B]"
        @drag-end="(event, info) => emit('drag-end', event, info)"
        @click="emit('toggle')"
        @wheel.prevent="emit('wheel', $event)"
        @keydown.enter.prevent="emit('toggle')"
        @keydown.space.prevent="emit('toggle')"
        ><img :src="sidebarSectionControlUrl" alt="" class="size-4 opacity-60" /><span>Friends</span
        ><SectionBadge :count="badge" singular="friend request" plural="friend requests" /></motion.h2
      ><Button
        size="icon"
        variant="ghost"
        class="harbor-ghost-action size-9 rounded-full text-[#0B7A75]"
        :class="{ 'bg-[#E6F4F1] !text-[#102F35]': searchOpen }"
        :aria-expanded="searchOpen"
        aria-controls="people-search"
        aria-label="Search friends and people"
        @click="emit('update:searchOpen', !searchOpen)"
        ><Search class="size-4"
      /></Button>
    </div>
    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden"
      :class="expanded ? 'opacity-100' : 'pointer-events-none h-0 flex-none opacity-0'"
      :aria-hidden="!expanded"
    >
      <div
        id="people-search"
        class="grid px-2 transition-[grid-template-rows,margin] duration-300 ease-out motion-reduce:transition-none"
        :class="searchOpen ? 'mt-2 grid-rows-[1fr]' : 'mt-0 grid-rows-[0fr]'"
      >
        <div class="min-h-0 overflow-hidden">
          <label class="relative block"
            ><span class="sr-only">Search friends and people</span
            ><Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#809697]" /><Input
              ref="input"
              v-model="query"
              type="search"
              placeholder="Search friends and people"
              class="h-9 rounded-xl border-[#D8E7E3] bg-white pl-9 pr-9 text-xs text-[#102F35] focus-visible:ring-0" /><button
              v-if="query"
              type="button"
              class="harbor-ghost-action absolute right-1.5 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-md p-1 text-[#61777B]"
              aria-label="Clear friend search"
              @click="
                query = '';
                input?.focus();
              "
            >
              <X class="size-3.5" /></button
          ></label>
          <p v-if="query.trim() && query.replace(/\s/g, '').length < 2" class="mt-2 text-xs text-[#61777B]">
            Keep typing to search people outside your friend list.
          </p>
          <div v-else-if="isSearching" class="flex h-16 items-center justify-center">
            <LoadingRipple class="size-4 text-[#0B7A75]" />
            <span class="sr-only">Searching people</span>
          </div>
          <div v-else-if="peopleSearchActive" class="mt-2 space-y-1">
            <button
              v-for="friend in friends"
              :key="friend.id"
              type="button"
              class="harbor-ghost-action flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left"
              @click="emit('open', friend)"
            >
              <span
                class="flex size-7 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] text-[10px] font-semibold text-[#0B7A75]"
                ><img
                  v-if="friendAvatarUrls[friend.id]"
                  :src="friendAvatarUrls[friend.id]"
                  alt=""
                  class="size-full object-cover"
                /><LoadingRipple v-else-if="isAvatarLoading(friend.id)" class="size-3.5 text-[#0B7A75]" /><template
                  v-else
                  >{{ initials(friend.name) }}</template
                ></span
              ><span class="min-w-0 flex-1"
                ><span class="block truncate text-xs font-semibold">{{ friend.name }}</span
                ><span class="block truncate text-[11px] text-[#61777B]">{{
                  friend.nickname ? `@${friend.nickname}` : friend.email
                }}</span></span
              ><span
                data-friend-icon
                role="img"
                aria-label="Friend"
                title="Friend"
                class="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E6F4F1] text-[#0B7A75]"
                ><UserCheck class="size-3.5"
              /></span>
            </button>
            <div
              v-for="result in results"
              :key="result.id"
              data-people-result
              class="flex items-center gap-2 rounded-xl bg-[#F0F7F5] px-2 py-2"
            >
              <button
                type="button"
                class="harbor-ghost-action flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left"
                :aria-label="`View ${result.name}'s profile`"
                @click="emit('open-result', result)"
              >
                <span
                  class="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] text-[10px] font-semibold text-[#0B7A75]"
                  ><img
                    v-if="resultAvatarUrls[result.id]"
                    :src="resultAvatarUrls[result.id]"
                    alt=""
                    class="size-full object-cover"
                  /><template v-else>{{ initials(result.name) }}</template></span
                ><span class="min-w-0 flex-1"
                  ><span class="block truncate text-xs font-semibold">{{ result.name }}</span
                  ><span class="block truncate text-[11px] text-[#61777B]">@{{ result.nickname }}</span></span
                >
              </button>
              <Button
                size="sm"
                :disabled="isAdding"
                class="harbor-primary-action h-7 rounded-full bg-[#0B7A75] px-2 text-xs text-white"
                @click="emit('add', result)"
                >{{ isAdding ? 'Adding...' : 'Add' }}</Button
              >
            </div>
            <p v-if="!friends.length && !results.length" class="px-2 py-2 text-xs text-[#61777B]">
              No registered accounts found.
            </p>
          </div>
        </div>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <div v-if="incomingRequests.length" class="mt-2 space-y-1 border-b border-[#E5EFEC] px-2 pb-2">
          <p class="px-2 pt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#61777B]">Requests</p>
          <div
            v-for="request in incomingRequests"
            :key="request.id"
            class="flex items-center gap-2 rounded-xl bg-[#EAF7F4] px-2 py-2"
          >
            <span
              class="flex size-8 items-center justify-center rounded-full bg-[#DDF1ED] text-xs font-semibold text-[#0B7A75]"
              >{{ initials(request.user.name) }}</span
            ><span class="min-w-0 flex-1 truncate text-xs font-semibold">{{ request.user.name }}</span
            ><Button
              size="icon"
              variant="ghost"
              class="harbor-ghost-action size-8 rounded-full text-[#0B7A75]"
              :disabled="isResponding !== null"
              @click="emit('respond', request, true)"
              ><Check class="size-4" /></Button
            ><Button
              size="icon"
              variant="ghost"
              class="size-8 rounded-full text-[#9D4636] hover:bg-[#FFF0EA]"
              :disabled="isResponding !== null"
              @click="emit('respond', request, false)"
              ><X class="size-4"
            /></Button>
          </div>
        </div>
        <div v-if="!peopleSearchActive && friends.length" class="mt-2 space-y-1 px-2">
          <SwipeableRow
            v-for="friend in friends"
            :id="`friend-${friend.id}`"
            :key="friend.id"
            class="rounded-xl"
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
                :class="armed ? 'bg-[#08635F]' : 'bg-[#0B7A75]'"
                :aria-label="`Call ${friend.name}`"
                @click="
                  close();
                  emit('call', friend);
                "
              >
                <span class="flex w-20 shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
                  ><Phone class="size-4" />Call</span
                >
              </button>
            </template>
            <template #trailing="{ close }">
              <button
                type="button"
                data-swipe-action
                class="flex h-full w-full items-center justify-end bg-[#E6F4F1] text-[#102F35]"
                :aria-label="`View ${friend.name}'s profile`"
                @click="
                  close();
                  emit('profile', friend);
                "
              >
                <span class="flex w-20 shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
                  ><CircleUserRound class="size-4" />Profile</span
                >
              </button>
            </template>
            <ContextMenu
              :key="contextMenuKey(`friend-${friend.id}`)"
              :press-open-delay="500"
              @update:open="emit('context-open', `friend-${friend.id}`, $event)"
              ><ContextMenuTrigger as-child
                ><button
                  type="button"
                  class="harbor-ghost-action flex w-full items-center gap-2 rounded-xl border border-transparent px-2 py-2 text-left"
                  :disabled="isOpening !== null"
                  @click="openFriend(friend)"
                  @contextmenu="emit('context-activate', `friend-${friend.id}`)"
                  @pointerdown="startLongPress($event, friend)"
                  @pointermove="clearLongPress"
                  @pointerup="clearLongPress"
                  @pointercancel="clearLongPress"
                >
                  <span class="relative shrink-0"
                    ><span
                      class="flex size-8 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] text-xs font-semibold text-[#0B7A75]"
                      ><img
                        v-if="friendAvatarUrls[friend.id]"
                        :src="friendAvatarUrls[friend.id]"
                        alt=""
                        class="size-full object-cover"
                      /><LoadingRipple v-else-if="isAvatarLoading(friend.id)" class="size-4 text-[#0B7A75]" /><template
                        v-else
                        >{{ initials(friend.name) }}</template
                      ></span
                    ><PresenceDot
                      surface="friends"
                      :online="friend.isOnline"
                      :status="friend.status"
                      class="size-2.5 border-2 border-[#FBFCF8]" /></span
                  ><span class="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm"
                    ><span class="truncate">{{ friend.name }}</span
                    ><span v-if="friend.nickname" class="shrink-0 text-xs text-[#61777B]"
                      >@{{ friend.nickname }}</span
                    ></span
                  ><LoadingRipple
                    v-if="isOpening === friend.id"
                    class="size-4 text-[#0B7A75]"
                  /></button></ContextMenuTrigger
              ><ContextMenuContent
                class="harbor-action-menu min-w-52 rounded-[1.25rem] border-[#D8E7E3] bg-white p-2 text-[#102F35]"
                ><ContextMenuLabel class="px-3 py-1 text-xs uppercase tracking-[0.12em] text-[#61777B]">{{
                  friend.name
                }}</ContextMenuLabel
                ><ContextMenuSeparator class="mx-1 my-2 bg-[#E5EFEC]" /><ContextMenuItem
                  class="harbor-context-menu-item harbor-floating-menu-item min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                  @select="emit('profile', friend)"
                  ><CircleUserRound class="size-4" />View profile</ContextMenuItem
                ><ContextMenuItem
                  class="harbor-context-menu-danger min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-[#C4513D]"
                  @select="emit('remove', friend)"
                  ><UserMinus class="size-4" />Remove friend</ContextMenuItem
                ></ContextMenuContent
              ></ContextMenu
            ></SwipeableRow
          >
        </div>
        <div v-else-if="isLoading || isRefreshing" class="flex h-16 items-center justify-center">
          <LoadingRipple class="size-4 text-[#0B7A75]" />
        </div>
        <div
          v-else-if="!peopleSearchActive"
          data-friends-empty
          class="mx-2 mt-2 flex flex-col items-center rounded-2xl border border-dashed border-[#D8E7E3] bg-white px-4 py-6 text-center"
        >
          <span class="flex size-11 items-center justify-center rounded-full bg-[#E6F4F1] text-[#0B7A75]"
            ><UsersRound class="size-5"
          /></span>
          <p class="mt-3 text-sm font-semibold text-[#102F35]">No friends yet</p>
          <p class="mt-1 text-xs leading-5 text-[#61777B]">
            Search by name or @nickname to find people and send a friend request.
          </p>
          <Button
            size="sm"
            variant="ghost"
            class="harbor-ghost-action mt-3 rounded-full bg-[#E6F4F1] px-4 text-[#0B7A75]"
            @click="emit('update:searchOpen', true)"
            ><Search class="size-4" />Find people</Button
          >
        </div>
      </div>
    </div>
  </section>
</template>
