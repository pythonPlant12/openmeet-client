import { assign, fromPromise, setup } from 'xstate';

import { cookieUtils } from '@/utils';
import type { AuthContext, AuthEvents, AuthInput, LoginResponse } from './types';

/**
 * ============================================================================
 * STEP 1: DEFINE ASYNC OPERATIONS (The "Ingredients")
 * ============================================================================
 * These are NOT running instances - they are DEFINITIONS of async operations
 * that the machine can invoke when it enters certain states.
 *
 * Think of these as "recipes" that can be used later when needed.
 */

/**
 * Login Actor Definition using fromPromise
 *
 * WHY fromPromise?
 * - Converts a plain async function into an XState-compatible actor
 * - Provides type safety for input and output
 * - Allows XState to manage lifecycle (start, stop, cancel)
 * - Maps Promise resolve/reject to onDone/onError events
 *
 * fromPromise<ReturnType, InputType>:
 * - ReturnType: What the promise resolves with (LoginResponse)
 * - InputType: What data it needs to run ({ email, password })
 *
 * This is a DEFINITION, not a running instance!
 * Think of it as a "recipe card" that XState can use later.
 */
const loginService = fromPromise<LoginResponse, { email: string; password: string }>(async ({ input }) => {
  // `input` contains the data passed when this actor is invoked via invoke: { input: ... }
  // This function won't run until XState invokes it from a state

  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Mock response - replace with real API call like: authApi.login(input)
  if (input.email === 'test@test.com' && input.password === 'password') {
    // If successful, return data (triggers onDone)
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

  // If failed, throw error (triggers onError)
  throw new Error('Invalid credentials');
});

/**
 * Session Validation Actor Definition
 * Same pattern as loginService - wrapped with fromPromise
 */
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

/**
 * Logout Actor Definition
 * Note: No InputType specified - this actor doesn't need input
 */
const logoutService = fromPromise(async () => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  cookieUtils.remove('authToken');
});

/**
 * ============================================================================
 * STEP 2: SETUP THE MACHINE (The "Recipe Book")
 * ============================================================================
 * Here we register all the "ingredients" (actors, actions, guards) that
 * our machine can use. This is NOT executing anything yet - just defining
 * what's available.
 */
