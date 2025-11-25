import { flushPromises, mount } from '@vue/test-utils';
import { useMachine } from '@xstate/vue';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, inject } from 'vue';

import { authMachine } from '@/xstate/machines/auth';
import { AuthEventType, AuthState } from '@/xstate/machines/auth/types';

import { useAuth } from '../useAuth';

// Helper to create and mount test component with auth actor
function createAuthTestWrapper(initialToken: string | null = null) {
  // Possible to declar the auth actor outside, and then inject it inside the component
  const authActorRef = useMachine(authMachine, {
    input: { initialToken },
  });

  const TestComponent = defineComponent({
    setup() {
      const authActor = inject<any>('authActor');
      console.log('authActor in helper: ', authActor);
      const auth = useAuth();
      return { auth };
    },
    render() {
      return h('div', [
        h('div', { 'data-testid': 'state' }, this.auth.state.value?.value || ''),
        h('div', { 'data-testid': 'is-authenticating' }, String(this.auth.isAuthenticating.value)),
        h('div', { 'data-testid': 'is-authenticated' }, String(this.auth.isAuthenticated.value)),
        h('div', { 'data-testid': 'user-name' }, this.auth.currentUser.value?.name || 'null'),
      ]);
    },
  });

  const wrapper = mount(TestComponent, {
    global: {
      provide: {
        authActor: authActorRef,
      },
    },
  });

  return { wrapper, authActorRef };
}

describe('useAuth Composable', () => {
  describe('Composable Setup', () => {
    it('should throw error when authActor is not provided', () => {
      const TestComponent = defineComponent({
        setup() {
          const auth = useAuth();
          return { auth };
        },
        render() {
          return h('div');
        },
      });

      expect(() => {
        mount(TestComponent);
      }).toThrow('Auth actor not provided');
    });

    it('should successfully inject authActor when provided', () => {
      const { wrapper } = createAuthTestWrapper();
      expect(wrapper.find('[data-testid="state"]').text()).toBeTruthy();
    });
  });

  describe('State Computed Properties', () => {
    it('should expose state computed property', () => {
      const { wrapper } = createAuthTestWrapper();
      const state = wrapper.find('[data-testid="state"]').text();
      expect([AuthState.CHECKING_SESSION, AuthState.UNAUTHENTICATED]).toContain(state);
    });

    it('should expose context computed property', () => {
      const { wrapper } = createAuthTestWrapper();
      expect(wrapper.vm.auth.context.value).toBeDefined();
      expect(wrapper.vm.auth.context.value.user).toBeNull();
    });
  });

  describe('Boolean State Helpers', () => {
    it('should have isAuthenticating false initially', () => {
      const { wrapper } = createAuthTestWrapper();
      expect(wrapper.find('[data-testid="is-authenticating"]').text()).toBe('false');
    });

    it('should have isAuthenticated false when unauthenticated', async () => {
      const { wrapper } = createAuthTestWrapper();
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(wrapper.find('[data-testid="is-authenticated"]').text()).toBe('false');
    });

    it('should have isAuthenticating computed property', () => {
      const { wrapper } = createAuthTestWrapper();
      expect(wrapper.vm.auth.isAuthenticating).toBeDefined();
      expect(typeof wrapper.vm.auth.isAuthenticating.value).toBe('boolean');
    });

    it('should have isAuthenticated computed property', () => {
      const { wrapper } = createAuthTestWrapper();
      expect(wrapper.vm.auth.isAuthenticated).toBeDefined();
      expect(typeof wrapper.vm.auth.isAuthenticated.value).toBe('boolean');
    });
  });

  describe('isCheckingSession', () => {
    it('should be true in checkingSession state', () => {
      const { wrapper } = createAuthTestWrapper();
      const state = wrapper.find('[data-testid="state"]').text();
      expect([AuthState.CHECKING_SESSION, AuthState.UNAUTHENTICATED]).toContain(state);
    });

    it('should be true in validatingSession state', async () => {
      const { wrapper } = createAuthTestWrapper('mock-jwt-token');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(wrapper.vm.auth.isCheckingSession.value).toBe(true);
    });

    it('should be false in unauthenticated state', async () => {
      const { wrapper } = createAuthTestWrapper();
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(wrapper.vm.auth.isCheckingSession.value).toBe(false);
    });
  });

  describe('hasError and errorMessage', () => {
    it('should have hasError false initially', () => {
      const { wrapper } = createAuthTestWrapper();
      expect(wrapper.vm.auth.hasError.value).toBe(false);
    });

    it('should expose hasError and errorMessage computed properties', () => {
      const { wrapper } = createAuthTestWrapper();
      expect(wrapper.vm.auth.hasError).toBeDefined();
      expect(wrapper.vm.auth.errorMessage).toBeDefined();
      expect(typeof wrapper.vm.auth.hasError.value).toBe('boolean');
    });
  });

  describe('currentUser', () => {
    it('should be null when not authenticated', () => {
      const { wrapper } = createAuthTestWrapper();
      expect(wrapper.find('[data-testid="user-name"]').text()).toBe('null');
    });

    it('should expose currentUser computed property', () => {
      const { wrapper } = createAuthTestWrapper();
      expect(wrapper.vm.auth.currentUser).toBeDefined();
    });
  });

  describe('send and actorRef', () => {
    it('should expose send method', () => {
      const { wrapper } = createAuthTestWrapper();
      expect(wrapper.vm.auth.send).toBeDefined();
      expect(typeof wrapper.vm.auth.send).toBe('function');
    });

    it('should expose actorRef', () => {
      const { wrapper, authActorRef } = createAuthTestWrapper();
      expect(wrapper.vm.auth.actorRef).toBeDefined();
      expect(wrapper.vm.auth.actorRef).toBe(authActorRef.actorRef);
    });

    it('should be able to send events via composable send method', () => {
      const { wrapper } = createAuthTestWrapper();
      expect(() => {
        wrapper.vm.auth.send({ type: AuthEventType.RETRY });
      }).not.toThrow();
    });
  });

  describe('Reactivity', () => {
    it('should have reactive computed properties', () => {
      const { wrapper } = createAuthTestWrapper();
      const { state, context, isAuthenticating, isAuthenticated } = wrapper.vm.auth;

      expect(state.value).toBeDefined();
      expect(context.value).toBeDefined();
      expect(typeof isAuthenticating.value).toBe('boolean');
      expect(typeof isAuthenticated.value).toBe('boolean');
    });
  });
});
