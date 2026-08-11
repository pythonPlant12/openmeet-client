import { afterEach, describe, expect, it, vi } from 'vitest';

import { cookieUtils } from '@/utils';

import { SocialApiError, socialApi } from '../social-api';

describe('socialApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    cookieUtils.remove('accessToken');
    cookieUtils.remove('refreshToken');
  });

  it('loads friends with bearer authentication', async () => {
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
      );
    vi.stubGlobal('fetch', fetchMock);

    await socialApi.createCall('token', 'friend-id');
    await socialApi.recordMeeting('token', 'room-id');

    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ friendId: 'friend-id' }) }),
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ roomId: 'room-id' }) }),
    );
  });

  it('handles no-content responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(socialApi.updatePresence('token')).resolves.toBeUndefined();
  });

  it.each([
    ['accepts a friend', () => socialApi.acceptFriend('token', 'request-id'), '/friends/request-id/accept', 'POST'],
    ['declines a friend', () => socialApi.declineFriend('token', 'request-id'), '/friends/request-id', 'DELETE'],
    ['deletes a meeting', () => socialApi.deleteMeeting('token', 'meeting-id'), '/meetings/meeting-id', 'DELETE'],
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

  it('refreshes an expired access token and retries once', async () => {
    cookieUtils.set('accessToken', 'expired-token', 1);
    cookieUtils.set('refreshToken', 'refresh-token', 1);
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

  it('expires a session when no refresh token is available', async () => {
    cookieUtils.set('accessToken', 'expired-token', 1);
    const sessionExpired = vi.fn();
    window.addEventListener('openmeet:session-expired', sessionExpired, { once: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Expired', { status: 401 })));

    await expect(socialApi.listFriends('expired-token')).rejects.toEqual(new SocialApiError('Expired', 401));
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
