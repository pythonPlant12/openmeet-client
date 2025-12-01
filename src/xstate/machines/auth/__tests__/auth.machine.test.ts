import { createActor, waitFor } from 'xstate';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authMachine } from '../index';
import { AuthEventType, AuthState } from '../types';
import type { Router } from 'vue-router';

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
          user: { id: '1', email, name: 'Test User', role: 'user' },
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
        };
      }
      throw new Error('Invalid credentials');
    }),
    register: vi.fn().mockImplementation(async ({ email, name }) => ({
      user: { id: '1', email, name, role: 'user' },
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
    })),
    me: vi.fn().mockImplementation(async ({ accessToken }) => {
      if (accessToken === 'mock-access-token') {
        return { id: '1', email: 'test@test.com', name: 'Test User', role: 'user' };
      }
      throw new Error('Invalid token');
    }),
    refresh: vi.fn().mockResolvedValue({ access_token: 'new-access-token' }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Auth Machine', () => {
  let actor: ReturnType<typeof createActor<typeof authMachine>>;

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
        input: { initialAccessToken: 'mock-access-token', initialRefreshToken: 'mock-refresh-token', router: mockRouter },
      });
      actor.start();
    });

    it('should start and transition to validatingSession', () => {
      // XState transitions synchronously to validatingSession when token exists
      expect(actor.getSnapshot().value).toBe(AuthState.VALIDATING_SESSION);
    });

    it('should transition to validatingSession when token exists', async () => {
      await waitFor(actor, (state) => state.matches(AuthState.VALIDATING_SESSION));
      expect(actor.getSnapshot().value).toBe(AuthState.VALIDATING_SESSION);
    });

    it('should transition to authenticated with valid token', async () => {
      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe(AuthState.AUTHENTICATED);
      expect(snapshot.context.user).toEqual({
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        role: 'user',
      });
      expect(snapshot.context.accessToken).toBe('mock-access-token');
    });

    it('should not navigate to dashboard when validating existing session', async () => {
      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });
      expect(mockRouter.push).not.toHaveBeenCalled();
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

  describe('Logout Flow', () => {
    beforeEach(async () => {
      actor = createActor(authMachine, {
        input: { initialAccessToken: 'mock-access-token', initialRefreshToken: 'mock-refresh-token', router: mockRouter },
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
  });

  describe('Token Refresh', () => {
    beforeEach(async () => {
      actor = createActor(authMachine, {
        input: { initialAccessToken: 'mock-access-token', initialRefreshToken: 'mock-refresh-token', router: mockRouter },
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

      actor.send({ type: AuthEventType.REFRESH_TOKEN });

      await waitFor(actor, (state) => state.matches(AuthState.AUTHENTICATED), { timeout: 2000 });
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  describe('Context Management', () => {
    it('should clear auth context on logout', async () => {
      actor = createActor(authMachine, {
        input: { initialAccessToken: 'mock-access-token', initialRefreshToken: 'mock-refresh-token', router: mockRouter },
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
