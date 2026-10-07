<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import {
  Camera,
  Check,
  Copy,
  LogOut,
  MessageCircle,
  Phone,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  UserRound,
  X,
} from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { computed, onBeforeUnmount, ref, useAttrs, watch } from 'vue';

import FriendshipChangeDialog, {
  type FriendshipChange,
  type PendingFriendshipChange,
} from '@/components/dashboard-page/groups/FriendshipChangeDialog.vue';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingRipple } from '@/components/ui/loading';
import { PresenceDot } from '@/components/ui/presence-dot';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { toast } from '@/components/ui/toast';
import {
  GROUP_ACCESS_POLICIES,
  type GroupMutationToken,
  buildGroupSettingsRequest,
  groupAccessPolicyLabel,
  groupAddActionLabel,
  sortGroupMembers,
} from '@/pages/dashboard-group-state';
import {
  type Conversation,
  type Friend,
  type GroupAccessPolicy,
  type GroupCandidate,
  type GroupInfo,
  type GroupMember,
  type GroupMemberRole,
  SocialApiError,
  socialApi,
} from '@/services/social-api';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  accessToken: string;
  avatarUrl?: string;
  currentUserId?: string;
  error?: string;
  friends: Friend[];
  group: Conversation;
  info: GroupInfo | null;
  loading: boolean;
  members: GroupMember[];
  memberAvatarUrls: Record<string, string>;
  membersHasMore: boolean;
  membersLoadingMore: boolean;
  mutationBusy: boolean;
  beginMutation: (groupId: string) => GroupMutationToken | null;
  endMutation: (groupId: string, token: GroupMutationToken) => void;
  changeFriendship: (member: GroupMember, change: FriendshipChange) => Promise<boolean>;
}>();

const emit = defineEmits<{
  (event: 'open-profile', userId: string, name: string): void;
  (event: 'refresh'): void;
  (event: 'removed', groupId: string): void;
  (event: 'call-member', member: GroupMember): void;
  (event: 'load-more-members'): void;
  (event: 'chat-member', member: GroupMember): void;
}>();

const SWIPE_ACTION_WIDTH = 80;
const pendingFriendChange = ref<PendingFriendshipChange | null>(null);

const attrs = useAttrs();
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const avatarInput = ref<HTMLInputElement | null>(null);
const isUploadingAvatar = ref(false);
const isSettingsOpen = ref(false);
const isSavingSettings = ref(false);
const settingsTitle = ref('');
const settingsPolicy = ref<GroupAccessPolicy>('open');
const settingsPassword = ref('');
const isAddMembersOpen = ref(false);
const isAddingMembers = ref(false);
const memberSearch = ref('');
const registeredResults = ref<GroupCandidate[]>([]);
const registeredNextOffset = ref<number | null>(null);
const isSearchingPeople = ref(false);
const isLoadingMorePeople = ref(false);
const selectedCandidateIds = ref<string[]>([]);
const selectedMemberIds = ref<string[]>([]);
const isSelectionMode = ref(false);
const isRemovingMembers = ref(false);
const isQuitOpen = ref(false);
const quitConfirmation = ref('');
const isLeaving = ref(false);
const isDeleteOpen = ref(false);
const deleteConfirmation = ref('');
const isDeleting = ref(false);
const copiedGroupId = ref(false);
let searchRequest = 0;
let searchTimer: number | undefined;
let settingsDialogSession = 0;
let addMembersDialogSession = 0;
let quitDialogSession = 0;
let deleteDialogSession = 0;

const sortedMembers = computed(() => sortGroupMembers(props.members));
const currentRole = computed(() => props.info?.role ?? props.group.role);
const canManage = computed(() => currentRole.value === 'creator' || currentRole.value === 'admin');
const isCreator = computed(() => currentRole.value === 'creator');
const groupPolicy = computed(() => props.info?.accessPolicy ?? props.group.accessPolicy);
const usesInvitations = computed(() => groupPolicy.value === 'password');
const addActionLabel = computed(() => groupAddActionLabel(groupPolicy.value));
const candidateSectionLabel = computed(() =>
  groupPolicy.value === 'friendsOfFriends'
    ? 'Friends of members'
    : groupPolicy.value === 'friendsOnly'
      ? 'Friends of every member'
      : 'Registered people',
);
const addMembersDescription = computed(() =>
  usesInvitations.value
    ? 'Invited people join after they enter the group password.'
    : groupPolicy.value === 'friendsOfFriends'
      ? 'Select friends or search people who are friends with a member.'
      : groupPolicy.value === 'friendsOnly'
        ? 'Select friends who are friends with every member.'
        : 'Select accepted friends or search registered people.',
);
const memberIdSet = computed(() => new Set(props.members.map(({ id }) => id)));
const normalizedMemberSearch = computed(() => memberSearch.value.trim().toLocaleLowerCase());
const friendCandidates = computed(() =>
  props.friends
    .filter((friend) => !memberIdSet.value.has(friend.id))
    .filter(
      (friend) =>
        !normalizedMemberSearch.value ||
        friend.name.toLocaleLowerCase().includes(normalizedMemberSearch.value) ||
        friend.email.toLocaleLowerCase().includes(normalizedMemberSearch.value),
    ),
);
const registeredCandidates = computed(() =>
  registeredResults.value.filter(
    (person) => !memberIdSet.value.has(person.id) && !props.friends.some((friend) => friend.id === person.id),
  ),
);
function hydrateSettings() {
  settingsTitle.value = props.info?.title ?? props.group.title ?? '';
  settingsPolicy.value = props.info?.accessPolicy ?? props.group.accessPolicy ?? 'open';
  settingsPassword.value = '';
}

