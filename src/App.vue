<script setup lang="ts">
import { useMachine } from '@xstate/vue';
import { computed, provide } from 'vue';
import { RouterView, useRouter } from 'vue-router';

import { Button } from '@/components/ui/button';

import { cookieUtils } from './utils';
import { authMachine } from './xstate/machines/auth';
import { AuthEventType, AuthState } from './xstate/machines/auth/types';
import { webrtcMachine } from './xstate/machines/webrtc';

const router = useRouter();

const authActorRef = useMachine(authMachine, {
  input: {
    initialToken: cookieUtils.get('authToken'),
    router,
  },
});

const webrtcActorRef = useMachine(webrtcMachine);

provide('authActor', authActorRef);
provide('webrtcActor', webrtcActorRef);

const authSnapshot = computed(() => authActorRef.snapshot.value);
const isAuthenticated = computed(() => authSnapshot.value.value === AuthState.AUTHENTICATED);
const currentUser = computed(() => authSnapshot.value.context.user);

const handleLogin = () => {
  router.push('/dashboard');
};

const handleLogout = () => {
  authActorRef.send({ type: AuthEventType.LOGOUT });
};
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <nav class="fixed top-0 left-0 right-0 z-[1030] bg-card border-b border-border backdrop-blur-sm">
      <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Xstate + WebRTC for AirConsole
          </span>
        </div>

        <div class="flex items-center gap-3">
          <Button v-if="!isAuthenticated" @click="handleLogin">Login</Button>
          <div v-else class="flex items-center gap-3">
            <span class="text-sm font-medium">{{ currentUser?.name }}</span>
            <Button variant="outline" @click="handleLogout">Logout</Button>
          </div>
        </div>
      </div>
    </nav>

    <main class="flex-1 mt-20">
      <RouterView />
    </main>
  </div>
</template>
