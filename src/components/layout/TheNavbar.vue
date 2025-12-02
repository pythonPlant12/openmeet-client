<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router';

import { Button } from '@/components/ui/button';
import { useBranding } from '@/config/branding.config';
import { useAuth } from '@/composables/useAuth';
import { AuthEventType } from '@/xstate/machines/auth/types';

const router = useRouter();
const branding = useBranding();
const { isAuthenticated, currentUser, send } = useAuth();

const handleLogin = () => {
  router.push('/login');
};

const handleLogout = () => {
  send({ type: AuthEventType.LOGOUT });
};
</script>

<template>
  <nav class="sticky top-0 left-0 right-0 z-[1030] bg-card border-b border-primary backdrop-blur-sm">
    <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
      <RouterLink to="/" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <div
          class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground"
        >
          {{ branding.logoText }}
        </div>
        <span class="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          {{ branding.appName }}
        </span>
      </RouterLink>

      <div class="flex items-center gap-3">
        <Button v-if="!isAuthenticated" @click="handleLogin">Login</Button>
        <div v-else class="flex items-center gap-3">
          <span class="text-sm font-medium">{{ currentUser?.name }}</span>
          <Button variant="outline" @click="handleLogout">Logout</Button>
        </div>
      </div>
    </div>
  </nav>
</template>