function setSettingsOpen(open: boolean, force = false) {
  if (!open && isSavingSettings.value && !force) return;
  if (open && props.mutationBusy) return;
  isSettingsOpen.value = open;
  if (open) settingsDialogSession += 1;
  hydrateSettings();
}

watch(() => props.group.id, hydrateSettings, { immediate: true });
watch(settingsPolicy, (policy) => {
  if (policy !== 'password') settingsPassword.value = '';
});

function setAddMembersOpen(open: boolean, force = false) {
  if (!open && isAddingMembers.value && !force) return;
  if (open && props.mutationBusy) return;
  isAddMembersOpen.value = open;
  if (open) addMembersDialogSession += 1;
}

function setQuitOpen(open: boolean, force = false) {
  if (!open && isLeaving.value && !force) return;
  if (open && props.mutationBusy) return;
  isQuitOpen.value = open;
  if (open) quitDialogSession += 1;
  if (!open) quitConfirmation.value = '';
}

function setDeleteOpen(open: boolean, force = false) {
  if (!open && isDeleting.value && !force) return;
  if (open && props.mutationBusy) return;
  isDeleteOpen.value = open;
  if (open) deleteDialogSession += 1;
  if (!open) deleteConfirmation.value = '';
}

watch(memberSearch, (query, _, onCleanup) => {
  const normalized = query.trim();
  const request = ++searchRequest;
  registeredResults.value = [];
  registeredNextOffset.value = null;
  if (normalized.replace(/\s/g, '').length < 2 || !isAddMembersOpen.value) {
    isSearchingPeople.value = false;
    return;
  }

  isSearchingPeople.value = true;
  searchTimer = window.setTimeout(async () => {
    try {
      const page = await socialApi.searchGroupCandidates(props.accessToken, props.group.id, normalized);
      if (request === searchRequest) {
        registeredResults.value = page.results;
        registeredNextOffset.value = page.nextOffset;
      }
    } catch (error) {
      console.error('[GroupDetailsPanel] Failed to search people:', error);
      if (request === searchRequest) toast({ title: 'Could not search registered people.', variant: 'destructive' });
    } finally {
      if (request === searchRequest) isSearchingPeople.value = false;
    }
  }, 400);
  onCleanup(() => window.clearTimeout(searchTimer));
});

watch(isAddMembersOpen, (open) => {
  if (open) return;
  searchRequest += 1;
  window.clearTimeout(searchTimer);
  memberSearch.value = '';
  registeredResults.value = [];
  registeredNextOffset.value = null;
  selectedCandidateIds.value = [];
});

async function loadMorePeople() {
  const offset = registeredNextOffset.value;
  const query = memberSearch.value.trim();
  if (offset === null || isLoadingMorePeople.value) return;
  const request = searchRequest;
  isLoadingMorePeople.value = true;
  try {
    const page = await socialApi.searchGroupCandidates(props.accessToken, props.group.id, query, offset);
    if (request !== searchRequest) return;
    const knownIds = new Set(registeredResults.value.map(({ id }) => id));
    registeredResults.value = [...registeredResults.value, ...page.results.filter(({ id }) => !knownIds.has(id))];
    registeredNextOffset.value = page.nextOffset;
  } catch (error) {
    showError('Could not load more people.', error);
  } finally {
    isLoadingMorePeople.value = false;
  }
}

onBeforeUnmount(() => {
  searchRequest += 1;
  window.clearTimeout(searchTimer);
});

watch([() => props.members, () => props.currentUserId], ([members, currentUserId]) => {
  const selectableIds = new Set(
    members.filter((member) => isSelectableMember(member, currentUserId)).map(({ id }) => id),
  );
  selectedMemberIds.value = selectedMemberIds.value.filter((id) => selectableIds.has(id));
  if (!selectedMemberIds.value.length) isSelectionMode.value = false;
});

function initials(name?: string | null) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

const accessLabel = groupAccessPolicyLabel;

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function isSelectableMember(member: GroupMember, currentUserId = props.currentUserId) {
  return canManage.value && member.role !== 'creator' && member.id !== currentUserId;
}

function canCallMember(member: GroupMember) {
  return member.id !== props.currentUserId && props.friends.some((friend) => friend.id === member.id);
}

function isSelf(member: GroupMember) {
  return member.id === props.currentUserId;
}

