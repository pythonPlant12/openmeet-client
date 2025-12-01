import { assign, fromPromise, setup } from 'xstate';

import { authApi, type AuthResponse } from '@/services/auth-api';
import { cookieUtils } from '@/utils';

import type { AuthContext, AuthEvents, AuthInput, User } from './types';

const loginService = fromPromise<AuthResponse, { email: string; password: string }>(async ({ input }) => {
  return authApi.login(input);
});

const registerService = fromPromise<AuthResponse, { email: string; name: string; password: string }>(
  async ({ input }) => {
    return authApi.register(input);
  },
);

const checkSessionService = fromPromise<User, { accessToken: string }>(async ({ input }) => {
  return authApi.me(input.accessToken);
});

const refreshTokenService = fromPromise<string, { refreshToken: string }>(async ({ input }) => {
  const response = await authApi.refresh(input.refreshToken);
  return response.access_token;
});

const logoutService = fromPromise<void, { refreshToken: string | null }>(async ({ input }) => {
  if (input.refreshToken) {
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
    loginService,
    registerService,
    checkSessionService,
    refreshTokenService,
    logoutService,
  },

  actions: {
    setAuthFromResponse: assign({
      user: ({ event }) => (event as any).output.user,
      accessToken: ({ event }) => (event as any).output.access_token,
      refreshToken: ({ event }) => (event as any).output.refresh_token,
      error: null,
    }),

    setUserFromSession: assign({
      user: ({ event }) => (event as any).output,
      error: null,
    }),

    setAccessToken: assign({
      accessToken: ({ event }) => (event as any).output,
    }),

    setError: assign({
      error: ({ event }) => {
        const error = (event as any).error;
        return error?.message || 'An error occurred';
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
    hasStoredToken: ({ context }) => !!context.accessToken,
    hasRefreshToken: ({ context }) => !!context.refreshToken,
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
          guard: 'hasStoredToken',
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
        src: 'checkSessionService',
        input: ({ context }) => ({ accessToken: context.accessToken! }),
        onDone: {
          target: 'authenticated',
          actions: 'setUserFromSession',
        },
        onError: [
          {
            guard: 'hasRefreshToken',
            target: 'refreshingToken',
          },
          {
            target: 'unauthenticated',
            actions: ['clearAuth', 'clearTokensFromStorage'],
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
      },
    },

    authenticating: {
      description: 'Logging in user',
      invoke: {
        src: 'loginService',
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
        src: 'registerService',
        input: ({ event }) => {
          const registerEvent = event as Extract<AuthEvents, { type: 'REGISTER' }>;
          return {
            email: registerEvent.email,
            name: registerEvent.name,
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
      },
    },

    refreshingToken: {
      description: 'Refreshing authentication token',
      invoke: {
        src: 'refreshTokenService',
        input: ({ context }) => ({ refreshToken: context.refreshToken! }),
        onDone: {
          target: 'authenticated',
          actions: ['setAccessToken', 'saveTokensToStorage'],
        },
        onError: {
          target: 'unauthenticated',
          actions: ['clearAuth', 'clearTokensFromStorage', 'navigateToLogin'],
        },
      },
    },

    loggingOut: {
      description: 'Logging out user',
      invoke: {
        src: 'logoutService',
        input: ({ context }) => ({ refreshToken: context.refreshToken }),
        onDone: {
          target: 'unauthenticated',
          actions: ['clearAuth', 'clearTokensFromStorage', 'navigateToLogin'],
        },
        onError: {
          target: 'unauthenticated',
          actions: ['clearAuth', 'clearTokensFromStorage', 'navigateToLogin'],
        },
      },
    },
  },
});
