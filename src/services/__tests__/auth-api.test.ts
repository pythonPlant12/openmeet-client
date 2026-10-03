import { afterEach, describe, expect, it, vi } from 'vitest';

import { authApi } from '../auth-api';

describe('authApi.me', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes before loading the session when access token is missing', async () => {
    const user = {
      id: 'user-id',
      email: 'test@example.com',
      name: 'Test User',
      nickname: 'test',
      role: 'user',
    } as const;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'fresh-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(user), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authApi.me(null, 'refresh-token')).resolves.toEqual({ ...user, newAccessToken: 'fresh-token' });
    expect(fetchMock.mock.calls[0]).toEqual([
      'http://localhost:8081/auth/refresh',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ refresh_token: 'refresh-token' }) }),
    ]);
    expect(fetchMock.mock.calls[1]).toEqual([
      'http://localhost:8081/auth/me',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }) }),
    ]);
  });

  it('does not request the session when refresh token validation fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Invalid refresh token', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authApi.me(null, 'invalid-refresh-token')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