// Left swipe: Profile always, Add friend for non-friends, and Remove for group managers.
function trailingActionCount(member: GroupMember) {
  return 1 + Number(!isSelf(member) && !isFriend(member)) + Number(isSelectableMember(member));
}

function isFriend(member: GroupMember) {
  return !isSelf(member) && props.friends.some((friend) => friend.id === member.id);
}

function canChangeMemberRole(member: GroupMember) {
  return isCreator.value && member.role !== 'creator' && member.id !== props.currentUserId;
}

async function copyGroupId() {
  if (!props.info) return;
  await navigator.clipboard.writeText(props.info.groupCode);
  copiedGroupId.value = true;
  window.setTimeout(() => (copiedGroupId.value = false), 2_000);
}

function selectMember(member: GroupMember) {
  if (!isSelectableMember(member)) return;
  isSelectionMode.value = true;
  selectedMemberIds.value = toggleId(selectedMemberIds.value, member.id);
}

function leaveSelectionMode() {
  isSelectionMode.value = false;
  selectedMemberIds.value = [];
}

function showError(title: string, error: unknown) {
  console.error(`[GroupDetailsPanel] ${title}:`, error);
  toast({
    title,
    description: error instanceof SocialApiError ? error.message : undefined,
    variant: 'destructive',
  });
}

async function uploadAvatar(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > MAX_AVATAR_SIZE) {
    toast({ title: 'Avatar must be 5 MiB or smaller.', variant: 'destructive' });
    return;
  }

  const groupId = props.group.id;
  const mutationToken = props.beginMutation(groupId);
  if (!mutationToken) return;
  isUploadingAvatar.value = true;
  try {
    await socialApi.uploadGroupAvatar(props.accessToken, groupId, file);
    toast({ title: 'Group avatar updated', variant: 'success' });
    emit('refresh');
  } catch (error) {
    showError('Could not update group avatar.', error);
  } finally {
    isUploadingAvatar.value = false;
    props.endMutation(groupId, mutationToken);
  }
}

async function saveSettings() {
  const title = settingsTitle.value.trim();
  if (!title || isSavingSettings.value) return;
  if (settingsPolicy.value === 'password' && props.info?.accessPolicy !== 'password' && !settingsPassword.value) {
    toast({ title: 'Enter a password for password-protected access.', variant: 'destructive' });
    return;
  }

  const groupId = props.group.id;
  const mutationToken = props.beginMutation(groupId);
  if (!mutationToken) return;
  const dialogSession = settingsDialogSession;
  isSavingSettings.value = true;
  try {
    await socialApi.updateGroup(
      props.accessToken,
      groupId,
      buildGroupSettingsRequest(title, settingsPolicy.value, settingsPassword.value),
    );
    if (dialogSession === settingsDialogSession) setSettingsOpen(false, true);
    toast({ title: 'Group settings updated', variant: 'success' });
    emit('refresh');
  } catch (error) {
    showError('Could not update group settings.', error);
  } finally {
    isSavingSettings.value = false;
    props.endMutation(groupId, mutationToken);
  }
}

async function addSelectedMembers() {
  if (!selectedCandidateIds.value.length || isAddingMembers.value) return;
  const candidateIds = [...selectedCandidateIds.value];
  const groupId = props.group.id;
  const mutationToken = props.beginMutation(groupId);
  if (!mutationToken) return;
  const dialogSession = addMembersDialogSession;
  isAddingMembers.value = true;
  try {
    const invite = usesInvitations.value;
    const results = await Promise.allSettled(
      candidateIds.map((userId) =>
        invite
          ? socialApi.inviteToGroup(props.accessToken, groupId, userId)
          : socialApi.addGroupMember(props.accessToken, groupId, userId),
      ),
    );
    const addedIds = candidateIds.filter((_, index) => results[index]?.status === 'fulfilled');
    const failed = results.filter((result) => result.status === 'rejected');
    selectedCandidateIds.value = selectedCandidateIds.value.filter((id) => !addedIds.includes(id));
    if (!failed.length) {
      if (dialogSession === addMembersDialogSession) setAddMembersOpen(false, true);
      toast({
        title: invite
          ? `${addedIds.length} ${addedIds.length === 1 ? 'invitation' : 'invitations'} sent`
          : `${addedIds.length} ${addedIds.length === 1 ? 'participant' : 'participants'} added`,
        variant: 'success',
      });
    } else {
      failed.forEach((result) => console.error('[GroupDetailsPanel] Could not add participant:', result.reason));
      toast({
        title: `${addedIds.length} ${invite ? 'invited' : 'added'}, ${failed.length} failed`,
        description: 'Failed participants remain selected. Try again.',
        variant: 'destructive',
      });
    }
  } finally {
    emit('refresh');
    isAddingMembers.value = false;
    props.endMutation(groupId, mutationToken);
  }
}

