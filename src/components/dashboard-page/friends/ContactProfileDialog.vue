<script setup lang="ts">
import { CalendarDays, Check, Clock3, Copy, Mail, Phone, UserPlus, UserX, Video, X } from 'lucide-vue-next';
import { ref } from 'vue';

import InfoPage from '@/components/dashboard-page/details/InfoPage.vue';
import SharedMediaPanel from '@/components/dashboard-page/shared-media/SharedMediaPanel.vue';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogTitle, HarborDialogContent } from '@/components/ui/dialog';
import { LoadingRipple } from '@/components/ui/loading';
import { RoundButtonGroup } from '@/components/ui/round-button';
import { toast } from '@/components/ui/toast';
import { useFullAvatar } from '@/composables/useFullAvatar';
import { userStatusOption } from '@/config/user-status.config';
import type { ContactProfile, Friend, FriendRequest } from '@/services/social-api';

const props = defineProps<{
  open: boolean;
  confirmationOpen: boolean;
  profile: ContactProfile | null;
  profileFriend: Friend | null;
  pendingRequest?: FriendRequest | null;
  loading: boolean;
  error: string;
  removingId: string | null;
  opening: string | null;
  respondingId?: string | null;
  callActive: boolean;
  avatarUrls: Record<string, string>;
  avatarLoading: boolean;
  formatDate: (value: string | null) => string;
  /** The direct chat with this person, whose shared media the profile lists. */
  sharedConversationId?: string | null;
  accessToken?: string;
  currentUserId?: string | null;
}>();
const isAvatarPreviewOpen = ref(false);
const fullAvatarUrl = useFullAvatar(
  () => props.profile?.avatarUrl,
  () => isAvatarPreviewOpen.value,
);
const copiedNickname = ref(false);
const emit = defineEmits<{
  (event: 'update:open', value: boolean): void;
  (event: 'update:confirmationOpen', value: boolean): void;
  (event: 'call', options: { video: boolean }): void;
  (event: 'remove'): void;
  (event: 'add-friend'): void;
  (event: 'accept-request', request: FriendRequest): void;
  (event: 'decline-request', request: FriendRequest): void;
}>();
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
function statusLabel(status: ContactProfile['status']) {
  return userStatusOption(status).label;
}
async function copyNickname(nickname: string) {
  try {
    await navigator.clipboard.writeText(nickname);
    copiedNickname.value = true;
    window.setTimeout(() => (copiedNickname.value = false), 2_000);
  } catch (error) {
    console.error('[ContactProfileDialog] Failed to copy nickname:', error);
    toast({ title: 'Could not copy nickname.', variant: 'destructive' });
  }
}
</script>
<template>
  <InfoPage
    :open="open"
    title="Profile info"
    :description="`${profile?.name ?? 'This person'}'s profile and status.`"
    :busy="!!profile && loading"
    @update:open="emit('update:open', $event)"
  >
    <!-- Render the fallback profile immediately and update it in place, so the page does not jump when the live
         details arrive. -->
    <div v-if="loading && !profile" class="flex min-h-64 items-center justify-center">
      <LoadingRipple class="size-7 text-harbor-accent" />
    </div>
    <div v-else-if="profile" class="space-y-8">
      <p
        v-if="error"
        class="rounded-xl border border-harbor-danger/25 bg-harbor-danger-soft px-4 py-3 text-sm text-harbor-danger-strong"
        role="alert"
      >
        {{ error }}
      </p>
      <section class="flex flex-col items-center gap-5 pt-2 text-center">
        <span class="relative shrink-0">
          <button
            v-if="avatarUrls[profile.id]"
            type="button"
            data-profile-avatar
            class="harbor-ghost-action flex size-28 items-center justify-center overflow-hidden rounded-[28%] bg-harbor-avatar p-0"
            :class="['border-2', userStatusOption(profile.isOnline ? profile.status : 'offline').borderClass]"
            :aria-label="`View ${profile.name}'s profile picture`"
            @click="isAvatarPreviewOpen = true"
          >
            <img
              :src="avatarUrls[profile.id]"
              :alt="`${profile.name}'s profile picture`"
              class="size-full object-cover"
            />
          </button>
          <span
            v-else-if="profile.avatarUrl && avatarLoading"
            data-profile-avatar
            class="flex size-28 items-center justify-center overflow-hidden rounded-[28%] bg-harbor-avatar"
            :class="['border-2', userStatusOption(profile.isOnline ? profile.status : 'offline').borderClass]"
          >
            <LoadingRipple class="size-6 text-harbor-accent" />
          </span>
          <span
            v-else
            data-profile-avatar
            class="flex size-28 items-center justify-center overflow-hidden rounded-[28%] bg-harbor-avatar text-3xl font-semibold text-harbor-accent"
            :class="['border-2', userStatusOption(profile.isOnline ? profile.status : 'offline').borderClass]"
            >{{ initials(profile.name) }}</span
          >
          <span
            v-if="profile.isOnline"
            data-online-indicator
            role="img"
            :aria-label="statusLabel(profile.status)"
            :title="statusLabel(profile.status)"
            class="absolute bottom-0.5 right-0.5 size-5 rounded-full border-[3px] border-harbor-surface"
            :class="userStatusOption(profile.status).dotClass"
          />
        </span>
        <div class="min-w-0 max-w-full">
          <h3 class="truncate text-3xl font-semibold leading-tight tracking-[-0.03em]">{{ profile.name }}</h3>
          <div
            class="mt-1 flex items-center justify-center gap-1 text-base text-harbor-muted"
            :class="{ invisible: !profile.nickname }"
            :aria-hidden="!profile.nickname"
          >
            <span class="truncate">@{{ profile.nickname || 'nickname' }}</span>
            <button
              type="button"
              class="harbor-ghost-action shrink-0 rounded-md p-1 text-harbor-icon"
              :aria-label="copiedNickname ? 'Nickname copied' : 'Copy nickname'"
              :title="copiedNickname ? 'Copied' : 'Copy nickname'"
              @click="copyNickname(profile.nickname)"
            >
              <Check v-if="copiedNickname" class="size-4" /><Copy v-else class="size-4" />
            </button>
          </div>
        </div>
        <!-- Actions sit under the name, in the same white pill as the chat header's call buttons. Removing a
             friend asks for confirmation first. -->
        <RoundButtonGroup v-if="pendingRequest" aria-label="Friend request actions">
          <button
            type="button"
            class="size-11"
            data-accept-friend-request
            :disabled="respondingId !== null"
            aria-label="Accept friend request"
            title="Accept friend request"
            @click="emit('accept-request', pendingRequest)"
          >
            <Check class="size-5" /></button
          ><button
            type="button"
            class="size-11"
            data-tone="destructive"
            data-decline-friend-request
            :disabled="respondingId !== null"
            aria-label="Decline friend request"
            title="Decline friend request"
            @click="emit('decline-request', pendingRequest)"
          >
            <X class="size-5" />
          </button>
        </RoundButtonGroup>
        <RoundButtonGroup v-else-if="profile.relationship === 'none' && !profileFriend" aria-label="Profile actions">
          <button
            type="button"
            class="size-11"
            data-add-friend
            aria-label="Add friend"
            title="Add friend"
            @click="emit('add-friend')"
          >
            <UserPlus class="size-5" />
          </button>
        </RoundButtonGroup>
        <RoundButtonGroup v-else-if="profileFriend" aria-label="Profile actions">
          <button
            type="button"
            class="size-11"
            data-start-video-call
            :disabled="opening !== null || callActive"
            aria-label="Start a video call"
            title="Start a video call"
            @click="emit('call', { video: true })"
          >
            <Video class="size-5" /></button
          ><button
            type="button"
            class="size-11"
            data-start-call
            :disabled="opening !== null || callActive"
            aria-label="Start an audio call"
            title="Start an audio call"
            @click="emit('call', { video: false })"
          >
            <Phone class="size-[1.125rem]" /></button
          ><button
            type="button"
            class="size-11"
            data-tone="destructive"
            data-remove-friend
            :disabled="removingId !== null"
            aria-label="Remove friend"
            title="Remove friend"
            @click="emit('update:confirmationOpen', true)"
          >
            <UserX class="size-5" />
          </button>
        </RoundButtonGroup>
        <p
          class="max-w-md text-sm leading-6"
          :class="profile.statusMessage ? 'text-harbor-icon' : 'text-harbor-subtle'"
        >
          {{
            profile.statusMessage
              ? `“${profile.statusMessage}”`
              : profile.relationship === 'none'
                ? 'Add each other as friends to see status and contact details.'
                : 'No status message.'
          }}
        </p>
      </section>
      <section class="grid gap-4 rounded-[1.4rem] bg-harbor-app p-4 text-sm sm:grid-cols-3">
        <div class="inline-flex min-w-0 items-center gap-3 text-harbor-muted">
          <Mail class="size-4 shrink-0 text-harbor-icon" /><span class="min-w-0"
            ><span class="block text-xs">Email</span
            ><strong class="block truncate font-semibold text-harbor-ink">{{
              profile.relationship === 'none' ? 'Shared with friends' : profile.email
            }}</strong></span
          >
        </div>
        <div class="inline-flex items-center gap-3 text-harbor-muted">
          <CalendarDays class="size-4 shrink-0 text-harbor-icon" /><span class="min-w-0"
            ><span class="block text-xs">Joined</span
            ><strong class="block font-semibold text-harbor-ink">{{ formatDate(profile.createdAt) }}</strong></span
          >
        </div>
        <div class="inline-flex items-center gap-3 text-harbor-muted">
          <Clock3 class="size-4 shrink-0 text-harbor-icon" /><span class="min-w-0"
            ><span class="block text-xs">Last active</span
            ><strong class="block font-semibold text-harbor-ink">{{ formatDate(profile.lastSeenAt) }}</strong></span
          >
        </div>
      </section>
      <SharedMediaPanel
        v-if="sharedConversationId && profile.relationship !== 'owner'"
        :conversation-id="sharedConversationId"
        :access-token="accessToken"
        :user-id="currentUserId"
      />
    </div>
  </InfoPage>
  <Dialog :open="isAvatarPreviewOpen" @update:open="isAvatarPreviewOpen = $event"
    ><HarborDialogContent
      overlay-class="!z-[1050] bg-harbor-ink/50 backdrop-blur-lg"
      hide-close
      class="!z-[1050] w-auto max-w-[min(88dvw,42rem)] border-0 bg-transparent p-0 shadow-none"
      ><DialogTitle class="sr-only">{{ profile?.name }} profile picture</DialogTitle
      ><img
        v-if="profile && avatarUrls[profile.id]"
        :src="fullAvatarUrl ?? avatarUrls[profile.id]"
        :alt="`${profile.name}'s profile picture`"
        class="max-h-[78dvh] max-w-[min(88dvw,42rem)] rounded-[28%] object-contain shadow-[0_24px_70px_rgba(16,47,53,0.35)]"
      />
    </HarborDialogContent> </Dialog
  ><ConfirmDialog
    :open="confirmationOpen"
    :icon="UserX"
    :title="`Remove ${profileFriend?.name ?? 'friend'}?`"
    description="They leave your friends. You can send another request later."
    action-label="Remove friend"
    busy-label="Removing..."
    :busy="removingId !== null"
    @update:open="emit('update:confirmationOpen', $event)"
    @confirm="emit('remove')"
  />
</template>
