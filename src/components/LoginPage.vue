<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { Actor } from 'xstate';

/**
 * Inject the auth actor from App.vue
 * The actor is provided at the app level so all components can access it
 */
const authActor = inject<any>('authActor');
const router = useRouter();

if (!authActor) {
  throw new Error('Auth actor not provided!');
}

/**
 * Access the snapshot from the injected actor
 * We use authActor.snapshot to get the current snapshot
 */
const snapshot = computed(() => authActor.snapshot.value);

const email = ref('');
const password = ref('');
const rememberMe = ref(false);

/**
 * Computed properties tracking machine state
 */
const isAuthenticating = computed(() => snapshot.value.value === 'authenticating');
const hasError = computed(() => snapshot.value.value === 'authenticationFailed');
const errorMessage = computed(() => snapshot.value.context.error);
const isAuthenticated = computed(() => snapshot.value.value === 'authenticated');

/**
 * Watch for successful authentication and redirect to dashboard
 * This will trigger whenever the auth state changes to 'authenticated'
 */
watch(isAuthenticated, (authenticated) => {
  if (authenticated) {
    router.push('/dashboard');
  }
});

/**
 * Send LOGIN event to the auth machine
 */
const handleLogin = () => {
  authActor.send({
    type: 'LOGIN',
    email: email.value,
    password: password.value,
    rememberMe: rememberMe.value,
  });
};

const handleRetry = () => {
  authActor.send({ type: 'RETRY' });
};
</script>

<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <h1>Welcome Back</h1>
          <p>Sign in to continue your gaming experience</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="your.email@example.com"
              required
              :disabled="isAuthenticating"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              placeholder="Enter your password"
              required
              :disabled="isAuthenticating"
            />
          </div>

          <div class="form-group-checkbox">
            <input id="remember" v-model="rememberMe" type="checkbox" :disabled="isAuthenticating" />
            <label for="remember">Remember me</label>
          </div>

          <div v-if="hasError" class="error-message">
            <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            {{ errorMessage }}
          </div>

          <button type="submit" class="btn-primary" :disabled="isAuthenticating">
            <span v-if="isAuthenticating" class="btn-spinner"></span>
            <span v-else>Sign In</span>
          </button>

          <button v-if="hasError" type="button" class="btn-secondary" @click="handleRetry">
            Try Again
          </button>
        </form>

        <div class="login-footer">
          <p class="demo-hint">
            💡 Demo credentials: <strong>test@test.com</strong> / <strong>password</strong>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: calc(100vh - 80px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-4);
  position: relative;
  overflow: hidden;
}

.login-page::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, rgba(255, 107, 53, 0.1) 0%, transparent 70%);
  animation: pulse 8s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

.login-container {
  width: 100%;
  max-width: 420px;
  z-index: 1;
}

.login-card {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-2xl);
  padding: var(--spacing-8);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--color-surface);
}

.login-header {
  text-align: center;
  margin-bottom: var(--spacing-8);
}

.login-header h1 {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
}

.login-header p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-5);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.form-group input[type='email'],
.form-group input[type='password'] {
  padding: var(--spacing-3) var(--spacing-4);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-surface);
  border-radius: var(--radius-lg);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  transition: all var(--transition-base);
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-group-checkbox {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.form-group-checkbox input[type='checkbox'] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.form-group-checkbox label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.error-message {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-4);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-lg);
  color: var(--color-error);
  font-size: var(--font-size-sm);
}

.error-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.btn-primary,
.btn-secondary {
  padding: var(--spacing-3) var(--spacing-6);
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.btn-secondary:hover {
  background: var(--color-surface-hover);
}

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: var(--radius-full);
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.login-footer {
  margin-top: var(--spacing-6);
  padding-top: var(--spacing-6);
  border-top: 1px solid var(--color-surface);
}

.demo-hint {
  text-align: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.demo-hint strong {
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}
</style>
