<script setup lang="ts">
import { ArrowLeft, Home } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import { Button } from '@/components/ui/button';
import { useBranding } from '@/config/branding.config';

const router = useRouter();
const branding = useBranding();
</script>

<template>
  <div class="not-found">
    <div class="not-found-content">
      <div class="error-code">404</div>
      <h1 class="text-2xl font-bold mb-2">Page not found</h1>
      <p class="text-muted-foreground mb-8 max-w-md text-center">
        The page you're looking for doesn't exist or the meeting room ID is invalid.
      </p>

      <div class="flex gap-3">
        <Button variant="outline" @click="router.back()">
          <ArrowLeft class="w-4 h-4 mr-2" />
          Go Back
        </Button>
        <Button @click="router.push('/')">
          <Home class="w-4 h-4 mr-2" />
          {{ branding.appName }} Home
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  min-height: calc(100vh - 80px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.not-found-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.error-code {
  font-size: 8rem;
  font-weight: 800;
  line-height: 1;
  background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.5) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
}
</style>