export const authMachine = setup({
  // Define TypeScript types for the machine
  types: {
    context: {} as AuthContext, // Shape of the machine's state data
    events: {} as AuthEvents, // All possible events this machine handles
    input: {} as AuthInput, // Initial data when creating the machine
  },

  /**
   * Register Actor Definitions (NOT running instances!)
   * These are the async operations that can be invoked by states.
   * When a state uses `invoke: { src: 'loginService' }`, XState will:
   * 1. Look up 'loginService' from this list
   * 2. Create a NEW child actor from that definition
   * 3. Run it with the provided input
   * 4. Wait for onDone (success) or onError (failure)
   */
  actors: {
    loginService, // ← Can be invoked with: invoke: { src: 'loginService' }
    checkSessionService, // ← Can be invoked with: invoke: { src: 'checkSessionService' }
    logoutService, // ← Can be invoked with: invoke: { src: 'logoutService' }
  },
  /**
   * Register Action Definitions
   * Actions are side effects or context updates that happen during transitions.
   *
   * ALL ACTIONS RECEIVE THESE PARAMETERS:
   * - context: Current machine context (state data)
   * - event: The event that triggered this action
   * - self: Reference to the current actor (the machine instance)
   * - system: The actor system (advanced, rarely used)
   *
   * TWO TYPES OF ACTIONS:
   * 1. assign() - Updates the machine's context (state data)
   *    - MUST use assign() to update context
   *    - Returns new context values
   *    - Can read from { context, event }
   *
   * 2. Regular functions - Side effects (localStorage, logging, etc.)
   *    - Can READ context but cannot UPDATE it
   *    - Used for: localStorage, logging, DOM manipulation, etc.
   *    - Don't return anything
   */
  actions: {
    /**
     * assign() action example - Updates context
     *
     * Receives: { context, event, self, system }
     * When an invoked actor succeeds (onDone), the event contains:
     * - event.output: The return value from the fromPromise function
     *
     * We extract user and token from event.output and save to context
     */
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

    /**
     * Side effect action example (NOT assign)
     *
     * Receives: { context, event, self, system } (but only uses context)
     * This doesn't UPDATE context - it performs a side effect
     *
     * Can READ context.token
     * But cannot UPDATE them (use assign() for that)
     *
     * Used for: Saving token to cookies for persistence across sessions
     */
    saveTokenToStorage: ({ context }) => {
      if (context.token) {
        // Set cookie with 7 days expiration
        cookieUtils.set('authToken', context.token, 7);
      }
      // Note: This action doesn't return anything!
    },

    /**
     * Side effect action with no params
     * If you don't need context/event, you can omit the params
     */
    clearTokenFromStorage: () => {
      cookieUtils.remove('authToken');
    },
  },

  /**
   * Register Guard Definitions
   * Guards are conditional checks that determine if a transition should happen.
   * They return true (allow transition) or false (block transition).
   *
   * Example: always: [{ guard: 'hasStoredToken', target: 'validatingSession' }]
   * - If guard returns true → transition to 'validatingSession'
   * - If guard returns false → try next transition in the array
   */
  guards: {
    hasStoredToken: ({ context }) => !!context.token,
  },
}).createMachine({
  /**
   * ============================================================================
   * STEP 3: CREATE THE MACHINE (The "Recipe")
   * ============================================================================
   * Now we define the actual state machine logic using the registered actors,
   * actions, and guards from setup().
   */
  id: 'auth',

  // Initial context values (the machine's "state data")
  // Can accept input when creating the actor: useMachine(authMachine, { input: { initialToken: '...' } })
  context: ({ input }) => ({
    user: null,
    token: input.initialToken ?? null,
    error: null,
  }),

  // The starting state when the machine is created
  initial: 'checkingSession',

  // All possible states the machine can be in
  states: {
    /**
     * Initial state - runs immediately when machine starts
     * Uses 'always' transitions to immediately check a condition and transition
     */
    checkingSession: {
      description: 'Check if user has a valid stored session',

      /**
       * 'always' means: check these transitions immediately (no event needed)
       * Checks guards in order, takes first one that returns true
       */
      always: [
        {
          guard: 'hasStoredToken', // ← Uses the registered guard
          target: 'validatingSession',
        },
        {
          // Fallback if guard fails (no guard = always true)
          target: 'unauthenticated',
        },
      ],
    },

    validatingSession: {
      description: 'Validate stored token with backend',

      // Example of invoke without detailed comments (same pattern as authenticating)
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

      /**
       * 'entry' actions run when entering this state
       * Here we clear auth data whenever user becomes unauthenticated
       */
      entry: 'clearAuth',

      /**
       * 'on' defines event handlers
       * When this state receives a LOGIN event, transition to 'authenticating'
       */
      on: {
        LOGIN: {
          target: 'authenticating',
        },
      },
    },

    authenticating: {
      description: 'Logging in user',

      /**
       * INVOKE: This is where we USE the registered actor!
       * When the machine enters this state:
       * 1. XState looks up 'loginService' from the actors we registered in setup()
       * 2. Creates a NEW child actor instance from that definition
       * 3. Runs the async function with the input we provide
       * 4. Waits for the promise to resolve (onDone) or reject (onError)
       * 5. Transitions to the appropriate state based on the result
       */
      invoke: {
        src: 'loginService', // ← Which registered actor to invoke

        /**
         * input: Provides data to the actor when it's spawned
         *
         * Where does `event` come from?
         * - It's the event that triggered the transition to this state!
         * - When user sends: send({ type: 'LOGIN', email: '...', password: '...' })
         * - That LOGIN event is captured here as `event`
         * - We extract the email/password and pass them to loginService
         *
         * The return value becomes the `input` parameter in loginService:
         * fromPromise(async ({ input }) => { ... })
         *                      ↑
         *              This gets: { email: '...', password: '...' }
         */
        input: ({ event }) => {
          const loginEvent = event as Extract<AuthEvents, { type: 'LOGIN' }>;
          return {
            email: loginEvent.email, // ← From send({ type: 'LOGIN', email: ... })
            password: loginEvent.password, // ← From send({ type: 'LOGIN', password: ... })
          };
        },

        /**
         * onDone: Runs when the promise resolves successfully
         *
         * Actions execute SYNCHRONOUSLY in the order listed:
         * 1. 'setUserAndToken' runs first (updates context.user and context.token)
         * 2. 'saveTokenToStorage' runs second (reads context.token and saves it)
         * 3. Then transition to 'authenticated' completes
         *
         * Order matters! saveTokenToStorage needs the token that setUserAndToken just set.
         */
        onDone: {
          target: 'authenticated',
          actions: ['setUserAndToken', 'saveTokenToStorage'], // ← Execute in ORDER
        },

        /**
         * onError: Runs when the promise rejects (throws an error)
         */
        onError: {
          target: 'authenticationFailed',
          actions: 'setError', // ← Can be a string (single action) or array
        },
      },
    },

    authenticationFailed: {
      description: 'Login failed - show error',

      /**
       * This state has NO invoke - it just waits for user events
       * The error message is already in context (set by setError action)
       * User can either retry LOGIN or RETRY to clear the error
       */
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

      /**
       * This is a "final-ish" state - user is successfully authenticated
       * Waits for LOGOUT or REFRESH_TOKEN events
       */
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

/**
 * ============================================================================
 * HOW TO USE THIS MACHINE IN VUE:
 * ============================================================================
 *
 * In a Vue component:
 *
 * ```typescript
 * import { useMachine } from '@xstate/vue';
 * import { authMachine } from './machines/auth';
 *
 * // STEP 4: Create a RUNNING instance (the "Restaurant Opens")
 * const { snapshot, send, actorRef } = useMachine(authMachine, {
 *   input: { initialToken: tokenStorage.get() }
 * });
 *
 * // Now `actorRef` is the RUNNING auth machine instance
 * // When you do: send({ type: 'LOGIN', email: '...', password: '...' })
 * // The machine transitions to 'authenticating' state which invokes loginService
 * // XState spawns a child actor from loginService definition and runs it
 * // When done, transitions to 'authenticated' or 'authenticationFailed'
 * ```
 *
 * ============================================================================
 * COMPLETE FLOW EXAMPLE: User Logs In
 * ============================================================================
 *
 * 1. Machine starts in 'checkingSession' state
 * 2. Guard 'hasStoredToken' returns false (no token yet)
 * 3. Transitions to 'unauthenticated'
 * 4. Entry action 'clearAuth' runs, clearing context
 * 5. User clicks login button: send({ type: 'LOGIN', email: '...', password: '...' })
 * 6. Event triggers transition to 'authenticating' state
 * 7. Entry action 'setRememberMe' runs, saving preference to context
 * 8. invoke: { src: 'loginService' } executes:
 *    - XState looks up 'loginService' from registered actors
 *    - Creates a NEW child actor from the fromPromise definition
 *    - Calls the async function with input: { email, password }
 *    - Child actor starts running (making API call)
 * 9. Two possible outcomes:
 *    A) Promise resolves (success):
 *       - onDone fires
 *       - Actions run: ['setUserAndToken', 'saveTokenToStorage']
 *       - Transitions to 'authenticated' state
 *    B) Promise rejects (error):
 *       - onError fires
 *       - Action runs: 'setError'
 *       - Transitions to 'authenticationFailed' state
 *
 * ============================================================================
 * KEY CONCEPTS RECAP:
 * ============================================================================
 * - loginService (fromPromise): DEFINITION of async operation (the recipe card)
 * - actors in setup(): REGISTRATION of available operations (the recipe book)
 * - invoke: { src: 'loginService' }: USAGE in a state (cooking the recipe)
 * - actorRef from useMachine(): RUNNING machine instance (the open restaurant)
 * - Child actor spawned by invoke: RUNNING async operation (the chef cooking)
 * - fromPromise: Converts async function → XState-compatible actor with lifecycle
 */
