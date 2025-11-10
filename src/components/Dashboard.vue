<script setup lang="ts">
import { computed, inject } from 'vue';
import { useRouter } from 'vue-router';

/**
 * Inject the auth actor from App.vue
 */
const authActor = inject<any>('authActor');
const router = useRouter();

if (!authActor) {
  throw new Error('Auth actor not provided!');
}

/**
 * Access the snapshot from the injected actor
 */
const snapshot = computed(() => authActor.snapshot.value);
const currentUser = computed(() => snapshot.value.context.user);

// Debug: Check what's in the context
console.log('Dashboard context:', snapshot.value.context);

/**
 * Send LOGOUT event to the machine
 */
const handleLogout = () => {
  authActor.send({ type: 'LOGOUT' });
  router.push('/');
};

/**
 * Redirect to login if not authenticated
 */
const isAuthenticated = computed(() => snapshot.value.value === 'authenticated');
if (!isAuthenticated.value) {
  router.push('/');
}
</script>

<template>
  <div class="dashboard-page">
    <div class="dashboard-container">
      <div class="welcome-card">
        <div class="welcome-header">
          <div class="avatar">
            {{ currentUser?.name?.charAt(0) || 'U' }}
          </div>
          <div class="welcome-text">
            <h2>Welcome back, {{ currentUser?.name }}!</h2>
            <p>{{ currentUser?.email }}</p>
            <span class="role-badge">{{ currentUser?.role }}</span>
          </div>
        </div>

        <div class="user-info">
          <div class="info-card">
            <h3>Authentication Status</h3>
            <div class="status-grid">
              <div class="status-item">
                <span class="status-label">State:</span>
                <span class="status-value">{{ snapshot.value }}</span>
              </div>
              <div class="status-item">
                <span class="status-label">Token:</span>
                <span class="status-value token">
                  {{ snapshot.context?.token ? snapshot.context.token.substring(0, 20) + '...' : 'None' }}
                </span>
              </div>
              <div class="status-item">
                <span class="status-label">Remember Me:</span>
                <span class="status-value">{{ snapshot.context?.rememberMe ? 'Yes' : 'No' }}</span>
              </div>
            </div>
          </div>
        </div>

        <button class="btn-logout" @click="handleLogout">Sign Out</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  min-height: calc(100vh - 80px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-4);
}

.dashboard-container {
  width: 100%;
  max-width: 500px;
}

.welcome-card {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-2xl);
  padding: var(--spacing-8);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--color-surface);
}

.welcome-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-6);
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: white;
  flex-shrink: 0;
}

.welcome-text h2 {
  font-size: var(--font-size-2xl);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-1);
}

.welcome-text p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-2);
}

.role-badge {
  display: inline-block;
  padding: var(--spacing-1) var(--spacing-3);
  background: var(--color-surface);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  text-transform: uppercase;
  font-weight: var(--font-weight-semibold);
}

.user-info {
  margin-bottom: var(--spacing-6);
}

.info-card {
  background: var(--color-bg-tertiary);
  padding: var(--spacing-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-surface);
}

.info-card h3 {
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-4);
}

.status-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.status-value {
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.status-value.token {
  font-family: monospace;
  font-size: var(--font-size-xs);
  color: var(--color-primary);
}

.btn-logout {
  width: 100%;
  padding: var(--spacing-3) var(--spacing-6);
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-base);
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.btn-logout:hover {
  background: var(--color-surface-hover);
  transform: translateY(-1px);
}
</style>
