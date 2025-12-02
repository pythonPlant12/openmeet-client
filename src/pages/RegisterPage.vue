<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next';
import { computed, inject, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/composables/useAuth';
import { useFullscreenLock } from '@/composables/useFullscreenLock';
import { useTheme } from '@/composables/useTheme';
import { AuthEventType } from '@/xstate/machines/auth/types';

useFullscreenLock();

const { theme } = useTheme();
const backgroundImageUrl = computed(() => theme.backgroundImageUrl);

const authActor = inject<any>('authActor');

if (!authActor) {
  throw new Error('Auth actor not provided!');
}

const { isRegistering, isCheckingSession, hasRegisterError, errorMessage } = useAuth();

const name = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const passwordMismatch = ref(false);

const handleRegister = () => {
  if (password.value !== confirmPassword.value) {
    passwordMismatch.value = true;
    return;
  }
  passwordMismatch.value = false;

  authActor.send({
    type: AuthEventType.REGISTER,
    email: email.value,
    name: name.value,
    password: password.value,
  });
};

const handleRetry = () => {
  authActor.send({ type: AuthEventType.RETRY });
};
</script>

<template>
  <div class="register-page">
    <!-- Background image with blur -->
    <div
      v-if="backgroundImageUrl"
      class="absolute inset-0 bg-cover bg-center blur-sm scale-105"
      :style="{ backgroundImage: `url(${backgroundImageUrl})` }"
    />
    <div v-if="backgroundImageUrl" class="absolute inset-0 bg-black/50" />

    <div class="register-container relative z-10">
      <div v-if="isCheckingSession" class="flex flex-col items-center gap-4">
        <Spinner />
        <p class="text-sm text-muted-foreground">Checking authentication...</p>
      </div>

      <Card v-else class="w-full max-w-md">
        <CardHeader class="text-center">
          <CardTitle class="text-3xl font-bold">Create account</CardTitle>
          <CardDescription>Sign up to start video conferencing</CardDescription>
        </CardHeader>

        <CardContent>
          <form @submit.prevent="handleRegister" class="space-y-4">
            <div class="space-y-2">
              <Label for="name">Name</Label>
              <Input id="name" v-model="name" type="text" placeholder="Your name" required :disabled="isRegistering" />
            </div>

            <div class="space-y-2">
              <Label for="email">Email</Label>
              <Input
                id="email"
                v-model="email"
                type="email"
                placeholder="your.email@example.com"
                required
                :disabled="isRegistering"
              />
            </div>

            <div class="space-y-2">
              <Label for="password">Password</Label>
              <Input
                id="password"
                v-model="password"
                type="password"
                placeholder="Create a password"
                required
                minlength="6"
                :disabled="isRegistering"
              />
            </div>

            <div class="space-y-2">
              <Label for="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                v-model="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                required
                :disabled="isRegistering"
              />
            </div>

            <div
              v-if="passwordMismatch"
              class="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm"
            >
              <AlertCircle class="w-5 h-5 flex-shrink-0" />
              Passwords do not match
            </div>

            <div
              v-if="hasRegisterError"
              class="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm"
            >
              <AlertCircle class="w-5 h-5 flex-shrink-0" />
              {{ errorMessage }}
            </div>

            <Button type="submit" class="w-full" :disabled="isRegistering">
              <Spinner v-if="isRegistering" size="sm" class="mr-2" />
              {{ isRegistering ? 'Creating Account...' : 'Create Account' }}
            </Button>

            <Button v-if="hasRegisterError" type="button" variant="outline" class="w-full" @click="handleRetry">
              Try Again
            </Button>

            <p class="text-center text-sm text-muted-foreground pt-4 border-t">
              Already have an account?
              <RouterLink to="/login" class="text-primary hover:underline font-medium"> Sign in </RouterLink>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.register-page {
  min-height: calc(100vh - 80px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  position: relative;
  overflow: hidden;
}

.register-container {
  width: 100%;
  display: flex;
  justify-content: center;
}
</style>