async function removeSelectedMembers() {
  if (!selectedMemberIds.value.length || isRemovingMembers.value) return;
  const memberIds = [...selectedMemberIds.value];
  const groupId = props.group.id;
  const mutationToken = props.beginMutation(groupId);
  if (!mutationToken) return;
  isRemovingMembers.value = true;
  try {
    const results = await Promise.allSettled(
      memberIds.map((userId) => socialApi.removeGroupMember(props.accessToken, groupId, userId)),
    );
    const removedIds = memberIds.filter((_, index) => results[index]?.status === 'fulfilled');
    const failed = results.filter((result) => result.status === 'rejected');
    selectedMemberIds.value = selectedMemberIds.value.filter((id) => !removedIds.includes(id));
    if (!failed.length) {
      toast({
        title: `${removedIds.length} ${removedIds.length === 1 ? 'participant' : 'participants'} removed`,
        variant: 'success',
      });
      leaveSelectionMode();
    } else {
      failed.forEach((result) => console.error('[GroupDetailsPanel] Could not remove participant:', result.reason));
      toast({
        title: `${removedIds.length} removed, ${failed.length} failed`,
        description: 'Failed participants remain selected. Try again.',
        variant: 'destructive',
      });
    }
  } finally {
    emit('refresh');
    isRemovingMembers.value = false;
    props.endMutation(groupId, mutationToken);
  }
}

async function removeMember(member: GroupMember) {
  if (!isSelectableMember(member) || isRemovingMembers.value) return;
  isSelectionMode.value = true;
  selectedMemberIds.value = [member.id];
  await removeSelectedMembers();
}

async function updateMemberRole(member: GroupMember, role: GroupMemberRole) {
  if (!canChangeMemberRole(member) || member.role === role) return;
  const groupId = props.group.id;
  const mutationToken = props.beginMutation(groupId);
  if (!mutationToken) return;
  try {
    await socialApi.updateGroupMemberRole(props.accessToken, groupId, member.id, role);
    toast({ title: `${member.name} is now ${role === 'admin' ? 'an admin' : 'a participant'}.`, variant: 'success' });
    emit('refresh');
  } catch (error) {
    showError('Could not update participant role.', error);
  } finally {
    props.endMutation(groupId, mutationToken);
  }
}

async function leaveGroup() {
  if (quitConfirmation.value.toLocaleLowerCase() !== 'quit' || isLeaving.value || isCreator.value) return;
  const groupId = props.group.id;
  const mutationToken = props.beginMutation(groupId);
  if (!mutationToken) return;
  const dialogSession = quitDialogSession;
  isLeaving.value = true;
  try {
    await socialApi.leaveGroup(props.accessToken, groupId);
    toast({ title: `You left ${props.info?.title ?? props.group.title ?? 'the group'}.`, variant: 'success' });
    if (dialogSession === quitDialogSession) setQuitOpen(false, true);
    emit('removed', groupId);
  } catch (error) {
    showError('Could not quit group.', error);
  } finally {
    isLeaving.value = false;
    props.endMutation(groupId, mutationToken);
  }
}

async function deleteGroup() {
  if (deleteConfirmation.value.toLocaleLowerCase() !== 'delete' || isDeleting.value || !canManage.value) return;
  const groupId = props.group.id;
  const mutationToken = props.beginMutation(groupId);
  if (!mutationToken) return;
  const dialogSession = deleteDialogSession;
  isDeleting.value = true;
  try {
    await socialApi.deleteGroup(props.accessToken, groupId);
    toast({ title: 'Group deleted', variant: 'success' });
    if (dialogSession === deleteDialogSession) setDeleteOpen(false, true);
    emit('removed', groupId);
  } catch (error) {
    showError('Could not delete group.', error);
  } finally {
    isDeleting.value = false;
    props.endMutation(groupId, mutationToken);
  }
}

defineExpose({
  openAddMembers: () => setAddMembersOpen(true),
  openQuitGroup: () => setQuitOpen(true),
  openRemoveGroup: () => setDeleteOpen(true),
  openSettings: () => setSettingsOpen(true),
});
</script>

