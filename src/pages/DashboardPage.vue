<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { Picker } from 'emoji-picker-element';
import {
  ArrowLeft,
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleUserRound,
  Clock3,
  LockKeyhole,
  MessageCircleMore,
  MinusCircle,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Smile,
  UserMinus,
  UserPlus,
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
  type UserSearchResult,
  socialApi,
} from '@/services/social-api';

const router = useRouter();
const { accessToken, currentUser, isAuthenticated, isCheckingSession } = useAuth();

const conversations = ref<Conversation[]>([]);
const friends = ref<Friend[]>([]);
const incomingFriendRequests = ref<FriendRequest[]>([]);
const directRequests = ref<DirectMessageRequest[]>([]);
const searchQuery = ref('');
const isConversationSearchOpen = ref(false);
const friendSearchQuery = ref('');
const isFriendSearchOpen = ref(false);
const showAllFriends = ref(false);
const isFriendFinderOpen = ref(false);
const friendFinderQuery = ref('');
const friendSearchResults = ref<UserSearchResult[]>([]);
const conversationSearchInput = ref<HTMLInputElement | null>(null);
const friendSearchInput = ref<HTMLInputElement | null>(null);
const friendFinderInput = ref<HTMLInputElement | null>(null);
const isSearchingUsers = ref(false);
const selectedConversation = ref<Conversation | null>(null);
const pendingDirectFriend = ref<Friend | null>(null);
const isLoading = ref(true);
const isOpeningDirect = ref<string | null>(null);
const isAddingFriend = ref(false);
const isRemovingFriend = ref<string | null>(null);
const isRespondingToFriendRequest = ref<string | null>(null);
const isCreatingGroup = ref(false);
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
let friendRefreshRequest = 0;
let contactProfileRequest = 0;
let groupProfileRequest = 0;
let messageRequest = 0;
let emojiPicker: Picker | null = null;

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const chatStateInitial = computed(() => (prefersReducedMotion.value ? false : { opacity: 0, y: 8, scale: 0.99 }));
const chatStateExit = computed(() => (prefersReducedMotion.value ? undefined : { opacity: 0, y: -6, scale: 0.99 }));
const chatStateTransition = computed(() =>
  prefersReducedMotion.value ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' as const },
);
const showNotificationPermissionWarning = computed(
  () => notificationPermission.value === 'default' || notificationPermission.value === 'denied',
);

const friendById = computed(() => new Map(friends.value.map((friend) => [friend.id, friend])));
const filteredConversations = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  if (!query) return conversations.value;

  return conversations.value.filter((conversation) =>
    conversationName(conversation).toLocaleLowerCase().includes(query),
  );
});
const filteredFriends = computed(() => {
  const query = friendSearchQuery.value.trim().toLocaleLowerCase();

  return [...friends.value]
    .sort((first, second) => first.name.localeCompare(second.name))
    .filter(
      (friend) =>
        !query || friend.name.toLocaleLowerCase().includes(query) || friend.email.toLocaleLowerCase().includes(query),
    );
});
const visibleFriends = computed(() =>
  showAllFriends.value ? filteredFriends.value : filteredFriends.value.slice(0, 5),
);
const canToggleFriends = computed(() => filteredFriends.value.length > 5);
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
  const activity = conversationActivity.value[conversationId];
  if (!activity?.unreadCount) return;

  conversationActivity.value = {
    ...conversationActivity.value,
    [conversationId]: { ...activity, unreadCount: 0 },
  };
}

