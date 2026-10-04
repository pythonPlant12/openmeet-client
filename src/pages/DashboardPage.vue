<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { motion } from 'motion-v';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import ChatPane from '@/components/dashboard-page/chat/ChatPane.vue';
import ConversationsSidebar from '@/components/dashboard-page/conversations/ConversationsSidebar.vue';
import DetailsPane from '@/components/dashboard-page/details/DetailsPane.vue';
import ContactProfileDialog from '@/components/dashboard-page/friends/ContactProfileDialog.vue';
import FriendsSidebar from '@/components/dashboard-page/friends/FriendsSidebar.vue';
import AcceptGroupInvitationDialog from '@/components/dashboard-page/groups/AcceptGroupInvitationDialog.vue';
import CreateGroupDialog from '@/components/dashboard-page/groups/CreateGroupDialog.vue';
import GroupInfoDialog from '@/components/dashboard-page/groups/GroupInfoDialog.vue';
import JoinGroupDialog from '@/components/dashboard-page/groups/JoinGroupDialog.vue';
import { LoadingRipple } from '@/components/ui/loading';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/composables/useAuth';
import { useAvatarCache } from '@/composables/useAvatarCache';
import {
  type ConversationActivity,
  sortConversationsByActivity,
  toggledReactions,
  upsertConversationByActivity,
} from '@/pages/dashboard-chat-state';
import {
  type GroupMutationToken,
  type SidebarPanel,
  beginGroupMutation as acquireGroupMutation,
  groupAccessPolicyLabel,
  endGroupMutation as releaseGroupMutation,
  shouldApplyDashboardRequest,
  sidebarPanelAfterDrag,
} from '@/pages/dashboard-group-state';
import { getSystemNotificationPermission, requestSystemNotificationPermission } from '@/services/notifications';
import {
  type ContactProfile,
  type Conversation,
  type ConversationMessage,
  type DirectMessageRequest,
  type Friend,
  type FriendRequest,
  type GroupAccessPolicy,
  type GroupInfo,
  type GroupInvitation,
  type GroupMember,
  type MessageReaction,
  SocialApiError,
  type UserSearchResult,
  type UserStatus,
  socialApi,
} from '@/services/social-api';
import { cookieUtils } from '@/utils';

const router = useRouter();
const { accessToken, currentUser, isAuthenticated, isCheckingSession } = useAuth();
const SIDEBAR_PANEL_STORAGE_KEY = 'openmeet.dashboard.sidebar-panel';
const NOTIFICATION_WARNING_DISMISSED_KEY = 'openmeet.dashboard.notification-warning-dismissed';
const MESSAGE_PAGE_SIZE = 50;

function parseSidebarPanel(value: string | null): SidebarPanel | null {
  return value === 'messages' || value === 'friends' ? value : null;
}

function restoreSidebarPanel() {
  try {
    return (
      parseSidebarPanel(localStorage.getItem(SIDEBAR_PANEL_STORAGE_KEY)) ??
      parseSidebarPanel(cookieUtils.get(SIDEBAR_PANEL_STORAGE_KEY))
    );
  } catch {
    return parseSidebarPanel(cookieUtils.get(SIDEBAR_PANEL_STORAGE_KEY));
  }
}

function readDismissedNotificationPermission() {
  try {
    return localStorage.getItem(NOTIFICATION_WARNING_DISMISSED_KEY);
  } catch {
    return null;
  }
}

function dismissNotificationWarning() {
  dismissedNotificationPermission.value = notificationPermission.value;
  try {
    localStorage.setItem(NOTIFICATION_WARNING_DISMISSED_KEY, notificationPermission.value);
  } catch {
    // Without storage the warning stays dismissed for this visit only.
  }
}

function persistSidebarPanel(panel: SidebarPanel | null) {
  const value = panel ?? 'none';
  try {
    localStorage.setItem(SIDEBAR_PANEL_STORAGE_KEY, value);
  } catch {
    // Cookie persistence keeps the workspace preference when local storage is unavailable.
  }
  cookieUtils.set(SIDEBAR_PANEL_STORAGE_KEY, value, 180);
}

const conversations = ref<Conversation[]>([]);
const friends = ref<Friend[]>([]);
const friendAvatarUrls = ref<Record<string, string>>({});
const groupAvatarUrls = ref<Record<string, string>>({});
const loadingFriendAvatarIds = ref(new Set<string>());
const loadingGroupAvatarIds = ref(new Set<string>());
const incomingFriendRequests = ref<FriendRequest[]>([]);
const directRequests = ref<DirectMessageRequest[]>([]);
const groupInvitations = ref<GroupInvitation[]>([]);
const activeGroupInvitation = ref<GroupInvitation | null>(null);
const searchQuery = ref('');
const isConversationSearchOpen = ref(false);
const peopleSearchQuery = ref('');
const isPeopleSearchOpen = ref(false);
const peopleSearchResults = ref<UserSearchResult[]>([]);
const isSearchingUsers = ref(false);
const selectedConversation = ref<Conversation | null>(null);
const pendingDirectFriend = ref<Friend | null>(null);
const isLoading = ref(true);
const isRefreshingConversations = ref(false);
const isRefreshingFriends = ref(false);
const isOpeningDirect = ref<string | null>(null);
const isAddingFriend = ref(false);
const isRemovingFriend = ref<string | null>(null);
const isDeletingConversation = ref<string | null>(null);
const isLeavingGroup = ref<string | null>(null);
const isRespondingToFriendRequest = ref<string | null>(null);
const isCreatingGroup = ref(false);
const startingCallConversationId = ref<string | null>(null);
const expandedSidebarPanel = ref<SidebarPanel | null>(restoreSidebarPanel());
const activeContextMenuId = ref<string | null>(null);
const contextMenuResets = ref<Record<string, number>>({});
const isGroupDialogOpen = ref(false);
const isJoinGroupDialogOpen = ref(false);
const isGroupProfileDialogOpen = ref(false);
const isContactProfileDialogOpen = ref(false);
const isContactRemoveConfirmationOpen = ref(false);
const contactProfile = ref<ContactProfile | null>(null);
const isContactProfileLoading = ref(false);
const contactProfileError = ref('');
const groupInfo = ref<GroupInfo | null>(null);
const groupMembers = ref<GroupMember[]>([]);
const groupMembersNextOffset = ref<number | null>(null);
const isLoadingMoreGroupMembers = ref(false);
const memberAvatarCache = useAvatarCache((path) => socialApi.loadAvatar(accessToken.value ?? '', path));
// Friends' avatars are already loaded, so only other participants need a separate fetch.
const groupMemberAvatarUrls = computed(() =>
  Object.fromEntries(
    groupMembers.value.flatMap((member) => {
      const url =
        friendAvatarUrls.value[member.id] ?? (member.avatarUrl ? memberAvatarCache.urls.value[member.avatarUrl] : '');
      return url ? [[member.id, url]] : [];
    }),
  ),
);
const activeGroupMutations = reactive(new Map<string, GroupMutationToken>());
const isGroupProfileLoading = ref(false);
const groupProfileError = ref('');
const messages = ref<ConversationMessage[]>([]);
const messageContent = ref('');
const messageReplyTo = ref<ConversationMessage | null>(null);
const nextMessageBefore = ref<number | null>(null);
const chatPane = ref<{
  focusComposer: () => void;
  getScrollState: () => { height: number; top: number } | null;
  restoreScroll: (state: { height: number; top: number } | null) => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
} | null>(null);
const detailsPane = ref<{
  openAddMembers: () => void;
  openQuitGroup: () => void;
  openRemoveGroup: () => void;
  openSettings: () => void;
} | null>(null);
const conversationActivity = ref<Record<string, ConversationActivity>>({});
const animatedMessageSequences = ref(new Set<number>());
const isLoadingMessages = ref(false);
const isLoadingOlderMessages = ref(false);
const isSendingMessage = ref(false);
const groupTitle = ref('');
const groupPolicy = ref<GroupAccessPolicy>('open');
const groupPassword = ref('');
const groupMemberSearch = ref('');
const groupMemberIds = ref<string[]>([]);
const joinGroupCode = ref('');
const joinGroupPassword = ref('');
const joinGroupPreview = ref<GroupInfo | null>(null);
const isPreviewingGroup = ref(false);
const isJoiningGroup = ref(false);
const joinGroupError = ref('');
const feedbackError = ref('');
const feedbackMessage = ref('');
const notificationPermission = ref(getSystemNotificationPermission());
// Stores the permission state the user dismissed, so the warning returns if that state changes.
const dismissedNotificationPermission = ref(readDismissedNotificationPermission());
let hasStartedDashboard = false;
let friendSearchRequest = 0;
let peopleSearchTimer: number | undefined;
let friendRefreshRequest = 0;
let friendRefreshPending = false;
let conversationRefreshRequest = 0;
let conversationRefreshPending = false;
let conversationRefreshPromise: Promise<void> | null = null;
let friendAvatarRequest = 0;
let groupAvatarRequest = 0;
let groupAvatarSources: Record<string, string> = {};
let contactProfileRequest = 0;
let groupProfileRequest = 0;
let groupProfilePromise: { groupId: string; promise: Promise<void> } | null = null;
let messageRequest = 0;
let joinGroupPreviewRequest = 0;
let callLaunchRequest = 0;
let isUnmounted = false;
let panelWheelLocked = false;
let panelWheelTimer: number | undefined;

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const isDesktop = useMediaQuery('(min-width: 1024px)');
const showNotificationPermissionWarning = computed(
  () =>
    (notificationPermission.value === 'default' || notificationPermission.value === 'denied') &&
    dismissedNotificationPermission.value !== notificationPermission.value,
);
const canRequestNotificationPermission = computed(() => notificationPermission.value === 'default');

