import { mount } from '@vue/test-utils';
import { useMachine } from '@xstate/vue';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, provide } from 'vue';

import LoginPage from '@/components/LoginPage.vue';
import { authMachine } from '@/xstate/machines/auth';
import { AuthEventType, AuthState } from '@/xstate/machines/auth/types';

describe('useAuth Browser Integration', () => {
  it('should perform real login flow in browser with LoginPage', async () => {
    // Create a wrapper component that provides the auth actor
    const WrapperComponent = defineComponent({
      setup() {
        // Create the auth actor inside the component lifecycle
        const authActorRef = useMachine(authMachine, {
          input: { initialToken: null },
        });

        provide('authActor', authActorRef);

        return { authActorRef };
      },
      render() {
        return h(LoginPage);
      },
    });

    const wrapper = mount(WrapperComponent);

    // // Wait for initial session check to complete
    // await new Promise((resolve) => setTimeout(resolve, 200));

    // Check that we're in unauthenticated state
    const authActorRef = wrapper.vm.authActorRef;
    const currentState = authActorRef.snapshot.value.value;
    console.log('Initial state:', currentState);
    expect(currentState).toBe(AuthState.UNAUTHENTICATED);

    // Find email and password inputs
    const emailInput = wrapper.find('#email');
    const passwordInput = wrapper.find('#password');
    expect(emailInput.exists()).toBe(true);
    expect(passwordInput.exists()).toBe(true);

    // Fill in the form
    await emailInput.setValue('test@test.com');
    await passwordInput.setValue('password');
    await wrapper.vm.$nextTick();

    // Find the form and trigger submit
    const form = wrapper.find('form');
    expect(form.exists()).toBe(true);

    // Trigger form submit event
    await form.trigger('submit');
    await wrapper.vm.$nextTick();

    // Check authenticating state
    const authenticatingState = authActorRef.snapshot.value.value;
    expect(authenticatingState).toBe(AuthState.AUTHENTICATING);

    // Wait for authentication to complete (1000ms mock delay + buffer)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await wrapper.vm.$nextTick();

    const finalState = authActorRef.snapshot.value.value;
    const user = authActorRef.snapshot.value.context.user;

    expect(finalState).toBe(AuthState.AUTHENTICATED);
    expect(user).toBeDefined();
    expect(user?.name).toBe('Test User');
    expect(user?.email).toBe('test@test.com');
  });
});
