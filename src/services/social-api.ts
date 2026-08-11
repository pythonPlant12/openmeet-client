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

export interface RecentMeeting {
  id: string;
  roomId: string;
  lastJoinedAt: string;
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
};
