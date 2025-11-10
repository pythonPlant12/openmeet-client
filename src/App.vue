<script setup lang="ts">
import { useMachine } from '@xstate/vue';
import { computed, provide, watch } from 'vue';
import { RouterView, useRouter } from 'vue-router';

import { cookieUtils } from './utils';
import { authMachine } from './xstate/machines/auth';

const authActorRef = useMachine(authMachine, {
  input: {
    initialToken: cookieUtils.get('authToken'),
  },
});

provide('authActor', authActorRef);

const router = useRouter();

const snapshot = computed(() => authActorRef.snapshot.value);
const isAuthenticated = computed(() => snapshot.value.value === 'authenticated');
const currentUser = computed(() => snapshot.value.context.user);
console.log('snapshot: ', snapshot.value);
console.log('isAuthenticated: ', isAuthenticated.value);
console.log('currentUser: ', currentUser.value);
watch(
  () => snapshot.value,
  (newSnapshot) => {
    console.log('Auth snapshot changed: ', newSnapshot);
  },
);

const handleLogin = () => {
  router.push('/');
};

const handleLogout = () => {
  authActorRef.send({ type: 'LOGOUT' });
  router.push('/');
};
</script>

<template>
  <div class="app">
    <nav class="navbar">
      <div class="navbar-container">
        <div class="navbar-brand">
          <span class="brand-name">Xstate + WebRTC for AirConsole</span>
        </div>

        <div class="navbar-actions">
          <button v-if="!isAuthenticated" class="btn-nav" @click="handleLogin">Login</button>
          <div v-else class="user-menu">
            <span class="user-name">{{ currentUser?.name }}</span>
            <button class="btn-nav-logout" @click="handleLogout">Logout</button>
          </div>
        </div>
      </div>
    </nav>

    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-fixed);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-surface);
  backdrop-filter: blur(10px);
}

.navbar-container {
  max-width: var(--container-xl);
  margin: 0 auto;
  padding: var(--spacing-4) var(--spacing-6);
  display: flex;
  gap: var(--spacing-4);
  align-items: center;
  justify-content: space-between;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.logo {
  width: 32px;
  height: 32px;
  color: var(--color-primary);
}

.brand-name {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.main-content {
  flex: 1;
  margin-top: 80px;
}

.navbar-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.btn-nav,
.btn-nav-logout {
  padding: var(--spacing-2) var(--spacing-5);
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-nav {
  background: var(--color-primary);
  color: white;
}

.btn-nav:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.user-menu {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.user-name {
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.btn-nav-logout {
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.btn-nav-logout:hover {
  background: var(--color-surface-hover);
  transform: translateY(-1px);
}
</style>
