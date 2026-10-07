import { authApi } from '@/services/auth-api';
import { cookieUtils } from '@/utils';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';
let refreshInFlight: { refreshToken: string; promise: Promise<string> } | null = null;

function expireSession() {
  cookieUtils.remove('accessToken');
  cookieUtils.remove('refreshToken');
  window.dispatchEvent(new Event('openmeet:session-expired'));
}

export type UserStatus = 'available' | 'away' | 'doNotDisturb' | 'sleeping' | 'offline';

export interface Friend {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  avatarUrl?: string | null;
  isOnline: boolean;
  /** Null when the viewer may not see this person's status. */
  status?: UserStatus | null;
  friendshipId?: string;
}

/** People search returns public identity only. */
export interface UserSearchResult {
  id: string;
  name: string;
  nickname: string;
  avatarUrl: string | null;
}

export interface ContactProfile {
  id: string;
  name: string;
  nickname: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
  statusMessage: string;
  createdAt: string;
  lastSeenAt: string | null;
  isOnline: boolean;
  /** `none` means not friends: only public fields are filled in. */
  relationship: 'owner' | 'friend' | 'none';
}

export interface UpdateCurrentUserProfileRequest {
  name: string;
  nickname: string;
  statusMessage: string;
}

export interface FriendRequest {
  id: string;
  user: Friend;
  createdAt: string;
}

export interface FriendsResponse {
  friends: Friend[];
  incomingRequests: FriendRequest[];
}

export interface UserNotification {
  id: string;
  kind: string;
  actorId: string;
  actorName: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface CallInvitation {
  id: string;
  roomId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: string;
  caller: Friend | null;
}

export interface CallSession {
  id: string;
  roomId: string;
  expiresAt: string;
}

export interface CallSessionJoinResponse {
  roomId: string;
}

export interface CallSessionResponse {
  accepted: boolean;
  roomId?: string;
}

export interface CallSessionNotification {
  id: string;
  conversationId: string;
  initiatorId: string;
  expiresAt: string;
  createdAt: string;
}

export interface RecentMeeting {
  id: string;
  roomId: string;
  lastJoinedAt: string;
}

/** One person in a recorded meeting; reconnects are merged. Guests have no user ID. */
export interface MeetingPerson {
  userId: string | null;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  /** Null while the person is still in the meeting. */
  leftAt: string | null;
  isYou: boolean;
}

export interface MeetingSession {
  id: string;
  roomId: string;
  /** Set for calls started from a conversation; their links use this ID. */
  callSessionId: string | null;
  conversationId: string | null;
  /** Who could join a hosted meeting; null for conversation calls and meetings without a host. */
  accessPolicy: GroupAccessPolicy | null;
  startedAt: string;
  /** Null while the meeting is live. */
  endedAt: string | null;
  participantCount: number;
  /** History lists name a few other people; the detail lists everyone, including you. */
  participants: MeetingPerson[];
  /** A call that rang for you and that you never answered. */
  missed: boolean;
  /** A missed call you have not opened or marked read yet. */
  unread: boolean;
}

/** Sidebar badge counts, computed by the server from unread, pending and missed items. */
export interface BadgeCounts {
  /** Conversations with unread messages, plus pending direct-message requests and group invitations. */
  messages: number;
  /** Incoming friend requests. */
  friends: number;
  /** Missed calls the user has not read yet. */
  calls: number;
}

export interface MeetingSessionsPage {
  meetings: MeetingSession[];
  nextBefore: string | null;
}

export interface MeetingRoomSummary {
  status: 'live' | 'ended';
  startedAt: string;
  endedAt: string | null;
  participantCount: number;
  liveParticipantCount: number;
}

export interface MeetingParticipantPresence {
  participantId: string;
  userId: string;
  /** Null when the person does not share their status with meeting peers. */
  status: UserStatus | null;
  avatarUrl: string | null;
}

export interface MeetingRoomAccess {
  roomId: string;
  /** False for rooms without a host; they are open and have no settings. */
  managed: boolean;
  accessPolicy: GroupAccessPolicy;
  isOwner: boolean;
  canJoin: boolean;
  requiresPassword: boolean;
  ownerName: string | null;
  deniedReason: string | null;
}

export interface MeetingRoomSettings {
  accessPolicy: GroupAccessPolicy;
  /** Required when switching to a password; omitted keeps the current password. */
  password?: string;
}

export interface MeetingInvitationCandidate {
  id: string;
  name: string;
  nickname: string;
  avatarUrl: string | null;
  isFriend: boolean;
  invited: boolean;
}

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  hasImage: boolean;
}

