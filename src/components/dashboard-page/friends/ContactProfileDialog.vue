<script setup lang="ts">
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Lock,
  Mail,
  Phone,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-vue-next';
import { ref } from 'vue';

import SharedMediaPanel from '@/components/dashboard-page/shared-media/SharedMediaPanel.vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  HarborDialogContent,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingRipple } from '@/components/ui/loading';
import { toast } from '@/components/ui/toast';
import { useFullAvatar } from '@/composables/useFullAvatar';
import { USER_STATUS_OPTIONS, userStatusOption } from '@/config/user-status.config';
import type { ContactProfile, Friend, FriendRequest, UserStatus } from '@/services/social-api';

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
  (event: 'call'): void;
  (event: 'remove'): void;
  (event: 'add-friend'): void;
  (event: 'accept-request', request: FriendRequest): void;
  (event: 'decline-request', request: FriendRequest): void;
  (event: 'update-status', status: UserStatus): void;
}>();
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
function statusIcon(status: ContactProfile['status']) {
  return userStatusOption(status).icon;
}
function statusLabel(status: ContactProfile['status']) {
  return userStatusOption(status).label;
}
function statusClass(status: ContactProfile['status']) {
  return userStatusOption(status).chipClass;
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
  <Dialog :open="open" @update:open="emit('update:open', $event)"
    ><HarborDialogContent
      overlay-class="!z-[1040] bg-harbor-ink/30 backdrop-blur-md"
      class="marketing-font !z-[1040] flex top-[calc(50%+2.25rem)] max-h-[calc(100dvh-6rem)] min-h-[min(34rem,calc(100dvh-6rem))] w-[calc(100%-2rem)] max-w-3xl flex-col rounded-[1.75rem] border-harbor-line bg-harbor-surface p-5 text-harbor-ink shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full sm:p-6"
      @open-auto-focus="$event.preventDefault()"
      @close-auto-focus="$event.preventDefault()"
      ><DialogHeader
        ><DialogTitle>Profile info</DialogTitle
        ><DialogDescription class="sr-only">{{ profile?.name }}'s profile and status.</DialogDescription></DialogHeader
      >
      <!-- Render the fallback profile immediately and update it in place: swapping a spinner for the
           loaded body changes the centered dialog's height and makes it jump vertically. -->
      <div v-if="loading && !profile" class="flex min-h-64 items-center justify-center">
        <LoadingRipple class="size-7 text-harbor-accent" />
      </div>
      <div v-else-if="profile" class="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1" :aria-busy="loading">
        <p
          v-if="error"
          class="rounded-xl border border-harbor-danger/25 bg-harbor-danger-soft px-4 py-3 text-sm text-harbor-danger-strong"
          role="alert"
        >
          {{ error }}
        </p>
        <section
          class="flex flex-col items-center justify-center gap-5 rounded-2xl border border-harbor-line bg-white p-5 text-center sm:p-6"
        >
          <span class="relative shrink-0">
            <button
              v-if="avatarUrls[profile.id]"
              type="button"
              data-profile-avatar
              class="harbor-ghost-action flex size-20 items-center justify-center overflow-hidden rounded-[28%] bg-harbor-avatar p-0"
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
              class="flex size-20 items-center justify-center overflow-hidden rounded-[28%] bg-harbor-avatar"
              :class="['border-2', userStatusOption(profile.isOnline ? profile.status : 'offline').borderClass]"
            >
              <LoadingRipple class="size-6 text-harbor-accent" />
            </span>
            <span
              v-else
              data-profile-avatar
              class="flex size-20 items-center justify-center overflow-hidden rounded-[28%] bg-harbor-avatar text-xl font-semibold text-harbor-accent"
              :class="['border-2', userStatusOption(profile.isOnline ? profile.status : 'offline').borderClass]"
              >{{ initials(profile.name) }}</span
            >
            <span
              v-if="profile.isOnline"
              data-online-indicator
              role="img"
              :aria-label="statusLabel(profile.status)"
              :title="statusLabel(profile.status)"
              class="absolute bottom-0 right-0 size-4 rounded-full border-[3px] border-harbor-surface"
              :class="userStatusOption(profile.status).dotClass"
            />
          </span>
          <div class="min-w-0 max-w-full">
            <h3 class="truncate text-xl font-semibold tracking-[-0.025em]">{{ profile.name }}</h3>
            <div
              class="mt-1 flex items-center justify-center gap-1 text-sm text-harbor-muted"
              :class="{ invisible: !profile.nickname }"
              :aria-hidden="!profile.nickname"
            >
              <span class="truncate">@{{ profile.nickname || 'nickname' }}</span>
              <button
                type="button"
                class="harbor-ghost-action shrink-0 rounded-md p-1 text-harbor-accent"
                :aria-label="copiedNickname ? 'Nickname copied' : 'Copy nickname'"
                :title="copiedNickname ? 'Copied' : 'Copy nickname'"
                @click="copyNickname(profile.nickname)"
              >
                <Check v-if="copiedNickname" class="size-3.5" /><Copy v-else class="size-3.5" />
              </button>
            </div>
            <div class="mt-4 flex flex-wrap justify-center gap-2">
              <DropdownMenu v-if="profile.relationship === 'owner'">
                <DropdownMenuTrigger as-child>
                  <button
                    type="button"
                    data-status-menu
                    class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                    :class="statusClass(profile.status)"
                    aria-label="Change your status"
                  >
                    <component :is="statusIcon(profile.status)" class="size-3.5" />{{ statusLabel(profile.status) }}
                    <ChevronDown class="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" class="min-w-52">
                  <DropdownMenuItem
                    v-for="option in USER_STATUS_OPTIONS"
                    :key="option.value"
                    @select="emit('update-status', option.value)"
                  >
                    <span class="size-2.5 shrink-0 rounded-full" :class="option.dotClass" />
                    <span class="flex-1 font-semibold">{{ option.label }}</span>
                    <Check v-if="option.value === profile.status" class="size-4 text-harbor-accent" />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span
                v-else-if="profile.relationship !== 'none'"
                class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                :class="statusClass(profile.status)"
                ><component :is="statusIcon(profile.status)" class="size-3.5" />{{ statusLabel(profile.status) }}</span
              ><span
                v-else
                class="inline-flex items-center gap-1.5 rounded-full bg-harbor-hover px-3 py-1.5 text-xs font-semibold text-harbor-muted"
                ><Lock class="size-3.5" />Status shared with friends</span
              ><span
                v-if="profileFriend"
                class="inline-flex items-center gap-1.5 rounded-full bg-harbor-hover px-3 py-1.5 text-xs font-semibold text-harbor-ink"
                ><UserCheck class="size-3.5" />Friend</span
              >
            </div>
            <p
              class="mx-auto mt-4 max-w-md text-sm leading-6"
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
            <!-- Actions sit under the name, like a contact card. Removing a friend asks for confirmation first. -->
            <div
              v-if="pendingRequest"
              class="mt-5 flex items-center justify-center gap-3"
              role="group"
              aria-label="Friend request actions"
            >
              <button
                type="button"
                data-accept-friend-request
                data-tone="accent"
                class="harbor-round-button size-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-subtle focus-visible:ring-offset-2"
                :disabled="respondingId !== null"
                aria-label="Accept friend request"
                title="Accept friend request"
                @click="emit('accept-request', pendingRequest)"
              >
                <Check class="size-5" /></button
              ><button
                type="button"
                data-decline-friend-request
                data-tone="danger"
                class="harbor-round-button size-12 text-harbor-danger-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-subtle focus-visible:ring-offset-2"
                :disabled="respondingId !== null"
                aria-label="Decline friend request"
                title="Decline friend request"
                @click="emit('decline-request', pendingRequest)"
              >
                <X class="size-5" />
              </button>
            </div>
            <div
              v-else-if="profile.relationship === 'none' && !profileFriend"
              class="mt-5 flex items-center justify-center gap-3"
              role="group"
              aria-label="Profile actions"
            >
              <button
                type="button"
                data-add-friend
                data-tone="accent"
                class="harbor-round-button size-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-subtle focus-visible:ring-offset-2"
                aria-label="Add friend"
                title="Add friend"
                @click="emit('add-friend')"
              >
                <UserPlus class="size-5" />
              </button>
            </div>
            <div
              v-else-if="profileFriend"
              class="mt-5 flex items-center justify-center gap-3"
              role="group"
              aria-label="Profile actions"
            >
              <button
                type="button"
                data-start-call
                data-tone="accent"
                class="harbor-round-button size-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-subtle focus-visible:ring-offset-2"
                :disabled="opening !== null || callActive"
                aria-label="Start direct call"
                title="Start direct call"
                @click="emit('call')"
              >
                <Phone class="size-5" />
              </button>
              <button
                type="button"
                data-remove-friend
                data-tone="destructive"
                class="harbor-round-button size-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-subtle focus-visible:ring-offset-2"
                :disabled="removingId !== null"
                aria-label="Remove friend"
                title="Remove friend"
                @click="emit('update:confirmationOpen', true)"
              >
                <UserMinus class="size-5" />
              </button>
            </div>
          </div>
        </section>
        <section class="grid gap-3 rounded-2xl border border-harbor-line bg-white p-4 text-sm sm:grid-cols-3">
          <div class="inline-flex min-w-0 items-center gap-2 text-harbor-muted">
            <Mail class="size-4 shrink-0 text-harbor-accent" /><span class="min-w-0"
              ><span class="block text-xs">Email</span
              ><strong class="block truncate font-semibold text-harbor-ink">{{
                profile.relationship === 'none' ? 'Shared with friends' : profile.email
              }}</strong></span
            >
          </div>
          <div class="inline-flex items-center gap-2 text-harbor-muted">
            <CalendarDays class="size-4 shrink-0 text-harbor-accent" /><span class="min-w-0"
              ><span class="block text-xs">Joined</span
              ><strong class="block font-semibold text-harbor-ink">{{ formatDate(profile.createdAt) }}</strong></span
            >
          </div>
          <div class="inline-flex items-center gap-2 text-harbor-muted">
            <Clock3 class="size-4 shrink-0 text-harbor-accent" /><span class="min-w-0"
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
        /></div></HarborDialogContent></Dialog
  ><Dialog :open="isAvatarPreviewOpen" @update:open="isAvatarPreviewOpen = $event"
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
  ><Dialog :open="confirmationOpen" @update:open="emit('update:confirmationOpen', $event)"
    ><HarborDialogContent
      overlay-class="!z-[1050] bg-harbor-ink/30 backdrop-blur-md"
      class="marketing-font !z-[1050] w-[calc(100%-2rem)] max-w-md rounded-[1.75rem] border-harbor-danger/25 bg-harbor-surface p-5 text-harbor-ink shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full sm:p-6"
      ><DialogHeader
        ><DialogTitle>Remove friend?</DialogTitle
        ><DialogDescription class="text-harbor-muted"
          >Remove {{ profileFriend?.name }} from your friends? You can send another request later.</DialogDescription
        ></DialogHeader
      ><DialogFooter class="gap-2"
        ><Button
          variant="outline"
          class="rounded-full border-harbor-line bg-white text-harbor-ink-soft"
          :disabled="removingId !== null"
          @click="emit('update:confirmationOpen', false)"
          >Cancel</Button
        ><Button
          class="rounded-full bg-harbor-danger text-white hover:bg-harbor-danger-strong"
          :disabled="!profileFriend || removingId !== null"
          @click="emit('remove')"
          ><LoadingRipple v-if="removingId === profileFriend?.id" size="sm" /><UserMinus v-else class="size-4" />{{
            removingId ? 'Removing...' : 'Remove friend'
          }}</Button
        ></DialogFooter
      ></HarborDialogContent
    ></Dialog
  >
</template>
