<script setup lang="ts">
import {
  CalendarDays,
  Camera,
  Check,
  Clock3,
  Copy,
  Crown,
  Eye,
  LockKeyhole,
  LogOut,
  MessageCircle,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  UserRound,
  UsersRound,
} from 'lucide-vue-next';
import { ref, watch } from 'vue';

import InfoPage from '@/components/dashboard-page/details/InfoPage.vue';
import FriendshipChangeDialog, {
  type FriendshipChange,
  type PendingFriendshipChange,
} from '@/components/dashboard-page/groups/FriendshipChangeDialog.vue';
import SharedMediaPanel from '@/components/dashboard-page/shared-media/SharedMediaPanel.vue';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Dialog, DialogTitle, HarborDialogContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingRipple } from '@/components/ui/loading';
import { PresenceDot } from '@/components/ui/presence-dot';
import { RoundButtonGroup } from '@/components/ui/round-button';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { toast } from '@/components/ui/toast';
import { useFullAvatar } from '@/composables/useFullAvatar';
import { userStatusOption } from '@/config/user-status.config';
import { type GroupMutationToken, groupAddActionLabel } from '@/pages/dashboard-group-state';
import { hasNativeMediaPicker, pickNativeMedia } from '@/services/media-picker';
import { type Friend, type GroupInfo, type GroupMember, type GroupMemberRole, socialApi } from '@/services/social-api';

const MAX_ICON_BYTES = 5 * 1024 * 1024;

const props = defineProps<{
  open: boolean;
  loading: boolean;
  error: string;
  info: GroupInfo | null;
  members: GroupMember[];
  memberAvatarUrls: Record<string, string>;
  membersHasMore: boolean;
  membersLoadingMore: boolean;
  friends: Friend[];
  avatarUrl?: string;
  avatarLoading: boolean;
  currentUserId?: string;
  accessToken?: string;
  mutationBusy: boolean;
  beginMutation: (groupId: string) => GroupMutationToken | null;
  endMutation: (groupId: string, token: GroupMutationToken) => void;
  changeFriendship: (member: GroupMember, change: FriendshipChange) => Promise<boolean>;
  accessLabel: (policy: GroupInfo['accessPolicy']) => string;
  formatDate: (value: string | null) => string;
}>();
const copiedGroupId = ref(false);
const avatarInput = ref<HTMLInputElement | null>(null);
const isAvatarPreviewOpen = ref(false);
const fullAvatarUrl = useFullAvatar(
  () => props.info?.avatarUrl,
  () => isAvatarPreviewOpen.value,
);
const isUploadingAvatar = ref(false);
const activeParticipantContextMenuId = ref<string | null>(null);
const participantContextMenuResets = ref<Record<string, number>>({});
let suppressProfileClick = false;
const emit = defineEmits<{
  (event: 'update:open', value: boolean): void;
  (event: 'profile', id: string, name: string): void;
  (event: 'add-members'): void;
  (event: 'quit-group'): void;
  (event: 'remove-group'): void;
  (event: 'group-settings'): void;
  (event: 'refresh'): void;
  (event: 'load-more-members'): void;
  (event: 'chat-member', member: GroupMember): void;
}>();

const pendingFriendChange = ref<PendingFriendshipChange | null>(null);

const SWIPE_ACTION_WIDTH = 80;
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function roleLabel(role: string | null) {
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Participant';
}

function roleIcon(role: string | null) {
  return role === 'creator' ? Crown : role === 'admin' ? ShieldCheck : UserRound;
}

function roleClass(role: string | null) {
  return role === 'creator'
    ? 'bg-[#FFF8E8] text-[#80601D]'
    : role === 'admin'
      ? 'bg-[#E8F2F8] text-[#27647A]'
      : 'bg-harbor-hover text-harbor-accent-hover';
}

function canManage(role: string | null) {
  return role === 'creator' || role === 'admin';
}

function isFriend(member: GroupMember) {
  return member.id !== props.currentUserId && props.friends.some((friend) => friend.id === member.id);
}

