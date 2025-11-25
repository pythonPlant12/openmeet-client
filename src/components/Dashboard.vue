<script setup lang="ts">
import { Plus, Video } from 'lucide-vue-next';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/composables/useAuth';

const router = useRouter();

const { currentUser } = useAuth();

const meetingCode = ref('');

const createNewMeeting = () => {
  const meetingId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  router.push(`/meet/${meetingId}`);
};

const joinMeeting = () => {
  if (meetingCode.value.trim()) {
    router.push(`/meet/${meetingCode.value.trim()}`);
  }
};
</script>

<template>
  <div class="min-h-[calc(100vh-80px)] p-6">
    <div class="w-full max-w-7xl mx-auto flex flex-col gap-8">
      <Card class="mt-5">
        <CardHeader>
          <div class="flex items-center gap-4">
            <div
              class="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-2xl font-bold text-white shrink-0"
            >
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

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 class="text-xl font-semibold flex items-center gap-2">
              <Plus class="h-5 w-5" />
              Create a new meeting
            </h3>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground mb-4">
              Start an instant meeting and share the link with participants
            </p>
            <Button @click="createNewMeeting" class="w-full">
              <Video class="h-4 w-4 mr-2" />
              New Meeting
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 class="text-xl font-semibold flex items-center gap-2">
              <Video class="h-5 w-5" />
              Join a meeting
            </h3>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground mb-4">Enter a meeting code or link to join</p>
            <div class="flex gap-2">
              <Input v-model="meetingCode" placeholder="Enter meeting code" @keyup.enter="joinMeeting" />
              <Button @click="joinMeeting" :disabled="!meetingCode.trim()"> Join </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
