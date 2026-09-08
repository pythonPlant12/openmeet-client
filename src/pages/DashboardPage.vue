<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { Picker } from 'emoji-picker-element';
import {
  ArrowLeft,
  Ban,
  Check,
  ChevronRight,
  CircleCheck,
  CircleUserRound,
  Clock3,
  LockKeyhole,
  LogOut,
  Maximize2,
  MessageCircleMore,
  Minimize2,
  MinusCircle,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Smile,
  Trash2,
  UserMinus,
  UsersRound,
  X,
} from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  HarborDialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingRipple } from '@/components/ui/loading';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/composables/useAuth';
import {
  type ConversationActivity,
  sortConversationsByActivity,
  upsertConversationByActivity,
} from '@/pages/dashboard-chat-state';
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
  type GroupMember,
  SocialApiError,
  type UserSearchResult,
  socialApi,
} from '@/services/social-api';

const router = useRouter();
const { accessToken, currentUser, isAuthenticated, isCheckingSession } = useAuth();

const conversations = ref<Conversation[]>([]);
const friends = ref<Friend[]>([]);
const friendAvatarUrls = ref<Record<string, string>>({});
const incomingFriendRequests = ref<FriendRequest[]>([]);
const directRequests = ref<DirectMessageRequest[]>([]);
const searchQuery = ref('');
const isConversationSearchOpen = ref(false);
const peopleSearchQuery = ref('');
const isPeopleSearchOpen = ref(false);
const peopleSearchResults = ref<UserSearchResult[]>([]);
const conversationSearchInput = ref<HTMLInputElement | null>(null);
const peopleSearchInput = ref<HTMLInputElement | null>(null);
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
const expandedSidebarPanel = ref<'messages' | 'friends' | null>(null);
const activeContextMenuId = ref<string | null>(null);
const contextMenuResets = ref<Record<string, number>>({});
const isGroupDialogOpen = ref(false);
const isGroupProfileDialogOpen = ref(false);
const isContactProfileDialogOpen = ref(false);
const contactProfile = ref<ContactProfile | null>(null);
const isContactProfileLoading = ref(false);
const contactProfileError = ref('');
const groupInfo = ref<GroupInfo | null>(null);
const groupMembers = ref<GroupMember[]>([]);
const isGroupProfileLoading = ref(false);
const groupProfileError = ref('');
const messages = ref<ConversationMessage[]>([]);
const messageContent = ref('');
const nextMessageBefore = ref<number | null>(null);
const messagePane = ref<HTMLElement | null>(null);
const messageComposer = ref<HTMLTextAreaElement | null>(null);
const conversationActivity = ref<Record<string, ConversationActivity>>({});
const animatedMessageSequences = ref(new Set<number>());
const isEmojiPickerOpen = ref(false);
const emojiPickerControl = ref<HTMLElement | null>(null);
const emojiPickerPopover = ref<HTMLElement | null>(null);
const emojiPickerMount = ref<HTMLElement | null>(null);
const isLoadingMessages = ref(false);
const isLoadingOlderMessages = ref(false);
const isSendingMessage = ref(false);
const groupTitle = ref('');
const groupPolicy = ref<GroupAccessPolicy>('open');
const groupPassword = ref('');
const feedbackError = ref('');
const feedbackMessage = ref('');
const notificationPermission = ref(getSystemNotificationPermission());
let hasStartedDashboard = false;
let friendSearchRequest = 0;
let peopleSearchTimer: number | undefined;
let friendRefreshRequest = 0;
let friendRefreshPending = false;
let conversationRefreshPending = false;
let friendAvatarRequest = 0;
let contactProfileRequest = 0;
let groupProfileRequest = 0;
let messageRequest = 0;
let emojiPicker: Picker | null = null;
let friendLongPressTimer: number | undefined;
let suppressFriendClick = false;
let conversationLongPressTimer: number | undefined;
let suppressConversationClick = false;

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const chatStateInitial = computed(() => (prefersReducedMotion.value ? false : { opacity: 0, y: 8, scale: 0.99 }));
const chatStateExit = computed(() => (prefersReducedMotion.value ? undefined : { opacity: 0, y: -6, scale: 0.99 }));
const chatStateTransition = computed(() =>
  prefersReducedMotion.value ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' as const },
);
const showNotificationPermissionWarning = computed(
  () => notificationPermission.value === 'default' || notificationPermission.value === 'denied',
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
const hasSelectedConversation = computed(() => !!selectedConversation.value || !!pendingDirectFriend.value);
const groupCreatedAt = computed(() => {
  const infoCreatedAt = (groupInfo.value as (GroupInfo & { createdAt?: string | null }) | null)?.createdAt;
  return infoCreatedAt || selectedConversation.value?.createdAt || null;
});
const isDraftDirectConversation = computed(
  () =>
    selectedConversation.value?.kind === 'direct' &&
    !conversations.value.some((conversation) => conversation.id === selectedConversation.value?.id),
);

function conversationName(conversation: Conversation) {
  if (conversation.kind === 'group') return conversation.title?.trim() || 'Untitled group';
  return friendById.value.get(conversation.otherUserId ?? '')?.name || 'Direct conversation';
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

function contactStatusLabel(status: ContactProfile['status']) {
  return {
    available: 'Available',
    away: 'Away',
    doNotDisturb: 'Do not disturb',
    offline: 'Offline',
  }[status];
}

function contactStatusIcon(status: ContactProfile['status']) {
  return {
    available: CircleCheck,
    away: Clock3,
    doNotDisturb: MinusCircle,
    offline: Ban,
  }[status];
}

function contactStatusClass(status: ContactProfile['status']) {
  return {
    available: 'bg-[#EAF7F4] text-[#17645F]',
    away: 'bg-[#FFF8E8] text-[#80601D]',
    doNotDisturb: 'bg-[#FFF0EA] text-[#9D4636]',
    offline: 'bg-[#F0F4F3] text-[#61777B]',
  }[status];
}

function groupAccessPolicyLabel(policy: GroupAccessPolicy | null | undefined) {
  return policy === 'password' ? 'Password protected' : policy === 'friendsOnly' ? 'Friends-only' : 'Open access';
}

function groupRoleLabel(role: string | null | undefined) {
  if (!role) return 'Member';

  return role
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
    conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
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
    const response = await socialApi.listConversationMessages(token, conversationId);
    if (request !== messageRequest || selectedConversation.value?.id !== conversationId) return;

    messages.value = response.messages.slice().reverse();
    animatedMessageSequences.value = new Set();
    nextMessageBefore.value = response.nextBefore;
    await nextTick();
    if (messagePane.value) messagePane.value.scrollTop = messagePane.value.scrollHeight;
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
  const pane = messagePane.value;
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
  isLoadingOlderMessages.value = true;
  await nextTick();
  const previousHeight = pane.scrollHeight;
  const previousTop = pane.scrollTop;
  try {
    const response = await socialApi.listConversationMessages(token, conversationId, before);
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
    pane.scrollTop = previousTop + pane.scrollHeight - previousHeight;
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
  if (messagePane.value && messagePane.value.scrollTop < 80) void loadOlderMessages();
}

async function sendMessage() {
  const conversationId = selectedConversation.value?.id;
  const token = accessToken.value;
  const content = messageContent.value.trim();
  if (!conversationId || !token || !content || isLoadingMessages.value || isSendingMessage.value) return;

  clearFeedback();
  isSendingMessage.value = true;
  try {
    const message = await socialApi.createConversationMessage(token, conversationId, content);
    if (selectedConversation.value?.id !== conversationId) return;

    appendMessage(message);
    if (selectedConversation.value?.id === conversationId) addConversation(selectedConversation.value);
    messageContent.value = '';
    await nextTick();
    if (messagePane.value) messagePane.value.scrollTop = messagePane.value.scrollHeight;
  } catch (error) {
    console.error('[Dashboard] Failed to send message:', error);
    feedbackError.value = 'Could not send message. Try again.';
  } finally {
    isSendingMessage.value = false;
  }
}

function addConversation(conversation: Conversation) {
  conversations.value = upsertConversationByActivity(conversations.value, conversation, conversationActivity.value);
}

function excludeUnsentDirectDrafts(conversationData: Conversation[]) {
  return conversationData.filter((conversation) => conversation.kind !== 'direct' || conversation.messageCount > 0);
}

async function syncFriendAvatars(nextFriends: Friend[], token: string) {
  const request = ++friendAvatarRequest;
  const entries = await Promise.all(
    nextFriends.map(async (friend) => {
      if (!friend.avatarUrl) return null;
      try {
        const objectUrl = URL.createObjectURL(await socialApi.loadAvatar(token, friend.avatarUrl));
        return [friend.id, objectUrl] as const;
      } catch (error) {
        console.error(`[Dashboard] Failed to load avatar for ${friend.id}:`, error);
        return null;
      }
    }),
  );
  const loadedEntries = entries.filter((entry): entry is readonly [string, string] => entry !== null);
  if (request !== friendAvatarRequest) {
    loadedEntries.forEach(([, objectUrl]) => URL.revokeObjectURL(objectUrl));
    return;
  }

  const nextAvatarUrls = Object.fromEntries(loadedEntries);
  Object.values(friendAvatarUrls.value).forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
  friendAvatarUrls.value = nextAvatarUrls;
}

async function loadWorkspace() {
  const token = accessToken.value;
  if (!token) return;

  try {
    const [friendData, conversationData, requestData] = await Promise.all([
      socialApi.listFriends(token),
      socialApi.listConversations(token),
      socialApi.listDirectRequests(token),
    ]);
    friends.value = friendData.friends;
    void syncFriendAvatars(friendData.friends, token);
    incomingFriendRequests.value = friendData.incomingRequests;
    conversations.value = sortConversationsByActivity(
      excludeUnsentDirectDrafts(conversationData),
      conversationActivity.value,
    );
    directRequests.value = requestData;
    clearFeedback();
  } catch (error) {
    console.error('[Dashboard] Failed to load conversation workspace:', error);
    feedbackError.value = 'Could not load conversations. Try refreshing this page.';
  } finally {
    isLoading.value = false;
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
    if (request !== friendRefreshRequest) return;
    friends.value = friendData.friends;
    void syncFriendAvatars(friendData.friends, token);
    incomingFriendRequests.value = friendData.incomingRequests;
  } catch (error) {
    console.error('[Dashboard] Failed to refresh friends:', error);
  } finally {
    if (request === friendRefreshRequest) {
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
  if (isRefreshingConversations.value) {
    conversationRefreshPending = true;
    return;
  }

  isRefreshingConversations.value = true;
  try {
    const [conversationData, requestData] = await Promise.all([
      socialApi.listConversations(token),
      socialApi.listDirectRequests(token),
    ]);
    const nextConversations = excludeUnsentDirectDrafts(conversationData);
    conversations.value = sortConversationsByActivity(nextConversations, conversationActivity.value);
    directRequests.value = requestData;

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
    console.error('[Dashboard] Failed to refresh conversations:', error);
  } finally {
    isRefreshingConversations.value = false;
    if (conversationRefreshPending) {
      conversationRefreshPending = false;
      void refreshConversationWorkspace();
    }
  }
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

watch(selectedConversation, (conversation, previousConversation) => {
  if (conversation?.id === previousConversation?.id) return;
  messageRequest += 1;
  messages.value = [];
  messageContent.value = '';
  nextMessageBefore.value = null;
  isLoadingMessages.value = false;
  isLoadingOlderMessages.value = false;

  if (conversation) {
    markConversationRead(conversation.id);
    void loadLatestMessages(conversation.id);
  }
});

function selectConversation(conversation: Conversation) {
  pendingDirectFriend.value = null;
  selectedConversation.value = conversation;
  markConversationRead(conversation.id);
  clearFeedback();
}

function setContactProfileDialogOpen(open: boolean) {
  isContactProfileDialogOpen.value = open;
  if (!open) contactProfileRequest += 1;
}

function setGroupProfileDialogOpen(open: boolean) {
  isGroupProfileDialogOpen.value = open;
  if (!open) groupProfileRequest += 1;
}

function profileFallback(userId: string, name: string): ContactProfile {
  return {
    id: userId,
    name,
    nickname: '',
    email: 'Profile details unavailable',
    avatarUrl: null,
    status: 'offline',
    statusMessage: 'Live profile details are only available to accepted friends.',
    createdAt: '',
    lastSeenAt: null,
    isOnline: false,
  };
}

function openContactProfile(userId?: string, name?: string) {
  const token = accessToken.value;
  const friend = selectedFriend.value;
  const profileUserId = userId ?? friend?.id;
  const profileName = name ?? friend?.name;
  if (!token || !profileUserId || !profileName || (pendingDirectFriend.value && !userId)) return;

  const request = ++contactProfileRequest;
  isContactProfileDialogOpen.value = true;
  contactProfile.value = profileFallback(profileUserId, profileName);
  contactProfileError.value = '';
  isContactProfileLoading.value = true;

  void socialApi
    .getUserProfile(token, profileUserId)
    .then((profile) => {
      if (request === contactProfileRequest) contactProfile.value = profile;
    })
    .catch((error) => {
      console.error('[Dashboard] Failed to load contact profile:', error);
      if (request === contactProfileRequest) {
        contactProfileError.value = 'Live profile details are unavailable. Showing available member details.';
      }
    })
    .finally(() => {
      if (request === contactProfileRequest) isContactProfileLoading.value = false;
    });
}

function openSelectedContactProfile() {
  openContactProfile();
}

function openGroupProfile(conversation?: Conversation) {
  const token = accessToken.value;
  const group = conversation ?? selectedConversation.value;
  if (!token || !group || group.kind !== 'group') return;

  const request = ++groupProfileRequest;
  isGroupProfileDialogOpen.value = true;
  groupInfo.value = null;
  groupMembers.value = [];
  groupProfileError.value = '';
  isGroupProfileLoading.value = true;

  void Promise.all([socialApi.getGroupInfo(token, group.id), socialApi.listGroupMembers(token, group.id)])
    .then(([info, members]) => {
      if (request !== groupProfileRequest) return;
      groupInfo.value = info;
      groupMembers.value = members;
    })
    .catch((error) => {
      console.error('[Dashboard] Failed to load group profile:', error);
      if (request === groupProfileRequest) groupProfileError.value = 'Could not load group details. Try again.';
    })
    .finally(() => {
      if (request === groupProfileRequest) isGroupProfileLoading.value = false;
    });
}

function toggleConversationSearch() {
  isConversationSearchOpen.value = !isConversationSearchOpen.value;
  if (isConversationSearchOpen.value) nextTick(() => conversationSearchInput.value?.focus());
}

function togglePeopleSearch() {
  isPeopleSearchOpen.value = !isPeopleSearchOpen.value;
  if (isPeopleSearchOpen.value) nextTick(() => peopleSearchInput.value?.focus());
}

function toggleSidebarPanel(panel: 'messages' | 'friends') {
  expandedSidebarPanel.value = expandedSidebarPanel.value === panel ? null : panel;
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
  const movedUp = info.offset.y < -48 || info.velocity.y < -400;
  const movedDown = info.offset.y > 48 || info.velocity.y > 400;
  const shouldExpand = panel === 'messages' ? movedDown : movedUp;
  const shouldCollapse = panel === 'messages' ? movedUp : movedDown;

  if (expandedSidebarPanel.value && expandedSidebarPanel.value !== panel) {
    expandedSidebarPanel.value = null;
    return;
  }

  if (shouldExpand && expandedSidebarPanel.value !== panel) {
    expandedSidebarPanel.value = panel;
  } else if (shouldCollapse && expandedSidebarPanel.value === panel) {
    expandedSidebarPanel.value = null;
  }
}

function isExistingFriend(result: UserSearchResult) {
  return friendById.value.has(result.id);
}

function preventProfileTriggerFocus(event: Event) {
  event.preventDefault();
}

function preventDialogAutoFocus(event: Event) {
  event.preventDefault();
}

function preventMenuAutoFocus(event: Event) {
  event.preventDefault();
}

function handleEmojiClick(event: CustomEvent<{ unicode?: string }>) {
  const emoji = event.detail.unicode;
  if (!emoji) return;

  const composer = messageComposer.value;
  const start = composer?.selectionStart ?? messageContent.value.length;
  const end = composer?.selectionEnd ?? messageContent.value.length;
  const content = messageContent.value;
  const cursor = start + emoji.length;

  messageContent.value = `${content.slice(0, start)}${emoji}${content.slice(end)}`;
  isEmojiPickerOpen.value = false;
  void nextTick(() => {
    messageComposer.value?.focus();
    messageComposer.value?.setSelectionRange(cursor, cursor);
  });
}

function ensureEmojiPicker() {
  if (!emojiPickerMount.value) return;

  if (!emojiPicker) {
    emojiPicker = new Picker({ locale: navigator.language });
    emojiPicker.addEventListener('emoji-click', handleEmojiClick);
  }

  if (emojiPicker.parentElement !== emojiPickerMount.value) emojiPickerMount.value.append(emojiPicker);
}

function toggleEmojiPicker() {
  isEmojiPickerOpen.value = !isEmojiPickerOpen.value;
  if (isEmojiPickerOpen.value) void nextTick(ensureEmojiPicker);
}

function closeEmojiPickerOnOutsideClick(event: PointerEvent) {
  const target = event.target;
  if (
    !isEmojiPickerOpen.value ||
    !(target instanceof Node) ||
    emojiPickerPopover.value?.contains(target) ||
    emojiPickerControl.value?.contains(target)
  ) {
    return;
  }

  isEmojiPickerOpen.value = false;
}

function closeEmojiPickerOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !isEmojiPickerOpen.value) return;

  isEmojiPickerOpen.value = false;
  emojiPickerControl.value?.querySelector<HTMLButtonElement>('button')?.focus();
}

function handleSocialNotifications(event: Event) {
  const notifications = (event as CustomEvent<{ kind: string }[]>).detail;
  if (
    notifications.some((notification) => notification.kind === 'friendRequest' || notification.kind === 'friendRemoved')
  ) {
    void refreshFriends();
  }
}

function handleFriendsUpdated() {
  void refreshFriends();
}

function handleConversationsUpdated() {
  void refreshConversationWorkspace();
}

onMounted(() => {
  document.addEventListener('pointerdown', closeEmojiPickerOnOutsideClick, true);
  document.addEventListener('keydown', closeEmojiPickerOnEscape);
  window.addEventListener('openmeet:notifications-received', handleSocialNotifications);
  window.addEventListener('openmeet:social-friends-updated', handleFriendsUpdated);
  window.addEventListener('openmeet:social-conversations-updated', handleConversationsUpdated);
});

onBeforeUnmount(() => {
  friendAvatarRequest += 1;
  Object.values(friendAvatarUrls.value).forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
  document.removeEventListener('pointerdown', closeEmojiPickerOnOutsideClick, true);
  document.removeEventListener('keydown', closeEmojiPickerOnEscape);
  window.removeEventListener('openmeet:notifications-received', handleSocialNotifications);
  window.removeEventListener('openmeet:social-friends-updated', handleFriendsUpdated);
  window.removeEventListener('openmeet:social-conversations-updated', handleConversationsUpdated);
  emojiPicker?.removeEventListener('emoji-click', handleEmojiClick);
  emojiPicker?.remove();
  window.clearTimeout(friendLongPressTimer);
  window.clearTimeout(conversationLongPressTimer);
});

function clearFriendLongPress() {
  window.clearTimeout(friendLongPressTimer);
  friendLongPressTimer = undefined;
}

function startFriendLongPress(event: PointerEvent, contextMenuId: string) {
  if (event.pointerType === 'mouse') return;

  friendLongPressTimer = window.setTimeout(() => {
    suppressFriendClick = true;
    activateContextMenu(contextMenuId);
    friendLongPressTimer = undefined;
  }, 500);
}

function cancelFriendLongPress() {
  clearFriendLongPress();
}

function finishFriendLongPress() {
  clearFriendLongPress();
  if (suppressFriendClick) window.setTimeout(() => (suppressFriendClick = false));
}

function handleFriendClick(friend: Friend) {
  if (suppressFriendClick) {
    suppressFriendClick = false;
    return;
  }

  void openFriendConversation(friend);
}

function clearConversationLongPress() {
  window.clearTimeout(conversationLongPressTimer);
  conversationLongPressTimer = undefined;
}

function startConversationLongPress(event: PointerEvent, contextMenuId: string) {
  if (event.pointerType === 'mouse') return;

  conversationLongPressTimer = window.setTimeout(() => {
    suppressConversationClick = true;
    activateContextMenu(contextMenuId);
    conversationLongPressTimer = undefined;
  }, 500);
}

function finishConversationLongPress() {
  clearConversationLongPress();
  if (suppressConversationClick) window.setTimeout(() => (suppressConversationClick = false));
}

function handleConversationClick(conversation: Conversation) {
  if (suppressConversationClick) {
    suppressConversationClick = false;
    return;
  }

  selectConversation(conversation);
}

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

function removeConversationFromWorkspace(conversationId: string) {
  conversations.value = conversations.value.filter((conversation) => conversation.id !== conversationId);
  const activity = { ...conversationActivity.value };
  delete activity[conversationId];
  conversationActivity.value = activity;
  if (selectedConversation.value?.id === conversationId) selectedConversation.value = null;
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
  }
}

async function openFriendConversation(friend: Friend) {
  const token = accessToken.value;
  if (!token || isOpeningDirect.value) return;

  clearFeedback();
  isOpeningDirect.value = friend.id;
  try {
    const result = await socialApi.openDirectConversation(token, friend.id);
    if (result.state === 'available' && result.conversation) {
      selectedConversation.value = result.conversation;
      pendingDirectFriend.value = null;
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
}

async function addFriend(result: UserSearchResult) {
  const token = accessToken.value;
  if (!token || isAddingFriend.value) return;

  clearFeedback();
  isAddingFriend.value = true;
  try {
    await socialApi.addFriend(token, result.email);
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
  if (!token || !friend.friendshipId || isRemovingFriend.value) return;

  clearFeedback();
  isRemovingFriend.value = friend.id;
  try {
    await socialApi.removeFriend(token, friend.friendshipId);
    friends.value = friends.value.filter((item) => item.id !== friend.id);
    feedbackMessage.value = `${friend.name} was removed from your friends.`;
  } catch (error) {
    console.error('[Dashboard] Failed to remove friend:', error);
    feedbackError.value = 'Could not remove friend.';
  } finally {
    isRemovingFriend.value = null;
  }
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
    });
    addConversation(conversation);
    selectedConversation.value = conversation;
    pendingDirectFriend.value = null;
    groupTitle.value = '';
    groupPassword.value = '';
    groupPolicy.value = 'open';
    isGroupDialogOpen.value = false;
  } catch (error) {
    console.error('[Dashboard] Failed to create group:', error);
    feedbackError.value = 'Could not create group.';
  } finally {
    isCreatingGroup.value = false;
  }
}

async function startSelectedConversationCall() {
  const token = accessToken.value;
  const conversation = selectedConversation.value;
  if (!token || !conversation || pendingDirectFriend.value) return;

  clearFeedback();
  try {
    const callSession = await socialApi.startConversationCall(token, conversation.id);
    await router.push({ path: `/room/${callSession.id}`, query: { conversation: conversation.id } });
  } catch (error) {
    console.error('[Dashboard] Failed to start conversation call:', error);
    feedbackError.value = 'Could not start call.';
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
    class="marketing-font h-[calc(100dvh-84px)] overflow-hidden bg-[#FBFCF8] px-3 pb-3 pt-0 text-[#102F35] sm:px-5 sm:pb-3 sm:pt-0"
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
        <div class="border-b border-[#E5EFEC] px-4 py-4 sm:px-5">
          <div class="flex items-center justify-between gap-3">
            <motion.h1
              drag="y"
              :drag-constraints="{ top: 0, bottom: 0 }"
              :drag-elastic="0.08"
              :drag-momentum="false"
              class="-my-4 flex-1 touch-none cursor-ns-resize py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#61777B]"
              @drag-end="(event, info) => handlePanelHeaderDragEnd('messages', event, info)"
            >
              Messages
            </motion.h1>
            <div class="flex shrink-0 items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                class="harbor-ghost-action size-9 rounded-full text-[#0B7A75]"
                :class="{ 'bg-[#E6F4F1] !text-[#102F35]': isConversationSearchOpen }"
                :aria-expanded="isConversationSearchOpen"
                aria-controls="conversation-search"
                aria-label="Search conversations"
                title="Search conversations"
                @click="toggleConversationSearch"
              >
                <Search class="size-4" />
              </Button>
              <Button
                size="icon"
                class="harbor-primary-action size-9 rounded-full bg-[#0B7A75] text-white"
                aria-label="Create group"
                title="Create group"
                @click="isGroupDialogOpen = true"
              >
                <Plus class="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                class="harbor-ghost-action size-9 rounded-full text-[#0B7A75]"
                :aria-expanded="expandedSidebarPanel === 'messages'"
                aria-controls="messages-panel"
                :aria-label="expandedSidebarPanel === 'messages' ? 'Collapse messages' : 'Expand messages'"
                :title="expandedSidebarPanel === 'messages' ? 'Collapse messages' : 'Expand messages'"
                @click="toggleSidebarPanel('messages')"
              >
                <Minimize2 v-if="expandedSidebarPanel === 'messages'" class="size-4" />
                <Maximize2 v-else class="size-4" />
              </Button>
            </div>
          </div>
          <div
            id="conversation-search"
            class="grid transition-[grid-template-rows,margin] duration-300 ease-out motion-reduce:transition-none"
            :class="isConversationSearchOpen ? 'mt-4 grid-rows-[1fr]' : 'mt-0 grid-rows-[0fr]'"
          >
            <label class="relative min-h-0 overflow-hidden">
              <span class="sr-only">Search conversations</span>
              <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#809697]" />
              <Input
                ref="conversationSearchInput"
                v-model="searchQuery"
                type="search"
                placeholder="Search conversations"
                class="h-10 rounded-xl border-[#D8E7E3] bg-white pl-9 text-[#102F35] placeholder:text-[#809697] focus-visible:border-[#D8E7E3] focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </label>
          </div>
        </div>

        <div
          class="min-h-0 overflow-hidden transition-[flex-grow,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          :class="
            expandedSidebarPanel === 'friends'
              ? 'pointer-events-none flex-none basis-0 opacity-0'
              : 'flex-1 opacity-100'
          "
          :aria-hidden="expandedSidebarPanel === 'friends'"
        >
          <div id="messages-panel" class="h-full min-h-0 overflow-y-auto p-2" aria-live="polite">
            <div v-if="directRequests.length" class="mb-3 space-y-1 border-b border-[#E5EFEC] pb-3">
              <div
                v-for="request in directRequests"
                :key="request.id"
                class="flex items-center gap-2 rounded-xl px-2 py-2"
              >
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#E6F4F1] text-xs font-semibold text-[#0B7A75]"
                >
                  <CircleUserRound class="size-4" />
                </span>
                <p class="min-w-0 flex-1 truncate text-xs text-[#4E6B70]">
                  Request from account {{ request.requesterId.slice(0, 8) }}
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  class="harbor-ghost-action size-8 rounded-full text-[#0B7A75]"
                  :aria-label="`Accept request from account ${request.requesterId.slice(0, 8)}`"
                  @click="respondToDirectRequest(request, true)"
                >
                  <Check class="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  class="size-8 rounded-full text-[#9D4636] hover:bg-[#FFF0EA]"
                  :aria-label="`Decline request from account ${request.requesterId.slice(0, 8)}`"
                  @click="respondToDirectRequest(request, false)"
                >
                  <X class="size-4" />
                </Button>
              </div>
            </div>
            <div v-if="isLoading || isRefreshingConversations" class="flex min-h-44 items-center justify-center">
              <LoadingRipple class="size-6 text-[#0B7A75]" />
              <span class="sr-only">Loading conversations</span>
            </div>
            <p v-else-if="!filteredConversations.length" class="px-3 py-8 text-center text-sm text-[#61777B]">
              {{ searchQuery ? 'No conversations match your search.' : 'No conversations yet.' }}
            </p>
            <nav v-else aria-label="Persistent conversations" class="space-y-1">
              <ContextMenu
                v-for="conversation in filteredConversations"
                :key="contextMenuKey(`conversation-${conversation.id}`)"
                :press-open-delay="500"
                @update:open="handleContextMenuOpen(`conversation-${conversation.id}`, $event)"
              >
                <ContextMenuTrigger as-child>
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-[background-color,border-color,border-width] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                    :class="[
                      'harbor-ghost-action',
                      selectedConversation?.id === conversation.id ? 'bg-[#E6F4F1] !text-[#102F35]' : '',
                      activeContextMenuId === `conversation-${conversation.id}` ? 'border-2 border-[#0B7A75]' : '',
                    ]"
                    :aria-current="selectedConversation?.id === conversation.id ? 'page' : undefined"
                    @click="handleConversationClick(conversation)"
                    @contextmenu="activateContextMenu(`conversation-${conversation.id}`)"
                    @pointerdown="startConversationLongPress($event, `conversation-${conversation.id}`)"
                    @pointermove="clearConversationLongPress"
                    @pointerup="finishConversationLongPress"
                    @pointercancel="clearConversationLongPress"
                  >
                    <span
                      class="flex size-10 shrink-0 items-center justify-center rounded-full"
                      :class="conversation.kind === 'group' ? 'bg-[#102F35] text-white' : 'bg-[#DDF1ED] text-[#0B7A75]'"
                    >
                      <UsersRound v-if="conversation.kind === 'group'" class="size-4" />
                      <img
                        v-else-if="friendAvatarUrls[conversation.otherUserId ?? '']"
                        :src="friendAvatarUrls[conversation.otherUserId ?? '']"
                        alt=""
                        class="size-full rounded-full object-cover"
                      />
                      <span v-else class="text-xs font-semibold">{{
                        userInitials(friendById.get(conversation.otherUserId ?? '')?.name)
                      }}</span>
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="flex items-center gap-2">
                        <strong class="truncate text-sm">{{ conversationName(conversation) }}</strong>
                        <LockKeyhole
                          v-if="conversation.accessPolicy === 'password'"
                          class="size-3 shrink-0 text-[#61777B]"
                          aria-label="Password protected"
                        />
                      </span>
                      <span class="mt-0.5 block truncate text-xs text-[#61777B]">{{
                        conversation.kind === 'group' ? 'Group conversation' : 'Direct conversation'
                      }}</span>
                    </span>
                    <span
                      v-if="unreadCount(conversation)"
                      class="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[#0B7A75] px-1.5 py-0.5 text-[11px] font-semibold text-white"
                      :aria-label="`${unreadCount(conversation)} unread messages`"
                    >
                      {{ unreadCount(conversation) > 99 ? '99+' : unreadCount(conversation) }}
                    </span>
                    <ChevronRight v-else class="size-4 shrink-0 text-[#809697]" />
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent
                  class="harbor-action-menu min-w-52 rounded-[1.25rem] border-[#D8E7E3] bg-white p-2 text-[#102F35] shadow-[0_20px_55px_rgba(16,47,53,0.16)] data-[state=open]:duration-200 data-[state=closed]:duration-150 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
                  @open-auto-focus="preventMenuAutoFocus"
                  @entry-focus="preventMenuAutoFocus"
                >
                  <ContextMenuLabel class="px-3 py-1 text-xs uppercase tracking-[0.12em] text-[#61777B]">
                    {{ conversationName(conversation) }}
                  </ContextMenuLabel>
                  <ContextMenuSeparator class="mx-1 my-2 bg-[#E5EFEC]" />
                  <ContextMenuItem
                    class="harbor-context-menu-item harbor-floating-menu-item min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    @select="openConversationDetails(conversation)"
                  >
                    <CircleUserRound v-if="conversation.kind === 'direct'" class="size-4" aria-hidden="true" />
                    <UsersRound v-else class="size-4" aria-hidden="true" />
                    {{ conversation.kind === 'direct' ? 'See profile' : 'Group info' }}
                  </ContextMenuItem>
                  <ContextMenuItem
                    class="harbor-context-menu-danger min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-[#C4513D]"
                    :disabled="isDeletingConversation !== null || isLeavingGroup !== null"
                    @select="
                      conversation.kind === 'direct' ? hideDirectConversation(conversation) : leaveGroup(conversation)
                    "
                  >
                    <Trash2 v-if="conversation.kind === 'direct'" class="size-4" aria-hidden="true" />
                    <LogOut v-else class="size-4" aria-hidden="true" />
                    <template v-if="conversation.kind === 'direct'">
                      {{ isDeletingConversation === conversation.id ? 'Deleting...' : 'Delete conversation' }}
                    </template>
                    <template v-else>
                      {{ isLeavingGroup === conversation.id ? 'Leaving...' : 'Quit from group' }}
                    </template>
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </nav>
          </div>
        </div>

        <section
          class="flex min-h-0 flex-col overflow-hidden border-t border-[#E5EFEC] p-3 transition-[flex-basis,flex-grow,opacity,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          :class="
            expandedSidebarPanel === 'messages'
              ? 'basis-20 shrink-0 opacity-100'
              : expandedSidebarPanel === 'friends'
                ? 'flex-1 opacity-100'
                : 'basis-[min(38dvh,23rem)] shrink-0'
          "
          aria-labelledby="friends-heading"
        >
          <div class="flex items-center justify-between gap-2 px-2">
            <motion.h2
              id="friends-heading"
              drag="y"
              :drag-constraints="{ top: 0, bottom: 0 }"
              :drag-elastic="0.08"
              :drag-momentum="false"
              class="-my-2 flex-1 touch-none cursor-ns-resize py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#61777B]"
              @drag-end="(event, info) => handlePanelHeaderDragEnd('friends', event, info)"
            >
              Friends
            </motion.h2>
            <div class="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                class="harbor-ghost-action size-8 rounded-full text-[#0B7A75]"
                :class="{ 'bg-[#E6F4F1] !text-[#102F35]': isPeopleSearchOpen }"
                :aria-expanded="isPeopleSearchOpen"
                aria-controls="people-search"
                aria-label="Search friends and people"
                title="Search friends and people"
                @click="togglePeopleSearch"
              >
                <Search class="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                class="harbor-ghost-action size-8 rounded-full text-[#0B7A75]"
                :aria-expanded="expandedSidebarPanel === 'friends'"
                aria-controls="friends-panel"
                :aria-label="expandedSidebarPanel === 'friends' ? 'Collapse friends' : 'Expand friends'"
                :title="expandedSidebarPanel === 'friends' ? 'Collapse friends' : 'Expand friends'"
                @click="toggleSidebarPanel('friends')"
              >
                <Minimize2 v-if="expandedSidebarPanel === 'friends'" class="size-4" />
                <Maximize2 v-else class="size-4" />
              </Button>
            </div>
          </div>
          <div
            id="friends-panel"
            class="flex min-h-0 flex-col overflow-hidden transition-[height,flex-grow,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            :class="
              expandedSidebarPanel === 'messages' ? 'pointer-events-none h-0 flex-none opacity-0' : 'flex-1 opacity-100'
            "
            :aria-hidden="expandedSidebarPanel === 'messages'"
          >
            <div
              id="people-search"
              class="grid px-2 transition-[grid-template-rows,margin] duration-300 ease-out motion-reduce:transition-none"
              :class="isPeopleSearchOpen ? 'mt-2 grid-rows-[1fr]' : 'mt-0 grid-rows-[0fr]'"
            >
              <div class="min-h-0 overflow-hidden">
                <label class="relative block">
                  <span class="sr-only">Search friends and people</span>
                  <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#809697]" />
                  <Input
                    ref="peopleSearchInput"
                    v-model="peopleSearchQuery"
                    type="search"
                    placeholder="Search friends and people"
                    class="h-9 rounded-xl border-[#D8E7E3] bg-white pl-9 text-xs text-[#102F35] placeholder:text-[#809697] focus-visible:border-[#D8E7E3] focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </label>
                <p
                  v-if="peopleSearchQuery.trim() && peopleSearchQuery.replace(/\s/g, '').length < 2"
                  class="mt-2 text-xs text-[#61777B]"
                >
                  Keep typing to search people outside your friend list.
                </p>
                <div v-else-if="isSearchingUsers" class="flex h-16 items-center justify-center">
                  <LoadingRipple class="size-4 text-[#0B7A75]" />
                  <span class="sr-only">Searching people</span>
                </div>
                <div v-else-if="isPeopleSearchActive && filteredFriends.length" class="mt-2 space-y-1">
                  <p class="px-2 pt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#0B7A75]">Friends</p>
                  <button
                    v-for="friend in filteredFriends"
                    :key="friend.id"
                    type="button"
                    class="harbor-ghost-action flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                    @click="openFriendConversation(friend)"
                  >
                    <span
                      class="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] text-[10px] font-semibold text-[#0B7A75]"
                    >
                      <img
                        v-if="friendAvatarUrls[friend.id]"
                        :src="friendAvatarUrls[friend.id]"
                        alt=""
                        class="size-full object-cover"
                      />
                      <template v-else>{{ userInitials(friend.name) }}</template>
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-xs font-semibold">{{ friend.name }}</span>
                      <span class="block truncate text-[11px] text-[#61777B]">{{ friend.email }}</span>
                    </span>
                    <span class="rounded-full bg-[#E6F4F1] px-2 py-0.5 text-[10px] font-semibold text-[#27595D]"
                      >Friend</span
                    >
                  </button>
                </div>
                <div v-if="newPeopleSearchResults.length" class="mt-2 space-y-1">
                  <p class="px-2 pt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#61777B]">People</p>
                  <div
                    v-for="result in newPeopleSearchResults"
                    :key="result.id"
                    class="flex items-center gap-2 rounded-xl bg-[#F0F7F5] px-2 py-2"
                  >
                    <span
                      class="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#DDF1ED] text-[10px] font-semibold text-[#0B7A75]"
                    >
                      {{ userInitials(result.name) }}
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-xs font-semibold">{{ result.name }}</span>
                      <span class="block truncate text-[11px] text-[#61777B]">{{ result.email }}</span>
                    </span>
                    <Button
                      size="sm"
                      :disabled="isAddingFriend"
                      class="harbor-primary-action h-7 rounded-full bg-[#0B7A75] px-2 text-xs text-white"
                      @click="addFriend(result)"
                    >
                      {{ isAddingFriend ? 'Adding...' : 'Add' }}
                    </Button>
                  </div>
                </div>
                <p
                  v-else-if="
                    isPeopleSearchActive && !filteredFriends.length && peopleSearchQuery.replace(/\s/g, '').length >= 2
                  "
                  class="mt-2 text-xs text-[#61777B]"
                >
                  No registered accounts found.
                </p>
              </div>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto">
              <div v-if="incomingFriendRequests.length" class="mt-2 space-y-1 border-b border-[#E5EFEC] px-2 pb-2">
                <p class="px-2 pt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#61777B]">Requests</p>
                <div
                  v-for="request in incomingFriendRequests"
                  :key="request.id"
                  class="flex items-center gap-2 rounded-xl bg-[#EAF7F4] px-2 py-2 text-[#102F35]"
                >
                  <span
                    class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] text-xs font-semibold text-[#0B7A75]"
                  >
                    <img
                      v-if="friendAvatarUrls[request.user.id]"
                      :src="friendAvatarUrls[request.user.id]"
                      alt=""
                      class="size-full object-cover"
                    />
                    <template v-else>{{ userInitials(request.user.name) }}</template>
                  </span>
                  <span class="min-w-0 flex-1 truncate text-xs font-semibold">{{ request.user.name }}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    class="harbor-ghost-action size-8 rounded-full text-[#0B7A75]"
                    :disabled="isRespondingToFriendRequest !== null"
                    :aria-label="`Accept friend request from ${request.user.name}`"
                    @click="respondToFriendRequest(request, true)"
                  >
                    <Check class="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-8 rounded-full text-[#9D4636] hover:bg-[#FFF0EA]"
                    :disabled="isRespondingToFriendRequest !== null"
                    :aria-label="`Decline friend request from ${request.user.name}`"
                    @click="respondToFriendRequest(request, false)"
                  >
                    <X class="size-4" />
                  </Button>
                </div>
              </div>
              <div v-if="!isPeopleSearchActive && visibleFriends.length" id="friend-list" class="mt-2 space-y-1 px-2">
                <ContextMenu
                  v-for="friend in visibleFriends"
                  :key="contextMenuKey(`friend-${friend.id}`)"
                  :press-open-delay="500"
                  @update:open="handleContextMenuOpen(`friend-${friend.id}`, $event)"
                >
                  <ContextMenuTrigger as-child>
                    <button
                      type="button"
                      class="harbor-ghost-action flex w-full items-center gap-2 rounded-xl border border-transparent px-2 py-2 text-left transition-[background-color,border-color,border-width] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                      :aria-label="`Open direct conversation with ${friend.name}`"
                      :class="{ 'border-2 border-[#0B7A75]': activeContextMenuId === `friend-${friend.id}` }"
                      @click="handleFriendClick(friend)"
                      @contextmenu="activateContextMenu(`friend-${friend.id}`)"
                      @pointerdown="startFriendLongPress($event, `friend-${friend.id}`)"
                      @pointermove="cancelFriendLongPress"
                      @pointerup="finishFriendLongPress"
                      @pointercancel="cancelFriendLongPress"
                    >
                      <span
                        class="relative flex size-8 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] text-xs font-semibold text-[#0B7A75]"
                      >
                        <img
                          v-if="friendAvatarUrls[friend.id]"
                          :src="friendAvatarUrls[friend.id]"
                          alt=""
                          class="size-full object-cover"
                        />
                        <template v-else>{{ userInitials(friend.name) }}</template>
                        <span
                          v-if="friend.isOnline"
                          class="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-[#FBFCF8] bg-[#2DA58F]"
                          aria-label="Online"
                        />
                      </span>
                      <span class="min-w-0 flex-1 truncate text-sm">{{
                        isOpeningDirect === friend.id ? 'Opening...' : friend.name
                      }}</span>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent
                    class="harbor-action-menu min-w-52 rounded-[1.25rem] border-[#D8E7E3] bg-white p-2 text-[#102F35] shadow-[0_20px_55px_rgba(16,47,53,0.16)] data-[state=open]:duration-200 data-[state=closed]:duration-150 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
                    @open-auto-focus="preventMenuAutoFocus"
                    @entry-focus="preventMenuAutoFocus"
                  >
                    <ContextMenuLabel class="px-3 py-1 text-xs uppercase tracking-[0.12em] text-[#61777B]">
                      {{ friend.name }}
                    </ContextMenuLabel>
                    <ContextMenuSeparator class="mx-1 my-2 bg-[#E5EFEC]" />
                    <ContextMenuItem
                      class="harbor-context-menu-item harbor-floating-menu-item min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                      @select="openContactProfile(friend.id, friend.name)"
                    >
                      <CircleUserRound class="size-4" aria-hidden="true" />
                      View profile
                    </ContextMenuItem>
                    <ContextMenuItem
                      :disabled="isRemovingFriend !== null"
                      class="harbor-context-menu-danger min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-[#C4513D]"
                      @select="removeFriend(friend)"
                    >
                      <UserMinus class="size-4" aria-hidden="true" />
                      {{ isRemovingFriend === friend.id ? 'Removing...' : 'Remove friend' }}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </div>
              <p
                v-else-if="!isPeopleSearchActive && !isLoading && !isRefreshingFriends && friends.length"
                class="px-2 py-2 text-xs text-[#61777B]"
              >
                No friends match your search.
              </p>
              <div v-else-if="isLoading || isRefreshingFriends" class="flex h-16 items-center justify-center">
                <LoadingRipple class="size-4 text-[#0B7A75]" />
                <span class="sr-only">Loading friends</span>
              </div>
              <p v-else class="px-2 py-2 text-xs text-[#61777B]">No accepted friends.</p>
            </div>
          </div>
        </section>
      </aside>

      <section
        class="flex h-full min-h-0 min-w-0 flex-col bg-white transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        :class="
          hasSelectedConversation
            ? 'relative translate-x-0 opacity-100'
            : 'pointer-events-none absolute inset-0 translate-x-3 opacity-0 lg:static lg:translate-x-0 lg:opacity-100 lg:pointer-events-auto'
        "
        aria-labelledby="conversation-title"
      >
        <AnimatePresence mode="wait">
          <motion.div
            v-if="selectedConversation || pendingDirectFriend"
            :key="selectedConversation?.id ?? `pending-${pendingDirectFriend?.id}`"
            :initial="chatStateInitial"
            :animate="{ opacity: 1, y: 0, scale: 1 }"
            :exit="chatStateExit"
            :transition="chatStateTransition"
            class="flex h-full min-h-0 flex-col"
          >
            <header class="flex min-h-16 items-center gap-3 border-b border-[#E5EFEC] px-4 sm:px-6">
              <Button
                variant="ghost"
                size="icon"
                class="harbor-ghost-action -ml-2 rounded-full text-[#27595D] lg:hidden"
                aria-label="Back to conversations"
                @click="
                  selectedConversation = null;
                  pendingDirectFriend = null;
                "
              >
                <ArrowLeft class="size-5" />
              </Button>
              <button
                v-if="selectedFriend && !pendingDirectFriend"
                type="button"
                class="harbor-ghost-action -mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                :aria-label="`View profile for ${selectedFriend.name}`"
                @click="openSelectedContactProfile"
              >
                <span
                  class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] text-[#0B7A75]"
                >
                  <img
                    v-if="friendAvatarUrls[selectedFriend.id]"
                    :src="friendAvatarUrls[selectedFriend.id]"
                    alt=""
                    class="size-full object-cover"
                  />
                  <span v-else class="text-xs font-semibold">{{ userInitials(selectedFriend.name) }}</span>
                </span>
                <span class="min-w-0">
                  <span id="conversation-title" class="block truncate font-semibold">{{ selectedTitle }}</span>
                  <span class="block truncate text-xs text-[#61777B]">{{
                    isDraftDirectConversation ? 'Draft direct chat' : 'Direct conversation'
                  }}</span>
                </span>
              </button>
              <button
                v-else-if="selectedIsGroup"
                type="button"
                class="harbor-ghost-action -mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                :aria-label="`View group info for ${selectedTitle}`"
                @click="openGroupProfile()"
              >
                <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#102F35] text-white">
                  <UsersRound class="size-4" />
                </span>
                <span class="min-w-0">
                  <span id="conversation-title" class="block truncate font-semibold">{{ selectedTitle }}</span>
                  <span class="block truncate text-xs text-[#61777B]">Group conversation</span>
                </span>
              </button>
              <div v-else class="flex min-w-0 flex-1 items-center gap-3">
                <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#DDF1ED] text-[#0B7A75]">
                  <span class="text-xs font-semibold">{{ userInitials(selectedFriend?.name) }}</span>
                </span>
                <div class="min-w-0">
                  <h2 id="conversation-title" class="truncate font-semibold">{{ selectedTitle }}</h2>
                  <p class="truncate text-xs text-[#61777B]">
                    {{ pendingDirectFriend ? 'Direct-message request pending' : 'Draft direct chat' }}
                  </p>
                </div>
              </div>
              <Button
                v-if="selectedFriend && !pendingDirectFriend"
                variant="ghost"
                size="icon"
                class="harbor-ghost-action rounded-full text-[#0B7A75]"
                :aria-label="`Start call with ${selectedFriend.name}`"
                @click="startSelectedConversationCall"
              >
                <Phone class="size-5" />
              </Button>
              <Button
                v-else-if="selectedIsGroup"
                variant="ghost"
                size="icon"
                class="harbor-ghost-action rounded-full text-[#0B7A75]"
                :aria-label="`Start call in ${selectedTitle}`"
                @click="startSelectedConversationCall"
              >
                <Phone class="size-5" />
              </Button>
            </header>

            <div v-if="selectedConversation" class="flex min-h-0 flex-1 flex-col">
              <div
                ref="messagePane"
                class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
                aria-label="Message history"
                @scroll.passive="handleMessageScroll"
              >
                <div
                  v-if="showNotificationPermissionWarning"
                  class="sticky top-0 z-10 mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#D8E7E3] bg-[#E6F4F1] px-3 py-2.5 text-sm text-[#102F35] shadow-sm"
                >
                  <p>
                    {{
                      canRequestNotificationPermission
                        ? 'Enable notifications for messages and calls.'
                        : 'Notifications are blocked. Enable them in your browser settings.'
                    }}
                  </p>
                  <Button
                    v-if="canRequestNotificationPermission"
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="harbor-ghost-action h-8 shrink-0 rounded-lg px-2 font-bold text-[#0B7A75]"
                    @click="requestNotificationPermission"
                  >
                    Enable
                  </Button>
                </div>
                <div v-if="isLoadingOlderMessages" class="flex justify-center pb-4" aria-live="polite">
                  <LoadingRipple class="size-5 text-[#0B7A75]" />
                  <span class="sr-only">Loading older messages</span>
                </div>
                <div v-if="isLoadingMessages" class="flex h-full items-center justify-center" aria-live="polite">
                  <LoadingRipple class="size-7 text-[#0B7A75]" />
                  <span class="sr-only">Loading messages</span>
                </div>
                <p v-else-if="!messages.length" class="py-10 text-center text-sm text-[#61777B]">
                  No messages yet. Start the conversation.
                </p>
                <ol v-else class="space-y-4">
                  <motion.li
                    v-for="message in messages"
                    :key="message.sequence"
                    :initial="
                      shouldAnimateMessage(message) && !prefersReducedMotion
                        ? { opacity: 0, y: 10, scale: 0.97 }
                        : false
                    "
                    :animate="{ opacity: 1, y: 0, scale: 1 }"
                    :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }"
                    :layout="!prefersReducedMotion"
                    class="flex"
                    :class="isLocalMessage(message) ? 'justify-end' : 'justify-start'"
                  >
                    <article
                      class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[70%]"
                      :class="
                        isLocalMessage(message)
                          ? 'rounded-br-md bg-[#0B7A75] text-white'
                          : 'rounded-bl-md border border-[#D8E7E3] bg-[#F6FAF7] text-[#102F35]'
                      "
                    >
                      <div
                        class="mb-1 flex items-center gap-2 text-xs"
                        :class="isLocalMessage(message) ? 'text-white/80' : 'text-[#61777B]'"
                      >
                        <span class="font-semibold">{{ isLocalMessage(message) ? 'You' : message.senderName }}</span>
                        <time :datetime="message.createdAt">{{ formatMessageTime(message.createdAt) }}</time>
                      </div>
                      <p class="whitespace-pre-wrap break-words leading-5">{{ message.content }}</p>
                    </article>
                  </motion.li>
                </ol>
              </div>

              <div class="border-t border-[#E5EFEC] bg-[#FBFCF8] px-4 py-3 sm:px-6">
                <p class="mb-2 text-xs text-[#61777B]">Messages stored by OpenMeet</p>
                <form class="flex items-end gap-2" @submit.prevent="sendMessage">
                  <textarea
                    ref="messageComposer"
                    v-model="messageContent"
                    rows="1"
                    maxlength="2000"
                    placeholder="Write a message"
                    aria-label="Message"
                    class="min-h-11 max-h-32 min-w-0 flex-1 resize-y rounded-xl border border-[#D8E7E3] bg-white px-3 py-2.5 text-sm text-[#102F35] placeholder:text-[#809697] focus-visible:border-[#D8E7E3] focus-visible:outline-none focus-visible:ring-0"
                    @keydown.enter.exact.prevent="sendMessage"
                  />
                  <span ref="emojiPickerControl" class="relative shrink-0">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      class="harbor-ghost-action size-11 rounded-xl text-[#0B7A75]"
                      :class="{ 'bg-[#E6F4F1] !text-[#102F35]': isEmojiPickerOpen }"
                      :aria-expanded="isEmojiPickerOpen"
                      aria-controls="emoji-picker"
                      aria-label="Choose emoji"
                      title="Choose emoji"
                      @click="toggleEmojiPicker"
                    >
                      <Smile class="size-5" />
                    </Button>
                    <AnimatePresence>
                      <motion.div
                        v-if="isEmojiPickerOpen"
                        id="emoji-picker"
                        ref="emojiPickerPopover"
                        :initial="prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.96 }"
                        :animate="{ opacity: 1, y: 0, scale: 1 }"
                        :exit="prefersReducedMotion ? undefined : { opacity: 0, y: 6, scale: 0.96 }"
                        :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }"
                        class="fixed inset-x-3 bottom-20 z-30 overflow-hidden rounded-2xl border border-[#D8E7E3] bg-white p-1 shadow-[0_18px_48px_rgba(16,47,53,0.18)] md:absolute md:inset-x-auto md:bottom-full md:right-0 md:mb-2 md:w-[min(22rem,calc(100vw-2rem))]"
                      >
                        <div
                          ref="emojiPickerMount"
                          class="max-h-[min(26rem,55dvh)] overflow-y-auto [&>emoji-picker]:w-full"
                        />
                      </motion.div>
                    </AnimatePresence>
                  </span>
                  <Button
                    type="submit"
                    class="harbor-primary-action h-11 rounded-xl bg-[#0B7A75] px-4 text-white"
                    :disabled="!messageContent.trim() || isLoadingMessages || isSendingMessage"
                  >
                    {{ isSendingMessage ? 'Sending...' : 'Send' }}
                  </Button>
                </form>
              </div>
            </div>

            <div v-else class="flex flex-1 items-center justify-center px-6 py-10 text-center">
              <p class="max-w-sm rounded-xl bg-[#FFF8E8] px-4 py-3 text-sm text-[#80601D]">
                Waiting for {{ pendingDirectFriend?.name }} to accept this direct-message request.
              </p>
            </div>
          </motion.div>

          <motion.div
            v-else
            key="empty-conversation"
            :initial="chatStateInitial"
            :animate="{ opacity: 1, y: 0, scale: 1 }"
            :exit="chatStateExit"
            :transition="chatStateTransition"
            class="flex h-full flex-1 items-center justify-center px-6 py-10 text-center"
          >
            <div class="max-w-sm">
              <span class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#E6F4F1] text-[#0B7A75]">
                <MessageCircleMore class="size-7" />
              </span>
              <h2 id="conversation-title" class="mt-5 text-xl font-semibold">Choose a conversation</h2>
              <p class="mt-2 text-sm leading-6 text-[#61777B]">
                Select a conversation or an accepted friend to manage its secure access.
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      <aside
        class="hidden h-full min-h-0 overflow-y-auto border-l border-[#D8E7E3] bg-[#FBFCF8] lg:flex lg:flex-col"
        aria-label="Conversation details"
      >
        <div class="border-b border-[#E5EFEC] px-5 py-5">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B7A75]">Details</p>
          <h2 class="mt-1 font-semibold">
            {{ selectedConversation || pendingDirectFriend ? selectedTitle : 'Your workspace' }}
          </h2>
        </div>
        <div v-if="selectedConversation || pendingDirectFriend" class="space-y-5 p-5">
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
            v-if="selectedConversation && !pendingDirectFriend"
            class="harbor-primary-action w-full rounded-full bg-[#0B7A75] text-white"
            @click="startSelectedConversationCall"
          >
            <Phone class="size-4" />
            Start call
          </Button>
        </div>
        <div v-else class="p-5 text-sm leading-6 text-[#61777B]">
          Create group conversations, review direct-message requests, or select an accepted friend.
        </div>

        <div class="mt-auto border-t border-[#E5EFEC] p-4">
          <div class="flex items-center gap-3 rounded-xl bg-white p-3">
            <span
              class="flex size-9 items-center justify-center rounded-full bg-[#E6F4F1] text-xs font-semibold text-[#0B7A75]"
              >{{ userInitials(currentUser?.name) }}</span
            >
            <span class="min-w-0">
              <strong class="block truncate text-sm">{{ currentUser?.name }}</strong>
              <span class="block truncate text-xs text-[#61777B]">{{ currentUser?.email }}</span>
            </span>
          </div>
        </div>
      </aside>
    </motion.div>

    <Dialog :open="isGroupDialogOpen" @update:open="isGroupDialogOpen = $event">
      <HarborDialogContent
        overlay-class="bg-[#102F35]/30 backdrop-blur-md"
        class="marketing-font w-[calc(100%-2rem)] max-w-md rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-5 text-[#102F35] shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full sm:p-6"
      >
        <DialogHeader>
          <DialogTitle>Create group</DialogTitle>
          <DialogDescription class="text-[#61777B]"
            >Set initial group access. Membership controls remain managed by group admins.</DialogDescription
          >
        </DialogHeader>
        <form class="space-y-5" @submit.prevent="createGroup">
          <div class="space-y-2">
            <Label for="group-title" class="text-[#102F35]">Title</Label>
            <Input
              id="group-title"
              v-model="groupTitle"
              required
              maxlength="120"
              placeholder="Group name"
              class="h-11 rounded-xl border-[#D8E7E3] bg-white focus-visible:border-[#D8E7E3] focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <fieldset class="space-y-2">
            <legend class="text-sm font-medium text-[#102F35]">Access policy</legend>
            <label
              v-for="policy in ['open', 'password', 'friendsOnly'] as GroupAccessPolicy[]"
              :key="policy"
              class="flex cursor-pointer items-center gap-3 rounded-xl border border-[#D8E7E3] bg-white px-3 py-3 has-[:checked]:border-[#0B7A75] has-[:checked]:bg-[#EAF7F4]"
            >
              <input
                v-model="groupPolicy"
                type="radio"
                name="group-policy"
                :value="policy"
                class="size-4 accent-[#0B7A75]"
              />
              <span class="text-sm font-medium">{{
                policy === 'open' ? 'Open' : policy === 'password' ? 'Password' : 'Friends-only'
              }}</span>
            </label>
          </fieldset>
          <div v-if="groupPolicy === 'password'" class="space-y-2">
            <Label for="group-password" class="text-[#102F35]">Password</Label>
            <Input
              id="group-password"
              v-model="groupPassword"
              type="password"
              required
              autocomplete="new-password"
              placeholder="Group password"
              class="h-11 rounded-xl border-[#D8E7E3] bg-white focus-visible:border-[#D8E7E3] focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <DialogFooter class="gap-2">
            <Button
              type="button"
              variant="outline"
              class="rounded-full border-[#D8E7E3] bg-white text-[#27595D]"
              @click="isGroupDialogOpen = false"
              >Cancel</Button
            >
            <Button
              type="submit"
              class="harbor-primary-action rounded-full bg-[#0B7A75] text-white"
              :disabled="isCreatingGroup"
            >
              {{ isCreatingGroup ? 'Creating...' : 'Create group' }}
            </Button>
          </DialogFooter>
        </form>
      </HarborDialogContent>
    </Dialog>

    <Dialog :open="isGroupProfileDialogOpen" @update:open="setGroupProfileDialogOpen">
      <HarborDialogContent
        overlay-class="bg-[#102F35]/30 backdrop-blur-md"
        class="marketing-font flex top-[calc(50%+2.25rem)] max-h-[calc(100dvh-6rem)] w-[calc(100%-2rem)] max-w-4xl flex-col rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-5 text-[#102F35] shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full sm:p-6"
        @open-auto-focus="preventDialogAutoFocus"
        @close-auto-focus="preventProfileTriggerFocus"
      >
        <DialogHeader>
          <DialogTitle>Group info</DialogTitle>
          <DialogDescription class="text-[#61777B]">Members and group access details.</DialogDescription>
        </DialogHeader>

        <div v-if="isGroupProfileLoading" class="flex min-h-72 items-center justify-center" aria-live="polite">
          <LoadingRipple class="size-7 text-[#0B7A75]" />
          <span class="sr-only">Loading group details</span>
        </div>

        <div
          v-else-if="groupProfileError"
          class="rounded-2xl border border-[#F2C7BE] bg-[#FFF4F0] p-4 text-sm text-[#9D4636]"
          role="alert"
        >
          {{ groupProfileError }}
        </div>

        <div v-else-if="groupInfo" class="min-h-0 space-y-6 overflow-y-auto pr-1">
          <section
            class="flex flex-col gap-5 rounded-2xl border border-[#D8E7E3] bg-white p-5 sm:flex-row sm:items-start sm:p-6"
          >
            <span class="flex size-20 shrink-0 items-center justify-center rounded-full bg-[#102F35] text-white">
              <UsersRound class="size-9" />
            </span>
            <div class="min-w-0 flex-1">
              <h3 class="truncate text-xl font-semibold tracking-[-0.025em]">{{ groupInfo.title }}</h3>
              <p class="mt-1 text-sm text-[#61777B]">{{ groupAccessPolicyLabel(groupInfo.accessPolicy) }}</p>
              <div class="mt-4 flex flex-wrap gap-2">
                <span class="rounded-full bg-[#EAF7F4] px-3 py-1.5 text-xs font-semibold text-[#17645F]">
                  {{ groupInfo.memberCount }} {{ groupInfo.memberCount === 1 ? 'member' : 'members' }}
                </span>
                <span class="rounded-full bg-[#F0F4F3] px-3 py-1.5 text-xs font-semibold text-[#27595D]">
                  Your role: {{ groupRoleLabel(groupInfo.role) }}
                </span>
              </div>
            </div>
          </section>

          <section class="grid gap-3 sm:grid-cols-2" aria-label="Group details">
            <div class="rounded-2xl border border-[#D8E7E3] bg-white p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#61777B]">Access</p>
              <p class="mt-2 text-sm font-medium text-[#102F35]">
                {{ groupAccessPolicyLabel(groupInfo.accessPolicy) }}
              </p>
            </div>
            <div class="rounded-2xl border border-[#D8E7E3] bg-white p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#61777B]">Created</p>
              <p class="mt-2 text-sm font-medium text-[#102F35]">{{ formatProfileDate(groupCreatedAt) }}</p>
            </div>
          </section>

          <section aria-labelledby="group-members-heading">
            <div class="mb-3 flex items-baseline justify-between gap-3">
              <h3 id="group-members-heading" class="text-sm font-semibold text-[#102F35]">Participants</h3>
              <span class="text-xs text-[#61777B]">{{ groupMembers.length }} listed</span>
            </div>
            <div v-if="groupMembers.length" class="overflow-hidden rounded-2xl border border-[#D8E7E3] bg-white">
              <button
                v-for="member in groupMembers"
                :key="member.id"
                type="button"
                class="harbor-ghost-action flex w-full items-center gap-3 border-b border-[#E5EFEC] px-4 py-3 text-left last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0B7A75]"
                :aria-label="`View profile for ${member.name}`"
                @click="openContactProfile(member.id, member.name)"
              >
                <span
                  class="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#DDF1ED] text-xs font-semibold text-[#0B7A75]"
                >
                  {{ userInitials(member.name) }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold">{{ member.name }}</span>
                  <span class="block truncate text-xs text-[#61777B]"
                    >Joined {{ formatProfileDate(member.joinedAt) }}</span
                  >
                </span>
                <span class="flex shrink-0 flex-wrap justify-end gap-1.5">
                  <span
                    v-if="member.id === currentUser?.id"
                    class="rounded-full bg-[#EAF7F4] px-2 py-1 text-[11px] font-semibold text-[#17645F]"
                  >
                    You
                  </span>
                  <span class="rounded-full bg-[#F0F4F3] px-2 py-1 text-[11px] font-semibold text-[#27595D]">
                    {{ groupRoleLabel(member.role) }}
                  </span>
                </span>
              </button>
            </div>
            <p v-else class="rounded-2xl border border-[#D8E7E3] bg-white p-4 text-sm text-[#61777B]">
              No participants are listed for this group.
            </p>
          </section>

          <section class="rounded-2xl border border-[#D8E7E3] bg-[#F0F7F5] p-4" aria-labelledby="group-media-heading">
            <p id="group-media-heading" class="text-sm font-semibold text-[#102F35]">Shared media</p>
            <p class="mt-1 text-sm leading-6 text-[#4E6B70]">No group media yet. Media assets are not available.</p>
          </section>
        </div>
      </HarborDialogContent>
    </Dialog>

    <Dialog :open="isContactProfileDialogOpen" @update:open="setContactProfileDialogOpen">
      <HarborDialogContent
        overlay-class="bg-[#102F35]/30 backdrop-blur-md"
        class="marketing-font flex top-[calc(50%+2.25rem)] max-h-[calc(100dvh-6rem)] w-[calc(100%-2rem)] max-w-3xl flex-col rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-5 text-[#102F35] shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full sm:p-6"
        @open-auto-focus="preventDialogAutoFocus"
        @close-auto-focus="preventProfileTriggerFocus"
      >
        <DialogHeader>
          <DialogTitle>Contact profile</DialogTitle>
          <DialogDescription class="text-[#61777B]">Profile details shared with accepted friends.</DialogDescription>
        </DialogHeader>

        <div v-if="isContactProfileLoading" class="flex min-h-64 items-center justify-center" aria-live="polite">
          <LoadingRipple class="size-7 text-[#0B7A75]" />
          <span class="sr-only">Loading contact profile</span>
        </div>

        <div v-else-if="contactProfile" class="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          <p
            v-if="contactProfileError"
            class="rounded-xl border border-[#F2C7BE] bg-[#FFF4F0] px-4 py-3 text-sm text-[#9D4636]"
            role="alert"
          >
            {{ contactProfileError }}
          </p>
          <section
            class="flex flex-col gap-5 rounded-2xl border border-[#D8E7E3] bg-white p-5 sm:flex-row sm:items-start sm:p-6"
          >
            <span
              class="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] text-xl font-semibold text-[#0B7A75]"
            >
              <img
                v-if="friendAvatarUrls[contactProfile.id]"
                :src="friendAvatarUrls[contactProfile.id]"
                alt=""
                class="size-full object-cover"
              />
              <template v-else>{{ userInitials(contactProfile.name) }}</template>
            </span>
            <div class="min-w-0 flex-1">
              <h3 class="truncate text-xl font-semibold tracking-[-0.025em]">{{ contactProfile.name }}</h3>
              <p class="mt-1 truncate text-sm text-[#61777B]">{{ contactProfile.email }}</p>
              <p class="mt-4 text-sm leading-6 text-[#4E6B70]">
                {{ contactProfile.statusMessage || 'No status message.' }}
              </p>
              <span
                class="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
                :class="contactStatusClass(contactProfile.status)"
              >
                <component :is="contactStatusIcon(contactProfile.status)" class="size-4" />
                {{ contactStatusLabel(contactProfile.status) }}
              </span>
            </div>
          </section>

          <section class="grid gap-3 sm:grid-cols-2" aria-label="Profile activity">
            <div class="rounded-2xl border border-[#D8E7E3] bg-white p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#61777B]">Joined</p>
              <p class="mt-2 text-sm font-medium text-[#102F35]">{{ formatProfileDate(contactProfile.createdAt) }}</p>
            </div>
            <div class="rounded-2xl border border-[#D8E7E3] bg-white p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#61777B]">Last active</p>
              <p class="mt-2 text-sm font-medium text-[#102F35]">{{ formatProfileDate(contactProfile.lastSeenAt) }}</p>
            </div>
          </section>

          <section class="rounded-2xl border border-[#D8E7E3] bg-[#F0F7F5] p-4" aria-labelledby="shared-media-heading">
            <p id="shared-media-heading" class="text-sm font-semibold text-[#102F35]">Shared media</p>
            <p class="mt-1 text-sm leading-6 text-[#4E6B70]">
              No shared media yet. Encrypted attachments are not available, so media cannot be shared in this
              conversation.
            </p>
          </section>

          <DialogFooter class="gap-2 sm:justify-end">
            <Button
              class="harbor-primary-action w-full rounded-full bg-[#0B7A75] text-white sm:w-auto"
              @click="startSelectedConversationCall"
            >
              <Phone class="size-4" />
              Start direct call
            </Button>
          </DialogFooter>
        </div>
      </HarborDialogContent>
    </Dialog>
  </main>
</template>