function canRemoveMember(member: GroupMember) {
  return canManage(props.info?.role ?? null) && member.role !== 'creator' && member.id !== props.currentUserId;
}

function canChangeMemberRole(member: GroupMember) {
  return props.info?.role === 'creator' && member.role !== 'creator' && member.id !== props.currentUserId;
}

function isSelf(member: GroupMember) {
  return member.id === props.currentUserId;
}

// Left swipe: Profile always, Add friend for non-friends, and Remove for group managers.
function trailingActionCount(member: GroupMember) {
  return 1 + Number(!isSelf(member) && !isFriend(member)) + Number(canRemoveMember(member));
}

function requestFriendChange(member: GroupMember, change: FriendshipChange) {
  pendingFriendChange.value = { member, change };
}

function openProfile(member: GroupMember) {
  if (suppressProfileClick || activeParticipantContextMenuId.value === member.id) {
    suppressProfileClick = false;
    return;
  }
  // Everyone has a profile: friends see full details, others see public details.
  emit('profile', member.id, member.name);
}

function participantContextMenuKey(memberId: string) {
  return `${memberId}-${participantContextMenuResets.value[memberId] ?? 0}`;
}

function setParticipantContextMenuOpen(memberId: string, open: boolean) {
  const previousId = activeParticipantContextMenuId.value;
  if (open) {
    if (previousId && previousId !== memberId) {
      participantContextMenuResets.value = {
        ...participantContextMenuResets.value,
        [previousId]: (participantContextMenuResets.value[previousId] ?? 0) + 1,
      };
    }
    activeParticipantContextMenuId.value = memberId;
  } else if (previousId === memberId) {
    activeParticipantContextMenuId.value = null;
  }
}

function closeParticipantContextMenuBeforeClick(event: PointerEvent) {
  const previousId = activeParticipantContextMenuId.value;
  if (event.button !== 0 || !previousId) return;
  participantContextMenuResets.value = {
    ...participantContextMenuResets.value,
    [previousId]: (participantContextMenuResets.value[previousId] ?? 0) + 1,
  };
  activeParticipantContextMenuId.value = null;
  suppressProfileClick = true;
}

async function removeMember(member: GroupMember) {
  if (!props.accessToken || !props.info || !canRemoveMember(member)) return;
  const groupId = props.info.id;
  const mutation = props.beginMutation(groupId);
  if (!mutation) return;
  try {
    await socialApi.removeGroupMember(props.accessToken, groupId, member.id);
    if (props.info?.id === groupId) {
      toast({ title: `${member.name} was removed from the group.`, variant: 'success' });
      emit('refresh');
    }
  } catch (error) {
    console.error('[GroupInfoDialog] Failed to remove participant:', error);
    toast({ title: 'Could not remove participant.', variant: 'destructive' });
  } finally {
    props.endMutation(groupId, mutation);
  }
}

async function updateMemberRole(member: GroupMember, role: GroupMemberRole) {
  if (!props.accessToken || !props.info || !canChangeMemberRole(member) || member.role === role) return;
  const groupId = props.info.id;
  const mutation = props.beginMutation(groupId);
  if (!mutation) return;
  try {
    await socialApi.updateGroupMemberRole(props.accessToken, groupId, member.id, role);
    if (props.info?.id === groupId) {
      toast({ title: `${member.name} is now ${role === 'admin' ? 'an admin' : 'a participant'}.`, variant: 'success' });
      emit('refresh');
    }
  } catch (error) {
    console.error('[GroupInfoDialog] Failed to update participant role:', error);
    toast({ title: 'Could not update participant role.', variant: 'destructive' });
  } finally {
    props.endMutation(groupId, mutation);
  }
}

async function chooseAvatar() {
  if (!hasNativeMediaPicker()) {
    avatarInput.value?.click();
    return;
  }
  try {
    const { files, oversized } = await pickNativeMedia({ kind: 'image', multiple: false, maxBytes: MAX_ICON_BYTES });
    if (oversized > 0) toast({ title: 'Icon must be 5 MiB or smaller.', variant: 'destructive' });
    else if (files[0]) await uploadAvatarFile(files[0]);
  } catch (error) {
    console.error('[GroupInfoDialog] Failed to pick group icon:', error);
    toast({ title: 'Could not open your photos.', variant: 'destructive' });
  }
}

