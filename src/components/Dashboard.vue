<script setup lang="ts">
import { computed, inject } from 'vue';
import { useRouter } from 'vue-router';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
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
  <div class="min-h-[calc(100vh-80px)] p-6">
    <div class="w-full max-w-7xl mx-auto flex flex-col gap-8">
      <Card class="mt-5">
        <CardHeader>
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-2xl font-bold text-white shrink-0">
              {{ currentUser?.name?.charAt(0) || 'U' }}
            </div>
            <div class="flex-1">
              <h2 class="text-2xl font-bold mb-1">Welcome back, {{ currentUser?.name }}!</h2>
              <p class="text-sm text-muted-foreground mb-2">{{ currentUser?.email }}</p>
              <Badge variant="secondary" class="uppercase">{{ currentUser?.role }}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div class="w-full">
        <h2 class="text-2xl font-bold mb-6">Video Calling</h2>
        <VideoCall />
      </div>
    </div>
  </div>
</template>

