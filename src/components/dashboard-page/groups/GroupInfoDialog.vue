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

import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Dialog, DialogHeader, DialogTitle, HarborDialogContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingRipple } from '@/components/ui/loading';
import { PresenceDot } from '@/components/ui/presence-dot';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { toast } from '@/components/ui/toast';
import { useFullAvatar } from '@/composables/useFullAvatar';
import FriendshipChangeDialog, {
  type FriendshipChange,
  type PendingFriendshipChange,
} from '@/components/dashboard-page/groups/FriendshipChangeDialog.vue';
import { type GroupMutationToken, groupAddActionLabel } from '@/pages/dashboard-group-state';
import { type Friend, type GroupInfo, type GroupMember, type GroupMemberRole, socialApi } from '@/services/social-api';

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
      : 'bg-[#EAF7F4] text-[#17645F]';
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

async function uploadAvatar(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !props.accessToken || !props.info || isUploadingAvatar.value) return;
  if (file.size > 5 * 1024 * 1024) {
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
  <Dialog :open="open" @update:open="emit('update:open', $event)"
    ><HarborDialogContent
      overlay-class="bg-[#102F35]/30 backdrop-blur-md"
      class="marketing-font top-[calc(50%+2.25rem)] flex max-h-[calc(100dvh-6rem)] w-[calc(100%-2rem)] max-w-4xl flex-col rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-5 text-[#102F35] shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full sm:p-6"
      @open-auto-focus="$event.preventDefault()"
      @close-auto-focus="$event.preventDefault()"
      ><DialogHeader><DialogTitle>Group info</DialogTitle></DialogHeader>
      <div v-if="loading" class="flex min-h-72 items-center justify-center">
        <LoadingRipple class="size-7 text-[#0B7A75]" />
      </div>
      <div
        v-else-if="error"
        class="rounded-2xl border border-[#F2C7BE] bg-[#FFF4F0] p-4 text-sm text-[#9D4636]"
        role="alert"
      >
        {{ error }}
      </div>
      <div v-else-if="info" class="min-h-0 space-y-6 overflow-y-auto pr-1">
        <section
          class="
            flex flex-col items-center justify-center gap-5 rounded-2xl border border-[#D8E7E3] bg-white p-5 text-center
            sm:p-6
          "
        >
          <DropdownMenu v-if="canManage(info.role)">
            <DropdownMenuTrigger as-child>
              <button
                type="button"
                class="
                  harbor-ghost-action flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full
                  bg-[#102F35] p-0 text-white
                "
                :aria-label="`Manage ${info.title} group icon`"
              >
                <img
                  v-if="avatarUrl"
                  :src="avatarUrl"
                  :alt="`${info.title} group icon`"
                  class="size-full object-cover"
                />
                <LoadingRipple v-else-if="avatarLoading" class="size-7 text-white" />
                <UsersRound v-else class="size-9" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              :side-offset="10"
              class="
                harbor-action-menu min-w-48 rounded-2xl border-[#D8E7E3] bg-white p-2 text-[#102F35]
                shadow-[0_20px_55px_rgba(16,47,53,0.16)]
              "
            >
              <DropdownMenuItem
                v-if="avatarUrl"
                class="harbor-context-menu-item cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                @select="isAvatarPreviewOpen = true"
              >
                <Eye class="size-4" />View
              </DropdownMenuItem>
              <DropdownMenuSeparator v-if="avatarUrl" class="mx-1 my-2 bg-[#E5EFEC]" />
              <DropdownMenuItem
                class="harbor-context-menu-item cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                :disabled="isUploadingAvatar || mutationBusy"
                @select="avatarInput?.click()"
              >
                <Camera class="size-4" />Change avatar
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="avatarUrl"
                class="harbor-context-menu-danger cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-[#C4513D]"
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
            class="
              harbor-ghost-action flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full
              bg-[#102F35] p-0 text-white
            "
            :aria-label="`View ${info.title} group icon`"
            @click="isAvatarPreviewOpen = true"
          >
            <img :src="avatarUrl" :alt="`${info.title} group icon`" class="size-full object-cover" />
          </button>
          <span
            v-else
            class="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#102F35] text-white"
            ><LoadingRipple v-if="avatarLoading" class="size-7 text-white" /><UsersRound v-else class="size-9"
          /></span>
          <div class="min-w-0">
            <h3 class="truncate text-xl font-semibold tracking-[-0.025em]">{{ info.title }}</h3>
            <p class="mt-1 text-sm text-[#61777B]">{{ accessLabel(info.accessPolicy) }}</p>
            <div class="mt-4 flex flex-wrap justify-center gap-2">
              <span class="rounded-full bg-[#EAF7F4] px-3 py-1.5 text-xs font-semibold text-[#17645F]"
                >{{ info.memberCount }} {{ info.memberCount === 1 ? 'member' : 'members' }}</span
              ><span
                class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                :class="roleClass(info.role)"
                ><component :is="roleIcon(info.role)" class="size-3.5" />{{ roleLabel(info.role) }}</span
              >
            </div>
          </div>
          <input ref="avatarInput" type="file" accept="image/*" class="sr-only" @change="uploadAvatar" />
        </section>
        <section class="grid gap-3 rounded-2xl border border-[#D8E7E3] bg-white p-4 text-sm sm:grid-cols-3">
          <div class="inline-flex items-center gap-2 text-[#61777B]">
            <ShieldCheck class="size-4 shrink-0 text-[#0B7A75]" /><span class="min-w-0"
              ><span class="block text-xs">Access</span
              ><strong class="block font-semibold text-[#102F35]">{{ accessLabel(info.accessPolicy) }}</strong></span
            >
          </div>
          <div class="inline-flex items-center gap-2 text-[#61777B]">
            <CalendarDays class="size-4 shrink-0 text-[#0B7A75]" /><span class="min-w-0"
              ><span class="block text-xs">Created</span
              ><strong class="block font-semibold text-[#102F35]">{{ formatDate(info.createdAt) }}</strong></span
            >
          </div>
          <div class="inline-flex min-w-0 items-center gap-2 text-[#61777B]">
            <Copy class="size-4 shrink-0 text-[#0B7A75]" /><span class="min-w-0 flex-1"
              ><span class="block text-xs">Group ID</span
              ><code class="block truncate font-semibold text-[#102F35]">#{{ info.groupCode }}</code></span
            ><button
              type="button"
              class="harbor-ghost-action shrink-0 rounded-lg p-2 text-[#0B7A75]"
              :aria-label="copiedGroupId ? 'Group ID copied' : 'Copy group ID'"
              :title="copiedGroupId ? 'Copied' : 'Copy group ID'"
              @click="copyGroupId"
            >
              <Check v-if="copiedGroupId" class="size-4" /><Copy v-else class="size-4" />
            </button>
          </div>
        </section>
        <section class="flex flex-wrap items-center justify-center gap-2" aria-label="Group actions">
          <Button
            v-if="canManage(info.role)"
            variant="ghost"
            class="
              group size-11 rounded-full bg-[#E6F4F1] p-0 text-[#0B7A75] hover:bg-[#D8E7E3] hover:text-[#08635F]
              sm:w-auto sm:px-2
            "
            :aria-label="groupAddActionLabel(info.accessPolicy)"
            :title="groupAddActionLabel(info.accessPolicy)"
            @click="emit('add-members')"
          >
            <UserPlus
              class="
                size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-110
                motion-reduce:transition-none
              "
            />
            <span class="hidden sm:inline">{{ groupAddActionLabel(info.accessPolicy) }}</span>
          </Button>
          <Button
            v-if="canManage(info.role)"
            data-group-security
            variant="ghost"
            class="
              group size-11 rounded-full bg-[#E6F4F1] p-0 text-[#0B7A75] hover:bg-[#D8E7E3] hover:text-[#102F35]
              sm:w-auto sm:px-4
            "
            aria-label="Security"
            title="Change group access and password"
            @click="emit('group-settings')"
          >
            <LockKeyhole
              class="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none"
            />
            <span class="hidden sm:inline">Security</span>
          </Button>
          <Button
            v-if="info.role !== 'creator'"
            variant="ghost"
            class="group size-11 rounded-full bg-[#FFF0EA] p-0 text-[#9D4636] hover:bg-[#F9DED6] sm:w-auto sm:px-4"
            aria-label="Quit group"
            title="Quit group"
            @click="emit('quit-group')"
          >
            <LogOut
              class="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
            <span class="hidden sm:inline">Quit group</span>
          </Button>
          <Button
            v-if="canManage(info.role)"
            variant="ghost"
            class="group size-11 rounded-full bg-[#FFF0EA] p-0 text-[#9D4636] hover:bg-[#F9DED6] sm:w-auto sm:px-4"
            aria-label="Remove group"
            title="Remove group"
            @click="emit('remove-group')"
          >
            <Trash2
              class="
                size-4 transition-transform duration-200 group-hover:scale-90 group-hover:rotate-6
                motion-reduce:transition-none
              "
            />
            <span class="hidden sm:inline">Remove group</span>
          </Button>
        </section>
        <section>
          <div class="mb-3 flex items-baseline justify-between gap-3">
            <h3 class="text-sm font-semibold">Participants</h3>
            <span class="text-xs text-[#61777B]">{{ members.length }} of {{ info.memberCount }} listed</span>
          </div>
          <div v-if="members.length" class="space-y-1 rounded-2xl border border-[#D8E7E3] bg-white p-1.5">
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
                  :class="armed ? 'bg-[#08635F]' : 'bg-[#0B7A75]'"
                  :aria-label="`Message ${member.name}`"
                  @click="
                    close();
                    emit('chat-member', member);
                  "
                >
                  <span class="flex w-20 shrink-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
                    ><MessageCircle class="size-4" />Message</span
                  >
                </button>
              </template>
              <template #trailing="{ close }">
                <button
                  type="button"
                  data-swipe-action
                  class="
                    flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden bg-[#E6F4F1]
                    text-[11px] font-semibold text-[#102F35]
                  "
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
                  class="
                    flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden bg-[#0B7A75]
                    text-[11px] font-semibold text-white
                  "
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
                  class="
                    flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden bg-[#C4513D]
                    text-[11px] font-semibold text-white disabled:opacity-60
                  "
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
                    class="harbor-ghost-action flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left outline-none focus:outline-none [@media(hover:hover)]:focus-visible:ring-2 [@media(hover:hover)]:focus-visible:ring-inset [@media(hover:hover)]:focus-visible:ring-[#0B7A75]"
                    title="Open profile"
                    @pointerdown="closeParticipantContextMenuBeforeClick"
                    @click="openProfile(member)"
                  >
                    <span class="relative shrink-0"
                      ><span
                        class="flex size-10 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] text-xs font-semibold text-[#0B7A75]"
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
                        class="size-3 border-2 border-white" /></span
                    ><span class="min-w-0 flex-1"
                      ><span class="flex min-w-0 flex-col items-start"
                        ><span class="max-w-full truncate text-sm font-semibold">{{ member.name }}</span
                        ><span class="max-w-full truncate text-xs text-[#61777B]">@{{ member.nickname }}</span></span
                      ><span class="inline-flex items-center gap-1 truncate text-xs text-[#61777B]"
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
                      class="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E6F4F1] text-[#0B7A75]"
                      title="Your friend"
                      aria-label="Your friend"
                      ><UserCheck class="size-3.5" /></span
                    ><span
                      v-if="member.id === currentUserId"
                      class="rounded-full bg-[#EAF7F4] px-2 py-1 text-[11px] font-semibold text-[#17645F]"
                      >You</span
                    >
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent
                  class="harbor-action-menu min-w-48 rounded-2xl border-[#D8E7E3] bg-white p-2 text-[#102F35]"
                >
                  <ContextMenuItem
                    class="harbor-context-menu-item cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    @select="emit('profile', member.id, member.name)"
                  >
                    <UserRound class="size-4" />See profile
                  </ContextMenuItem>
                  <ContextMenuItem
                    v-if="canRemoveMember(member)"
                    class="harbor-context-menu-danger cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-[#C4513D]"
                    :disabled="mutationBusy"
                    @select="removeMember(member)"
                  >
                    <UserMinus class="size-4" />Remove from group
                  </ContextMenuItem>
                  <ContextMenuItem
                    v-if="canChangeMemberRole(member) && member.role === 'member'"
                    class="harbor-context-menu-item cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    :disabled="mutationBusy"
                    @select="updateMemberRole(member, 'admin')"
                  >
                    <ShieldCheck class="size-4" />Make admin
                  </ContextMenuItem>
                  <ContextMenuItem
                    v-if="canChangeMemberRole(member) && member.role === 'admin'"
                    class="harbor-context-menu-item cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
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
            class="harbor-ghost-action mt-2 w-full rounded-full text-[#0B7A75]"
            :disabled="membersLoadingMore"
            @click="emit('load-more-members')"
          >
            <LoadingRipple v-if="membersLoadingMore" size="sm" />
            {{ membersLoadingMore ? 'Loading participants...' : 'Load more participants' }}
          </Button>
          <p v-if="!members.length" class="rounded-2xl border border-[#D8E7E3] bg-white p-4 text-sm text-[#61777B]">
            No participants are listed for this group.
          </p>
        </section>
      </div></HarborDialogContent
    ></Dialog
  >
  <Dialog :open="isAvatarPreviewOpen" @update:open="isAvatarPreviewOpen = $event"
    ><HarborDialogContent
      overlay-class="bg-[#102F35]/50 backdrop-blur-lg"
      hide-close
      class="w-auto max-w-[min(88dvw,42rem)] border-0 bg-transparent p-0 shadow-none"
      ><DialogTitle class="sr-only">{{ info?.title }} group icon</DialogTitle
      ><img
        v-if="avatarUrl"
        :src="fullAvatarUrl ?? avatarUrl"
        :alt="`${info?.title} group icon`"
        class="max-h-[78dvh] max-w-[min(88dvw,42rem)] rounded-full object-contain shadow-[0_24px_70px_rgba(16,47,53,0.35)]"
      />
    </HarborDialogContent>
  </Dialog>
  <FriendshipChangeDialog v-model:pending="pendingFriendChange" :change-friendship="changeFriendship" />
</template>