const friendById = computed(() => new Map(friends.value.map((friend) => [friend.id, friend])));
const filteredConversations = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  if (!query) return conversations.value;

  return conversations.value.filter((conversation) =>
    conversationName(conversation).toLocaleLowerCase().includes(query),
  );
});
const filteredFriends = computed(() => {
  const query = peopleSearchQuery.value.trim().toLocaleLowerCase();

  return [...friends.value]
    .sort((first, second) => first.name.localeCompare(second.name))
    .filter(
      (friend) =>
        !query || friend.name.toLocaleLowerCase().includes(query) || friend.email.toLocaleLowerCase().includes(query),
    );
});
const isPeopleSearchActive = computed(() => isPeopleSearchOpen.value && !!peopleSearchQuery.value.trim());
const newPeopleSearchResults = computed(() => peopleSearchResults.value.filter((result) => !isExistingFriend(result)));
const peopleResultAvatarUrls = computed(() =>
  Object.fromEntries(
    newPeopleSearchResults.value.flatMap((result) => {
      const url = result.avatarUrl ? memberAvatarCache.urls.value[result.avatarUrl] : undefined;
      return url ? [[result.id, url]] : [];
    }),
  ),
);
// Statuses are only visible between friends, so the friends list is the live source for participants too.
const groupMembersWithPresence = computed(() =>
  groupMembers.value.map((member) => {
    const friend = friendById.value.get(member.id);
    return friend ? { ...member, isOnline: friend.isOnline, status: friend.status ?? member.status } : member;
  }),
);
const visibleFriends = computed(() =>
  expandedSidebarPanel.value === 'friends' ? filteredFriends.value : filteredFriends.value.slice(0, 5),
);
const selectedFriend = computed(() => {
  if (pendingDirectFriend.value) return pendingDirectFriend.value;
  if (selectedConversation.value?.kind !== 'direct') return null;
  return friendById.value.get(selectedConversation.value.otherUserId ?? '') ?? null;
});
const selectedTitle = computed(() => {
  if (pendingDirectFriend.value) return pendingDirectFriend.value.name;
  return selectedConversation.value ? conversationName(selectedConversation.value) : 'Conversation';
});
const selectedIsGroup = computed(() => selectedConversation.value?.kind === 'group');
const selectedGroupAvatarUrl = computed(() =>
  selectedConversation.value ? groupAvatarUrls.value[selectedConversation.value.id] : undefined,
);
const hasSelectedConversation = computed(() => !!selectedConversation.value || !!pendingDirectFriend.value);
const contactProfileFriend = computed(() =>
  contactProfile.value
    ? friends.value.find((friend) => friend.id === contactProfile.value?.id && friend.friendshipId)
    : null,
);
const isCallLaunchActive = computed(() => startingCallConversationId.value !== null);

function beginGroupMutation(groupId: string) {
  return acquireGroupMutation(activeGroupMutations, groupId);
}

function endGroupMutation(groupId: string, token: GroupMutationToken) {
  releaseGroupMutation(activeGroupMutations, groupId, token);
}

function isGroupMutationBusy(groupId: string) {
  return activeGroupMutations.has(groupId);
}

function isFriendAvatarLoading(userId: string) {
  return loadingFriendAvatarIds.value.has(userId);
}

function isGroupAvatarLoading(groupId: string) {
  return loadingGroupAvatarIds.value.has(groupId);
}

function conversationName(conversation: Conversation) {
  if (conversation.kind === 'group') return conversation.title?.trim() || 'Untitled group';
  return friendById.value.get(conversation.otherUserId ?? '')?.name || 'Direct conversation';
}

function conversationIdentifier(conversation: Conversation) {
  if (conversation.kind === 'group') {
    return conversation.groupCode ? `#${conversation.groupCode}` : conversationName(conversation);
  }

  const nickname = friendById.value.get(conversation.otherUserId ?? '')?.nickname;
  return nickname ? `@${nickname}` : conversationName(conversation);
}

