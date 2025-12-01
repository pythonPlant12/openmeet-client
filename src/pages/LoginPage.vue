<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next';
import { computed, inject, ref } from 'vue';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/composables/useAuth';
import { AuthEventType, AuthState } from '@/xstate/machines/auth/types';

const authActor = inject<any>('authActor');

if (!authActor) {
  throw new Error('Auth actor not provided!');
}

const authSnapshot = computed(() => authActor.snapshot.value);
const { isAuthenticating, isCheckingSession } = useAuth();

const email = ref('');
const password = ref('');

const hasError = computed(() => authSnapshot.value.value === AuthState.AUTHENTICATION_FAILED);
const errorMessage = computed(() => authSnapshot.value.context.error);

const handleLogin = () => {
  authActor.send({
    type: AuthEventType.LOGIN,
    email: email.value,
    password: password.value,
  });
};

const handleRetry = () => {
  authActor.send({ type: AuthEventType.RETRY });
};
</script>

<template>
  <div class="login-page">
    <div class="login-container">
      <div v-if="isCheckingSession" class="flex flex-col items-center gap-4">
        <Spinner />
        <p class="text-sm text-muted-foreground">Checking authentication...</p>
      </div>

      <Card v-else class="w-full max-w-md">
        <CardHeader class="text-center">
          <CardTitle class="text-3xl font-bold">Welcome</CardTitle>
          <CardDescription>Sign in to create chat rooms</CardDescription>
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

            <div
              v-if="hasError"
              class="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm"
            >
              <AlertCircle class="w-5 h-5 flex-shrink-0" />
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
              💡 Demo: <strong class="text-primary">test@test.com</strong> /
              <strong class="text-primary">password</strong>
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
