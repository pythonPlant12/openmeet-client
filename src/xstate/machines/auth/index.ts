import { assign, fromPromise, setup } from 'xstate';

import { cookieUtils } from '@/utils';

import type { AuthContext, AuthEvents, AuthInput, LoginResponse } from './types';

const loginService = fromPromise<LoginResponse, { email: string; password: string }>(async ({ input }) => {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (input.email === 'test@test.com' && input.password === 'password') {
    return {
      user: {
        id: '1',
        email: input.email,
        name: 'Test User',
        role: 'user' as const,
      },
      token: 'mock-jwt-token',
    };
  }

  throw new Error('Invalid credentials');
});

const checkSessionService = fromPromise<LoginResponse, { token: string }>(async ({ input }) => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log('Validating token:', input.token);

  if (input.token === 'mock-jwt-token') {
    return {
      user: {
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        role: 'user' as const,
      },
      token: input.token,
    };
  }

  throw new Error('Invalid token');
});

const logoutService = fromPromise(async () => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  cookieUtils.remove('authToken');
});

export const authMachine = setup({
  types: {
    context: {} as AuthContext,
    events: {} as AuthEvents,
    input: {} as AuthInput,
  },

  actors: {
    loginService,
    checkSessionService,
    logoutService,
  },

  actions: {
    setUserAndToken: assign({
      user: ({ event }) => (event as any).output.user,
      token: ({ event }) => (event as any).output.token,
      error: null,
    }),

    setError: assign({
      error: ({ event }) => {
        const error = (event as any).error;
        return error?.message || 'An error occurred';
      },
    }),

    clearAuth: assign({
      user: null,
      token: null,
      error: null,
    }),

    saveTokenToStorage: ({ context }) => {
      if (context.token) {
        cookieUtils.set('authToken', context.token, 7);
      }
    },

    clearTokenFromStorage: () => {
      cookieUtils.remove('authToken');
    },
  },

  guards: {
    hasStoredToken: ({ context }) => !!context.token,
  },
}).createMachine({
  id: 'auth',

  context: ({ input }) => ({
    user: null,
    token: input.initialToken ?? null,
    error: null,
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
        input: ({ context }) => ({ token: context.token! }),
        onDone: {
          target: 'authenticated',
          actions: 'setUserAndToken',
        },
        onError: {
          target: 'unauthenticated',
          actions: ['clearAuth', 'clearTokenFromStorage'],
        },
      },
    },

    unauthenticated: {
      description: 'User is not logged in',
      entry: 'clearAuth',
      on: {
        LOGIN: {
          target: 'authenticating',
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
          actions: ['setUserAndToken', 'saveTokenToStorage'],
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
        src: 'checkSessionService',
        input: ({ context }) => ({ token: context.token! }),
        onDone: {
          target: 'authenticated',
          actions: ['setUserAndToken', 'saveTokenToStorage'],
        },
        onError: {
          target: 'unauthenticated',
          actions: ['clearAuth', 'clearTokenFromStorage'],
        },
      },
    },

    loggingOut: {
      description: 'Logging out user',
      invoke: {
        src: 'logoutService',
        onDone: {
          target: 'unauthenticated',
          actions: 'clearTokenFromStorage',
        },
        onError: {
          target: 'unauthenticated',
          actions: 'clearTokenFromStorage',
        },
      },
    },
  },
});
