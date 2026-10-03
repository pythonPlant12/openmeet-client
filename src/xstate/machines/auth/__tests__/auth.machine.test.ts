import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Router } from 'vue-router';
import { createActor, waitFor } from 'xstate';

import { type TokenResponse, authApi } from '@/services/auth-api';
import { cookieUtils } from '@/utils';

import { authMachine } from '../index';
import { AuthEventType, AuthState } from '../types';

// Mock router
const mockRouter: Router = {
  push: vi.fn(),
} as any;

// Mock cookieUtils
vi.mock('@/utils', () => ({
  cookieUtils: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

// Mock auth-api with test responses
vi.mock('@/services/auth-api', () => ({
  authApi: {
    login: vi.fn().mockImplementation(async ({ email, password }) => {
      if (email === 'test@test.com' && password === 'password') {
        return {
          user: { id: '1', email, name: 'Test User', nickname: 'test_user', role: 'user' },
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
        };
      }
      throw new Error('Invalid credentials');
    }),
    register: vi.fn().mockImplementation(async ({ email, name }) => ({
      user: { id: '1', email, name, nickname: 'test_user', role: 'user' },
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
    })),
    me: vi.fn().mockImplementation(async (accessToken: string, _refreshToken?: string) => {
      if (accessToken === 'mock-access-token') {
        return { id: '1', email: 'test@test.com', name: 'Test User', nickname: 'test_user', role: 'user' };
      }
      throw new Error('Invalid token');
    }),
    refresh: vi.fn().mockResolvedValue({ access_token: 'new-access-token' }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Auth Machine', () => {
  let actor: ReturnType<typeof createActor<typeof authMachine>>;

  beforeEach(() => {
    vi.mocked(cookieUtils.get).mockImplementation((name) => {
      if (name === 'accessToken') return 'mock-access-token';
      if (name === 'refreshToken') return 'mock-refresh-token';
      return null;
    });
  });

  afterEach(() => {
    actor?.stop();
    vi.clearAllMocks();
  });

  describe('Initial State - No Token', () => {
    beforeEach(() => {
      actor = createActor(authMachine, {
        input: { initialAccessToken: null, initialRefreshToken: null, router: mockRouter },
      });
      actor.start();
    });

    it('should start and transition to unauthenticated', () => {
      // XState transitions synchronously when no token, so we check final state
      expect(actor.getSnapshot().value).toBe(AuthState.UNAUTHENTICATED);
    });

    it('should transition to unauthenticated when no token exists', async () => {
      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED));
      expect(actor.getSnapshot().value).toBe(AuthState.UNAUTHENTICATED);
    });

    it('should have null user and tokens in unauthenticated state', async () => {
      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED));
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.user).toBeNull();
      expect(snapshot.context.accessToken).toBeNull();
      expect(snapshot.context.refreshToken).toBeNull();
      expect(snapshot.context.error).toBeNull();
    });
  });

  describe('Initial State - With Token', () => {
    beforeEach(() => {
      actor = createActor(authMachine, {
        input: {
          initialAccessToken: 'mock-access-token',
          initialRefreshToken: 'mock-refresh-token',
          router: mockRouter,
        },
      });
      actor.start();
    });

    it('should validate session and transition to authenticated when token is valid', async () => {
      // With instant mock, machine transitions directly to authenticated
      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });
      expect(actor.getSnapshot().value).toBe(AuthState.AUTHENTICATED);
    });

    it('should transition to authenticated with valid token', async () => {
      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe(AuthState.AUTHENTICATED);
      expect(snapshot.context.user).toEqual({
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        nickname: 'test_user',
        role: 'user',
      });
      expect(snapshot.context.accessToken).toBe('mock-access-token');
    });

    it('should not navigate to dashboard when validating existing session', async () => {
      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('restores a session when only a refresh token exists', async () => {
      actor.stop();
      vi.clearAllMocks();
      vi.mocked(cookieUtils.get).mockReturnValue('mock-refresh-token');
      vi.mocked(authApi.me).mockResolvedValueOnce({
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        nickname: 'test_user',
        role: 'user',
        newAccessToken: 'new-access-token',
      });
      actor = createActor(authMachine, {
        input: { initialAccessToken: null, initialRefreshToken: 'mock-refresh-token', router: mockRouter },
      });
      actor.start();

      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });

      expect(authApi.me).toHaveBeenCalledWith(null, 'mock-refresh-token');
      expect(actor.getSnapshot().context.accessToken).toBe('new-access-token');
      expect(cookieUtils.set).toHaveBeenCalledWith('accessToken', 'new-access-token', 1);
    });

    it('clears a rejected refresh-only session', async () => {
      actor.stop();
      vi.clearAllMocks();
      vi.mocked(cookieUtils.get).mockImplementation((name) => {
        if (name === 'refreshToken') return 'invalid-refresh-token';
        return null;
      });
      vi.mocked(authApi.me).mockRejectedValueOnce(new Error('Invalid refresh token'));
      actor = createActor(authMachine, {
        input: { initialAccessToken: null, initialRefreshToken: 'invalid-refresh-token', router: mockRouter },
      });
      actor.start();

      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED), { timeout: 2000 });

      expect(actor.getSnapshot().context.accessToken).toBeNull();
      expect(actor.getSnapshot().context.refreshToken).toBeNull();
      expect(cookieUtils.remove).toHaveBeenCalledWith('accessToken');
      expect(cookieUtils.remove).toHaveBeenCalledWith('refreshToken');
    });

    it('does not restore a session after its refresh token is deleted during validation', async () => {
      actor.stop();
      vi.clearAllMocks();
      vi.mocked(cookieUtils.get).mockReturnValue('refresh-token');
      let resolveSession!: (value: {
        id: string;
        email: string;
        name: string;
        nickname: string;
        role: 'user';
        newAccessToken: string;
      }) => void;
      vi.mocked(authApi.me).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSession = resolve;
          }),
      );
      actor = createActor(authMachine, {
        input: { initialAccessToken: null, initialRefreshToken: 'refresh-token', router: mockRouter },
      });
      actor.start();
      vi.mocked(cookieUtils.get).mockReturnValue(null);
      resolveSession({
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        nickname: 'test_user',
        role: 'user',
        newAccessToken: 'new-access-token',
      });

      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED), { timeout: 2000 });

      expect(cookieUtils.set).not.toHaveBeenCalled();
    });

    it('does not restore a session after its access token is deleted during validation', async () => {
      actor.stop();
      vi.clearAllMocks();
      vi.mocked(cookieUtils.get).mockImplementation((name) => {
        if (name === 'accessToken') return 'access-token';
        if (name === 'refreshToken') return 'refresh-token';
        return null;
      });
      let resolveSession!: (value: { id: string; email: string; name: string; nickname: string; role: 'user' }) => void;
      vi.mocked(authApi.me).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSession = resolve;
          }),
      );
      actor = createActor(authMachine, {
        input: { initialAccessToken: 'access-token', initialRefreshToken: 'refresh-token', router: mockRouter },
      });
      actor.start();
      vi.mocked(cookieUtils.get).mockReturnValue(null);
      resolveSession({
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        nickname: 'test_user',
        role: 'user',
      });

      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED), { timeout: 2000 });

      expect(cookieUtils.set).not.toHaveBeenCalled();
    });

    it('does not clear replacement tokens after stale session validation fails', async () => {
      actor.stop();
      vi.clearAllMocks();
      let accessToken = 'access-token';
      let refreshToken = 'refresh-token';
      vi.mocked(cookieUtils.get).mockImplementation((name) => {
        if (name === 'accessToken') return accessToken;
        if (name === 'refreshToken') return refreshToken;
        return null;
      });
      let rejectSession!: (reason: Error) => void;
      vi.mocked(authApi.me).mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectSession = reject;
          }),
      );
      actor = createActor(authMachine, {
        input: { initialAccessToken: accessToken, initialRefreshToken: refreshToken, router: mockRouter },
      });
      actor.start();
      accessToken = 'replacement-access-token';
      refreshToken = 'replacement-refresh-token';
      vi.mocked(authApi.me).mockResolvedValueOnce({
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        nickname: 'test_user',
        role: 'user',
      });
      rejectSession(new Error('Invalid token'));

      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });

      expect(cookieUtils.remove).not.toHaveBeenCalled();
    });
  });

  describe('Login Flow', () => {
    beforeEach(() => {
      actor = createActor(authMachine, {
        input: { initialAccessToken: null, initialRefreshToken: null, router: mockRouter },
      });
      actor.start();
    });

    it('should transition from unauthenticated to authenticating on LOGIN event', async () => {
      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED));

      actor.send({
        type: AuthEventType.LOGIN,
        email: 'test@test.com',
        password: 'password',
      });

      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATING));
      expect(actor.getSnapshot().value).toBe(AuthState.AUTHENTICATING);
    });

    it('should successfully authenticate with valid credentials', async () => {
      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED));

      actor.send({
        type: AuthEventType.LOGIN,
        email: 'test@test.com',
        password: 'password',
      });

      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });
      const snapshot = actor.getSnapshot();

      expect(snapshot.value).toBe(AuthState.AUTHENTICATED);
      expect(snapshot.context.user).toEqual({
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        nickname: 'test_user',
        role: 'user',
      });
      expect(snapshot.context.accessToken).toBe('mock-access-token');
      expect(snapshot.context.error).toBeNull();
    });

    it('should navigate to dashboard after successful login', async () => {
      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED));

      actor.send({
        type: AuthEventType.LOGIN,
        email: 'test@test.com',
        password: 'password',
      });

      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
    });

    it('should fail authentication with invalid credentials', async () => {
      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED));

      actor.send({
        type: AuthEventType.LOGIN,
        email: 'wrong@test.com',
        password: 'wrongpassword',
      });

      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATION_FAILED), { timeout: 2000 });
      const snapshot = actor.getSnapshot();

      expect(snapshot.value).toBe(AuthState.AUTHENTICATION_FAILED);
      expect(snapshot.context.user).toBeNull();
      expect(snapshot.context.accessToken).toBeNull();
      expect(snapshot.context.error).toBe('Invalid credentials');
    });

    it('should allow retry after authentication failure', async () => {
      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED));

      actor.send({
        type: AuthEventType.LOGIN,
        email: 'wrong@test.com',
        password: 'wrongpassword',
      });

      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATION_FAILED), { timeout: 2000 });

      actor.send({ type: AuthEventType.RETRY });

      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED));
      expect(actor.getSnapshot().value).toBe(AuthState.UNAUTHENTICATED);
      expect(actor.getSnapshot().context.error).toBeNull();
    });

    it('should allow login again after failure', async () => {
      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED));

      // First attempt - fail
      actor.send({
        type: AuthEventType.LOGIN,
        email: 'wrong@test.com',
        password: 'wrongpassword',
      });

      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATION_FAILED), { timeout: 2000 });

      // Second attempt - success
      actor.send({
        type: AuthEventType.LOGIN,
        email: 'test@test.com',
        password: 'password',
      });

      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });
      expect(actor.getSnapshot().value).toBe(AuthState.AUTHENTICATED);
    });
  });

  describe('Registration Flow', () => {
    beforeEach(() => {
      actor = createActor(authMachine, {
        input: { initialAccessToken: null, initialRefreshToken: null, router: mockRouter },
      });
      actor.start();
    });

    it('forwards nickname and stores it in the authenticated user', async () => {
      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED));

      actor.send({
        type: AuthEventType.REGISTER,
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        nickname: 'ada_lovelace',
        password: 'password',
      });

      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });
      expect(authApi.register).toHaveBeenCalledWith({
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        nickname: 'ada_lovelace',
        password: 'password',
      });
      expect(actor.getSnapshot().context.user?.nickname).toBe('test_user');
    });
  });

  describe('Logout Flow', () => {
    beforeEach(async () => {
      actor = createActor(authMachine, {
        input: {
          initialAccessToken: 'mock-access-token',
          initialRefreshToken: 'mock-refresh-token',
          router: mockRouter,
        },
      });
      actor.start();
      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });
    });

    it('should transition from authenticated to loggingOut on LOGOUT event', () => {
      actor.send({ type: AuthEventType.LOGOUT });
      expect(actor.getSnapshot().value).toBe(AuthState.LOGGING_OUT);
    });

    it('should transition to unauthenticated after logout', async () => {
      actor.send({ type: AuthEventType.LOGOUT });

      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED), { timeout: 2000 });
      const snapshot = actor.getSnapshot();

      expect(snapshot.value).toBe(AuthState.UNAUTHENTICATED);
      expect(snapshot.context.user).toBeNull();
      expect(snapshot.context.accessToken).toBeNull();
    });

    it('should navigate to login page after logout', async () => {
      vi.clearAllMocks();

      actor.send({ type: AuthEventType.LOGOUT });

      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED), { timeout: 2000 });
      expect(mockRouter.push).toHaveBeenCalledWith('/login');
    });

    it('does not revoke replacement tokens after stale logout completes', async () => {
      let accessToken = 'mock-access-token';
      let refreshToken = 'mock-refresh-token';
      vi.mocked(cookieUtils.get).mockImplementation((name) => {
        if (name === 'accessToken') return accessToken;
        if (name === 'refreshToken') return refreshToken;
        return null;
      });
      let resolveLogout!: () => void;
      vi.mocked(authApi.logout).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLogout = resolve;
          }),
      );

      actor.send({ type: AuthEventType.LOGOUT });
      accessToken = 'replacement-access-token';
      refreshToken = 'replacement-refresh-token';
      vi.mocked(authApi.me).mockResolvedValueOnce({
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        nickname: 'test_user',
        role: 'user',
      });
      resolveLogout();

      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });

      expect(authApi.logout).toHaveBeenCalledWith('mock-refresh-token');
      expect(cookieUtils.remove).not.toHaveBeenCalled();
    });
  });

  describe('Token Refresh', () => {
    beforeEach(async () => {
      vi.mocked(cookieUtils.get).mockImplementation((name) => {
        if (name === 'accessToken') return 'mock-access-token';
        if (name === 'refreshToken') return 'mock-refresh-token';
        return null;
      });
      actor = createActor(authMachine, {
        input: {
          initialAccessToken: 'mock-access-token',
          initialRefreshToken: 'mock-refresh-token',
          router: mockRouter,
        },
      });
      actor.start();
      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });
    });

    it('should handle REFRESH_TOKEN event', () => {
      actor.send({ type: AuthEventType.REFRESH_TOKEN });
      expect(actor.getSnapshot().value).toBe(AuthState.REFRESHING_TOKEN);
    });

    it('should remain authenticated after successful token refresh', async () => {
      actor.send({ type: AuthEventType.REFRESH_TOKEN });

      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });
      const snapshot = actor.getSnapshot();

      expect(snapshot.value).toBe(AuthState.AUTHENTICATED);
      expect(snapshot.context.user).toBeTruthy();
      expect(snapshot.context.accessToken).toBe('new-access-token');
    });

    it('should not navigate to dashboard after token refresh', async () => {
      vi.clearAllMocks();
      vi.mocked(cookieUtils.get).mockReturnValue('mock-refresh-token');

      actor.send({ type: AuthEventType.REFRESH_TOKEN });

      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('updates the session token refreshed by an API retry', () => {
      actor.send({ type: AuthEventType.ACCESS_TOKEN_REFRESHED, accessToken: 'fresh-token' });

      expect(actor.getSnapshot().context.accessToken).toBe('fresh-token');
      expect(cookieUtils.set).toHaveBeenCalledWith('accessToken', 'fresh-token', 1);
    });

    it('accepts an API retry token while its own refresh is pending', () => {
      let resolveRefresh!: (response: TokenResponse) => void;
      vi.mocked(authApi.refresh).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          }),
      );

      actor.send({ type: AuthEventType.REFRESH_TOKEN });
      actor.send({ type: AuthEventType.ACCESS_TOKEN_REFRESHED, accessToken: 'fresh-token' });
      resolveRefresh({ access_token: 'stale-token' });

      expect(actor.getSnapshot().value).toBe(AuthState.AUTHENTICATED);
      expect(actor.getSnapshot().context.accessToken).toBe('fresh-token');
    });

    it('does not refresh from a deleted cookie using stale session state', async () => {
      vi.mocked(cookieUtils.get).mockReturnValue(null);
      vi.clearAllMocks();
      vi.mocked(cookieUtils.get).mockReturnValue(null);

      actor.send({ type: AuthEventType.REFRESH_TOKEN });

      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED), { timeout: 2000 });
      expect(authApi.refresh).not.toHaveBeenCalled();
      expect(cookieUtils.remove).not.toHaveBeenCalled();
    });

    it('does not save an access token refreshed for a replaced session', async () => {
      let accessToken = 'mock-access-token';
      let refreshToken = 'mock-refresh-token';
      vi.mocked(cookieUtils.get).mockImplementation((name) => {
        if (name === 'accessToken') return accessToken;
        if (name === 'refreshToken') return refreshToken;
        return null;
      });
      let resolveRefresh!: (response: TokenResponse) => void;
      vi.mocked(authApi.refresh).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          }),
      );

      actor.send({ type: AuthEventType.REFRESH_TOKEN });
      accessToken = 'replacement-access-token';
      refreshToken = 'replacement-refresh-token';
      resolveRefresh({ access_token: 'stale-access-token' });

      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED), { timeout: 2000 });

      expect(cookieUtils.set).not.toHaveBeenCalledWith('accessToken', 'stale-access-token', 1);
    });
  });

  describe('Context Management', () => {
    it('should clear auth context on logout', async () => {
      actor = createActor(authMachine, {
        input: {
          initialAccessToken: 'mock-access-token',
          initialRefreshToken: 'mock-refresh-token',
          router: mockRouter,
        },
      });
      actor.start();
      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });

      actor.send({ type: AuthEventType.LOGOUT });
      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED), { timeout: 2000 });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.user).toBeNull();
      expect(snapshot.context.accessToken).toBeNull();
      expect(snapshot.context.refreshToken).toBeNull();
      expect(snapshot.context.error).toBeNull();
    });

    it('should clear error on successful login', async () => {
      actor = createActor(authMachine, {
        input: { initialAccessToken: null, initialRefreshToken: null, router: mockRouter },
      });
      actor.start();
      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED));

      // Fail first
      actor.send({ type: AuthEventType.LOGIN, email: 'wrong', password: 'wrong' });
      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATION_FAILED), { timeout: 2000 });
      expect(actor.getSnapshot().context.error).toBeTruthy();

      // Succeed
      actor.send({ type: AuthEventType.LOGIN, email: 'test@test.com', password: 'password' });
      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });
      expect(actor.getSnapshot().context.error).toBeNull();
    });
  });

  describe('Router Integration', () => {
    it('should work without router provided', async () => {
      actor = createActor(authMachine, {
        input: { initialAccessToken: null, initialRefreshToken: null },
      });
      actor.start();

      await waitFor(actor, (state) => state.matches(AuthState.UNAUTHENTICATED));

      actor.send({ type: AuthEventType.LOGIN, email: 'test@test.com', password: 'password' });
      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });

      expect(actor.getSnapshot().value).toBe(AuthState.AUTHENTICATED);
    });
  });
});