export type AvatarSize = 'thumb' | 'full';
export type ConversationKind = 'group' | 'direct';
export type GroupAccessPolicy = 'open' | 'password' | 'friendsOnly' | 'friendsOfFriends';
export type GroupMemberRole = 'admin' | 'member';

export interface Conversation {
  id: string;
  kind: ConversationKind;
  title: string | null;
  accessPolicy: GroupAccessPolicy | null;
  groupCode: string | null;
  avatarUrl: string | null;
  role: string | null;
  otherUserId: string | null;
  messageCount: number;
  unreadCount: number;
  markedUnread: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupRequest {
  title: string;
  accessPolicy: GroupAccessPolicy;
  password?: string;
  memberIds?: string[];
}

export interface UpdateGroupPolicyRequest {
  accessPolicy: GroupAccessPolicy;
  password?: string;
}

export interface UpdateGroupRequest {
  title?: string;
  accessPolicy?: GroupAccessPolicy;
  password?: string;
}

export interface GroupInfo {
  id: string;
  title: string;
  accessPolicy: GroupAccessPolicy;
  groupCode: string;
  avatarUrl: string | null;
  createdAt: string;
  memberCount: number;
  isMember: boolean;
  role: string | null;
  canJoin: boolean;
}

export interface GroupMember {
  id: string;
  name: string;
  nickname: string;
  avatarUrl: string | null;
  isOnline: boolean;
  status: UserStatus | null;
  role: string;
  joinedAt: string;
}

export interface GroupMembersPage {
  members: GroupMember[];
  nextOffset: number | null;
}

export interface GroupCandidate {
  id: string;
  name: string;
  nickname: string;
}

export interface GroupCandidatesPage {
  results: GroupCandidate[];
  nextOffset: number | null;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  groupTitle: string;
  accessPolicy: GroupAccessPolicy;
  inviterId: string;
  inviterName: string;
  createdAt: string;
}

export interface OpenDirectConversationResponse {
  state: 'available' | 'pending' | 'declined';
  conversation: Conversation | null;
  requestId: string | null;
}

export interface DirectMessageRequest {
  id: string;
  requesterId: string;
  createdAt: string;
}

export interface MessageReplyPreview {
  sequence: number;
  senderId: string;
  senderName: string;
  senderNickname: string;
  /** Short excerpt of the quoted message. */
  content: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface ConversationMessageAttachment {
  id: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  url: string;
}

export interface ConversationMessage {
  sequence: number;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderNickname?: string;
  content: string;
  createdAt: string;
  replyTo?: MessageReplyPreview | null;
  reactions?: MessageReaction[];
  attachments?: ConversationMessageAttachment[];
}

export interface ConversationMessagesResponse {
  messages: ConversationMessage[];
  nextBefore: number | null;
}

export class SocialApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'SocialApiError';
  }
}

async function refreshAccessToken(): Promise<string> {
  const previousAccessToken = cookieUtils.get('accessToken');
  const refreshToken = cookieUtils.get('refreshToken');
  if (!refreshToken) {
    expireSession();
    throw new SocialApiError('Missing refresh token', 401);
  }

  const refreshRequest =
    refreshInFlight?.refreshToken === refreshToken
      ? refreshInFlight
      : {
          refreshToken,
          promise: authApi.refresh(refreshToken).then(({ access_token }) => access_token),
        };
  refreshInFlight = refreshRequest;

  let accessToken: string;
  try {
    accessToken = await refreshRequest.promise;
  } catch (error) {
    if (cookieUtils.get('accessToken') === previousAccessToken && cookieUtils.get('refreshToken') === refreshToken) {
      expireSession();
    }
    throw error;
  } finally {
    if (refreshInFlight === refreshRequest) refreshInFlight = null;
  }

  const currentAccessToken = cookieUtils.get('accessToken');
  if (cookieUtils.get('refreshToken') !== refreshToken) {
    throw new SocialApiError('Session changed while refreshing', 401);
  }
  if (currentAccessToken !== previousAccessToken) {
    if (currentAccessToken) return currentAccessToken;
    throw new SocialApiError('Session changed while refreshing', 401);
  }

  cookieUtils.set('accessToken', accessToken, 1);
  window.dispatchEvent(new CustomEvent<string>('openmeet:access-token-refreshed', { detail: accessToken }));
  return accessToken;
}