<template>
  <div v-bind="attrs" class="flex h-full min-h-0 flex-col text-[#102F35]">
    <div v-if="loading" class="flex min-h-64 flex-1 items-center justify-center" aria-live="polite">
      <LoadingRipple class="size-7 text-[#0B7A75]" />
      <span class="sr-only">Loading group details</span>
    </div>
    <div
      v-else-if="error"
      class="m-4 rounded-2xl border border-[#F2C7BE] bg-[#FFF4F0] p-4 text-sm text-[#9D4636]"
      role="alert"
    >
      {{ error }}
    </div>
    <template v-else-if="info">
      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1">
        <section class="flex flex-col gap-2 py-4 text-sm" data-group-facts>
          <div class="rounded-xl border border-[#D8E7E3] bg-white p-3">
            <span class="block text-xs text-[#61777B]">Access</span
            ><strong class="mt-1 block text-xs leading-4">{{ accessLabel(info.accessPolicy) }}</strong>
          </div>
          <div class="rounded-xl border border-[#D8E7E3] bg-white p-3">
            <span class="block text-xs text-[#61777B]">Created</span
            ><strong class="mt-1 block text-xs leading-4">{{ new Date(info.createdAt).toLocaleDateString() }}</strong>
          </div>
          <div class="min-w-0 rounded-xl border border-[#D8E7E3] bg-white p-3">
            <span class="block text-xs text-[#61777B]">Group ID</span>
            <div class="mt-1 flex items-center gap-1">
              <code class="min-w-0 flex-1 truncate text-xs font-semibold">#{{ info.groupCode }}</code
              ><button
                type="button"
                class="harbor-ghost-action shrink-0 rounded-md p-1 text-[#0B7A75]"
                :aria-label="copiedGroupId ? 'Group ID copied' : 'Copy group ID'"
                :title="copiedGroupId ? 'Copied' : 'Copy group ID'"
                @click="copyGroupId"
              >
                <Check v-if="copiedGroupId" class="size-3.5" /><Copy v-else class="size-3.5" />
              </button>
            </div>
          </div>
        </section>
        <section
          :class="isSelectionMode ? 'grid-cols-3' : 'grid-cols-2'"
          class="grid gap-2 pb-4"
          aria-label="Group actions"
        >
          <DropdownMenu v-if="isSelectionMode">
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                class="harbor-ghost-action h-auto min-h-20 flex-col gap-2 rounded-2xl bg-[#EDF8F5] px-2 py-3 text-[#102F35]"
                :disabled="!selectedMemberIds.length || isRemovingMembers"
              >
                <UserMinus class="size-5" />
                <span class="text-center text-[11px] leading-4">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              class="harbor-action-menu min-w-48 rounded-2xl border-[#D8E7E3] bg-white p-2 text-[#102F35]"
            >
              <DropdownMenuItem
                class="harbor-context-menu-danger cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-[#C4513D]"
                @select="removeSelectedMembers"
              >
                <UserMinus class="size-4" /> Remove {{ selectedMemberIds.length }} from group
              </DropdownMenuItem>
              <DropdownMenuItem class="cursor-pointer rounded-xl px-3 py-2.5" @select="leaveSelectionMode">
                Cancel selection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            class="harbor-ghost-action h-auto min-h-20 flex-col gap-2 rounded-2xl bg-[#EDF8F5] px-2 py-3 text-[#102F35]"
            :disabled="!canManage || mutationBusy"
            :title="canManage ? addActionLabel : 'Only group admins can add people'"
            @click="setAddMembersOpen(true)"
          >
            <UserPlus class="size-5" />
            <span class="text-center text-[11px] leading-4">{{ addActionLabel }}</span>
          </Button>
          <Button
            variant="ghost"
            class="h-auto min-h-20 flex-col gap-2 rounded-2xl bg-[#FFF0EA] px-2 py-3 text-[#9D4636] hover:bg-[#F9DED6]"
            :disabled="isCreator || mutationBusy"
            :title="isCreator ? 'Creator must transfer ownership before quitting.' : 'Quit group'"
            @click="setQuitOpen(true)"
          >
            <LogOut class="size-5" />
            <span class="text-center text-[11px] leading-4">Quit group</span>
          </Button>
        </section>

        <section aria-labelledby="group-participants-heading">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h4 id="group-participants-heading" class="text-sm font-semibold">Participants</h4>
              <p class="text-xs text-[#61777B]">Swipe a participant, or press and hold, for actions.</p>
            </div>
          </div>
          <div class="mt-3 max-h-80 space-y-1 overflow-y-auto rounded-2xl border border-[#D8E7E3] bg-white p-1.5">
            <SwipeableRow
              v-for="member in sortedMembers"
              :id="`details-participant-${member.id}`"
              :key="member.id"
              class="rounded-xl"
              :disabled="isSelectionMode"
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
                  class="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden bg-[#E6F4F1] text-[11px] font-semibold text-[#102F35]"
                  :aria-label="`View ${member.name}'s profile`"
                  @click="
                    close();
                    emit('open-profile', member.id, member.name);
                  "
                >
                  <UserRound class="size-4 shrink-0" />Profile
                </button>
                <button
                  v-if="!isSelf(member) && !isFriend(member)"
                  type="button"
                  data-swipe-action
                  class="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden bg-[#0B7A75] text-[11px] font-semibold text-white"
                  :aria-label="`Add ${member.name} as a friend`"
                  @click="
                    close();
                    pendingFriendChange = { member, change: 'add' };
                  "
                >
                  <UserPlus class="size-4 shrink-0" /><span class="leading-tight">Add friend</span>
                </button>
                <button
                  v-if="isSelectableMember(member)"
                  type="button"
                  data-swipe-action
                  class="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden bg-[#C4513D] text-[11px] font-semibold text-white disabled:opacity-60"
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
              <ContextMenu>
                <ContextMenuTrigger as-child>
                  <button
                    type="button"
                    class="harbor-ghost-action flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left outline-none focus:outline-none [@media(hover:hover)]:focus-visible:ring-2 [@media(hover:hover)]:focus-visible:ring-inset [@media(hover:hover)]:focus-visible:ring-[#0B7A75]"
                    :class="{ 'bg-[#E6F4F1]': selectedMemberIds.includes(member.id) }"
                    :title="isSelectionMode ? undefined : 'Open profile'"
                    @click="isSelectionMode ? selectMember(member) : emit('open-profile', member.id, member.name)"
                  >
                    <span class="relative shrink-0">
                      <span
                        class="flex size-9 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] text-xs font-semibold text-[#0B7A75]"
                      >
                        <img
                          v-if="memberAvatarUrls[member.id]"
                          :src="memberAvatarUrls[member.id]"
                          alt=""
                          class="size-full object-cover"
                        />
                        <template v-else>{{ initials(member.name) }}</template>
                      </span>
                      <PresenceDot
                        surface="groupParticipants"
                        :online="member.isOnline"
                        :status="member.status"
                        class="size-3 border-2 border-white"
                      />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-semibold">{{ member.name }}</span>
                      <span class="block truncate text-xs text-[#61777B]">@{{ member.nickname }}</span>
                    </span>
                    <span
                      v-if="isFriend(member)"
                      data-friend-icon
                      role="img"
                      aria-label="Your friend"
                      title="Your friend"
                      class="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E6F4F1] text-[#0B7A75]"
                    >
                      <UserCheck class="size-3.5" />
                    </span>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent
                  class="harbor-action-menu min-w-48 rounded-2xl border-[#D8E7E3] bg-white p-2 text-[#102F35]"
                >
                  <ContextMenuItem
                    class="harbor-context-menu-item cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    @select="emit('open-profile', member.id, member.name)"
                  >
                    <UserRound class="size-4" />See profile
                  </ContextMenuItem>
                  <ContextMenuItem
                    v-if="canCallMember(member)"
                    class="harbor-context-menu-item cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    @select="emit('call-member', member)"
                  >
                    <Phone class="size-4" /> Call
                  </ContextMenuItem>
                  <ContextMenuItem
                    v-if="isSelectableMember(member)"
                    class="harbor-context-menu-danger cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-[#C4513D]"
                    :disabled="mutationBusy"
                    @select="removeMember(member)"
                  >
                    <UserMinus class="size-4" /> Remove from group
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
                  <ContextMenuItem
                    v-if="isSelectableMember(member)"
                    class="harbor-context-menu-item cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    @select="selectMember(member)"
                  >
                    Select
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </SwipeableRow>
          </div>
          <Button
            v-if="membersHasMore"
            variant="ghost"
            class="harbor-ghost-action mt-2 w-full rounded-full text-[#0B7A75]"
            :disabled="membersLoadingMore"
            @click="emit('load-more-members')"
          >
            <LoadingRipple v-if="membersLoadingMore" size="sm" />
            {{ membersLoadingMore ? 'Loading participants...' : 'Load more participants' }}
          </Button>
        </section>

        <section class="mt-5 space-y-2 border-t border-[#E5EFEC] pt-5">
          <Button
            v-if="canManage"
            variant="outline"
            class="w-full rounded-full border-[#D8E7E3] bg-white text-[#27595D] hover:bg-[#E6F4F1] hover:text-[#102F35]"
            @click="setSettingsOpen(true)"
          >
            <Settings class="size-4" /> Group settings
          </Button>
          <Button
            v-if="canManage"
            variant="ghost"
            class="w-full rounded-full bg-[#FFF0EA] text-[#9D4636] hover:bg-[#F9DED6]"
            @click="setDeleteOpen(true)"
          >
            <Trash2 class="size-4" /> Delete group
          </Button>
        </section>
      </div>
    </template>
  </div>

  <Dialog :open="isSettingsOpen" @update:open="setSettingsOpen">
    <HarborDialogContent
      class="marketing-font w-[calc(100%-2rem)] max-w-md rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-5 text-[#102F35] sm:w-full"
      overlay-class="bg-[#102F35]/30 backdrop-blur-md"
    >
      <DialogHeader
        ><DialogTitle>Group settings</DialogTitle
        ><DialogDescription class="text-[#61777B]">Update group name and access.</DialogDescription></DialogHeader
      >
      <motion.form
        layout
        :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }"
        class="space-y-4"
        @submit.prevent="saveSettings"
      >
        <div class="flex items-center gap-3 rounded-2xl border border-[#D8E7E3] bg-white p-3">
          <span
            class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#102F35] text-sm font-semibold text-white"
          >
            <img
              v-if="avatarUrl"
              :src="avatarUrl"
              :alt="`${info?.title ?? group.title} avatar`"
              class="size-full object-cover"
            />
            <span v-else>{{ initials(info?.title ?? group.title) }}</span>
          </span>
          <Button
            type="button"
            variant="outline"
            class="rounded-full border-[#D8E7E3] bg-white text-[#27595D]"
            :disabled="isUploadingAvatar || mutationBusy"
            @click="avatarInput?.click()"
          >
            <LoadingRipple v-if="isUploadingAvatar" size="sm" />
            <Camera v-else class="size-4" />
            {{ isUploadingAvatar ? 'Uploading...' : 'Change avatar' }}
          </Button>
          <input ref="avatarInput" type="file" accept="image/*" class="sr-only" @change="uploadAvatar" />
        </div>
        <div class="space-y-2">
          <Label for="settings-title">Name</Label
          ><Input
            id="settings-title"
            v-model="settingsTitle"
            maxlength="120"
            required
            class="h-11 rounded-xl border-[#D8E7E3] bg-white focus-visible:ring-0"
          />
        </div>
        <fieldset class="space-y-2">
          <legend class="text-sm font-medium">Accessibility</legend>
          <label
            v-for="policy in GROUP_ACCESS_POLICIES"
            :key="policy"
            class="flex cursor-pointer items-center gap-3 rounded-xl border border-[#D8E7E3] bg-white px-3 py-3 has-[:checked]:border-[#0B7A75] has-[:checked]:bg-[#EAF7F4]"
            ><input
              v-model="settingsPolicy"
              type="radio"
              name="settings-policy"
              :value="policy"
              class="size-4 accent-[#0B7A75]"
            /><span class="text-sm font-medium">{{ accessLabel(policy) }}</span></label
          >
        </fieldset>
        <AnimatePresence
          ><motion.div
            v-if="settingsPolicy === 'password'"
            :initial="prefersReducedMotion ? false : { opacity: 0, height: 0 }"
            :animate="{ opacity: 1, height: 'auto' }"
            :exit="prefersReducedMotion ? undefined : { opacity: 0, height: 0 }"
            class="overflow-hidden"
            ><Label for="settings-password">New password</Label
            ><Input
              id="settings-password"
              v-model="settingsPassword"
              type="password"
              autocomplete="new-password"
              placeholder="Leave blank to keep current password"
              class="mt-2 h-11 rounded-xl border-[#D8E7E3] bg-white focus-visible:ring-0" /></motion.div
        ></AnimatePresence>
        <DialogFooter
          ><Button
            type="button"
            variant="outline"
            class="rounded-full border-[#D8E7E3] bg-white"
            @click="setSettingsOpen(false)"
            >Cancel</Button
          ><Button
            type="submit"
            class="harbor-primary-action rounded-full bg-[#0B7A75] text-white"
            :disabled="isSavingSettings || !settingsTitle.trim()"
            >{{ isSavingSettings ? 'Saving...' : 'Save settings' }}</Button
          ></DialogFooter
        >
      </motion.form>
    </HarborDialogContent>
  </Dialog>

  <Dialog :open="isAddMembersOpen" @update:open="setAddMembersOpen">
    <HarborDialogContent
      class="marketing-font flex max-h-[min(42rem,calc(100dvh-3rem))] w-[calc(100%-2rem)] max-w-lg flex-col rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-5 text-[#102F35] sm:w-full"
      overlay-class="bg-[#102F35]/30 backdrop-blur-md"
    >
      <DialogHeader
        ><DialogTitle>{{ addActionLabel }}</DialogTitle
        ><DialogDescription class="text-[#61777B]">{{ addMembersDescription }}</DialogDescription></DialogHeader
      >
      <label class="relative"
        ><span class="sr-only">Search people</span
        ><Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#809697]" /><Input
          v-model="memberSearch"
          type="search"
          placeholder="Search by name, nickname, or email"
          class="h-11 rounded-xl border-[#D8E7E3] bg-white pl-10 pr-10 focus-visible:ring-0" /><button
          v-if="memberSearch"
          type="button"
          class="harbor-ghost-action absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-md p-1 text-[#61777B]"
          aria-label="Clear people search"
          @click="memberSearch = ''"
        >
          <X class="size-4" /></button
      ></label>
      <div class="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#D8E7E3] bg-white">
        <p
          v-if="!friendCandidates.length && !registeredCandidates.length && !isSearchingPeople"
          class="p-5 text-center text-sm text-[#61777B]"
        >
          No available people found.
        </p>
        <template v-if="friendCandidates.length"
          ><p
            class="sticky top-0 bg-[#F0F7F5] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#61777B]"
          >
            Accepted friends
          </p>
          <label
            v-for="friend in friendCandidates"
            :key="friend.id"
            class="flex cursor-pointer items-center gap-3 border-b border-[#E5EFEC] px-3 py-3 last:border-b-0"
            ><input
              type="checkbox"
              class="size-4 accent-[#0B7A75]"
              :checked="selectedCandidateIds.includes(friend.id)"
              @change="selectedCandidateIds = toggleId(selectedCandidateIds, friend.id)"
            /><span class="min-w-0 flex-1"
              ><span class="block truncate text-sm font-semibold">{{ friend.name }}</span
              ><span class="block truncate text-xs text-[#61777B]">{{ friend.email }}</span></span
            ></label
          ></template
        >
        <div v-if="isSearchingPeople" class="flex h-16 items-center justify-center">
          <LoadingRipple class="size-5 text-[#0B7A75]" /><span class="sr-only">Searching registered people</span>
        </div>
        <template v-else-if="registeredCandidates.length"
          ><p
            class="sticky top-0 bg-[#F0F7F5] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#61777B]"
          >
            {{ candidateSectionLabel }}
          </p>
          <label
            v-for="person in registeredCandidates"
            :key="person.id"
            class="flex cursor-pointer items-center gap-3 border-b border-[#E5EFEC] px-3 py-3 last:border-b-0"
            ><input
              type="checkbox"
              class="size-4 accent-[#0B7A75]"
              :checked="selectedCandidateIds.includes(person.id)"
              @change="selectedCandidateIds = toggleId(selectedCandidateIds, person.id)"
            /><span class="min-w-0 flex-1"
              ><span class="block truncate text-sm font-semibold">{{ person.name }}</span
              ><span class="block truncate text-xs text-[#61777B]">@{{ person.nickname }}</span></span
            ></label
          >
          <Button
            v-if="registeredNextOffset !== null"
            variant="ghost"
            class="harbor-ghost-action m-2 w-[calc(100%-1rem)] rounded-full text-[#0B7A75]"
            :disabled="isLoadingMorePeople"
            @click="loadMorePeople"
          >
            <LoadingRipple v-if="isLoadingMorePeople" size="sm" />
            {{ isLoadingMorePeople ? 'Loading people...' : 'Load more people' }}
          </Button></template
        >
      </div>
      <DialogFooter
        ><Button variant="outline" class="rounded-full border-[#D8E7E3] bg-white" @click="setAddMembersOpen(false)"
          >Cancel</Button
        ><Button
          class="harbor-primary-action rounded-full bg-[#0B7A75] mb-2 text-white"
          :disabled="!selectedCandidateIds.length || isAddingMembers"
          @click="addSelectedMembers"
          >{{
            isAddingMembers
              ? usesInvitations
                ? 'Inviting...'
                : 'Adding...'
              : `${usesInvitations ? 'Invite' : 'Add'} ${selectedCandidateIds.length || ''}`
          }}</Button
        ></DialogFooter
      >
    </HarborDialogContent>
  </Dialog>

  <Dialog :open="isQuitOpen" @update:open="setQuitOpen">
    <HarborDialogContent
      class="marketing-font w-[calc(100%-2rem)] max-w-md rounded-[1.75rem] border-[#F2C7BE] bg-[#FBFCF8] p-5 text-[#102F35] sm:w-full"
      overlay-class="bg-[#102F35]/30 backdrop-blur-md"
    >
      <DialogHeader
        ><DialogTitle>Quit group?</DialogTitle
        ><DialogDescription class="text-[#61777B]"
          >Type <strong>quit</strong> to leave. Group messages will disappear from your workspace.</DialogDescription
        ></DialogHeader
      >
      <Input
        v-model="quitConfirmation"
        autocomplete="off"
        placeholder="Type quit"
        class="h-11 rounded-xl border-[#D8E7E3] bg-white focus-visible:ring-0"
      />
      <DialogFooter
        ><Button variant="outline" class="rounded-full border-[#D8E7E3] bg-white" @click="setQuitOpen(false)"
          >Cancel</Button
        ><Button
          class="rounded-full bg-[#C4513D] text-white hover:bg-[#9D4636]"
          :disabled="quitConfirmation.toLocaleLowerCase() !== 'quit' || isLeaving"
          @click="leaveGroup"
          >{{ isLeaving ? 'Quitting...' : 'Quit group' }}</Button
        ></DialogFooter
      >
    </HarborDialogContent>
  </Dialog>

  <Dialog :open="isDeleteOpen" @update:open="setDeleteOpen">
    <HarborDialogContent
      class="marketing-font w-[calc(100%-2rem)] max-w-md rounded-[1.75rem] border-[#F2C7BE] bg-[#FBFCF8] p-5 text-[#102F35] sm:w-full"
      overlay-class="bg-[#102F35]/30 backdrop-blur-md"
    >
      <DialogHeader
        ><DialogTitle>Delete group?</DialogTitle
        ><DialogDescription class="text-[#61777B]"
          >This cannot be undone. Type <strong>delete</strong> to continue.</DialogDescription
        ></DialogHeader
      >
      <Input
        v-model="deleteConfirmation"
        autocomplete="off"
        placeholder="Type delete"
        class="h-11 rounded-xl border-[#D8E7E3] bg-white focus-visible:ring-0"
      />
      <DialogFooter
        ><Button variant="outline" class="rounded-full border-[#D8E7E3] bg-white" @click="setDeleteOpen(false)"
          >Cancel</Button
        ><Button
          class="rounded-full mb-2 bg-[#C4513D] text-white hover:bg-[#9D4636]"
          :disabled="deleteConfirmation.toLocaleLowerCase() !== 'delete' || isDeleting"
          @click="deleteGroup"
          >{{ isDeleting ? 'Deleting...' : 'Delete group' }}</Button
        ></DialogFooter
      >
    </HarborDialogContent>
  </Dialog>
  <FriendshipChangeDialog v-model:pending="pendingFriendChange" :change-friendship="changeFriendship" />
</template>
