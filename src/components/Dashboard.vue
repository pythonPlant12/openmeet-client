<script setup lang="ts">
import { computed, inject } from 'vue';
import { useRouter } from 'vue-router';

import VideoCall from './VideoCall.vue';

const authActor = inject<any>('authActor');
const router = useRouter();

if (!authActor) {
  throw new Error('Auth actor not provided!');
}

const snapshot = computed(() => authActor.snapshot.value);
const currentUser = computed(() => snapshot.value.context.user);

console.log('Dashboard context:', snapshot.value.context);

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
      </div>

      <!-- Video Calling Interface -->
      <div class="video-section">
        <h2 class="section-title">Video Calling</h2>
        <VideoCall />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  min-height: calc(100vh - 80px);
  padding: var(--spacing-6);
}

.dashboard-container {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-8);
}

.welcome-card {
  margin-top: 20px;
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

.video-section {
  width: 100%;
}

.section-title {
  font-size: var(--font-size-2xl);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-6);
  font-weight: var(--font-weight-bold);
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: var(--spacing-4);
  }

  .dashboard-container {
    gap: var(--spacing-6);
  }

  .section-title {
    font-size: var(--font-size-xl);
  }
}
</style>
