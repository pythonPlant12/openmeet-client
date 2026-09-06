<script setup lang="ts">
import { Check, ChevronDown, MailPlus, PhoneCall, Plus, Search, UserPlus, Users, X } from 'lucide-vue-next';
import { motion } from 'motion-v';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingRipple } from '@/components/ui/loading';
import type { Friend, FriendRequest } from '@/services/social-api';

const props = defineProps<{
  friends: Friend[];
  incomingRequests: FriendRequest[];
  isLoading: boolean;
  isAddingFriend: boolean;
  callingFriendId: string | null;
  onlineFriends: number;
  desktop: boolean;
  prefersReducedMotion: boolean;
  entranceInitial: false | { opacity: number; y: number };
}>();

const emit = defineEmits<{
  (event: 'add-friend'): void;
  (event: 'clear-feedback'): void;
  (event: 'answer-friend-request', requestId: string, accept: boolean): void;
  (event: 'call-friend', friend: Friend): void;
}>();

const friendEmail = defineModel<string>('friendEmail', { required: true });
const friendSearch = ref('');
const showAllFriends = ref(false);
const { t } = useI18n();

const filteredFriends = computed(() => {
  const query = friendSearch.value.trim().toLocaleLowerCase();
  if (!query) return props.friends;
  return props.friends.filter(
    (friend) => friend.name.toLocaleLowerCase().includes(query) || friend.email.toLocaleLowerCase().includes(query),
  );
});
const visibleFriends = computed(() =>
  props.desktop || showAllFriends.value ? filteredFriends.value : filteredFriends.value.slice(0, 5),
);
const canToggleFriends = computed(() => !props.desktop && filteredFriends.value.length > 5);

function userInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
</script>