async function uploadAvatar(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) await uploadAvatarFile(file);
}

async function uploadAvatarFile(file: File) {
  if (!props.accessToken || !props.info || isUploadingAvatar.value) return;
  if (file.size > MAX_ICON_BYTES) {
    toast({ title: 'Icon must be 5 MiB or smaller.', variant: 'destructive' });
    return;
  }

  const groupId = props.info.id;
  const mutation = props.beginMutation(groupId);
  if (!mutation) return;
  isUploadingAvatar.value = true;
  try {
    await socialApi.uploadGroupAvatar(props.accessToken, groupId, file);
    if (props.info?.id === groupId) {
      toast({ title: 'Group icon updated.', variant: 'success' });
      emit('refresh');
    }
  } catch (error) {
    console.error('[GroupInfoDialog] Failed to update group icon:', error);
    toast({ title: 'Could not update group icon.', variant: 'destructive' });
  } finally {
    isUploadingAvatar.value = false;
    props.endMutation(groupId, mutation);
  }
}

async function removeAvatar() {
  if (!props.accessToken || !props.info || !props.avatarUrl || isUploadingAvatar.value) return;
  const groupId = props.info.id;
  const mutation = props.beginMutation(groupId);
  if (!mutation) return;
  isUploadingAvatar.value = true;
  try {
    await socialApi.removeGroupAvatar(props.accessToken, groupId);
    if (props.info?.id === groupId) {
      isAvatarPreviewOpen.value = false;
      toast({ title: 'Group icon removed.', variant: 'success' });
      emit('refresh');
    }
  } catch (error) {
    console.error('[GroupInfoDialog] Failed to remove group icon:', error);
    toast({ title: 'Could not remove group icon.', variant: 'destructive' });
  } finally {
    isUploadingAvatar.value = false;
    props.endMutation(groupId, mutation);
  }
}

async function copyGroupId() {
  if (!props.info) return;
  await navigator.clipboard.writeText(props.info.groupCode);
  copiedGroupId.value = true;
  window.setTimeout(() => (copiedGroupId.value = false), 2_000);
}

