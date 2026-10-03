import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { cookieUtils } from '@/utils';

import { type Conversation, SocialApiError, socialApi } from '../social-api';

describe('socialApi', () => {
  beforeEach(() => {
    cookieUtils.set('accessToken', 'token', 1);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cookieUtils.remove('accessToken');
    cookieUtils.remove('refreshToken');
  });

  it('loads friends with bearer authentication', async () => {
    cookieUtils.set('accessToken', 'access-token', 1);
    const payload = { friends: [], incomingRequests: [] };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(socialApi.listFriends('access-token')).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8081/social/friends',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('sends camel-case call and meeting payloads', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'call', roomId: 'room', status: 'pending', expiresAt: '', caller: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'meeting', roomId: 'room', lastJoinedAt: '' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accepted: true, roomId: 'opaque-room' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await socialApi.createCall('token', 'friend-id');
    await socialApi.recordMeeting('token', 'room-id');
    await socialApi.respondToCallSession('token', 'session-id', true);

    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ friendId: 'friend-id' }) }),
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ roomId: 'room-id' }) }),
    );
    expect(fetchMock.mock.calls[2]).toEqual([
      'http://localhost:8081/social/call-sessions/session-id/respond',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ accept: true }) }),
    ]);
  });

  it('handles no-content responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(socialApi.updatePresence('token')).resolves.toBeUndefined();
  });

  it('loads the current profile through the authenticated self-profile route', async () => {
    const profile = {
      id: 'user-id',
      name: 'Ada Lovelace',
      nickname: 'ada_lovelace',
      email: 'ada@example.com',
      avatarUrl: null,
      status: 'available',
      statusMessage: 'Working',
      createdAt: '2026-01-01T00:00:00Z',
      lastSeenAt: null,
      isOnline: true,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(profile), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(socialApi.getCurrentUserProfile('token')).resolves.toEqual(profile);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8081/social/me/profile',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token' }) }),
    );
  });

  it('updates the current profile through the authenticated self-profile route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await socialApi.updateCurrentUserProfile('token', {
      name: 'Ada Lovelace',
      nickname: 'ada_lovelace',
      statusMessage: 'Working',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8081/social/me/profile',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('loads private avatars with the authenticated API client', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('avatar', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(socialApi.loadAvatar('token', '/social/users/user-id/avatar')).resolves.toBeInstanceOf(Blob);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8081/social/users/user-id/avatar',
      expect.objectContaining({ headers: { Authorization: 'Bearer token' } }),
    );
  });

  it('does not load private avatars with a stale in-memory token', async () => {
    cookieUtils.remove('accessToken');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(socialApi.loadAvatar('stale-memory-token', '/social/users/user-id/avatar')).rejects.toEqual(
      new SocialApiError('Missing refresh token', 401),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses conversation GET, POST, and DELETE contracts', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await socialApi.listConversations('token');
    await socialApi.createGroup('token', {
      title: 'Team chat',
      accessPolicy: 'friendsOnly',
      password: 'password1',
      memberIds: ['friend-1', 'friend-2'],
    });
    await socialApi.getGroupInfo('token', 'group-id');
    await socialApi.listGroupMembers('token', 'group-id');
    await socialApi.removeGroupMember('token', 'group-id', 'user-id');

    expect(fetchMock.mock.calls[0]).toEqual([
      'http://localhost:8081/social/conversations',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token' }) }),
    ]);
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Team chat',
          accessPolicy: 'friendsOnly',
          password: 'password1',
          memberIds: ['friend-1', 'friend-2'],
        }),
      }),
    );
    expect(fetchMock.mock.calls[2]).toEqual([
      'http://localhost:8081/social/conversations/groups/group-id/info',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token' }) }),
    ]);
    expect(fetchMock.mock.calls[3]).toEqual([
      'http://localhost:8081/social/conversations/groups/group-id/members',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token' }) }),
    ]);
    expect(fetchMock.mock.calls[4]).toEqual([
      'http://localhost:8081/social/conversations/groups/group-id/members/user-id',
      expect.objectContaining({ method: 'DELETE' }),
    ]);
  });

  it('uses fixed 50-message cursor pages', async () => {
    const response = { messages: [], nextBefore: null };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await socialApi.listConversationMessages('token', 'conversation-id');
    await socialApi.listConversationMessages('token', 'conversation-id', 51);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:8081/social/conversations/conversation-id/messages?limit=50',
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://localhost:8081/social/conversations/conversation-id/messages?limit=50&before=51',
    );
  });

  it('uses code-based group preview and join contracts', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await socialApi.getGroupInfoByCode('token', 'harbor team/one');
    await socialApi.joinGroupByCode('token', 'harbor team/one', 'secret');
    await socialApi.joinGroup('token', 'group-id', 'secret');

    expect(fetchMock.mock.calls[0]).toEqual([
      'http://localhost:8081/social/conversations/groups/code/info',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ groupCode: 'harbor team/one' }) }),
    ]);
    expect(fetchMock.mock.calls[1]).toEqual([
      'http://localhost:8081/social/conversations/groups/code/join',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ groupCode: 'harbor team/one', password: 'secret' }),
      }),
    ]);
    expect(fetchMock.mock.calls[2]).toEqual([
      'http://localhost:8081/social/conversations/groups/group-id/join',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ password: 'secret' }) }),
    ]);
  });

  it('allows groups without initial members and preserves the policy update wrapper', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await socialApi.createGroup('token', { title: 'Solo group', accessPolicy: 'open' });
    await socialApi.updateGroupPolicy('token', 'group-id', { accessPolicy: 'friendsOnly' });

    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'Solo group', accessPolicy: 'open' }),
      }),
    );
    expect(fetchMock.mock.calls[1]).toEqual([
      'http://localhost:8081/social/conversations/groups/group-id/policy',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ accessPolicy: 'friendsOnly' }) }),
    ]);
  });

  it('updates, deletes, and uploads group avatars with expected contracts', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const avatar = new File(['avatar'], 'group.png', { type: 'image/png' });

    await socialApi.updateGroup('token', 'group-id', {
      title: 'New title',
      accessPolicy: 'password',
      password: 'secret',
    });
    await socialApi.deleteGroup('token', 'group-id');
    const upload = socialApi.uploadGroupAvatar('token', 'group-id', avatar);
    expectTypeOf(upload).toEqualTypeOf<Promise<Conversation>>();
    await upload;

    expect(fetchMock.mock.calls[0]).toEqual([
      'http://localhost:8081/social/conversations/groups/group-id',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ title: 'New title', accessPolicy: 'password', password: 'secret' }),
      }),
    ]);
    expect(fetchMock.mock.calls[1]).toEqual([
      'http://localhost:8081/social/conversations/groups/group-id',
      expect.objectContaining({ method: 'DELETE' }),
    ]);
    expect(fetchMock.mock.calls[2]?.[0]).toBe('http://localhost:8081/social/conversations/groups/group-id/avatar');
    const uploadInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(uploadInit.method).toBe('POST');
    expect(uploadInit.body).toBeInstanceOf(FormData);
    expect((uploadInit.body as FormData).get('avatar')).toBe(avatar);
    expect((uploadInit.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it.each([
    ['accepts a friend', () => socialApi.acceptFriend('token', 'request-id'), '/friends/request-id/accept', 'POST'],
    ['declines a friend', () => socialApi.declineFriend('token', 'request-id'), '/friends/request-id', 'DELETE'],
    ['deletes a meeting', () => socialApi.deleteMeeting('token', 'meeting-id'), '/meetings/meeting-id', 'DELETE'],
    ['leaves a group', () => socialApi.leaveGroup('token', 'group-id'), '/conversations/groups/group-id/leave', 'POST'],
    [
      'hides a direct conversation',
      () => socialApi.hideDirectConversation('token', 'conversation-id'),
      '/conversations/conversation-id',
      'DELETE',
    ],
  ])('%s with the expected contract', async (_, invoke, path, method) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await invoke();

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:8081/social${path}`,
      expect.objectContaining({
        method,
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );
  });

  it('lists and marks generic notifications with bearer authentication', async () => {
    const notifications = [
      {
        id: 'notification-id',
        kind: 'friendRequest',
        actorId: 'friend-id',
        actorName: 'Alice',
        data: { friendshipId: 'friendship-id' },
        createdAt: '2026-08-27T00:00:00Z',
      },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(notifications), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(socialApi.listNotifications('token')).resolves.toEqual(notifications);
    await expect(socialApi.markNotificationRead('token', 'notification-id')).resolves.toBeUndefined();

    expect(fetchMock.mock.calls[0]).toEqual([
      'http://localhost:8081/social/notifications',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token' }) }),
    ]);
    expect(fetchMock.mock.calls[1]).toEqual([
      'http://localhost:8081/social/notifications/notification-id/read',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer token' }) }),
    ]);
  });

  it('refreshes an expired access token and retries once', async () => {
    cookieUtils.set('accessToken', 'expired-token', 1);
    cookieUtils.set('refreshToken', 'refresh-token', 1);
    const accessTokenRefreshed = vi.fn();
    window.addEventListener('openmeet:access-token-refreshed', accessTokenRefreshed, { once: true });
    const payload = { friends: [], incomingRequests: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('Expired', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'fresh-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(socialApi.listFriends('expired-token')).resolves.toEqual(payload);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:8081/auth/refresh');
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }),
      }),
    );
    expect(cookieUtils.get('accessToken')).toBe('fresh-token');
    expect(accessTokenRefreshed).toHaveBeenCalledOnce();
    const refreshedEvent = accessTokenRefreshed.mock.calls[0]?.[0];
    expect(refreshedEvent).toBeInstanceOf(CustomEvent);
    expect((refreshedEvent as CustomEvent<string>).detail).toBe('fresh-token');
  });

  it('refreshes before calling a protected endpoint when access token is missing', async () => {
    cookieUtils.remove('accessToken');
    cookieUtils.set('refreshToken', 'refresh-token', 1);
    const payload = { friends: [], incomingRequests: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'fresh-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(socialApi.listFriends('stale-memory-token')).resolves.toEqual(payload);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:8081/auth/refresh');
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }) }),
    );
  });

  it('does not send a stale in-memory token when refresh token is invalid', async () => {
    cookieUtils.remove('accessToken');
    cookieUtils.set('refreshToken', 'invalid-refresh-token', 1);
    const fetchMock = vi.fn().mockResolvedValue(new Response('Invalid refresh token', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(socialApi.listFriends('stale-memory-token')).rejects.toEqual(expect.objectContaining({ status: 401 }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:8081/auth/refresh');
  });

  it('clears the session when token refresh fails', async () => {
    cookieUtils.set('accessToken', 'expired-token', 1);
    cookieUtils.set('refreshToken', 'revoked-token', 1);
    const sessionExpired = vi.fn();
    window.addEventListener('openmeet:session-expired', sessionExpired, { once: true });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('Expired', { status: 401 }))
        .mockResolvedValueOnce(new Response('Revoked', { status: 401 })),
    );

    await expect(socialApi.listFriends('expired-token')).rejects.toThrow();
    expect(cookieUtils.get('accessToken')).toBeNull();
    expect(cookieUtils.get('refreshToken')).toBeNull();
    expect(sessionExpired).toHaveBeenCalledOnce();
  });

  it('keeps replacement tokens when an earlier refresh fails', async () => {
    cookieUtils.remove('accessToken');
    cookieUtils.set('refreshToken', 'stale-refresh-token', 1);
    let resolveRefresh!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === 'http://localhost:8081/auth/refresh') {
        return new Promise((resolve) => {
          resolveRefresh = resolve;
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = socialApi.listFriends('stale-memory-token');
    cookieUtils.set('accessToken', 'replacement-access-token', 1);
    cookieUtils.set('refreshToken', 'replacement-refresh-token', 1);
    resolveRefresh(new Response('Invalid refresh token', { status: 401 }));

    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(cookieUtils.get('accessToken')).toBe('replacement-access-token');
    expect(cookieUtils.get('refreshToken')).toBe('replacement-refresh-token');
  });

  it('keeps a newer access token when a refresh for the same session fails', async () => {
    cookieUtils.remove('accessToken');
    cookieUtils.set('refreshToken', 'refresh-token', 1);
    let resolveRefresh!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const request = socialApi.listFriends('stale-memory-token');
    cookieUtils.set('accessToken', 'newer-access-token', 1);
    resolveRefresh(new Response('Invalid refresh token', { status: 401 }));

    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(cookieUtils.get('accessToken')).toBe('newer-access-token');
    expect(cookieUtils.get('refreshToken')).toBe('refresh-token');
  });

  it('expires a session when no refresh token is available', async () => {
    cookieUtils.remove('accessToken');
    const sessionExpired = vi.fn();
    window.addEventListener('openmeet:session-expired', sessionExpired, { once: true });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(socialApi.listFriends('expired-token')).rejects.toEqual(
      new SocialApiError('Missing refresh token', 401),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookieUtils.get('accessToken')).toBeNull();
    expect(sessionExpired).toHaveBeenCalledOnce();
  });

  it('keeps a refreshed session when only the retried request loses network', async () => {
    cookieUtils.set('accessToken', 'expired-token', 1);
    cookieUtils.set('refreshToken', 'refresh-token', 1);
    const sessionExpired = vi.fn();
    window.addEventListener('openmeet:session-expired', sessionExpired, { once: true });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('Expired', { status: 401 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'fresh-token' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockRejectedValueOnce(new TypeError('Network unavailable')),
    );

    await expect(socialApi.listFriends('expired-token')).rejects.toThrow('Network unavailable');
    expect(cookieUtils.get('accessToken')).toBe('fresh-token');
    expect(cookieUtils.get('refreshToken')).toBe('refresh-token');
    expect(sessionExpired).not.toHaveBeenCalled();
  });

  it('exposes server errors with their status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('No registered user has that email', { status: 404 })),
    );

    await expect(socialApi.addFriend('token', 'missing@example.com')).rejects.toEqual(
      new SocialApiError('No registered user has that email', 404),
    );
  });
});