<template>
  <motion.aside
    :initial="entranceInitial"
    :animate="{ opacity: 1, y: 0 }"
    :transition="{ duration: 0.5, delay: 0.18 }"
    class="h-fit min-w-0 rounded-[2rem] border border-[#D8E7E3] bg-white p-5 shadow-[0_18px_55px_rgba(16,47,53,0.07)] sm:p-6 xl:sticky xl:top-24"
  >
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.14em] text-[#0B7A75]">{{ t('dashboard.people') }}</p>
        <h2 class="mt-2 text-2xl font-semibold tracking-[-0.035em]">{{ t('dashboard.friends') }}</h2>
      </div>
      <span class="flex items-center gap-2 rounded-full bg-[#EDF8F5] px-3 py-1.5 text-xs font-semibold text-[#17645F]">
        <span class="size-2 rounded-full bg-[#29A899]" />
        {{ t('dashboard.onlineCount', { count: onlineFriends }) }}
      </span>
    </div>

    <form class="mt-5" @submit.prevent="emit('add-friend')">
      <label for="friend-email" class="text-sm font-semibold">{{ t('dashboard.addFriend') }}</label>
      <div class="mt-2 flex gap-2">
        <div class="relative min-w-0 flex-1">
          <MailPlus class="pointer-events-none absolute left-3.5 top-3.5 size-4 text-[#809697]" />
          <Input
            id="friend-email"
            v-model="friendEmail"
            type="email"
            :placeholder="t('dashboard.friendEmailPlaceholder')"
            class="h-11 rounded-full border-[#D8E7E3] bg-[#F8FAF8] pl-10 pr-4 focus-visible:border-[#0B7A75] focus-visible:ring-2 focus-visible:ring-[#9BCFC7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8FAF8]"
            required
            @input="emit('clear-feedback')"
          />
        </div>
        <Button
          type="submit"
          size="icon"
          :disabled="isAddingFriend || !friendEmail.trim()"
          :aria-label="t('dashboard.sendFriendRequest')"
          class="size-11 shrink-0 rounded-full bg-[#102F35] text-white hover:bg-[#1C4A4F]"
        >
          <LoadingRipple v-if="isAddingFriend" size="sm" />
          <UserPlus v-else class="size-4" />
        </Button>
      </div>
      <p class="mt-2 text-xs leading-5 text-[#809697]">{{ t('dashboard.registeredOnly') }}</p>
    </form>

    <section v-if="incomingRequests.length" class="mt-6 border-t border-[#E5EFEC] pt-5">
      <h3 class="flex items-center gap-2 text-sm font-semibold">
        <Users class="size-4 text-[#0B7A75]" />
        {{ t('dashboard.friendRequests') }}
        <span class="rounded-full bg-[#FFF0EA] px-2 py-0.5 text-xs text-[#B44D3A]">{{ incomingRequests.length }}</span>
      </h3>
      <div class="mt-3 space-y-2">
        <div
          v-for="request in incomingRequests"
          :key="request.id"
          class="flex items-center gap-3 rounded-2xl bg-[#F8FAF8] p-3"
        >
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E6F4F1] text-xs font-semibold text-[#0B7A75]"
          >
            {{ userInitials(request.user.name) }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ request.user.name }}</p>
            <p class="truncate text-xs text-[#809697]">{{ request.user.email }}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            :aria-label="t('dashboard.declineRequest')"
            class="size-8 rounded-full text-[#B44D3A] hover:bg-[#FFF0EA]"
            @click="emit('answer-friend-request', request.id, false)"
          >
            <X class="size-4" />
          </Button>
          <Button
            size="icon"
            :aria-label="t('dashboard.acceptRequest')"
            class="size-8 rounded-full bg-[#0B7A75] text-white hover:bg-[#08635F]"
            @click="emit('answer-friend-request', request.id, true)"
          >
            <Check class="size-4" />
          </Button>
        </div>
      </div>
    </section>

    <section class="mt-6 border-t border-[#E5EFEC] pt-5">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">{{ t('dashboard.yourFriends') }}</h3>
        <span class="text-xs text-[#809697]">{{ friends.length }}</span>
      </div>

      <div v-if="friends.length" class="relative mt-3">
        <Search class="pointer-events-none absolute left-4 top-3.5 size-4 text-[#809697]" />
        <Input
          v-model="friendSearch"
          type="search"
          :aria-label="t('dashboard.searchFriends')"
          :placeholder="t('dashboard.searchFriends')"
          class="h-11 rounded-full border-[#D8E7E3] bg-[#F8FAF8] pl-11 pr-4 focus-visible:border-[#0B7A75] focus-visible:ring-2 focus-visible:ring-[#9BCFC7]"
        />
      </div>

      <div v-if="isLoading" class="flex min-h-36 items-center justify-center">
        <LoadingRipple class="size-5 text-[#0B7A75]" />
      </div>
      <div v-else-if="!friends.length" class="flex min-h-44 flex-col items-center justify-center px-4 text-center">
        <span class="flex size-12 items-center justify-center rounded-full bg-[#EDF3F2] text-[#61777B]">
          <Users class="size-5" />
        </span>
        <p class="mt-3 text-sm font-semibold">{{ t('dashboard.noFriends') }}</p>
        <p class="mt-1 text-xs leading-5 text-[#809697]">{{ t('dashboard.noFriendsDescription') }}</p>
      </div>
      <div v-else-if="!filteredFriends.length" class="flex min-h-32 items-center justify-center px-4 text-center">
        <p class="text-sm text-[#61777B]">{{ t('dashboard.noFriendSearchResults') }}</p>
      </div>
      <div v-else id="dashboard-friend-list" class="mt-3 space-y-1">
        <motion.div
          v-for="friend in visibleFriends"
          :key="friend.id"
          :whileHover="prefersReducedMotion ? undefined : { x: 3 }"
          class="group flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-[#F6FAF7]"
        >
          <span
            class="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E6F4F1] text-sm font-semibold text-[#0B7A75]"
          >
            {{ userInitials(friend.name) }}
            <span
              :class="[
                'absolute bottom-0 right-0 size-3 rounded-full border-2 border-white',
                friend.isOnline ? 'bg-[#29A899]' : 'bg-[#B8C6C5]',
              ]"
            />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ friend.name }}</p>
            <p class="truncate text-xs text-[#809697]">
              {{ friend.isOnline ? t('dashboard.online') : t('dashboard.offline') }}
            </p>
          </div>
          <Button
            size="icon"
            :disabled="callingFriendId !== null"
            :aria-label="t('dashboard.callFriend', { name: friend.name })"
            class="size-9 rounded-full bg-[#E6F4F1] text-[#0B7A75] hover:bg-[#0B7A75] hover:text-white"
            @click="emit('call-friend', friend)"
          >
            <LoadingRipple v-if="callingFriendId === friend.id" size="sm" />
            <PhoneCall v-else class="size-4" />
          </Button>
        </motion.div>
      </div>
      <Button
        v-if="canToggleFriends"
        variant="ghost"
        class="mt-2 w-full rounded-full text-[#0B7A75] hover:bg-[#E6F4F1]"
        aria-controls="dashboard-friend-list"
        :aria-expanded="showAllFriends"
        @click="showAllFriends = !showAllFriends"
      >
        {{ showAllFriends ? t('dashboard.showLess') : t('dashboard.showAllFriends') }}
        <ChevronDown class="size-4 transition-transform" :class="{ 'rotate-180': showAllFriends }" />
      </Button>
    </section>

    <div class="mt-6 flex items-center gap-3 rounded-2xl bg-[#102F35] p-4 text-white">
      <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
        <Plus class="size-4" />
      </span>
      <p class="text-xs leading-5 text-[#B8C9CB]">
        <strong class="block text-sm text-white">{{ t('dashboard.openByDesign') }}</strong>
        {{ t('dashboard.guestsStillWelcome') }}
      </p>
    </div>
  </motion.aside>
</template>
