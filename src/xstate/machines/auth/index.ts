import { assign, fromPromise, setup } from 'xstate';

import { i18n } from '@/i18n';
import { type AuthResponse, authApi } from '@/services/auth-api';
import { cookieUtils } from '@/utils';

import type { AuthContext, AuthEvents, AuthInput, User } from './types';

const loginActor = fromPromise<AuthResponse, { email: string; password: string }>(async ({ input }) => {
  return authApi.login(input);
});

const registerActor = fromPromise<AuthResponse, { email: string; name: string; nickname: string; password: string }>(
  async ({ input }) => {
    return authApi.register(input);
  },
);

const checkSessionActor = fromPromise<
  User & { newAccessToken?: string },
  { accessToken: string | null; refreshToken: string | null }
>(async ({ input }) => {
  return authApi.me(input.accessToken, input.refreshToken ?? undefined);
});

const refreshTokenActor = fromPromise<string, { refreshToken: string | null }>(async ({ input }) => {
  if (!input.refreshToken || cookieUtils.get('refreshToken') !== input.refreshToken) {
    throw new Error('Refresh token changed');
  }
  const response = await authApi.refresh(input.refreshToken);
  return response.access_token;
});

const logoutActor = fromPromise<void, { refreshToken: string | null }>(async ({ input }) => {
  if (input.refreshToken && cookieUtils.get('refreshToken') === input.refreshToken) {
    await authApi.logout(input.refreshToken);
  }
});