watch(
  () => [props.open, props.info?.id],
  () => {
    isAvatarPreviewOpen.value = false;
  },
);
</script>
<template>
  <InfoPage
    :open="open"
    title="Group info"
    :description="`${info?.title ?? 'This group'}'s details and participants.`"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="loading" class="flex min-h-72 items-center justify-center">
      <LoadingRipple class="size-7 text-harbor-accent" />
    </div>
    <div
      v-else-if="error"
      class="rounded-2xl border border-harbor-danger/25 bg-harbor-danger-soft p-4 text-sm text-harbor-danger-strong"
      role="alert"
    >
      {{ error }}
    </div>
    <div v-else-if="info" class="space-y-8">
      <section class="flex flex-col items-center gap-5 pt-2 text-center">
        <DropdownMenu v-if="canManage(info.role)">
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="harbor-ghost-action flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-[28%] bg-harbor-ink p-0 text-white"
              :aria-label="`Manage ${info.title} group icon`"
            >
              <img v-if="avatarUrl" :src="avatarUrl" :alt="`${info.title} group icon`" class="size-full object-cover" />
              <LoadingRipple v-else-if="avatarLoading" class="size-7 text-white" />
              <UsersRound v-else class="size-12" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" :side-offset="10" class="min-w-48">
            <DropdownMenuItem v-if="avatarUrl" @select="isAvatarPreviewOpen = true">
              <Eye class="size-4" />View
            </DropdownMenuItem>
            <DropdownMenuSeparator v-if="avatarUrl" class="mx-1 my-2 bg-harbor-line" />
            <DropdownMenuItem :disabled="isUploadingAvatar || mutationBusy" @select="chooseAvatar">
              <Camera class="size-4" />Change avatar
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="avatarUrl"
              variant="danger"
              :disabled="isUploadingAvatar || mutationBusy"
              @select="removeAvatar"
            >
              <Trash2 class="size-4" />Remove avatar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          v-else-if="avatarUrl"
          type="button"
          class="harbor-ghost-action flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-[28%] bg-harbor-ink p-0 text-white"
          :aria-label="`View ${info.title} group icon`"
          @click="isAvatarPreviewOpen = true"
        >
          <img :src="avatarUrl" :alt="`${info.title} group icon`" class="size-full object-cover" />
        </button>
        <span
          v-else
          class="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-[28%] bg-harbor-ink text-white"
          ><LoadingRipple v-if="avatarLoading" class="size-7 text-white" /><UsersRound v-else class="size-12"
        /></span>
        <div class="min-w-0 max-w-full">
          <h3 class="truncate text-3xl font-semibold leading-tight tracking-[-0.03em]">{{ info.title }}</h3>
          <p class="mt-1 text-base text-harbor-muted">#{{ info.groupCode }}</p>
        </div>
        <!-- Group management sits under the name, in the same white pill as the chat header's call buttons;
               leaving or removing the group lives apart at the bottom. -->
        <RoundButtonGroup v-if="info.isMember && canManage(info.role)" aria-label="Group actions">
          <button
            type="button"
            class="size-11"
            :aria-label="groupAddActionLabel(info.accessPolicy)"
            :title="groupAddActionLabel(info.accessPolicy)"
            @click="emit('add-members')"
          >
            <UserPlus class="size-5" /></button
          ><button
            type="button"
            class="size-11"
            data-group-security
            aria-label="Security"
            title="Change group access and password"
            @click="emit('group-settings')"
          >
            <LockKeyhole class="size-5" />
          </button>
        </RoundButtonGroup>
        <input ref="avatarInput" type="file" accept="image/*" class="sr-only" @change="uploadAvatar" />
      </section>
      <section class="grid gap-4 rounded-[1.4rem] bg-harbor-app p-4 text-sm sm:grid-cols-3">
        <div class="inline-flex items-center gap-3 text-harbor-muted">
          <ShieldCheck class="size-4 shrink-0 text-harbor-icon" /><span class="min-w-0"
            ><span class="block text-xs">Access</span
            ><strong class="block font-semibold text-harbor-ink">{{ accessLabel(info.accessPolicy) }}</strong></span
          >
        </div>
        <div class="inline-flex items-center gap-3 text-harbor-muted">
          <CalendarDays class="size-4 shrink-0 text-harbor-icon" /><span class="min-w-0"
            ><span class="block text-xs">Created</span
            ><strong class="block font-semibold text-harbor-ink">{{ formatDate(info.createdAt) }}</strong></span
          >
        </div>
        <div class="inline-flex min-w-0 items-center gap-3 text-harbor-muted">
          <Copy class="size-4 shrink-0 text-harbor-icon" /><span class="min-w-0 flex-1"
            ><span class="block text-xs">Group ID</span
            ><code class="block truncate font-semibold text-harbor-ink">#{{ info.groupCode }}</code></span
          ><button
            type="button"
            class="harbor-ghost-action shrink-0 rounded-lg p-2 text-harbor-icon"
            :aria-label="copiedGroupId ? 'Group ID copied' : 'Copy group ID'"
            :title="copiedGroupId ? 'Copied' : 'Copy group ID'"
            @click="copyGroupId"
          >
            <Check v-if="copiedGroupId" class="size-4" /><Copy v-else class="size-4" />
          </button>
        </div>
      </section>
      <section v-if="info.isMember">
        <div class="mb-3 flex items-baseline justify-between gap-3">
          <h3 class="text-sm font-semibold">Participants</h3>
          <span class="text-xs text-harbor-muted">{{ members.length }} of {{ info.memberCount }} listed</span>
        </div>
        <div v-if="members.length" class="-mx-1.5 space-y-1">
          <SwipeableRow
            v-for="member in members"
            :id="`participant-${member.id}`"
            :key="member.id"
            class="rounded-xl"
            :leading-width="isFriend(member) ? SWIPE_ACTION_WIDTH : 0"
            :trailing-width="trailingActionCount(member) * SWIPE_ACTION_WIDTH"
            :full-swipe-leading="isFriend(member)"
            @full-swipe-leading="emit('chat-member', member)"
          >
            <template v-if="isFriend(member)" #leading="{ armed, close }">
              <button
                type="button"
                data-swipe-action
                class="flex flex-1 items-center justify-start text-white transition-colors"
                :class="armed ? 'bg-harbor-ink-soft' : 'bg-harbor-icon'"
                :aria-label="`Message ${member.name}`"
                @click="
                  close();
                  emit('chat-member', member);
                "
              >
                <span
                  class="flex w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
                  ><MessageCircle class="size-4" />Message</span
                >
              </button>
            </template>
            <template #trailing="{ close }">
              <button
                type="button"
                data-swipe-action
                class="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden bg-harbor-hover text-[11px] font-semibold text-harbor-ink"
                :aria-label="`View ${member.name}'s profile`"
                @click="
                  close();
                  emit('profile', member.id, member.name);
                "
              >
                <UserRound class="size-4 shrink-0" />Profile
              </button>
              <button
                v-if="!isSelf(member) && !isFriend(member)"
                type="button"
                data-swipe-action
                class="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden bg-harbor-icon text-[11px] font-semibold text-white"
                :aria-label="`Add ${member.name} as a friend`"
                @click="
                  close();
                  requestFriendChange(member, 'add');
                "
              >
                <UserPlus class="size-4 shrink-0" /><span class="leading-tight">Add friend</span>
              </button>
              <button
                v-if="canRemoveMember(member)"
                type="button"
                data-swipe-action
                class="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden bg-harbor-danger text-[11px] font-semibold text-white disabled:opacity-60"
                :aria-label="`Remove ${member.name} from the group`"
                :disabled="mutationBusy"
                @click="
                  close();
                  removeMember(member);
                "
              >
                <UserMinus class="size-4 shrink-0" />Remove
              </button>
            </template>
            <ContextMenu
              :key="participantContextMenuKey(member.id)"
              :press-open-delay="500"
              @update:open="setParticipantContextMenuOpen(member.id, $event)"
            >
              <ContextMenuTrigger as-child>
                <button
                  type="button"
                  class="harbor-ghost-action flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left outline-none focus:outline-none [@media(hover:hover)]:focus-visible:ring-2 [@media(hover:hover)]:focus-visible:ring-inset [@media(hover:hover)]:focus-visible:ring-harbor-accent"
                  title="Open profile"
                  @pointerdown="closeParticipantContextMenuBeforeClick"
                  @click="openProfile(member)"
                >
                  <span class="relative shrink-0"
                    ><span
                      class="flex size-10 items-center justify-center overflow-hidden rounded-[28%] bg-harbor-avatar text-xs font-semibold text-harbor-accent"
                      :class="['border-2', userStatusOption(member.isOnline ? member.status : 'offline').borderClass]"
                      ><img
                        v-if="memberAvatarUrls[member.id]"
                        :src="memberAvatarUrls[member.id]"
                        alt=""
                        class="size-full object-cover"
                      /><template v-else>{{ initials(member.name) }}</template></span
                    ><PresenceDot
                      surface="groupParticipants"
                      :online="member.isOnline"
                      :status="member.status"
                      class="size-3 border-[3px] border-harbor-surface" /></span
                  ><span class="min-w-0 flex-1"
                    ><span class="flex min-w-0 flex-col items-start"
                      ><span class="max-w-full truncate text-sm font-semibold">{{ member.name }}</span
                      ><span class="max-w-full truncate text-xs text-harbor-muted">@{{ member.nickname }}</span></span
                    ><span class="inline-flex items-center gap-1 truncate text-xs text-harbor-muted"
                      ><Clock3 class="size-3" />{{ formatDate(member.joinedAt) }}</span
                    ></span
                  ><span
                    class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold"
                    :class="roleClass(member.role)"
                    ><component :is="roleIcon(member.role)" class="size-3" />{{ roleLabel(member.role) }}</span
                  ><span
                    v-if="isFriend(member)"
                    data-friend-badge
                    role="img"
                    class="flex size-6 shrink-0 items-center justify-center rounded-full bg-harbor-hover text-harbor-accent"
                    title="Your friend"
                    aria-label="Your friend"
                    ><UserCheck class="size-3.5" /></span
                  ><span
                    v-if="member.id === currentUserId"
                    class="rounded-full bg-harbor-hover px-2 py-1 text-[11px] font-semibold text-harbor-accent-hover"
                    >You</span
                  >
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent class="min-w-48">
                <ContextMenuItem @select="emit('profile', member.id, member.name)">
                  <UserRound class="size-4" />See profile
                </ContextMenuItem>
                <ContextMenuItem
                  v-if="canRemoveMember(member)"
                  variant="danger"
                  :disabled="mutationBusy"
                  @select="removeMember(member)"
                >
                  <UserMinus class="size-4" />Remove from group
                </ContextMenuItem>
                <ContextMenuItem
                  v-if="canChangeMemberRole(member) && member.role === 'member'"
                  :disabled="mutationBusy"
                  @select="updateMemberRole(member, 'admin')"
                >
                  <ShieldCheck class="size-4" />Make admin
                </ContextMenuItem>
                <ContextMenuItem
                  v-if="canChangeMemberRole(member) && member.role === 'admin'"
                  :disabled="mutationBusy"
                  @select="updateMemberRole(member, 'member')"
                >
                  <UserRound class="size-4" />Make participant
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </SwipeableRow>
        </div>
        <Button
          v-if="members.length && membersHasMore"
          variant="ghost"
          class="harbor-ghost-action mt-2 w-full rounded-full text-harbor-accent"
          :disabled="membersLoadingMore"
          @click="emit('load-more-members')"
        >
          <LoadingRipple v-if="membersLoadingMore" size="sm" />
          {{ membersLoadingMore ? 'Loading participants...' : 'Load more participants' }}
        </Button>
        <p v-if="!members.length" class="rounded-[1.4rem] bg-harbor-app p-4 text-sm text-harbor-muted">
          No participants are listed for this group.
        </p>
      </section>
      <SharedMediaPanel
        v-if="info.isMember"
        :conversation-id="info.id"
        :access-token="accessToken"
        :user-id="currentUserId"
      />
      <section v-if="info.isMember" class="flex flex-col gap-2 sm:flex-row" aria-label="Leave or remove group">
        <button
          v-if="info.role !== 'creator' || info.memberCount > 1"
          type="button"
          data-quit-group
          class="harbor-pill-button harbor-pill-button-danger flex flex-1 items-center justify-center gap-2 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-subtle"
          @click="emit('quit-group')"
        >
          <LogOut class="size-4" />Quit group</button
        ><button
          v-if="canManage(info.role)"
          type="button"
          data-remove-group
          class="harbor-pill-button harbor-pill-button-danger flex flex-1 items-center justify-center gap-2 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-subtle"
          @click="emit('remove-group')"
        >
          <Trash2 class="size-4" />Remove group
        </button>
      </section>
    </div>
  </InfoPage>
  <Dialog :open="isAvatarPreviewOpen" @update:open="isAvatarPreviewOpen = $event"
    ><HarborDialogContent
      overlay-class="!z-[1050] bg-harbor-ink/50 backdrop-blur-lg"
      hide-close
      class="!z-[1050] w-auto max-w-[min(88dvw,42rem)] border-0 bg-transparent p-0 shadow-none"
      ><DialogTitle class="sr-only">{{ info?.title }} group icon</DialogTitle
      ><img
        v-if="avatarUrl"
        :src="fullAvatarUrl ?? avatarUrl"
        :alt="`${info?.title} group icon`"
        class="max-h-[78dvh] max-w-[min(88dvw,42rem)] rounded-[28%] object-contain shadow-[0_24px_70px_rgba(16,47,53,0.35)]"
      />
    </HarborDialogContent>
  </Dialog>
  <FriendshipChangeDialog v-model:pending="pendingFriendChange" :change-friendship="changeFriendship" />
</template>
