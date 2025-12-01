import { computed, inject } from 'vue';

export function useAuth() {
  const authActor = inject<any>('authActor');

  if (!authActor) {
    throw new Error('Auth actor not provided! Make sure authActor is provided in App.vue');
  }

  const state = computed(() => authActor.snapshot.value);
  const context = computed(() => authActor.snapshot.value.context);

  const isAuthenticating = computed(() => state.value.value === 'authenticating');
  const isRegistering = computed(() => state.value.value === 'registering');
  const isAuthenticated = computed(() => state.value.value === 'authenticated');
  const isCheckingSession = computed(
    () =>
      state.value.value === 'checkingSession' ||
      state.value.value === 'validatingSession' ||
      state.value.value === 'refreshingToken',
  );
  const hasLoginError = computed(() => state.value.value === 'authenticationFailed');
  const hasRegisterError = computed(() => state.value.value === 'registrationFailed');
  const hasError = computed(() => hasLoginError.value || hasRegisterError.value);
  const errorMessage = computed(() => state.value.context.error);
  const currentUser = computed(() => state.value.context.user);
  const accessToken = computed(() => state.value.context.accessToken);

  return {
    state,
    context,
    isAuthenticating,
    isRegistering,
    isAuthenticated,
    isCheckingSession,
    hasLoginError,
    hasRegisterError,
    hasError,
    errorMessage,
    currentUser,
    accessToken,
    send: authActor.send,
    actorRef: authActor.actorRef,
  };
}