export const authMachine = setup({
  types: {
    context: {} as AuthContext,
    events: {} as AuthEvents,
    input: {} as AuthInput,
  },

  actors: {
    loginActor,
    registerActor,
    checkSessionActor,
    refreshTokenActor,
    logoutActor,
  },

  actions: {
    setAuthFromResponse: assign({
      user: ({ event }) => (event as any).output.user,
      accessToken: ({ event }) => (event as any).output.access_token,
      refreshToken: ({ event }) => (event as any).output.refresh_token,
      error: null,
    }),

    setUserFromSession: assign({
      user: ({ event }) => {
        const { newAccessToken: _, ...user } = (event as any).output;
        return user;
      },
      accessToken: ({ context, event }) => {
        const output = (event as any).output;
        return output.newAccessToken ?? context.accessToken;
      },
      error: null,
    }),

    setAccessToken: assign({
      accessToken: ({ event }) => (event as any).output,
    }),

    setRefreshedAccessToken: assign({
      accessToken: ({ event }) => (event as { accessToken: string }).accessToken,
    }),

    reloadStoredTokens: assign({
      user: null,
      accessToken: () => cookieUtils.get('accessToken'),
      refreshToken: () => cookieUtils.get('refreshToken'),
      error: null,
    }),

    setError: assign({
      error: ({ event }) => {
        const error = (event as any).error;
        return error?.message || i18n.global.t('errors.generic');
      },
    }),

    clearAuth: assign({
      user: null,
      accessToken: null,
      refreshToken: null,
      error: null,
    }),

    clearError: assign({
      error: null,
    }),

    saveTokensToStorage: ({ context }) => {
      if (context.accessToken) {
        cookieUtils.set('accessToken', context.accessToken, 1); // 1 day for access token cookie
      }
      if (context.refreshToken) {
        cookieUtils.set('refreshToken', context.refreshToken, 7); // 7 days for refresh token
      }
    },

    saveAccessTokenToStorage: ({ context }) => {
      if (context.accessToken) cookieUtils.set('accessToken', context.accessToken, 1);
    },

    clearTokensFromStorage: () => {
      cookieUtils.remove('accessToken');
      cookieUtils.remove('refreshToken');
    },

    navigateToDashboard: ({ context }) => {
      if (context.router) {
        context.router.push('/dashboard');
      }
    },

    navigateToLogin: ({ context }) => {
      if (context.router) {
        context.router.push('/login');
      }
    },

    navigateToRegister: ({ context }) => {
      if (context.router) {
        context.router.push('/register');
      }
    },
  },

  guards: {
    hasAuthTokens: ({ context }) => !!context.accessToken || !!context.refreshToken,
    validationMatchesSession: ({ context, event }) => {
      const newAccessToken = (event as any).output?.newAccessToken;
      return (
        cookieUtils.get('refreshToken') === context.refreshToken &&
        (newAccessToken || cookieUtils.get('accessToken') === context.accessToken)
      );
    },
    refreshTokenMatchesSession: ({ context }) =>
      !!context.refreshToken && cookieUtils.get('refreshToken') === context.refreshToken,
    logoutMatchesSession: ({ context }) =>
      context.refreshToken
        ? cookieUtils.get('refreshToken') === context.refreshToken
        : cookieUtils.get('refreshToken') === null && cookieUtils.get('accessToken') === context.accessToken,
  },
}).createMachine({
  id: 'auth',

  context: ({ input }) => ({
    user: null,
    accessToken: input.initialAccessToken ?? null,
    refreshToken: input.initialRefreshToken ?? null,
    error: null,
    router: input.router,
  }),

  initial: 'checkingSession',

  states: {
    checkingSession: {
      description: 'Check if user has a valid stored session',
      always: [
        {
          guard: 'hasAuthTokens',
          target: 'validatingSession',
        },
        {
          target: 'unauthenticated',
        },
      ],
    },

    validatingSession: {
      description: 'Validate stored token with backend',
      invoke: {
        src: 'checkSessionActor',
        input: ({ context }) => ({
          accessToken: context.accessToken!,
          refreshToken: context.refreshToken,
        }),
        onDone: [
          {
            guard: 'validationMatchesSession',
            target: 'authenticated',
            actions: ['setUserFromSession', 'saveTokensToStorage'],
          },
          {
            target: 'checkingSession',
            actions: 'reloadStoredTokens',
          },
        ],
        onError: [
          {
            guard: 'validationMatchesSession',
            target: 'unauthenticated',
            actions: ['clearAuth', 'clearTokensFromStorage'],
          },
          {
            target: 'checkingSession',
            actions: 'reloadStoredTokens',
          },
        ],
      },
    },

    unauthenticated: {
      description: 'User is not logged in',
      on: {
        LOGIN: {
          target: 'authenticating',
        },
        REGISTER: {
          target: 'registering',
        },
        GO_TO_REGISTER: {
          actions: 'navigateToRegister',
        },
        GO_TO_LOGIN: {
          actions: 'navigateToLogin',
        },
      },
    },

    authenticating: {
      description: 'Logging in user',
      invoke: {
        src: 'loginActor',
        input: ({ event }) => {
          const loginEvent = event as Extract<AuthEvents, { type: 'LOGIN' }>;
          return {
            email: loginEvent.email,
            password: loginEvent.password,
          };
        },
        onDone: {
          target: 'authenticated',
          actions: ['setAuthFromResponse', 'saveTokensToStorage', 'navigateToDashboard'],
        },
        onError: {
          target: 'authenticationFailed',
          actions: 'setError',
        },
      },
    },

    authenticationFailed: {
      description: 'Login failed - show error',
      on: {
        LOGIN: {
          target: 'authenticating',
        },
        RETRY: {
          target: 'unauthenticated',
          actions: 'clearError',
        },
        GO_TO_REGISTER: {
          target: 'unauthenticated',
          actions: ['clearError', 'navigateToRegister'],
        },
      },
    },

    registering: {
      description: 'Registering new user',
      invoke: {
        src: 'registerActor',
        input: ({ event }) => {
          const registerEvent = event as Extract<AuthEvents, { type: 'REGISTER' }>;
          return {
            email: registerEvent.email,
            name: registerEvent.name,
            nickname: registerEvent.nickname,
            password: registerEvent.password,
          };
        },
        onDone: {
          target: 'authenticated',
          actions: ['setAuthFromResponse', 'saveTokensToStorage', 'navigateToDashboard'],
        },
        onError: {
          target: 'registrationFailed',
          actions: 'setError',
        },
      },
    },

    registrationFailed: {
      description: 'Registration failed - show error',
      on: {
        REGISTER: {
          target: 'registering',
        },
        RETRY: {
          target: 'unauthenticated',
          actions: 'clearError',
        },
        GO_TO_LOGIN: {
          target: 'unauthenticated',
          actions: ['clearError', 'navigateToLogin'],
        },
      },
    },

    authenticated: {
      description: 'User is logged in',
      on: {
        LOGOUT: {
          target: 'loggingOut',
        },
        REFRESH_TOKEN: {
          target: 'refreshingToken',
        },
        ACCESS_TOKEN_REFRESHED: {
          actions: ['setRefreshedAccessToken', 'saveAccessTokenToStorage'],
        },
      },
    },

    refreshingToken: {
      description: 'Refreshing authentication token',
      on: {
        ACCESS_TOKEN_REFRESHED: {
          target: 'authenticated',
          actions: ['setRefreshedAccessToken', 'saveAccessTokenToStorage'],
        },
      },
      invoke: {
        src: 'refreshTokenActor',
        input: ({ context }) => ({ refreshToken: context.refreshToken }),
        onDone: [
          {
            guard: 'refreshTokenMatchesSession',
            target: 'authenticated',
            actions: ['setAccessToken', 'saveAccessTokenToStorage'],
          },
          {
            target: 'checkingSession',
            actions: 'reloadStoredTokens',
          },
        ],
        onError: [
          {
            guard: 'refreshTokenMatchesSession',
            target: 'unauthenticated',
            actions: ['clearAuth', 'clearTokensFromStorage', 'navigateToLogin'],
          },
          {
            target: 'checkingSession',
            actions: 'reloadStoredTokens',
          },
        ],
      },
    },

    loggingOut: {
      description: 'Logging out user',
      invoke: {
        src: 'logoutActor',
        input: ({ context }) => ({ refreshToken: context.refreshToken }),
        onDone: [
          {
            guard: 'logoutMatchesSession',
            target: 'unauthenticated',
            actions: ['clearAuth', 'clearTokensFromStorage', 'navigateToLogin'],
          },
          {
            target: 'checkingSession',
            actions: 'reloadStoredTokens',
          },
        ],
        onError: [
          {
            guard: 'logoutMatchesSession',
            target: 'unauthenticated',
            actions: ['clearAuth', 'clearTokensFromStorage', 'navigateToLogin'],
          },
          {
            target: 'checkingSession',
            actions: 'reloadStoredTokens',
          },
        ],
      },
    },
  },
});
