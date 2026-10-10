<script setup lang="ts">
import { Phone, ShieldCheck } from 'lucide-vue-next';
import { ref } from 'vue';

import GroupDetailsPanel from '@/components/dashboard-page/groups/GroupDetailsPanel.vue';
import AccountMenuContent from '@/components/layout/AccountMenuContent.vue';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useOwnProfile } from '@/composables/useOwnProfile';
import type { GroupMutationToken } from '@/pages/dashboard-group-state';
import type { Conversation, Friend, GroupInfo, GroupMember } from '@/services/social-api';

defineProps<{
  accessToken?: string;
  avatarUrl?: string;
  currentUserId?: string;
  currentUser?: { name?: string; email?: string } | null;
  groupError: string;
  groupInfo: GroupInfo | null;
  groupLoading: boolean;
  groupMembers: GroupMember[];
  groupMemberAvatarUrls: Record<string, string>;
  groupMembersHasMore: boolean;
  groupMembersLoadingMore: boolean;
  groupMutationBusy: (groupId: string) => boolean;
  beginMutation: (groupId: string) => GroupMutationToken | null;
  endMutation: (groupId: string, token: GroupMutationToken) => void;
  changeFriendship: (member: GroupMember, change: 'add' | 'remove') => Promise<boolean>;
  friends: Friend[];
  pendingFriend: Friend | null;
  selectedConversation: Conversation | null;
  selectedIsGroup: boolean;
  selectedTitle: string;
  callActive: boolean;
}>();
const groupDetailsPanel = ref<{
  openAddMembers: () => void;
  openQuitGroup: () => void;
  openRemoveGroup: () => void;
  openSettings: () => void;
} | null>(null);
const emit = defineEmits<{
  (event: 'call'): void;
  (event: 'call-member', member: GroupMember): void;
  (event: 'account'): void;
  (event: 'open-profile', id: string, name: string): void;
  (event: 'refresh-group'): void;
  (event: 'load-more-members'): void;
  (event: 'chat-member', member: GroupMember): void;
  (event: 'group-removed', id: string): void;
}>();
const {
  avatarUrl: ownAvatarUrl,
  nickname,
  ownStatus,
  ownStatusOption,
  isNicknameCopied,
  setOwnStatus,
  copyNickname,
} = useOwnProfile();
// A click opens account settings; a right-click (or the context-menu key) opens the navbar's account menu.
const isAccountMenuOpen = ref(false);

function initials(name?: string) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

defineExpose({
  openAddMembers: () => groupDetailsPanel.value?.openAddMembers(),
  openQuitGroup: () => groupDetailsPanel.value?.openQuitGroup(),
  openRemoveGroup: () => groupDetailsPanel.value?.openRemoveGroup(),
  openSettings: () => groupDetailsPanel.value?.openSettings(),
});
</script>
<template>
  <aside
    class="hidden h-full min-h-0 overflow-hidden border-l border-[#D8E7E3] bg-[#FBFCF8] lg:flex lg:flex-col"
    aria-label="Conversation details"
  >
    <div class="border-b border-[#E5EFEC] px-5 py-5">
      <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B7A75]">Details</p>
      <h2 class="mt-1 font-semibold">{{ selectedConversation || pendingFriend ? selectedTitle : 'Your workspace' }}</h2>
    </div>
    <GroupDetailsPanel
      v-if="selectedConversation?.kind === 'group' && accessToken"
      ref="groupDetailsPanel"
      :key="`desktop-group-${selectedConversation.id}`"
      class="min-h-0 flex-1"
      :access-token="accessToken"
      :avatar-url="avatarUrl"
      :current-user-id="currentUserId"
      :error="groupError"
      :friends="friends"
      :group="selectedConversation"
      :info="groupInfo"
      :loading="groupLoading"
      :members="groupMembers"
      :member-avatar-urls="groupMemberAvatarUrls"
      :members-has-more="groupMembersHasMore"
      :members-loading-more="groupMembersLoadingMore"
      :mutation-busy="groupMutationBusy(selectedConversation.id)"
      :begin-mutation="beginMutation"
      :end-mutation="endMutation"
      :change-friendship="changeFriendship"
      @call-member="emit('call-member', $event)"
      @open-profile="(id, name) => emit('open-profile', id, name)"
      @refresh="emit('refresh-group')"
      @load-more-members="emit('load-more-members')"
      @chat-member="emit('chat-member', $event)"
      @removed="emit('group-removed', $event)"
    />
    <div v-else-if="selectedConversation || pendingFriend" class="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
      <div class="rounded-2xl border border-[#D8E7E3] bg-white p-4">
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#61777B]">Message storage</p>
        <div class="mt-3 flex gap-3">
          <ShieldCheck class="size-5 shrink-0 text-[#0B7A75]" />
          <p class="text-sm leading-5 text-[#4E6B70]">Messages stored by OpenMeet.</p>
        </div>
      </div>
      <div v-if="selectedIsGroup" class="rounded-2xl border border-[#D8E7E3] bg-white p-4">
        <p class="text-sm font-semibold">Group calls</p>
        <p class="mt-1 text-sm leading-5 text-[#61777B]">Start a call with this group.</p>
      </div>
      <Button
        v-if="selectedConversation && !pendingFriend"
        class="harbor-primary-action w-full rounded-full bg-[#0B7A75] text-white"
        :disabled="callActive"
        @click="emit('call')"
        ><Phone class="size-4" />Start call</Button
      >
    </div>
    <div v-else class="min-h-0 flex-1 overflow-y-auto p-5 text-sm leading-6 text-[#61777B]">
      Create group conversations, review direct-message requests, or select an accepted friend.
    </div>
    <div class="mt-auto border-t border-[#E5EFEC] p-4">
      <DropdownMenu v-model:open="isAccountMenuOpen" :modal="false">
        <div class="relative">
          <button
            type="button"
            class="harbor-ghost-action flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left"
            aria-label="Open account settings"
            @click="emit('account')"
            @contextmenu.prevent="isAccountMenuOpen = true"
          >
            <span
              class="relative inline-flex size-[2.625rem] shrink-0 items-center justify-center rounded-xl border-2 p-1 text-xs font-semibold"
              :class="[ownStatusOption.chipClass, ownStatusOption.borderClass]"
            >
              <img v-if="ownAvatarUrl" :src="ownAvatarUrl" alt="" class="size-full rounded-[0.55rem] object-cover" />
              <template v-else>{{ initials(currentUser?.name) }}</template>
              <span
                v-if="ownStatus"
                role="img"
                :aria-label="ownStatusOption.label"
                class="pointer-events-none absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-[3px] border-[#FBFCF8]"
                :class="ownStatusOption.dotClass"
              /> </span
            ><span class="min-w-0"
              ><strong class="block truncate text-sm">{{ currentUser?.name }}</strong
              ><span class="block truncate text-xs text-[#61777B]">{{ currentUser?.email }}</span></span
            >
          </button>
          <!-- The menu anchors to the card; this trigger only positions it, so left clicks still reach the card. -->
          <DropdownMenuTrigger as-child>
            <span aria-hidden="true" tabindex="-1" class="pointer-events-none absolute inset-0" />
          </DropdownMenuTrigger>
        </div>
        <AccountMenuContent
          side="top"
          align="start"
          :nickname="nickname"
          :own-status="ownStatus"
          :is-nickname-copied="isNicknameCopied"
          @copy-nickname="copyNickname"
          @set-status="setOwnStatus"
        />
      </DropdownMenu>
    </div>
  </aside>
</template>
