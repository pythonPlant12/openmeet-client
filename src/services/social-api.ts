import { authApi } from '@/services/auth-api';
import { cookieUtils } from '@/utils';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';
let refreshInFlight: { refreshToken: string; promise: Promise<string> } | null = null;

function expireSession() {
  cookieUtils.remove('accessToken');
  cookieUtils.remove('refreshToken');
  window.dispatchEvent(new Event('openmeet:session-expired'));
}

export interface Friend {
  id: string;
  name: string;
  email: string;
  isOnline: boolean;
}

export interface UserSearchResult {
  id: string;
  name: string;
  email: string;
}

export interface ContactProfile {
  id: string;
  name: string;
  email: string;
  status: 'available' | 'away' | 'doNotDisturb' | 'offline';
  statusMessage: string;
  createdAt: string;
  lastSeenAt: string | null;
  isOnline: boolean;
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

export type ConversationKind = 'group' | 'direct';
export type GroupAccessPolicy = 'open' | 'password' | 'friendsOnly';
export type GroupMemberRole = 'admin' | 'member';

export interface Conversation {
  id: string;
  kind: ConversationKind;
  title: string | null;
  accessPolicy: GroupAccessPolicy | null;
  role: string | null;
  otherUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupRequest {
  title: string;
  accessPolicy: GroupAccessPolicy;
  password?: string;
}

export interface UpdateGroupPolicyRequest {
  accessPolicy: GroupAccessPolicy;
  password?: string;
}

export interface GroupInfo {
  id: string;
  title: string;
  accessPolicy: GroupAccessPolicy;
  memberCount: number;
  isMember: boolean;
  role: string | null;
  canJoin: boolean;
}

export interface GroupMember {
  id: string;
  name: string;
  role: string;
  joinedAt: string;
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

export interface ConversationMessage {
  sequence: number;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
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

async function request<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const performRequest = (token: string) =>
    fetch(`${API_BASE_URL}/social${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });

  let response = await performRequest(cookieUtils.get('accessToken') || accessToken);
  const refreshToken = cookieUtils.get('refreshToken');
  if (response.status === 401 && refreshToken) {
    const refreshRequest =
      refreshInFlight?.refreshToken === refreshToken
        ? refreshInFlight
        : {
            refreshToken,
            promise: authApi.refresh(refreshToken).then(({ access_token }) => access_token),
          };
    refreshInFlight = refreshRequest;

    let refreshedAccessToken: string;
    try {
      refreshedAccessToken = await refreshRequest.promise;
    } catch (error) {
      expireSession();
      throw error;
    } finally {
      if (refreshInFlight === refreshRequest) refreshInFlight = null;
    }

    if (cookieUtils.get('refreshToken') !== refreshToken) {
      throw new SocialApiError('Session changed while refreshing', 401);
    }
    cookieUtils.set('accessToken', refreshedAccessToken, 1);
    response = await performRequest(refreshedAccessToken);
  }

  if (response.status === 401) {
    expireSession();
  }

  if (!response.ok) {
    const message = (await response.text()) || `Request failed with status ${response.status}`;
    throw new SocialApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const socialApi = {
  searchUsers(accessToken: string, query: string) {
    return request<UserSearchResult[]>(`/users?query=${encodeURIComponent(query)}`, accessToken);
  },

  getUserProfile(accessToken: string, userId: string) {
    return request<ContactProfile>(`/users/${userId}/profile`, accessToken);
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

  acceptFriend(accessToken: string, requestId: string) {
    return request<void>(`/friends/${requestId}/accept`, accessToken, { method: 'POST' });
  },

  declineFriend(accessToken: string, requestId: string) {
    return request<void>(`/friends/${requestId}`, accessToken, { method: 'DELETE' });
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

  listGroupMembers(accessToken: string, groupId: string) {
    return request<GroupMember[]>(`/conversations/groups/${groupId}/members`, accessToken);
  },

  joinGroup(accessToken: string, groupId: string, password?: string) {
    return request<Conversation>(`/conversations/groups/${groupId}/join`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  updateGroupPolicy(accessToken: string, groupId: string, policy: UpdateGroupPolicyRequest) {
    return request<Conversation>(`/conversations/groups/${groupId}/policy`, accessToken, {
      method: 'POST',
      body: JSON.stringify(policy),
    });
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

  listDirectRequests(accessToken: string) {
    return request<DirectMessageRequest[]>('/conversations/direct/requests', accessToken);
  },

  respondToDirectRequest(accessToken: string, requestId: string, accept: boolean) {
    return request<OpenDirectConversationResponse>(
      `/conversations/direct/requests/${requestId}/respond`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ accept }),
      },
    );
  },

  listConversationMessages(accessToken: string, conversationId: string, before?: number) {
    const query = before === undefined ? '' : `?before=${encodeURIComponent(before)}`;
    return request<ConversationMessagesResponse>(`/conversations/${conversationId}/messages${query}`, accessToken);
  },

  createConversationMessage(accessToken: string, conversationId: string, content: string) {
    return request<ConversationMessage>(`/conversations/${conversationId}/messages`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },
};