function unreadCount(conversation: Conversation) {
  return conversationActivity.value[conversation.id]?.unreadCount ?? 0;
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

async function excludeUnsentDirectDrafts(accessToken: string, conversationData: Conversation[]) {
  const directConversations = conversationData.filter((conversation) => conversation.kind === 'direct');
  const directConversationIdsWithMessages = new Set(
    await Promise.all(
      directConversations.map(async (conversation) => {
        try {
          const response = await socialApi.listConversationMessages(accessToken, conversation.id);
          return response.messages.length ? conversation.id : null;
        } catch (error) {
          // Keep a conversation visible when its history cannot be checked.
          console.error('[Dashboard] Failed to check direct conversation history:', error);
          return conversation.id;
        }
      }),
    ),
  );

  return conversationData.filter(
    (conversation) => conversation.kind !== 'direct' || directConversationIdsWithMessages.has(conversation.id),
  );
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
    incomingFriendRequests.value = friendData.incomingRequests;
    conversations.value = sortConversationsByActivity(
      await excludeUnsentDirectDrafts(token, conversationData),
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

  const request = ++friendRefreshRequest;
  try {
    const friendData = await socialApi.listFriends(token);
    if (request !== friendRefreshRequest) return;
    friends.value = friendData.friends;
    incomingFriendRequests.value = friendData.incomingRequests;
  } catch (error) {
    console.error('[Dashboard] Failed to refresh friends:', error);
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

watch(friendFinderQuery, async (query) => {
  const normalizedQuery = query.trim();
  const request = ++friendSearchRequest;

  if (normalizedQuery.replace(/\s/g, '').length < 2) {
    friendSearchResults.value = [];
    isSearchingUsers.value = false;
    return;
  }

  const token = accessToken.value;
  if (!token) return;

  isSearchingUsers.value = true;
  try {
    const results = await socialApi.searchUsers(token, normalizedQuery);
    if (request === friendSearchRequest) friendSearchResults.value = results;
  } catch (error) {
    console.error('[Dashboard] Failed to find users:', error);
    if (request === friendSearchRequest) {
      friendSearchResults.value = [];
      feedbackError.value = 'Could not search registered accounts.';
    }
  } finally {
    if (request === friendSearchRequest) isSearchingUsers.value = false;
  }
});

watch([feedbackError, feedbackMessage], ([error, message], _, onCleanup) => {
  if (!error && !message) return;

  const timer = window.setTimeout(clearFeedback, 3_000);
  onCleanup(() => window.clearTimeout(timer));
});

watch(selectedConversation, (conversation) => {
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
    email: 'Profile details unavailable',
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

function openGroupProfile() {
  const token = accessToken.value;
  const group = selectedConversation.value;
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

function toggleFriendSearch() {
  isFriendSearchOpen.value = !isFriendSearchOpen.value;
  if (isFriendSearchOpen.value) isFriendFinderOpen.value = false;
  if (isFriendSearchOpen.value) nextTick(() => friendSearchInput.value?.focus());
}

function toggleFriendFinder() {
  isFriendFinderOpen.value = !isFriendFinderOpen.value;
  if (isFriendFinderOpen.value) isFriendSearchOpen.value = false;
  if (isFriendFinderOpen.value) nextTick(() => friendFinderInput.value?.focus());
}

function preventProfileTriggerFocus(event: Event) {
  event.preventDefault();
}

function preventDialogAutoFocus(event: Event) {
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

onMounted(() => {
  document.addEventListener('pointerdown', closeEmojiPickerOnOutsideClick);
  document.addEventListener('keydown', closeEmojiPickerOnEscape);
  window.addEventListener('openmeet:notifications-received', handleSocialNotifications);
  void requestNotificationPermission();
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeEmojiPickerOnOutsideClick);
  document.removeEventListener('keydown', closeEmojiPickerOnEscape);
  window.removeEventListener('openmeet:notifications-received', handleSocialNotifications);
  emojiPicker?.removeEventListener('emoji-click', handleEmojiClick);
  emojiPicker?.remove();
});

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
    isFriendFinderOpen.value = false;
    friendFinderQuery.value = '';
    friendSearchResults.value = [];
    feedbackMessage.value = 'Friend request sent.';
  } catch (error) {
    console.error('[Dashboard] Failed to send friend request:', error);
    feedbackError.value = 'Could not send friend request.';
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
  <div v-if="isCheckingSession" class="flex h-[calc(100dvh-84px)] items-center justify-center bg-[#F6FAF7]">
    <LoadingRipple class="size-8 text-[#0B7A75]" />
    <span class="sr-only">Loading workspace</span>
  </div>

  <main
    v-else-if="isAuthenticated"
    class="marketing-font h-[calc(100dvh-84px)] overflow-hidden bg-[#F6FAF7] p-3 text-[#102F35] sm:p-5"
  >
    <motion.div
      :initial="{ opacity: 0, y: 10 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.35 }"
      class="mx-auto h-full max-w-[1600px] overflow-hidden rounded-[1.75rem] border border-[#D8E7E3] bg-white shadow-[0_20px_70px_rgba(16,47,53,0.1)] lg:grid lg:grid-cols-[20rem_minmax(0,1fr)_18rem]"
    >
      <aside
        class="flex h-full min-h-0 flex-col border-b border-[#D8E7E3] bg-[#FBFCF8] lg:border-b-0 lg:border-r"
        :class="{ 'hidden lg:flex': hasSelectedConversation }"
        aria-label="Conversations"
      >
        <div class="border-b border-[#E5EFEC] px-4 py-4 sm:px-5">
          <div class="flex items-center justify-between gap-3">
            <h1 class="min-w-0 text-xs font-semibold uppercase tracking-[0.14em] text-[#61777B]">Messages</h1>
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

        <div class="min-h-0 flex-1 overflow-y-auto p-2" aria-live="polite">
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
          <div v-if="isLoading" class="flex min-h-44 items-center justify-center">
            <LoadingRipple class="size-6 text-[#0B7A75]" />
            <span class="sr-only">Loading conversations</span>
          </div>
          <p v-else-if="!filteredConversations.length" class="px-3 py-8 text-center text-sm text-[#61777B]">
            {{ searchQuery ? 'No conversations match your search.' : 'No conversations yet.' }}
          </p>
          <nav v-else aria-label="Persistent conversations" class="space-y-1">
            <button
              v-for="conversation in filteredConversations"
              :key="conversation.id"
              type="button"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
              :class="[
                'harbor-ghost-action',
                selectedConversation?.id === conversation.id ? 'bg-[#E6F4F1] !text-[#102F35]' : '',
              ]"
              :aria-current="selectedConversation?.id === conversation.id ? 'page' : undefined"
              @click="selectConversation(conversation)"
            >
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-full"
                :class="conversation.kind === 'group' ? 'bg-[#102F35] text-white' : 'bg-[#DDF1ED] text-[#0B7A75]'"
              >
                <UsersRound v-if="conversation.kind === 'group'" class="size-4" />
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
          </nav>
        </div>

        <section
          class="flex max-h-[min(38dvh,23rem)] min-h-0 shrink-0 flex-col overflow-hidden border-t border-[#E5EFEC] p-3"
          aria-labelledby="friends-heading"
        >
          <div class="flex items-center justify-between gap-2 px-2">
            <h2 id="friends-heading" class="text-xs font-semibold uppercase tracking-[0.14em] text-[#61777B]">
              Friends
            </h2>
            <div class="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                class="harbor-ghost-action size-8 rounded-full text-[#0B7A75]"
                :class="{ 'bg-[#E6F4F1] !text-[#102F35]': isFriendSearchOpen }"
                :aria-expanded="isFriendSearchOpen"
                aria-controls="friend-search"
                aria-label="Search friends"
                title="Search friends"
                @click="toggleFriendSearch"
              >
                <Search class="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                class="harbor-ghost-action size-8 rounded-full text-[#0B7A75]"
                :class="{ 'bg-[#E6F4F1] !text-[#102F35]': isFriendFinderOpen }"
                :aria-expanded="isFriendFinderOpen"
                aria-controls="friend-finder"
                aria-label="Find registered users"
                title="Find registered users"
                @click="toggleFriendFinder"
              >
                <UserPlus class="size-4" />
              </Button>
            </div>
          </div>
          <div
            id="friend-search"
            class="grid px-2 transition-[grid-template-rows,margin] duration-300 ease-out motion-reduce:transition-none"
            :class="isFriendSearchOpen ? 'mt-2 grid-rows-[1fr]' : 'mt-0 grid-rows-[0fr]'"
          >
            <label class="relative min-h-0 overflow-hidden">
              <span class="sr-only">Search friends</span>
              <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#809697]" />
              <Input
                ref="friendSearchInput"
                v-model="friendSearchQuery"
                type="search"
                placeholder="Search friends"
                class="h-9 rounded-xl border-[#D8E7E3] bg-white pl-9 text-xs text-[#102F35] placeholder:text-[#809697] focus-visible:border-[#D8E7E3] focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </label>
          </div>
          <div
            id="friend-finder"
            class="grid px-2 transition-[grid-template-rows,margin] duration-300 ease-out motion-reduce:transition-none"
            :class="isFriendFinderOpen ? 'mt-2 grid-rows-[1fr]' : 'mt-0 grid-rows-[0fr]'"
          >
            <div class="min-h-0 overflow-hidden">
              <label class="relative block">
                <span class="sr-only">Find registered users</span>
                <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#809697]" />
                <Input
                  ref="friendFinderInput"
                  v-model="friendFinderQuery"
                  type="search"
                  placeholder="Find registered users"
                  class="h-9 rounded-xl border-[#D8E7E3] bg-white pl-9 text-xs text-[#102F35] placeholder:text-[#809697] focus-visible:border-[#D8E7E3] focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </label>
              <p
                v-if="friendFinderQuery.trim() && friendFinderQuery.replace(/\s/g, '').length < 2"
                class="mt-2 text-xs text-[#61777B]"
              >
                Enter at least two characters.
              </p>
              <div v-else-if="isSearchingUsers" class="flex h-16 items-center justify-center">
                <LoadingRipple class="size-4 text-[#0B7A75]" />
                <span class="sr-only">Searching registered users</span>
              </div>
              <div v-else-if="friendSearchResults.length" class="mt-2 space-y-1">
                <div
                  v-for="result in friendSearchResults"
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
              <p v-else-if="friendFinderQuery.replace(/\s/g, '').length >= 2" class="mt-2 text-xs text-[#61777B]">
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
                  class="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#DDF1ED] text-xs font-semibold text-[#0B7A75]"
                >
                  {{ userInitials(request.user.name) }}
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
            <div v-if="visibleFriends.length" id="friend-list" class="mt-2 space-y-1 px-2">
              <ContextMenu v-for="friend in visibleFriends" :key="friend.id">
                <ContextMenuTrigger as-child>
                  <button
                    type="button"
                    class="harbor-ghost-action flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                    :aria-label="`Open direct conversation with ${friend.name}`"
                    @click="openFriendConversation(friend)"
                  >
                    <span
                      class="relative flex size-8 items-center justify-center rounded-full bg-[#DDF1ED] text-xs font-semibold text-[#0B7A75]"
                    >
                      {{ userInitials(friend.name) }}
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
                  class="harbor-action-menu min-w-52 rounded-[1.25rem] border-[#D8E7E3] bg-white p-2 text-[#102F35] shadow-[0_20px_55px_rgba(16,47,53,0.16)]"
                >
                  <ContextMenuLabel class="px-3 py-1 text-xs uppercase tracking-[0.12em] text-[#61777B]">
                    {{ friend.name }}
                  </ContextMenuLabel>
                  <ContextMenuSeparator class="mx-1 my-2 bg-[#E5EFEC]" />
                  <ContextMenuItem
                    :disabled="isRemovingFriend !== null"
                    class="min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-[#C4513D] focus:bg-[#FFF0EA] focus:text-[#A94332]"
                    @select="removeFriend(friend)"
                  >
                    <UserMinus class="size-4" aria-hidden="true" />
                    {{ isRemovingFriend === friend.id ? 'Removing...' : 'Remove friend' }}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </div>
            <p v-else-if="!isLoading && friends.length" class="px-2 py-2 text-xs text-[#61777B]">
              No friends match your search.
            </p>
            <p v-else-if="!isLoading" class="px-2 py-2 text-xs text-[#61777B]">No accepted friends.</p>
            <Button
              v-if="canToggleFriends"
              size="icon"
              variant="ghost"
              class="harbor-ghost-action ml-2 mt-1 size-8 rounded-full text-[#0B7A75]"
              aria-controls="friend-list"
              :aria-expanded="showAllFriends"
              :aria-label="showAllFriends ? 'Show fewer friends' : 'Show all friends'"
              :title="showAllFriends ? 'Show fewer friends' : 'Show all friends'"
              @click="showAllFriends = !showAllFriends"
            >
              <ChevronUp v-if="showAllFriends" class="size-4" />
              <ChevronDown v-else class="size-4" />
            </Button>
          </div>
        </section>
      </aside>

      <section
        class="flex h-full min-h-0 min-w-0 flex-col bg-white"
        :class="{ 'hidden lg:flex': !hasSelectedConversation }"
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
                <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#DDF1ED] text-[#0B7A75]">
                  <span class="text-xs font-semibold">{{ userInitials(selectedFriend.name) }}</span>
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
                @click="openGroupProfile"
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
                  <p>Enable notifications for messages and calls.</p>
                  <Button
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
                        class="absolute bottom-full right-0 z-20 mb-2 overflow-hidden rounded-2xl border border-[#D8E7E3] bg-white p-1 shadow-[0_18px_48px_rgba(16,47,53,0.18)]"
                      >
                        <div ref="emojiPickerMount" class="max-h-[min(26rem,55dvh)] overflow-y-auto" />
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

    <motion.div
      v-if="feedbackError || feedbackMessage"
      :initial="{ opacity: 0, y: 12, scale: 0.98 }"
      :animate="{ opacity: 1, y: 0, scale: 1 }"
      :exit="{ opacity: 0, y: 8, scale: 0.98 }"
      :transition="{ duration: 0.2, ease: 'easeOut' }"
      class="fixed bottom-4 left-1/2 z-40 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2"
      aria-live="polite"
    >
      <p
        v-if="feedbackError"
        role="alert"
        class="flex items-center gap-2 rounded-xl border border-[#F2C7BE] bg-[#FFF4F0] px-4 py-3 text-sm text-[#9D4636] shadow-lg"
      >
        <CircleAlert class="size-4 shrink-0" />
        {{ feedbackError }}
      </p>
      <p v-else class="rounded-xl border border-[#BBDDD6] bg-[#EDF8F5] px-4 py-3 text-sm text-[#17645F] shadow-lg">
        {{ feedbackMessage }}
      </p>
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
        class="marketing-font flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl flex-col rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-5 text-[#102F35] shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full sm:p-6"
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
        class="marketing-font w-[calc(100%-2rem)] max-w-3xl rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-5 text-[#102F35] shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full sm:p-6"
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

        <div v-else-if="contactProfile" class="space-y-6">
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
              class="flex size-20 shrink-0 items-center justify-center rounded-full bg-[#DDF1ED] text-xl font-semibold text-[#0B7A75]"
            >
              {{ userInitials(contactProfile.name) }}
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
