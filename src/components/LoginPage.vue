<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

const authActor = inject<any>('authActor');
const router = useRouter();

if (!authActor) {
  throw new Error('Auth actor not provided!');
}

const snapshot = computed(() => authActor.snapshot.value);

const email = ref('');
const password = ref('');
const rememberMe = ref(false);

const isCheckingSession = computed(
  () => snapshot.value.value === 'checkingSession' || snapshot.value.value === 'validatingSession',
);
const isAuthenticating = computed(() => snapshot.value.value === 'authenticating');
const hasError = computed(() => snapshot.value.value === 'authenticationFailed');
const errorMessage = computed(() => snapshot.value.context.error);
const isAuthenticated = computed(() => snapshot.value.value === 'authenticated');

watch(isAuthenticated, (authenticated) => {
  if (authenticated) {
    router.push('/dashboard');
  }
});

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
      <div v-if="isCheckingSession" class="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p class="text-sm text-muted-foreground">Checking authentication...</p>
      </div>

      <Card v-else class="w-full max-w-md">
        <CardHeader class="text-center">
          <CardTitle class="text-3xl font-bold">Welcome</CardTitle>
          <CardDescription>Sign in to continue your gaming experience</CardDescription>
        </CardHeader>

        <CardContent>
          <form @submit.prevent="handleLogin" class="space-y-4">
            <div class="space-y-2">
              <Label for="email">Email</Label>
              <Input
                id="email"
                v-model="email"
                type="email"
                placeholder="your.email@example.com"
                required
                :disabled="isAuthenticating"
              />
            </div>

            <div class="space-y-2">
              <Label for="password">Password</Label>
              <Input
                id="password"
                v-model="password"
                type="password"
                placeholder="Enter your password"
                required
                :disabled="isAuthenticating"
              />
            </div>

            <div v-if="hasError" class="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              {{ errorMessage }}
            </div>

            <Button type="submit" class="w-full" :disabled="isAuthenticating">
              <Spinner v-if="isAuthenticating" size="sm" class="mr-2" />
              {{ isAuthenticating ? 'Signing In...' : 'Sign In' }}
            </Button>

            <Button v-if="hasError" type="button" variant="outline" class="w-full" @click="handleRetry">
              Try Again
            </Button>

            <p class="text-center text-xs text-muted-foreground pt-4 border-t">
              💡 Demo: <strong class="text-primary">test@test.com</strong> / <strong class="text-primary">password</strong>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: calc(100vh - 80px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.login-container {
  width: 100%;
  display: flex;
  justify-content: center;
}
</style>