async function sendAuthorizedRequest(send: (accessToken: string) => Promise<Response>): Promise<Response> {
  let accessToken = cookieUtils.get('accessToken') ?? (await refreshAccessToken());
  let response = await send(accessToken);

  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    response = await send(accessToken);
  }

  if (response.status === 401 && cookieUtils.get('accessToken') === accessToken && cookieUtils.get('refreshToken')) {
    expireSession();
  }
  return response;
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = (await response.text()) || `Request failed with status ${response.status}`;
    throw new SocialApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** Endpoints guests may call too: signed-in users send their token, guests send none. */
async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (hasStoredSession()) return request<T>(path, '', init);
  return readResponse<T>(
    await fetch(`${API_BASE_URL}/social${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    }),
  );
}

async function request<T>(path: string, _accessToken: string, init?: RequestInit): Promise<T> {
  const response = await sendAuthorizedRequest((accessToken) =>
    fetch(`${API_BASE_URL}/social${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${accessToken}`,
        ...init?.headers,
      },
    }),
  );
  return readResponse<T>(response);
}

/** Guests have no tokens; calling the API without one would end a session that never existed. */
export function hasStoredSession() {
  return !!(cookieUtils.get('accessToken') || cookieUtils.get('refreshToken'));
}

export const socialApi = {
  resolveMediaUrl(path: string | null) {
    if (!path || /^https?:\/\//.test(path)) return path;
    return `${API_BASE_URL}${path}`;
  },

  // Lists and avatars use small server-rendered thumbnails; only expanded previews request the full image.
  async loadAvatar(_accessToken: string, path: string, size: AvatarSize = 'thumb') {
    const sizedPath = size === 'thumb' ? `${path}${path.includes('?') ? '&' : '?'}size=thumb` : path;
    const response = await sendAuthorizedRequest((accessToken) =>
      fetch(this.resolveMediaUrl(sizedPath)!, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    if (!response.ok) {
      throw new SocialApiError((await response.text()) || 'Could not load avatar', response.status);
    }
    return response.blob();
  },

  async loadConversationAttachment(_accessToken: string, path: string) {
    const response = await sendAuthorizedRequest((accessToken) =>
      fetch(this.resolveMediaUrl(path)!, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    if (!response.ok) {
      throw new SocialApiError((await response.text()) || 'Could not load attachment', response.status);
    }
    return response.blob();
  },

  searchUsers(accessToken: string, query: string) {
    return request<UserSearchResult[]>(`/users?query=${encodeURIComponent(query)}`, accessToken);
  },

  getUserProfile(accessToken: string, userId: string) {
    return request<ContactProfile>(`/users/${userId}/profile`, accessToken);
  },

  updateCurrentUserProfile(accessToken: string, profile: UpdateCurrentUserProfileRequest) {
    return request<ContactProfile>('/me/profile', accessToken, {
      method: 'PATCH',
      body: JSON.stringify(profile),
    });
  },

  updateCurrentUserStatus(accessToken: string, status: UserStatus) {
    return request<ContactProfile>('/me/profile', accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  getCurrentUserProfile(accessToken: string) {
    return request<ContactProfile>('/me/profile', accessToken);
  },

  uploadCurrentUserAvatar(accessToken: string, avatar: File) {
    const body = new FormData();
    body.append('avatar', avatar);
    return request<ContactProfile>('/me/profile/avatar', accessToken, { method: 'POST', body });
  },

  removeCurrentUserAvatar(accessToken: string) {
    return request<void>('/me/profile/avatar', accessToken, { method: 'DELETE' });
  },

  listFriends(accessToken: string) {
    return request<FriendsResponse>('/friends', accessToken);
  },

  addFriend(accessToken: string, email: string) {
    return request<void>('/friends', accessToken, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  addFriendById(accessToken: string, userId: string) {
    return request<void>('/friends', accessToken, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  acceptFriend(accessToken: string, requestId: string) {
    return request<void>(`/friends/${requestId}/accept`, accessToken, { method: 'POST' });
  },

  declineFriend(accessToken: string, requestId: string) {
    return request<void>(`/friends/${requestId}`, accessToken, { method: 'DELETE' });
  },

  removeFriend(accessToken: string, friendshipId: string) {
    return request<void>(`/friends/${friendshipId}`, accessToken, { method: 'DELETE' });
  },

  listNotifications(accessToken: string) {
    return request<UserNotification[]>('/notifications', accessToken);
  },

  markNotificationRead(accessToken: string, notificationId: string) {
    return request<void>(`/notifications/${notificationId}/read`, accessToken, { method: 'POST' });
  },

  updatePresence(accessToken: string) {
    return request<void>('/presence', accessToken, { method: 'POST' });
  },

  createCall(accessToken: string, friendId: string) {
    return request<CallInvitation>('/calls', accessToken, {
      method: 'POST',
      body: JSON.stringify({ friendId }),
    });
  },

  startConversationCall(accessToken: string, conversationId: string) {
    return request<CallSession>(`/conversations/${conversationId}/call-sessions`, accessToken, {
      method: 'POST',
    });
  },

  getCallSession(accessToken: string, callSessionId: string) {
    return request<CallSessionJoinResponse>(`/call-sessions/${callSessionId}`, accessToken);
  },

  respondToCallSession(accessToken: string, callSessionId: string, accept: boolean) {
    return request<CallSessionResponse>(`/call-sessions/${callSessionId}/respond`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ accept }),
    });
  },

  listIncomingCallSessions(accessToken: string) {
    return request<CallSessionNotification[]>('/call-sessions/incoming', accessToken);
  },

  listIncomingCalls(accessToken: string) {
    return request<CallInvitation[]>('/calls/incoming', accessToken);
  },

  respondToCall(accessToken: string, invitationId: string, accept: boolean) {
    return request<CallInvitation>(`/calls/${invitationId}/respond`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ accept }),
    });
  },

  listMeetings(accessToken: string) {
    return request<RecentMeeting[]>('/meetings', accessToken);
  },

  recordMeeting(accessToken: string, roomId: string) {
    return request<RecentMeeting>('/meetings', accessToken, {
      method: 'POST',
      body: JSON.stringify({ roomId }),
    });
  },

  deleteMeeting(accessToken: string, meetingId: string) {
    return request<void>(`/meetings/${meetingId}`, accessToken, { method: 'DELETE' });
  },

  createMeetingRoom(accessToken: string, settings: MeetingRoomSettings) {
    return request<MeetingRoomAccess>('/meeting-rooms', accessToken, {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  getMeetingRoomAccess(roomId: string) {
    return publicRequest<MeetingRoomAccess>(`/meeting-rooms/${encodeURIComponent(roomId)}`);
  },

  checkMeetingRoomPassword(roomId: string, password: string) {
    return publicRequest<void>(`/meeting-rooms/${encodeURIComponent(roomId)}/password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  updateMeetingRoom(accessToken: string, roomId: string, settings: MeetingRoomSettings) {
    return request<MeetingRoomAccess>(`/meeting-rooms/${encodeURIComponent(roomId)}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  },

  listMeetingInvitationCandidates(accessToken: string, roomId: string, query = '') {
    const params = new URLSearchParams({ query });
    return request<MeetingInvitationCandidate[]>(
      `/meeting-rooms/${encodeURIComponent(roomId)}/candidates?${params.toString()}`,
      accessToken,
    );
  },

  inviteToMeetingRoom(accessToken: string, roomId: string, userId: string) {
    return request<void>(`/meeting-rooms/${encodeURIComponent(roomId)}/invitations`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  listMeetingSessions(accessToken: string, before?: string) {
    const query = before ? `?${new URLSearchParams({ before }).toString()}` : '';
    return request<MeetingSessionsPage>(`/meeting-sessions${query}`, accessToken);
  },

  getBadges(accessToken: string) {
    return request<BadgeCounts>('/badges', accessToken);
  },

  markMeetingRead(accessToken: string, meetingId: string) {
    return request<void>(`/meeting-sessions/${encodeURIComponent(meetingId)}/read`, accessToken, { method: 'POST' });
  },

  getMeetingSession(accessToken: string, meetingId: string) {
    return request<MeetingSession>(`/meeting-sessions/${encodeURIComponent(meetingId)}`, accessToken);
  },

  getMeetingRoomSummary(accessToken: string, roomRef: string) {
    return request<MeetingRoomSummary>(`/meeting-sessions/rooms/${encodeURIComponent(roomRef)}/summary`, accessToken);
  },

  listMeetingRoomPresence(accessToken: string, roomId: string) {
    return request<MeetingParticipantPresence[]>(
      `/meeting-sessions/rooms/${encodeURIComponent(roomId)}/presence`,
      accessToken,
    );
  },

  getLinkPreview(accessToken: string, url: string) {
    return request<LinkPreview>(`/link-previews?${new URLSearchParams({ url }).toString()}`, accessToken);
  },

  async loadLinkPreviewImage(_accessToken: string, url: string) {
    const response = await sendAuthorizedRequest((accessToken) =>
      fetch(`${API_BASE_URL}/social/link-previews/image?${new URLSearchParams({ url }).toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    if (!response.ok) {
      throw new SocialApiError((await response.text()) || 'Could not load preview image', response.status);
    }
    return response.blob();
  },

  listConversations(accessToken: string) {
    return request<Conversation[]>('/conversations', accessToken);
  },

  listGroups(accessToken: string) {
    return request<Conversation[]>('/conversations/groups', accessToken);
  },

  createGroup(accessToken: string, group: CreateGroupRequest) {
    return request<Conversation>('/conversations/groups', accessToken, {
      method: 'POST',
      body: JSON.stringify(group),
    });
  },

  getGroupInfo(accessToken: string, groupId: string) {
    return request<GroupInfo>(`/conversations/groups/${groupId}/info`, accessToken);
  },

  getGroupInfoByCode(accessToken: string, code: string) {
    return request<GroupInfo>('/conversations/groups/code/info', accessToken, {
      method: 'POST',
      body: JSON.stringify({ groupCode: code }),
    });
  },

  listGroupMembers(accessToken: string, groupId: string, offset = 0) {
    return request<GroupMembersPage>(`/conversations/groups/${groupId}/members?offset=${offset}`, accessToken);
  },

  searchGroupCandidates(accessToken: string, groupId: string, query: string, offset = 0) {
    const params = new URLSearchParams({ query, offset: String(offset) });
    return request<GroupCandidatesPage>(
      `/conversations/groups/${groupId}/candidates?${params.toString()}`,
      accessToken,
    );
  },

  inviteToGroup(accessToken: string, groupId: string, userId: string) {
    return request<void>(`/conversations/groups/${groupId}/invitations`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  listGroupInvitations(accessToken: string) {
    return request<GroupInvitation[]>('/conversations/groups/invitations', accessToken);
  },

  acceptGroupInvitation(accessToken: string, invitationId: string, password?: string) {
    return request<Conversation>(`/conversations/groups/invitations/${invitationId}/accept`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  declineGroupInvitation(accessToken: string, invitationId: string) {
    return request<void>(`/conversations/groups/invitations/${invitationId}/decline`, accessToken, {
      method: 'POST',
    });
  },

  joinGroup(accessToken: string, groupId: string, password?: string) {
    return request<Conversation>(`/conversations/groups/${groupId}/join`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  joinGroupByCode(accessToken: string, code: string, password?: string) {
    return request<Conversation>('/conversations/groups/code/join', accessToken, {
      method: 'POST',
      body: JSON.stringify({ groupCode: code, password }),
    });
  },

  leaveGroup(accessToken: string, groupId: string) {
    return request<void>(`/conversations/groups/${groupId}/leave`, accessToken, { method: 'POST' });
  },

  updateGroup(accessToken: string, groupId: string, group: UpdateGroupRequest) {
    return request<Conversation>(`/conversations/groups/${groupId}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(group),
    });
  },

  updateGroupPolicy(accessToken: string, groupId: string, policy: UpdateGroupPolicyRequest) {
    return request<Conversation>(`/conversations/groups/${groupId}/policy`, accessToken, {
      method: 'POST',
      body: JSON.stringify(policy),
    });
  },

  deleteGroup(accessToken: string, groupId: string) {
    return request<void>(`/conversations/groups/${groupId}`, accessToken, { method: 'DELETE' });
  },

  uploadGroupAvatar(accessToken: string, groupId: string, avatar: File) {
    const body = new FormData();
    body.append('avatar', avatar);
    return request<Conversation>(`/conversations/groups/${groupId}/avatar`, accessToken, { method: 'POST', body });
  },

  removeGroupAvatar(accessToken: string, groupId: string) {
    return request<void>(`/conversations/groups/${groupId}/avatar`, accessToken, { method: 'DELETE' });
  },

  addGroupMember(accessToken: string, groupId: string, userId: string) {
    return request<Conversation>(`/conversations/groups/${groupId}/members`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  removeGroupMember(accessToken: string, groupId: string, userId: string) {
    return request<void>(`/conversations/groups/${groupId}/members/${userId}`, accessToken, {
      method: 'DELETE',
    });
  },

  updateGroupMemberRole(accessToken: string, groupId: string, userId: string, role: GroupMemberRole) {
    return request<void>(`/conversations/groups/${groupId}/members/${userId}/role`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  },

  openDirectConversation(accessToken: string, userId: string) {
    return request<OpenDirectConversationResponse>(`/conversations/direct/${userId}`, accessToken, {
      method: 'POST',
    });
  },

  hideDirectConversation(accessToken: string, conversationId: string) {
    return request<void>(`/conversations/${conversationId}`, accessToken, { method: 'DELETE' });
  },

  listDirectRequests(accessToken: string) {
    return request<DirectMessageRequest[]>('/conversations/direct/requests', accessToken);
  },

  respondToDirectRequest(accessToken: string, requestId: string, accept: boolean) {
    return request<OpenDirectConversationResponse>(`/conversations/direct/requests/${requestId}/respond`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ accept }),
    });
  },

  listConversationMessages(accessToken: string, conversationId: string, before?: number, limit = 50) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before !== undefined) params.set('before', String(before));
    const query = `?${params.toString()}`;
    return request<ConversationMessagesResponse>(`/conversations/${conversationId}/messages${query}`, accessToken);
  },

  markConversationRead(accessToken: string, conversationId: string) {
    return request<void>(`/conversations/${conversationId}/read`, accessToken, { method: 'POST' });
  },

  markConversationUnread(accessToken: string, conversationId: string) {
    return request<void>(`/conversations/${conversationId}/unread`, accessToken, { method: 'POST' });
  },

  createConversationMessage(accessToken: string, conversationId: string, content: string, replyToSequence?: number) {
    return request<ConversationMessage>(`/conversations/${conversationId}/messages`, accessToken, {
      method: 'POST',
      body: JSON.stringify(replyToSequence === undefined ? { content } : { content, replyToSequence }),
    });
  },

  createConversationMessageWithAttachments(
    accessToken: string,
    conversationId: string,
    content: string,
    attachments: File[],
    replyToSequence?: number,
  ) {
    const body = new FormData();
    body.append('content', content);
    if (replyToSequence !== undefined) body.append('replyToSequence', String(replyToSequence));
    attachments.forEach((attachment) => body.append('file', attachment));
    return request<ConversationMessage>(`/conversations/${conversationId}/messages/attachments`, accessToken, {
      method: 'POST',
      body,
    });
  },

  toggleMessageReaction(accessToken: string, conversationId: string, sequence: number, emoji: string) {
    return request<MessageReaction[]>(`/conversations/${conversationId}/messages/${sequence}/reactions`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  },
};