function userInitials(name?: string | null) {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

function formatProfileDate(value: string | null) {
  if (!value) return 'No activity recorded';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function clearFeedback() {
  feedbackError.value = '';
  feedbackMessage.value = '';
}

async function requestNotificationPermission() {
  notificationPermission.value = await requestSystemNotificationPermission();
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function isLocalMessage(message: ConversationMessage) {
  return message.senderId === currentUser.value?.id;
}

function messageTimestamp(message: ConversationMessage) {
  const timestamp = Date.parse(message.createdAt);
  return Number.isNaN(timestamp) ? Date.now() : timestamp;
}

function updateConversationActivity(message: ConversationMessage) {
  const existing = conversationActivity.value[message.conversationId];
  const isVisible = selectedConversation.value?.id === message.conversationId;
  const unreadCount = isLocalMessage(message) || isVisible ? 0 : (existing?.unreadCount ?? 0) + 1;

  conversationActivity.value = {
    ...conversationActivity.value,
    [message.conversationId]: {
      lastActivityAt: messageTimestamp(message),
      unreadCount,
    },
  };
  conversations.value = sortConversationsByActivity(conversations.value, conversationActivity.value);
}

function markConversationRead(conversationId: string) {
  conversations.value = conversations.value.map((conversation) =>
    conversation.id === conversationId ? { ...conversation, unreadCount: 0, markedUnread: false } : conversation,
  );
  const activity = conversationActivity.value[conversationId];
  if (!activity?.unreadCount) return;

  conversationActivity.value = {
    ...conversationActivity.value,
    [conversationId]: { ...activity, unreadCount: 0 },
  };
}

function unreadCount(conversation: Conversation) {
  return conversation.unreadCount + (conversationActivity.value[conversation.id]?.unreadCount ?? 0);
}

function appendMessage(message: ConversationMessage) {
  if (messages.value.some((item) => item.sequence === message.sequence)) return;
  animatedMessageSequences.value = new Set([...animatedMessageSequences.value, message.sequence]);
  messages.value = [...messages.value, message];
  updateConversationActivity(message);
}

function shouldAnimateMessage(message: ConversationMessage) {
  return animatedMessageSequences.value.has(message.sequence);
}

async function loadLatestMessages(conversationId: string) {
  const token = accessToken.value;
  if (!token) return;

  const request = ++messageRequest;
  isLoadingMessages.value = true;
  try {
    const response = await socialApi.listConversationMessages(token, conversationId, undefined, MESSAGE_PAGE_SIZE);
    if (request !== messageRequest || selectedConversation.value?.id !== conversationId) return;

    const previousMessages = messages.value;
    const previousSequences = new Set(previousMessages.map((message) => message.sequence));
    const latestMessages = response.messages.slice().reverse();
    const newMessages = latestMessages.filter((message) => !previousSequences.has(message.sequence));
    const mergedMessages = new Map(previousMessages.map((message) => [message.sequence, message]));
    latestMessages.forEach((message) => mergedMessages.set(message.sequence, message));
    messages.value = [...mergedMessages.values()].sort((left, right) => left.sequence - right.sequence);
    if (previousMessages.length && newMessages.length) {
      animatedMessageSequences.value = new Set([
        ...animatedMessageSequences.value,
        ...newMessages.map((message) => message.sequence),
      ]);
    } else if (!previousMessages.length) {
      animatedMessageSequences.value = new Set();
    }
    nextMessageBefore.value = response.nextBefore;
    await nextTick();
    if (!previousMessages.length) chatPane.value?.scrollToBottom('auto');
    else if (newMessages.length) chatPane.value?.scrollToBottom('smooth');
  } catch (error) {
    console.error('[Dashboard] Failed to load messages:', error);
    if (request === messageRequest && selectedConversation.value?.id === conversationId) {
      feedbackError.value = 'Could not load messages. Try again.';
    }
  } finally {
    if (request === messageRequest) isLoadingMessages.value = false;
  }
}

async function loadOlderMessages() {
  const conversationId = selectedConversation.value?.id;
  const token = accessToken.value;
  const before = nextMessageBefore.value;
  const pane = chatPane.value;
  if (
    !conversationId ||
    !token ||
    before === null ||
    !pane ||
    isLoadingMessages.value ||
    isLoadingOlderMessages.value
  ) {
    return;
  }

  const request = ++messageRequest;
  const scrollState = pane.getScrollState();
  isLoadingOlderMessages.value = true;
  try {
    const response = await socialApi.listConversationMessages(token, conversationId, before, MESSAGE_PAGE_SIZE);
    if (request !== messageRequest || selectedConversation.value?.id !== conversationId) return;

    const existingSequences = new Set(messages.value.map((message) => message.sequence));
    const olderMessages = response.messages
      .slice()
      .reverse()
      .filter((message) => !existingSequences.has(message.sequence));
    messages.value = [...olderMessages, ...messages.value];
    nextMessageBefore.value = response.nextBefore;
    isLoadingOlderMessages.value = false;
    await nextTick();
    pane.restoreScroll(scrollState);
  } catch (error) {
    console.error('[Dashboard] Failed to load older messages:', error);
    if (request === messageRequest && selectedConversation.value?.id === conversationId) {
      feedbackError.value = 'Could not load older messages. Try again.';
    }
  } finally {
    if (request === messageRequest) isLoadingOlderMessages.value = false;
  }
}

function handleMessageScroll() {
  void loadOlderMessages();
}

async function sendMessage() {
  const conversationId = selectedConversation.value?.id;
  const token = accessToken.value;
  const content = messageContent.value.trim();
  if (!conversationId || !token || !content || isLoadingMessages.value || isSendingMessage.value) return;

  clearFeedback();
  isSendingMessage.value = true;
  try {
    const replyToSequence = messageReplyTo.value?.sequence;
    const message = await socialApi.createConversationMessage(token, conversationId, content, replyToSequence);
    if (selectedConversation.value?.id !== conversationId) return;

    appendMessage(message);
    if (selectedConversation.value?.id === conversationId) addConversation(selectedConversation.value);
    messageContent.value = '';
    messageReplyTo.value = null;
    await nextTick();
    chatPane.value?.scrollToBottom('smooth');
  } catch (error) {
    console.error('[Dashboard] Failed to send message:', error);
    feedbackError.value = 'Could not send message. Try again.';
  } finally {
    isSendingMessage.value = false;
  }
}

// Reactions update optimistically; the server's summary replaces the guess, and a failure restores it.
async function toggleMessageReaction(message: ConversationMessage, emoji: string) {
  const token = accessToken.value;
  if (!token) return;
  const conversationId = message.conversationId;
  const previous = message.reactions ?? [];
  setMessageReactions(message.sequence, toggledReactions(previous, emoji));
  try {
    const reactions = await socialApi.toggleMessageReaction(token, conversationId, message.sequence, emoji);
    if (selectedConversation.value?.id === conversationId) setMessageReactions(message.sequence, reactions);
  } catch (error) {
    console.error('[Dashboard] Failed to update reaction:', error);
    if (selectedConversation.value?.id === conversationId) setMessageReactions(message.sequence, previous);
    toast({ title: 'Could not update the reaction.', variant: 'destructive' });
  }
}

function setMessageReactions(sequence: number, reactions: MessageReaction[]) {
  messages.value = messages.value.map((message) =>
    message.sequence === sequence ? { ...message, reactions } : message,
  );
}

function addConversation(conversation: Conversation) {
  conversations.value = upsertConversationByActivity(conversations.value, conversation, conversationActivity.value);
}

function excludeUnsentDirectDrafts(conversationData: Conversation[]) {
  return conversationData.filter((conversation) => conversation.kind !== 'direct' || conversation.messageCount > 0);
}

async function syncFriendAvatars(nextFriends: Friend[], token: string) {
  const request = ++friendAvatarRequest;
  loadingFriendAvatarIds.value = new Set(nextFriends.filter((friend) => !!friend.avatarUrl).map((friend) => friend.id));
  const entries = await Promise.all(
    nextFriends.map(async (friend) => {
      if (!friend.avatarUrl) return null;
      try {
        return [friend.id, await socialApi.loadAvatar(token, friend.avatarUrl)] as const;
      } catch (error) {
        console.error(`[Dashboard] Failed to load avatar for ${friend.id}:`, error);
        return null;
      }
    }),
  );
  if (!shouldApplyDashboardRequest(request, friendAvatarRequest, isUnmounted)) return;

  const loadedEntries = entries.filter((entry): entry is readonly [string, Blob] => entry !== null);
  const createdUrls: string[] = [];
  let installed = false;
  try {
    const nextAvatarUrls: Record<string, string> = {};
    for (const [id, avatar] of loadedEntries) {
      const objectUrl = URL.createObjectURL(avatar);
      createdUrls.push(objectUrl);
      nextAvatarUrls[id] = objectUrl;
    }
    if (!shouldApplyDashboardRequest(request, friendAvatarRequest, isUnmounted)) return;
    Object.values(friendAvatarUrls.value).forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    friendAvatarUrls.value = nextAvatarUrls;
    installed = true;
  } finally {
    if (!installed) createdUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    if (request === friendAvatarRequest && !isUnmounted) loadingFriendAvatarIds.value = new Set();
  }
}

async function syncGroupAvatars(nextConversations: Conversation[], token: string) {
  const request = ++groupAvatarRequest;
  const groups = nextConversations.filter(
    (conversation): conversation is Conversation & { avatarUrl: string } =>
      conversation.kind === 'group' && !!conversation.avatarUrl,
  );
  loadingGroupAvatarIds.value = new Set(
    groups
      .filter((group) => groupAvatarSources[group.id] !== group.avatarUrl || !groupAvatarUrls.value[group.id])
      .map((group) => group.id),
  );
  const entries = await Promise.all(
    groups.map(async (group) => {
      if (groupAvatarSources[group.id] === group.avatarUrl && groupAvatarUrls.value[group.id]) {
        return { id: group.id, source: group.avatarUrl, objectUrl: groupAvatarUrls.value[group.id], avatar: null };
      }
      try {
        return {
          id: group.id,
          source: group.avatarUrl,
          objectUrl: null,
          avatar: await socialApi.loadAvatar(token, group.avatarUrl),
        };
      } catch (error) {
        console.error(`[Dashboard] Failed to load group avatar for ${group.id}:`, error);
        return null;
      }
    }),
  );
  if (!shouldApplyDashboardRequest(request, groupAvatarRequest, isUnmounted)) return;

  const loadedEntries = entries.filter((entry): entry is NonNullable<(typeof entries)[number]> => entry !== null);
  const createdUrls: string[] = [];
  let installed = false;
  try {
    const nextUrls: Record<string, string> = {};
    const nextSources: Record<string, string> = {};
    for (const entry of loadedEntries) {
      const objectUrl = entry.objectUrl ?? URL.createObjectURL(entry.avatar!);
      if (!entry.objectUrl) createdUrls.push(objectUrl);
      nextUrls[entry.id] = objectUrl;
      nextSources[entry.id] = entry.source;
    }
    if (!shouldApplyDashboardRequest(request, groupAvatarRequest, isUnmounted)) return;
    Object.entries(groupAvatarUrls.value).forEach(([id, objectUrl]) => {
      if (nextUrls[id] !== objectUrl) URL.revokeObjectURL(objectUrl);
    });
    groupAvatarUrls.value = nextUrls;
    groupAvatarSources = nextSources;
    installed = true;
  } finally {
    if (!installed) createdUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    if (request === groupAvatarRequest && !isUnmounted) loadingGroupAvatarIds.value = new Set();
  }
}

async function syncSelectedGroupAvatar(info: GroupInfo) {
  const token = accessToken.value;
  const group = selectedConversation.value;
  if (!token || !group || group.kind !== 'group') return;
  group.avatarUrl = info.avatarUrl;
  await syncGroupAvatars(
    conversations.value.map((item) => (item.id === group.id ? group : item)),
    token,
  );
}

async function loadWorkspace() {
  const token = accessToken.value;
  if (!token) return;
  const friendRequest = ++friendRefreshRequest;
  const conversationRequest = ++conversationRefreshRequest;

  try {
    const [friendData, conversationData, requestData, invitationData] = await Promise.all([
      socialApi.listFriends(token),
      socialApi.listConversations(token),
      socialApi.listDirectRequests(token),
      loadGroupInvitations(token),
    ]);
    let applied = false;
    if (shouldApplyDashboardRequest(friendRequest, friendRefreshRequest, isUnmounted)) {
      friends.value = friendData.friends;
      void syncFriendAvatars(friendData.friends, token);
      incomingFriendRequests.value = friendData.incomingRequests;
      applied = true;
    }
    if (shouldApplyDashboardRequest(conversationRequest, conversationRefreshRequest, isUnmounted)) {
      conversations.value = sortConversationsByActivity(
        excludeUnsentDirectDrafts(conversationData),
        conversationActivity.value,
      );
      void syncGroupAvatars(conversationData, token);
      directRequests.value = requestData;
      if (invitationData) groupInvitations.value = invitationData;
      applied = true;
    }
    if (applied) clearFeedback();
  } catch (error) {
    if (
      !shouldApplyDashboardRequest(friendRequest, friendRefreshRequest, isUnmounted) &&
      !shouldApplyDashboardRequest(conversationRequest, conversationRefreshRequest, isUnmounted)
    )
      return;
    console.error('[Dashboard] Failed to load conversation workspace:', error);
    feedbackError.value = 'Could not load conversations. Try refreshing this page.';
  } finally {
    if (!isUnmounted) isLoading.value = false;
  }
}

async function refreshFriends() {
  const token = accessToken.value;
  if (!token) return;
  if (isRefreshingFriends.value) {
    friendRefreshPending = true;
    return;
  }

  const request = ++friendRefreshRequest;
  isRefreshingFriends.value = true;
  try {
    const friendData = await socialApi.listFriends(token);
    if (!shouldApplyDashboardRequest(request, friendRefreshRequest, isUnmounted)) return;
    friends.value = friendData.friends;
    void syncFriendAvatars(friendData.friends, token);
    incomingFriendRequests.value = friendData.incomingRequests;
  } catch (error) {
    if (isUnmounted) return;
    console.error('[Dashboard] Failed to refresh friends:', error);
  } finally {
    if (shouldApplyDashboardRequest(request, friendRefreshRequest, isUnmounted)) {
      isRefreshingFriends.value = false;
      if (friendRefreshPending) {
        friendRefreshPending = false;
        void refreshFriends();
      }
    }
  }
}

async function refreshConversationWorkspace() {
  const token = accessToken.value;
  if (!token) return;
  if (conversationRefreshPromise) {
    conversationRefreshPending = true;
    return conversationRefreshPromise;
  }

  isRefreshingConversations.value = true;
  conversationRefreshPromise = (async () => {
    do {
      conversationRefreshPending = false;
      const request = ++conversationRefreshRequest;
      try {
        const [conversationData, requestData, invitationData] = await Promise.all([
          socialApi.listConversations(token),
          socialApi.listDirectRequests(token),
          loadGroupInvitations(token),
        ]);
        if (!shouldApplyDashboardRequest(request, conversationRefreshRequest, isUnmounted)) continue;
        const nextConversations = excludeUnsentDirectDrafts(conversationData);
        conversations.value = sortConversationsByActivity(nextConversations, conversationActivity.value);
        void syncGroupAvatars(conversationData, token);
        directRequests.value = requestData;
        if (invitationData) groupInvitations.value = invitationData;

        if (selectedConversation.value) {
          const selectedId = selectedConversation.value.id;
          const refreshedConversation = conversationData.find((conversation) => conversation.id === selectedId);
          if (refreshedConversation) {
            Object.assign(selectedConversation.value, refreshedConversation);
            await loadLatestMessages(selectedId);
          } else {
            selectedConversation.value = null;
          }
        }
      } catch (error) {
        if (isUnmounted) return;
        console.error('[Dashboard] Failed to refresh conversations:', error);
      }
    } while (conversationRefreshPending);
  })().finally(() => {
    if (!isUnmounted) isRefreshingConversations.value = false;
    conversationRefreshPromise = null;
  });
  return conversationRefreshPromise;
}

function invalidateConversationRefresh() {
  conversationRefreshRequest += 1;
  if (conversationRefreshPromise) conversationRefreshPending = true;
}

function startDashboard() {
  if (hasStartedDashboard || !accessToken.value) return;
  hasStartedDashboard = true;
  void loadWorkspace();
}

watch(
  [isCheckingSession, isAuthenticated, accessToken],
  ([checking, authenticated]) => {
    if (!checking && !authenticated) {
      void router.replace('/login');
      return;
    }
    if (authenticated) startDashboard();
  },
  { immediate: true },
);

watch(peopleSearchQuery, (query, _, onCleanup) => {
  const normalizedQuery = query.trim();
  const request = ++friendSearchRequest;

  if (normalizedQuery.replace(/\s/g, '').length < 2) {
    peopleSearchResults.value = [];
    isSearchingUsers.value = false;
    return;
  }

  const token = accessToken.value;
  if (!token) return;

  isSearchingUsers.value = true;
  peopleSearchTimer = window.setTimeout(async () => {
    try {
      const results = await socialApi.searchUsers(token, normalizedQuery);
      if (request === friendSearchRequest) peopleSearchResults.value = results;
    } catch (error) {
      console.error('[Dashboard] Failed to find users:', error);
      if (request === friendSearchRequest) {
        peopleSearchResults.value = [];
        feedbackError.value = 'Could not search registered accounts.';
      }
    } finally {
      if (request === friendSearchRequest) isSearchingUsers.value = false;
    }
  }, 500);
  onCleanup(() => {
    if (peopleSearchTimer) window.clearTimeout(peopleSearchTimer);
  });
});

watch([feedbackError, feedbackMessage], ([error, message]) => {
  if (!error && !message) return;

  if (error) toast({ title: error, variant: 'destructive' });
  else toast({ title: message, variant: 'success' });
  clearFeedback();
});

watch(isDesktop, (desktop) => {
  if (desktop) isGroupProfileDialogOpen.value = false;
});

watch(expandedSidebarPanel, persistSidebarPanel);

watch(selectedConversation, (conversation, previousConversation) => {
  if (conversation?.kind !== 'group') isGroupProfileDialogOpen.value = false;
  if (conversation?.id === previousConversation?.id) return;
  messageRequest += 1;
  messages.value = [];
  animatedMessageSequences.value = new Set();
  messageContent.value = '';
  nextMessageBefore.value = null;
  isLoadingMessages.value = false;
  isLoadingOlderMessages.value = false;

  if (conversation) {
    markConversationRead(conversation.id);
    void loadLatestMessages(conversation.id);
  }

  if (conversation?.kind === 'group') void loadGroupProfile(conversation);
  else {
    groupProfileRequest += 1;
    groupProfilePromise = null;
    groupInfo.value = null;
    groupMembers.value = [];
    groupMembersNextOffset.value = null;
    groupProfileError.value = '';
    isGroupProfileLoading.value = false;
  }
});

// Profiles open from group participant lists too, so the avatar may belong to a non-friend or to the current user.
const contactProfileAvatarUrls = computed<Record<string, string>>(() => {
  const profile = contactProfile.value;
  if (!profile) return {};
  const url =
    friendAvatarUrls.value[profile.id] ?? (profile.avatarUrl ? memberAvatarCache.urls.value[profile.avatarUrl] : '');
  return url ? { [profile.id]: url } : {};
});
const isContactProfileAvatarLoading = computed(() => {
  const profile = contactProfile.value;
  if (!profile) return false;
  return isFriendAvatarLoading(profile.id) || (!!profile.avatarUrl && memberAvatarCache.isLoading(profile.avatarUrl));
});

watch(contactProfile, (profile) => {
  if (profile?.avatarUrl && !friendAvatarUrls.value[profile.id]) void memberAvatarCache.ensure([profile.avatarUrl]);
});

watch(newPeopleSearchResults, (results) => {
  void memberAvatarCache.ensure(results.flatMap((result) => (result.avatarUrl ? [result.avatarUrl] : [])));
});

watch(groupMembers, (members) => {
  void memberAvatarCache.ensure(
    members.flatMap((member) => (member.avatarUrl && !friendAvatarUrls.value[member.id] ? [member.avatarUrl] : [])),
  );
});

function selectConversation(conversation: Conversation) {
  if (selectedConversation.value?.id !== conversation.id) messageReplyTo.value = null;
  pendingDirectFriend.value = null;
  selectedConversation.value = conversation;
  markConversationRead(conversation.id);
  clearFeedback();
}

function setContactProfileDialogOpen(open: boolean) {
  if (!open && isRemovingFriend.value) return;
  isContactProfileDialogOpen.value = open;
  if (!open) {
    contactProfileRequest += 1;
    isContactRemoveConfirmationOpen.value = false;
  }
}

function setContactRemoveConfirmationOpen(open: boolean) {
  if (!open && isRemovingFriend.value) return;
  isContactRemoveConfirmationOpen.value = open;
}

function setGroupProfileDialogOpen(open: boolean) {
  isGroupProfileDialogOpen.value = open;
}

// Management dialogs stack above Group info, so cancelling one returns to it. Group info closes only
// when the action removes the group (see handleGroupRemoved).
function openGroupManagement(action: 'add-members' | 'quit-group' | 'remove-group' | 'settings') {
  if (action === 'add-members') detailsPane.value?.openAddMembers();
  else if (action === 'quit-group') detailsPane.value?.openQuitGroup();
  else if (action === 'settings') detailsPane.value?.openSettings();
  else detailsPane.value?.openRemoveGroup();
}

function profileFallback(userId: string, name: string): ContactProfile {
  const member = groupMembers.value.find(({ id }) => id === userId);
  const isFriend = friendById.value.has(userId);
  return {
    id: userId,
    name,
    nickname: member?.nickname ?? '',
    email: '',
    avatarUrl: member?.avatarUrl ?? null,
    status: 'offline',
    statusMessage: '',
    createdAt: '',
    lastSeenAt: null,
    isOnline: false,
    relationship: userId === currentUser.value?.id ? 'owner' : isFriend ? 'friend' : 'none',
  };
}

function openContactProfile(userId?: string, name?: string) {
  const token = accessToken.value;
  const friend = selectedFriend.value;
  const profileUserId = userId ?? friend?.id;
  const profileName = name ?? friend?.name;
  if (!token || !profileUserId || !profileName || isRemovingFriend.value || (pendingDirectFriend.value && !userId))
    return;

  const request = ++contactProfileRequest;
  isContactRemoveConfirmationOpen.value = false;
  isContactProfileDialogOpen.value = true;
  contactProfile.value = profileFallback(profileUserId, profileName);
  contactProfileError.value = '';
  isContactProfileLoading.value = true;

  void socialApi
    .getUserProfile(token, profileUserId)
    .then((profile) => {
      if (shouldApplyDashboardRequest(request, contactProfileRequest, isUnmounted)) contactProfile.value = profile;
    })
    .catch((error) => {
      console.error('[Dashboard] Failed to load contact profile:', error);
      if (shouldApplyDashboardRequest(request, contactProfileRequest, isUnmounted)) {
        contactProfileError.value = 'Live profile details are unavailable. Showing available member details.';
      }
    })
    .finally(() => {
      if (shouldApplyDashboardRequest(request, contactProfileRequest, isUnmounted)) {
        isContactProfileLoading.value = false;
      }
    });
}

function openSelectedContactProfile() {
  openContactProfile();
}

function loadGroupProfile(conversation?: Conversation) {
  const token = accessToken.value;
  const group = conversation ?? selectedConversation.value;
  if (!token || !group || group.kind !== 'group') return;
  if (groupProfilePromise?.groupId === group.id) return groupProfilePromise.promise;

  const request = ++groupProfileRequest;
  // Refreshing the open group keeps its details on screen; clearing them would flash a spinner and
  // resize the Group info dialog.
  if (groupInfo.value?.id !== group.id) {
    groupInfo.value = null;
    groupMembers.value = [];
    groupMembersNextOffset.value = null;
    isGroupProfileLoading.value = true;
  }
  groupProfileError.value = '';

  const promise = Promise.all([socialApi.getGroupInfo(token, group.id), socialApi.listGroupMembers(token, group.id)])
    .then(([info, page]) => {
      if (!shouldApplyDashboardRequest(request, groupProfileRequest, isUnmounted)) return;
      groupInfo.value = info;
      groupMembers.value = page.members;
      groupMembersNextOffset.value = page.nextOffset;
      void syncSelectedGroupAvatar(info);
    })
    .catch((error) => {
      if (isUnmounted) return;
      console.error('[Dashboard] Failed to load group profile:', error);
      if (shouldApplyDashboardRequest(request, groupProfileRequest, isUnmounted)) {
        groupProfileError.value = 'Could not load group details. Try again.';
      }
    })
    .finally(() => {
      if (shouldApplyDashboardRequest(request, groupProfileRequest, isUnmounted)) {
        isGroupProfileLoading.value = false;
      }
      if (groupProfilePromise?.promise === promise) groupProfilePromise = null;
    });
  groupProfilePromise = { groupId: group.id, promise };
  return promise;
}

function openGroupProfile(conversation?: Conversation) {
  const group = conversation ?? selectedConversation.value;
  if (!group || group.kind !== 'group') return;
  if (selectedConversation.value?.id !== group.id) selectConversation(group);
  else if (!groupInfo.value && !isGroupProfileLoading.value) loadGroupProfile(group);
  isGroupProfileDialogOpen.value = true;
}

async function loadMoreGroupMembers() {
  const token = accessToken.value;
  const group = selectedConversation.value;
  const offset = groupMembersNextOffset.value;
  if (!token || group?.kind !== 'group' || offset === null || isLoadingMoreGroupMembers.value) return;

  const request = groupProfileRequest;
  isLoadingMoreGroupMembers.value = true;
  try {
    const page = await socialApi.listGroupMembers(token, group.id, offset);
    if (!shouldApplyDashboardRequest(request, groupProfileRequest, isUnmounted)) return;
    const knownIds = new Set(groupMembers.value.map(({ id }) => id));
    groupMembers.value = [...groupMembers.value, ...page.members.filter(({ id }) => !knownIds.has(id))];
    groupMembersNextOffset.value = page.nextOffset;
  } catch (error) {
    console.error('[Dashboard] Failed to load more group members:', error);
    toast({ title: 'Could not load more participants.', variant: 'destructive' });
  } finally {
    isLoadingMoreGroupMembers.value = false;
  }
}

async function refreshSelectedGroup() {
  const group = selectedConversation.value;
  if (!group || group.kind !== 'group') return;
  await refreshConversationWorkspace();
  if (selectedConversation.value?.id === group.id) await loadGroupProfile(selectedConversation.value);
}

function handleGroupRemoved(groupId: string) {
  isGroupProfileDialogOpen.value = false;
  removeConversationFromWorkspace(groupId);
  void refreshConversationWorkspace();
}

function contextMenuKey(id: string) {
  return `${id}-${contextMenuResets.value[id] ?? 0}`;
}

function activateContextMenu(id: string) {
  const previousId = activeContextMenuId.value;
  activeContextMenuId.value = id;
  if (previousId && previousId !== id) {
    contextMenuResets.value = {
      ...contextMenuResets.value,
      [previousId]: (contextMenuResets.value[previousId] ?? 0) + 1,
    };
  }
}

function handleContextMenuOpen(id: string, open: boolean) {
  if (open) {
    activateContextMenu(id);
  } else if (activeContextMenuId.value === id) {
    activeContextMenuId.value = null;
  }
}

function handlePanelHeaderDragEnd(
  panel: 'messages' | 'friends',
  _event: PointerEvent,
  info: { offset: { y: number }; velocity: { y: number } },
) {
  expandedSidebarPanel.value = sidebarPanelAfterDrag(panel, expandedSidebarPanel.value, info.offset.y, info.velocity.y);
}

function handlePanelHeaderWheel(panel: 'messages' | 'friends', event: WheelEvent) {
  if (!event.deltaY || panelWheelLocked) return;
  panelWheelLocked = true;
  expandedSidebarPanel.value = sidebarPanelAfterDrag(
    panel,
    expandedSidebarPanel.value,
    0,
    Math.sign(event.deltaY) * 401,
  );
  panelWheelTimer = window.setTimeout(() => (panelWheelLocked = false), 250);
}

function toggleSidebarPanel(panel: 'messages' | 'friends') {
  expandedSidebarPanel.value = expandedSidebarPanel.value === panel ? null : panel;
}

function isExistingFriend(result: UserSearchResult) {
  return friendById.value.has(result.id);
}

function handleSocialNotifications(event: Event) {
  const notifications = (event as CustomEvent<{ kind: string }[]>).detail;
  if (
    notifications.some((notification) => notification.kind === 'friendRequest' || notification.kind === 'friendRemoved')
  ) {
    void refreshFriends();
  }
  if (notifications.some((notification) => notification.kind === 'groupInvitation')) {
    void refreshConversationWorkspace();
  }
}

function handleFriendsUpdated() {
  void refreshFriends();
}

async function handleConversationsUpdated() {
  await refreshConversationWorkspace();
  if (selectedConversation.value?.kind === 'group') await loadGroupProfile(selectedConversation.value);
}

onMounted(() => {
  window.addEventListener('openmeet:notifications-received', handleSocialNotifications);
  window.addEventListener('openmeet:social-friends-updated', handleFriendsUpdated);
  window.addEventListener('openmeet:social-conversations-updated', handleConversationsUpdated);
});

onBeforeUnmount(() => {
  isUnmounted = true;
  friendSearchRequest += 1;
  window.clearTimeout(peopleSearchTimer);
  friendAvatarRequest += 1;
  groupAvatarRequest += 1;
  contactProfileRequest += 1;
  groupProfileRequest += 1;
  callLaunchRequest += 1;
  Object.values(friendAvatarUrls.value).forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
  Object.values(groupAvatarUrls.value).forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
  window.removeEventListener('openmeet:notifications-received', handleSocialNotifications);
  window.removeEventListener('openmeet:social-friends-updated', handleFriendsUpdated);
  window.removeEventListener('openmeet:social-conversations-updated', handleConversationsUpdated);
  window.clearTimeout(panelWheelTimer);
});

function openConversationDetails(conversation: Conversation) {
  if (conversation.kind === 'group') {
    openGroupProfile(conversation);
    return;
  }

  const friend = friendById.value.get(conversation.otherUserId ?? '');
  if (!friend) {
    feedbackError.value = 'Profile details are unavailable for this conversation.';
    return;
  }
  openContactProfile(friend.id, friend.name);
}

async function openConversationManagement(conversation: Conversation, action: 'add-members' | 'remove-group') {
  if (conversation.kind !== 'group') return;
  selectConversation(conversation);
  await nextTick();
  await loadGroupProfile(conversation);
  if (selectedConversation.value?.id !== conversation.id) return;
  openGroupManagement(action);
}

function removeConversationFromWorkspace(conversationId: string) {
  invalidateConversationRefresh();
  groupAvatarRequest += 1;
  conversations.value = conversations.value.filter((conversation) => conversation.id !== conversationId);
  const activity = { ...conversationActivity.value };
  delete activity[conversationId];
  conversationActivity.value = activity;
  if (selectedConversation.value?.id === conversationId) selectedConversation.value = null;
  if (groupAvatarUrls.value[conversationId]) {
    URL.revokeObjectURL(groupAvatarUrls.value[conversationId]);
    const nextUrls = { ...groupAvatarUrls.value };
    delete nextUrls[conversationId];
    groupAvatarUrls.value = nextUrls;
    delete groupAvatarSources[conversationId];
  }
}

async function hideDirectConversation(conversation: Conversation) {
  const token = accessToken.value;
  if (!token || conversation.kind !== 'direct' || isDeletingConversation.value) return;

  clearFeedback();
  isDeletingConversation.value = conversation.id;
  try {
    await socialApi.hideDirectConversation(token, conversation.id);
    removeConversationFromWorkspace(conversation.id);
    feedbackMessage.value = 'Conversation removed from your messages.';
  } catch (error) {
    console.error('[Dashboard] Failed to hide direct conversation:', error);
    feedbackError.value = 'Could not remove this conversation.';
  } finally {
    isDeletingConversation.value = null;
  }
}

async function leaveGroup(conversation: Conversation) {
  const token = accessToken.value;
  if (!token || conversation.kind !== 'group' || isLeavingGroup.value) return;
  if (conversation.role === 'creator') {
    feedbackError.value = 'Transfer group ownership before leaving.';
    return;
  }

  const mutationToken = beginGroupMutation(conversation.id);
  if (!mutationToken) return;
  clearFeedback();
  isLeavingGroup.value = conversation.id;
  try {
    await socialApi.leaveGroup(token, conversation.id);
    removeConversationFromWorkspace(conversation.id);
    feedbackMessage.value = `You left ${conversationName(conversation)}.`;
  } catch (error) {
    console.error('[Dashboard] Failed to leave group:', error);
    feedbackError.value = error instanceof SocialApiError ? error.message : 'Could not leave this group.';
  } finally {
    isLeavingGroup.value = null;
    endGroupMutation(conversation.id, mutationToken);
  }
}

async function openFriendConversation(friend: Friend): Promise<Conversation | null> {
  const token = accessToken.value;
  if (!token || isOpeningDirect.value) return null;

  clearFeedback();
  isOpeningDirect.value = friend.id;
  try {
    const result = await socialApi.openDirectConversation(token, friend.id);
    if (result.state === 'available' && result.conversation) {
      selectedConversation.value = result.conversation;
      pendingDirectFriend.value = null;
      return result.conversation;
    } else if (result.state === 'pending') {
      selectedConversation.value = null;
      pendingDirectFriend.value = friend;
      feedbackMessage.value = `Direct-message request sent to ${friend.name}.`;
    } else {
      selectedConversation.value = null;
      pendingDirectFriend.value = friend;
      feedbackMessage.value = `Direct-message request for ${friend.name} was declined.`;
    }
  } catch (error) {
    console.error('[Dashboard] Failed to open direct conversation:', error);
    feedbackError.value = 'Could not open this direct conversation.';
  } finally {
    isOpeningDirect.value = null;
  }
  return null;
}

async function addFriend(result: UserSearchResult) {
  const token = accessToken.value;
  if (!token || isAddingFriend.value) return;

  clearFeedback();
  isAddingFriend.value = true;
  try {
    await socialApi.addFriendById(token, result.id);
    isPeopleSearchOpen.value = false;
    peopleSearchQuery.value = '';
    peopleSearchResults.value = [];
    feedbackMessage.value = 'Friend request sent.';
  } catch (error) {
    console.error('[Dashboard] Failed to send friend request:', error);
    feedbackError.value = error instanceof SocialApiError ? error.message : 'Could not send friend request.';
  } finally {
    isAddingFriend.value = false;
  }
}

async function respondToFriendRequest(request: FriendRequest, accept: boolean) {
  const token = accessToken.value;
  if (!token || isRespondingToFriendRequest.value) return;

  clearFeedback();
  isRespondingToFriendRequest.value = request.id;
  try {
    if (accept) {
      await socialApi.acceptFriend(token, request.id);
      feedbackMessage.value = `${request.user.name} is now a friend.`;
    } else {
      await socialApi.declineFriend(token, request.id);
      feedbackMessage.value = 'Friend request declined.';
    }
    await refreshFriends();
  } catch (error) {
    console.error('[Dashboard] Failed to respond to friend request:', error);
    feedbackError.value = 'Could not update friend request.';
  } finally {
    isRespondingToFriendRequest.value = null;
  }
}

async function removeFriend(friend: Friend) {
  const token = accessToken.value;
  if (!token || !friend.friendshipId || isRemovingFriend.value) return false;

  clearFeedback();
  isRemovingFriend.value = friend.id;
  try {
    await socialApi.removeFriend(token, friend.friendshipId);
    if (isUnmounted) return false;
    friends.value = friends.value.filter((item) => item.id !== friend.id);
    feedbackMessage.value = `${friend.name} was removed from your friends.`;
    return true;
  } catch (error) {
    if (isUnmounted) return false;
    console.error('[Dashboard] Failed to remove friend:', error);
    feedbackError.value = 'Could not remove friend.';
    return false;
  } finally {
    if (!isUnmounted) isRemovingFriend.value = null;
  }
}

async function removeProfileFriend() {
  const friend = contactProfileFriend.value;
  const profileId = contactProfile.value?.id;
  if (!friend || !profileId) return;
  const removed = await removeFriend(friend);
  if (!removed || contactProfile.value?.id !== profileId) return;
  isContactRemoveConfirmationOpen.value = false;
  setContactProfileDialogOpen(false);
  await refreshFriends();
}

// Invitations are secondary to the conversation list, so a failure here must not block it.
function loadGroupInvitations(token: string) {
  return socialApi.listGroupInvitations(token).catch((error) => {
    console.error('[Dashboard] Failed to load group invitations:', error);
    return null;
  });
}

function handleGroupInvitationAccepted(invitationId: string, conversation: Conversation) {
  groupInvitations.value = groupInvitations.value.filter((invitation) => invitation.id !== invitationId);
  activeGroupInvitation.value = null;
  addConversation(conversation);
  selectConversation(conversation);
  toast({ title: `You joined ${conversation.title ?? 'the group'}.`, variant: 'success' });
}

async function declineGroupInvitation(invitation: GroupInvitation) {
  const token = accessToken.value;
  if (!token) return;
  try {
    await socialApi.declineGroupInvitation(token, invitation.id);
    groupInvitations.value = groupInvitations.value.filter((item) => item.id !== invitation.id);
  } catch (error) {
    console.error('[Dashboard] Failed to decline group invitation:', error);
    toast({ title: 'Could not decline the invitation.', variant: 'destructive' });
  }
}

// Opening a section's search also expands that section, so results are visible right away.
function setConversationSearchOpen(open: boolean) {
  isConversationSearchOpen.value = open;
  if (open) expandedSidebarPanel.value = 'messages';
}

function setPeopleSearchOpen(open: boolean) {
  isPeopleSearchOpen.value = open;
  if (open) expandedSidebarPanel.value = 'friends';
}

async function respondToDirectRequest(request: DirectMessageRequest, accept: boolean) {
  const token = accessToken.value;
  if (!token) return;

  clearFeedback();
  try {
    const result = await socialApi.respondToDirectRequest(token, request.id, accept);
    directRequests.value = directRequests.value.filter((item) => item.id !== request.id);
    if (accept && result.conversation) {
      addConversation(result.conversation);
      selectedConversation.value = result.conversation;
      feedbackMessage.value = 'Direct-message request accepted.';
    }
  } catch (error) {
    console.error('[Dashboard] Failed to respond to direct-message request:', error);
    feedbackError.value = 'Could not update direct-message request.';
  }
}

async function createGroup() {
  const token = accessToken.value;
  const title = groupTitle.value.trim();
  if (!token || !title || isCreatingGroup.value) return;
  if (groupPolicy.value === 'password' && !groupPassword.value) {
    feedbackError.value = 'Enter a password for this group.';
    return;
  }

  clearFeedback();
  isCreatingGroup.value = true;
  try {
    const conversation = await socialApi.createGroup(token, {
      title,
      accessPolicy: groupPolicy.value,
      ...(groupPolicy.value === 'password' ? { password: groupPassword.value } : {}),
      memberIds: groupMemberIds.value,
    });
    if (isUnmounted) return;
    addConversation(conversation);
    selectedConversation.value = conversation;
    pendingDirectFriend.value = null;
    setCreateGroupDialogOpen(false, true);
  } catch (error) {
    console.error('[Dashboard] Failed to create group:', error);
    feedbackError.value = error instanceof SocialApiError ? error.message : 'Could not create group.';
  } finally {
    if (!isUnmounted) isCreatingGroup.value = false;
  }
}

function resetCreateGroup() {
  groupTitle.value = '';
  groupPolicy.value = 'open';
  groupPassword.value = '';
  groupMemberSearch.value = '';
  groupMemberIds.value = [];
}

function setCreateGroupDialogOpen(open: boolean, force = false) {
  if (!open && isCreatingGroup.value && !force) return;
  isGroupDialogOpen.value = open;
  if (!open) resetCreateGroup();
}

function toggleCreateGroupMember(friendId: string) {
  groupMemberIds.value = groupMemberIds.value.includes(friendId)
    ? groupMemberIds.value.filter((id) => id !== friendId)
    : [...groupMemberIds.value, friendId];
}

function resetJoinGroup() {
  joinGroupPreviewRequest += 1;
  joinGroupCode.value = '';
  joinGroupPassword.value = '';
  joinGroupPreview.value = null;
  joinGroupError.value = '';
  isPreviewingGroup.value = false;
}

function invalidateJoinGroupPreview() {
  joinGroupPreviewRequest += 1;
  joinGroupPreview.value = null;
  joinGroupPassword.value = '';
  joinGroupError.value = '';
  isPreviewingGroup.value = false;
}

function setJoinGroupDialogOpen(open: boolean) {
  if (!open && isJoiningGroup.value) return;
  isJoinGroupDialogOpen.value = open;
  if (!open) resetJoinGroup();
}

async function previewGroupByCode() {
  const token = accessToken.value;
  const code = joinGroupCode.value.trim();
  if (!token || !code) return;
  const request = ++joinGroupPreviewRequest;
  isPreviewingGroup.value = true;
  joinGroupError.value = '';
  joinGroupPreview.value = null;
  joinGroupPassword.value = '';
  try {
    const preview = await socialApi.getGroupInfoByCode(token, code);
    if (request === joinGroupPreviewRequest) joinGroupPreview.value = preview;
  } catch (error) {
    console.error('[Dashboard] Failed to preview group:', error);
    if (request === joinGroupPreviewRequest) {
      joinGroupError.value = error instanceof SocialApiError ? error.message : 'Could not find a group with that code.';
    }
  } finally {
    if (request === joinGroupPreviewRequest) isPreviewingGroup.value = false;
  }
}

async function joinGroupByCode() {
  const token = accessToken.value;
  const preview = joinGroupPreview.value;
  const code = joinGroupCode.value.trim();
  if (!token || !preview || !code || isJoiningGroup.value) return;
  if (preview.accessPolicy === 'password' && !joinGroupPassword.value) {
    joinGroupError.value = "Enter this group's password.";
    return;
  }

  isJoiningGroup.value = true;
  joinGroupError.value = '';
  try {
    let conversation = conversations.value.find((item) => item.id === preview.id);
    if (!preview.isMember || !conversation) {
      conversation = await socialApi.joinGroupByCode(
        token,
        code,
        preview.accessPolicy === 'password' ? joinGroupPassword.value : undefined,
      );
      addConversation(conversation);
    }
    selectConversation(conversation);
    isJoinGroupDialogOpen.value = false;
    resetJoinGroup();
    feedbackMessage.value = preview.isMember ? 'Group opened.' : 'Group joined.';
    void refreshConversationWorkspace();
  } catch (error) {
    console.error('[Dashboard] Failed to join group:', error);
    joinGroupError.value = error instanceof SocialApiError ? error.message : 'Could not join this group.';
  } finally {
    isJoiningGroup.value = false;
  }
}

async function startSelectedConversationCall() {
  const conversation = selectedConversation.value;
  if (!conversation || pendingDirectFriend.value) return;
  await startConversationCall(conversation);
}

async function startContactProfileCall() {
  const friend = contactProfileFriend.value;
  if (!friend) return;
  setContactProfileDialogOpen(false);
  await startFriendCall(friend);
}

async function startFriendCall(friend: Friend) {
  if (isCallLaunchActive.value) return;
  const conversation = await openFriendConversation(friend);
  if (!conversation) return;
  await startConversationCall(conversation);
}

// Swipe actions: read state updates optimistically and rolls back if the server rejects it.
async function toggleConversationRead(conversation: Conversation) {
  const token = accessToken.value;
  if (!token) return;
  const wasUnread = unreadCount(conversation) > 0 || conversation.markedUnread;
  const previous = conversations.value.find(({ id }) => id === conversation.id);
  const previousActivity = conversationActivity.value[conversation.id];
  if (wasUnread) markConversationRead(conversation.id);
  else setConversationMarkedUnread(conversation.id, true);
  try {
    if (wasUnread) await socialApi.markConversationRead(token, conversation.id);
    else await socialApi.markConversationUnread(token, conversation.id);
  } catch (error) {
    console.error('[Dashboard] Failed to update read state:', error);
    if (previous) conversations.value = conversations.value.map((item) => (item.id === previous.id ? previous : item));
    if (previousActivity)
      conversationActivity.value = { ...conversationActivity.value, [conversation.id]: previousActivity };
    toast({ title: 'Could not update read state.', variant: 'destructive' });
  }
}

function setConversationMarkedUnread(conversationId: string, markedUnread: boolean) {
  conversations.value = conversations.value.map((conversation) =>
    conversation.id === conversationId ? { ...conversation, markedUnread } : conversation,
  );
}

// Participants may not be friends yet; opening a chat with them sends a message request.
function openMemberChat(member: GroupMember) {
  const friend = friends.value.find(({ id }) => id === member.id) ?? {
    id: member.id,
    name: member.name,
    nickname: member.nickname,
    email: '',
    avatarUrl: member.avatarUrl,
    isOnline: false,
  };
  void openFriendConversation(friend);
}

async function changeMemberFriendship(member: GroupMember, change: 'add' | 'remove') {
  const token = accessToken.value;
  if (!token) return false;
  if (change === 'remove') {
    const friend = friends.value.find(({ id }) => id === member.id);
    if (!friend) return false;
    const removed = await removeFriend(friend);
    if (!removed) toast({ title: `Could not remove ${member.name} from your friends.`, variant: 'destructive' });
    return removed;
  }
  try {
    await socialApi.addFriendById(token, member.id);
    toast({ title: `Friend request sent to ${member.name}.`, variant: 'success' });
    return true;
  } catch (error) {
    console.error('[Dashboard] Failed to send friend request:', error);
    toast({
      title: 'Could not send friend request.',
      description: error instanceof SocialApiError ? error.message : undefined,
      variant: 'destructive',
    });
    return false;
  }
}

async function addProfileFriend() {
  const token = accessToken.value;
  const profile = contactProfile.value;
  if (!token || !profile) return;
  try {
    await socialApi.addFriendById(token, profile.id);
    toast({ title: `Friend request sent to ${profile.name}.`, variant: 'success' });
  } catch (error) {
    console.error('[Dashboard] Failed to send friend request:', error);
    toast({
      title: 'Could not send friend request.',
      description: error instanceof SocialApiError ? error.message : undefined,
      variant: 'destructive',
    });
  }
}

async function updateOwnStatus(status: UserStatus) {
  const token = accessToken.value;
  if (!token) return;
  try {
    const profile = await socialApi.updateCurrentUserStatus(token, status);
    if (contactProfile.value?.id === profile.id) contactProfile.value = profile;
    window.dispatchEvent(new Event('openmeet:profile-updated'));
  } catch (error) {
    console.error('[Dashboard] Failed to update status:', error);
    toast({ title: 'Could not update your status.', variant: 'destructive' });
  }
}

async function startMemberCall(member: GroupMember) {
  const token = accessToken.value;
  const friend = friends.value.find((item) => item.id === member.id);
  if (!token || !friend || isCallLaunchActive.value || member.id === currentUser.value?.id) return;

  clearFeedback();
  isOpeningDirect.value = member.id;
  try {
    const result = await socialApi.openDirectConversation(token, friend.id);
    if (result.state !== 'available' || !result.conversation) {
      feedbackError.value = `A direct conversation with ${member.name} is required before calling.`;
      return;
    }
    await startConversationCall(result.conversation);
  } catch (error) {
    console.error('[Dashboard] Failed to start member call:', error);
    feedbackError.value = 'Could not start call.';
  } finally {
    isOpeningDirect.value = null;
  }
}

async function startConversationCall(conversation: Conversation) {
  const token = accessToken.value;
  if (!token || startingCallConversationId.value) return;

  clearFeedback();
  const request = ++callLaunchRequest;
  startingCallConversationId.value = conversation.id;
  try {
    const callSession = await socialApi.startConversationCall(token, conversation.id);
    if (!shouldApplyDashboardRequest(request, callLaunchRequest, isUnmounted)) return;
    await router.push({ path: `/room/${callSession.id}`, query: { conversation: conversation.id } });
  } catch (error) {
    if (!shouldApplyDashboardRequest(request, callLaunchRequest, isUnmounted)) return;
    console.error('[Dashboard] Failed to start conversation call:', error);
    feedbackError.value = 'Could not start call.';
  } finally {
    if (shouldApplyDashboardRequest(request, callLaunchRequest, isUnmounted)) {
      startingCallConversationId.value = null;
    }
  }
}
</script>

<template>
  <div v-if="isCheckingSession" class="flex h-[calc(100dvh-84px)] items-center justify-center bg-[#FBFCF8]">
    <LoadingRipple class="size-8 text-[#0B7A75]" />
    <span class="sr-only">Loading workspace</span>
  </div>
  <main
    v-else-if="isAuthenticated"
    class="marketing-font h-[calc(100dvh-84px)] w-full max-w-full overflow-hidden overscroll-none bg-[#FBFCF8] px-3 pb-3 pt-0 text-[#102F35] sm:px-5 sm:pb-3 sm:pt-0"
  >
    <motion.div
      :initial="{ opacity: 0, y: 10 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.35 }"
      class="relative mx-auto h-full max-w-[1600px] overflow-hidden rounded-[1.75rem] border border-[#D8E7E3] bg-white shadow-[0_20px_70px_rgba(16,47,53,0.1)] lg:grid lg:grid-cols-[20rem_minmax(0,1fr)_18rem]"
    >
      <aside
        class="flex h-full min-h-0 flex-col border-b border-[#D8E7E3] bg-[#FBFCF8] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none lg:border-b-0 lg:border-r"
        :class="
          hasSelectedConversation
            ? 'pointer-events-none absolute inset-0 -translate-x-3 opacity-0 lg:static lg:translate-x-0 lg:opacity-100 lg:pointer-events-auto'
            : 'relative translate-x-0 opacity-100'
        "
        aria-label="Conversations"
      >
        <ConversationsSidebar
          v-model:query="searchQuery"
          :active-context-menu-id="activeContextMenuId"
          :conversations="filteredConversations"
          :context-menu-key="contextMenuKey"
          :conversation-name="conversationName"
          :conversation-identifier="conversationIdentifier"
          :direct-avatar-url="(conversation) => friendAvatarUrls[conversation.otherUserId ?? '']"
          :is-direct-online="(conversation) => friendById.get(conversation.otherUserId ?? '')?.isOnline ?? false"
          :direct-status="(conversation) => friendById.get(conversation.otherUserId ?? '')?.status"
          :is-friend-avatar-loading="isFriendAvatarLoading"
          :is-group-avatar-loading="isGroupAvatarLoading"
          :direct-initials="(conversation) => userInitials(friendById.get(conversation.otherUserId ?? '')?.name)"
          :direct-requests="directRequests"
          :group-invitations="groupInvitations"
          :expanded="expandedSidebarPanel !== 'friends'"
          :group-avatar-urls="groupAvatarUrls"
          :is-loading="isLoading"
          :is-refreshing="isRefreshingConversations"
          :search-open="isConversationSearchOpen"
          :selected-conversation-id="selectedConversation?.id"
          :unread-count="unreadCount"
          @update:search-open="setConversationSearchOpen"
          @create-group="setCreateGroupDialogOpen(true)"
          @join-group="isJoinGroupDialogOpen = true"
          @drag-end="(event, info) => handlePanelHeaderDragEnd('messages', event, info)"
          @wheel="handlePanelHeaderWheel('messages', $event)"
          @toggle="toggleSidebarPanel('messages')"
          @select="selectConversation"
          @details="openConversationDetails"
          @delete="
            (conversation) =>
              conversation.kind === 'direct' ? hideDirectConversation(conversation) : leaveGroup(conversation)
          "
          @add-members="openConversationManagement($event, 'add-members')"
          @remove-group="openConversationManagement($event, 'remove-group')"
          @context-open="handleContextMenuOpen"
          @context-activate="activateContextMenu"
          @respond-direct-request="respondToDirectRequest"
          @accept-group-invitation="activeGroupInvitation = $event"
          @decline-group-invitation="declineGroupInvitation"
          @toggle-read="toggleConversationRead"
        />
        <FriendsSidebar
          v-model:query="peopleSearchQuery"
          :active-context-menu-id="activeContextMenuId"
          :context-menu-key="contextMenuKey"
          :expanded="expandedSidebarPanel !== 'messages'"
          :friend-avatar-urls="friendAvatarUrls"
          :is-avatar-loading="isFriendAvatarLoading"
          :friends="isPeopleSearchActive ? filteredFriends : visibleFriends"
          :incoming-requests="incomingFriendRequests"
          :is-adding="isAddingFriend"
          :is-loading="isLoading"
          :is-opening="isOpeningDirect"
          :is-refreshing="isRefreshingFriends"
          :is-responding="isRespondingToFriendRequest"
          :is-searching="isSearchingUsers"
          :people-search-active="isPeopleSearchActive"
          :results="newPeopleSearchResults"
          :result-avatar-urls="peopleResultAvatarUrls"
          :search-open="isPeopleSearchOpen"
          @update:search-open="setPeopleSearchOpen"
          @drag-end="(event, info) => handlePanelHeaderDragEnd('friends', event, info)"
          @wheel="handlePanelHeaderWheel('friends', $event)"
          @toggle="toggleSidebarPanel('friends')"
          @open="openFriendConversation"
          @profile="(friend) => openContactProfile(friend.id, friend.name)"
          @call="startFriendCall"
          @remove="removeFriend"
          @add="addFriend"
          @open-result="(result) => openContactProfile(result.id, result.name)"
          @respond="respondToFriendRequest"
          @context-open="handleContextMenuOpen"
          @context-activate="activateContextMenu"
        />
      </aside>
      <ChatPane
        ref="chatPane"
        v-model:content="messageContent"
        v-model:reply-to="messageReplyTo"
        :conversation="selectedConversation"
        :pending-friend="pendingDirectFriend"
        :selected-friend="selectedFriend"
        :selected-title="selectedTitle"
        :selected-is-group="selectedIsGroup"
        :group-avatar-url="selectedGroupAvatarUrl"
        :friend-avatar-urls="friendAvatarUrls"
        :is-friend-avatar-loading="isFriendAvatarLoading"
        :is-group-avatar-loading="isGroupAvatarLoading"
        :messages="messages"
        :loading="isLoadingMessages"
        :loading-older="isLoadingOlderMessages"
        :sending="isSendingMessage"
        :call-active="isCallLaunchActive"
        :notification-warning="showNotificationPermissionWarning"
        :can-request-notification-permission="canRequestNotificationPermission"
        :is-desktop="isDesktop"
        :prefers-reduced-motion="prefersReducedMotion"
        :should-animate="shouldAnimateMessage"
        :is-local="isLocalMessage"
        :format-time="formatMessageTime"
        @back="
          selectedConversation = null;
          pendingDirectFriend = null;
        "
        @profile="openSelectedContactProfile"
        @group-info="openGroupProfile()"
        @call="startSelectedConversationCall"
        @scroll-top="handleMessageScroll"
        @send="sendMessage"
        @request-notifications="requestNotificationPermission"
        @react="toggleMessageReaction"
        @dismiss-notifications="dismissNotificationWarning"
      />
      <DetailsPane
        ref="detailsPane"
        :access-token="accessToken ?? undefined"
        :avatar-url="selectedGroupAvatarUrl"
        :current-user-id="currentUser?.id"
        :current-user="currentUser"
        :group-error="groupProfileError"
        :group-info="groupInfo"
        :group-loading="isGroupProfileLoading"
        :group-members="groupMembersWithPresence"
        :change-friendship="changeMemberFriendship"
        :group-member-avatar-urls="groupMemberAvatarUrls"
        :group-members-has-more="groupMembersNextOffset !== null"
        :group-members-loading-more="isLoadingMoreGroupMembers"
        :group-mutation-busy="isGroupMutationBusy"
        :begin-mutation="beginGroupMutation"
        :end-mutation="endGroupMutation"
        :friends="friends"
        :pending-friend="pendingDirectFriend"
        :selected-conversation="selectedConversation"
        :selected-is-group="selectedIsGroup"
        :selected-title="selectedTitle"
        :call-active="isCallLaunchActive"
        @call="startSelectedConversationCall"
        @call-member="startMemberCall"
        @account="router.push('/account')"
        @open-profile="openContactProfile"
        @refresh-group="refreshSelectedGroup"
        @load-more-members="loadMoreGroupMembers"
        @chat-member="openMemberChat"
        @group-removed="handleGroupRemoved"
      />
    </motion.div>
    <CreateGroupDialog
      :open="isGroupDialogOpen"
      :title="groupTitle"
      :policy="groupPolicy"
      :password="groupPassword"
      :member-search="groupMemberSearch"
      :member-ids="groupMemberIds"
      :friends="friends"
      :creating="isCreatingGroup"
      :prefers-reduced-motion="prefersReducedMotion"
      @update:open="setCreateGroupDialogOpen"
      @update:title="groupTitle = String($event)"
      @update:policy="groupPolicy = $event"
      @update:password="groupPassword = String($event)"
      @update:member-search="groupMemberSearch = String($event)"
      @toggle-member="toggleCreateGroupMember"
      @submit="createGroup"
    />
    <JoinGroupDialog
      :open="isJoinGroupDialogOpen"
      :code="joinGroupCode"
      :password="joinGroupPassword"
      :preview="joinGroupPreview"
      :previewing="isPreviewingGroup"
      :joining="isJoiningGroup"
      :error="joinGroupError"
      :prefers-reduced-motion="prefersReducedMotion"
      :access-label="groupAccessPolicyLabel"
      @update:open="setJoinGroupDialogOpen"
      @update:code="joinGroupCode = String($event)"
      @update:password="joinGroupPassword = String($event)"
      @invalidate-preview="invalidateJoinGroupPreview"
      @preview="previewGroupByCode"
      @join="joinGroupByCode"
    />
    <GroupInfoDialog
      :open="isGroupProfileDialogOpen"
      :loading="isGroupProfileLoading"
      :error="groupProfileError"
      :info="groupInfo"
      :members="groupMembersWithPresence"
      :member-avatar-urls="groupMemberAvatarUrls"
      :members-has-more="groupMembersNextOffset !== null"
      :members-loading-more="isLoadingMoreGroupMembers"
      :friends="friends"
      :avatar-url="selectedGroupAvatarUrl"
      :avatar-loading="isGroupAvatarLoading(selectedConversation?.id ?? '')"
      :current-user-id="currentUser?.id"
      :access-token="accessToken ?? undefined"
      :mutation-busy="isGroupMutationBusy(selectedConversation?.id ?? '')"
      :begin-mutation="beginGroupMutation"
      :end-mutation="endGroupMutation"
      :access-label="groupAccessPolicyLabel"
      :format-date="formatProfileDate"
      @update:open="setGroupProfileDialogOpen"
      @profile="openContactProfile"
      @add-members="openGroupManagement('add-members')"
      @quit-group="openGroupManagement('quit-group')"
      @remove-group="openGroupManagement('remove-group')"
      @group-settings="openGroupManagement('settings')"
      @refresh="refreshSelectedGroup"
      :change-friendship="changeMemberFriendship"
      @load-more-members="loadMoreGroupMembers"
      @chat-member="openMemberChat"
    />
    <AcceptGroupInvitationDialog
      :open="activeGroupInvitation !== null"
      :invitation="activeGroupInvitation"
      :access-token="accessToken ?? undefined"
      @update:open="!$event && (activeGroupInvitation = null)"
      @accepted="handleGroupInvitationAccepted"
    />
    <ContactProfileDialog
      :open="isContactProfileDialogOpen"
      :confirmation-open="isContactRemoveConfirmationOpen"
      :profile="contactProfile"
      :profile-friend="contactProfileFriend"
      :loading="isContactProfileLoading"
      :error="contactProfileError"
      :removing-id="isRemovingFriend"
      :opening="isOpeningDirect"
      :call-active="isCallLaunchActive"
      :avatar-urls="contactProfileAvatarUrls"
      :avatar-loading="isContactProfileAvatarLoading"
      :format-date="formatProfileDate"
      @update:open="setContactProfileDialogOpen"
      @update:confirmation-open="setContactRemoveConfirmationOpen"
      @call="startContactProfileCall"
      @remove="removeProfileFriend"
      @add-friend="addProfileFriend"
      @update-status="updateOwnStatus"
    />
  </main>
</template>
