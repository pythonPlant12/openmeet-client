import { computed, inject } from 'vue';

export function useAuth() {
  const authActor = inject<any>('authActor');

  if (!authActor) {
    throw new Error('Auth actor not provided! Make sure authActor is provided in App.vue');
  }

  // Computed properties for easy access to state
  // authActor.snapshot is already a Ref from useMachine
  const state = computed(() => authActor.snapshot.value);
  const context = computed(() => authActor.snapshot.value.context);

  const isAuthenticating = computed(() => state.value.value === 'authenticating');
  const isAuthenticated = computed(() => state.value.value === 'authenticated');
  const isCheckingSession = computed(
    () => state.value.value === 'checkingSession' || state.value.value === 'validatingSession',
  );
  const hasError = computed(() => state.value.value === 'authenticationFailed');
  const errorMessage = computed(() => state.value.context.error);
  const currentUser = computed(() => state.value.context.user);

  return {
    state,
    context,
    isAuthenticating,
    isAuthenticated,
    isCheckingSession,
    hasError,
    errorMessage,
    currentUser,
    send: authActor.send,
    actorRef: authActor.actorRef,
  };
}
