<script setup lang="ts">
import { ref } from 'vue';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

interface Props {
  isIdle: boolean;
  isInitializingMedia: boolean;
  isMediaReady: boolean;
  isCreatingCall: boolean;
  isJoiningCall: boolean;
  isInCall: boolean;
  callId: string | null;
}

interface Emits {
  (e: 'init-media'): void;
  (e: 'create-call'): void;
  (e: 'join-call', callId: string): void;
  (e: 'end-call'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const callIdInput = ref('');
const showCopiedMessage = ref(false);

const handleJoinCall = () => {
  if (callIdInput.value.trim()) {
    emit('join-call', callIdInput.value.trim());
  }
};

const copyCallId = async () => {
  if (props.callId) {
    try {
      await navigator.clipboard.writeText(props.callId);
      showCopiedMessage.value = true;
      setTimeout(() => {
        showCopiedMessage.value = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy call ID:', error);
    }
  }
};
</script>

<template>
  <Card class="p-6">
    <!-- Step 1: Start Webcam -->
    <div v-if="isIdle" class="space-y-4">
      <h2 class="text-lg font-semibold">1. Start Your Webcam</h2>
      <Button class="w-full" @click="emit('init-media')">Start Webcam</Button>
    </div>

    <div v-if="isInitializingMedia" class="flex items-center gap-3 p-4 bg-muted rounded-lg">
      <Spinner size="sm" />
      <span class="text-sm text-muted-foreground">Accessing camera and microphone...</span>
    </div>

    <!-- Step 2: Create or Join Call -->
    <div v-if="isMediaReady" class="space-y-6">
      <div class="space-y-4">
        <h2 class="text-lg font-semibold">2. Create a New Call</h2>
        <Button variant="default" class="w-full" @click="emit('create-call')">Create Call</Button>
      </div>

      <div class="relative text-center text-sm text-muted-foreground my-6">
        <span class="bg-card px-3 relative z-10">OR</span>
        <div class="absolute inset-x-0 top-1/2 h-px bg-border -z-0"></div>
      </div>

      <div class="space-y-4">
        <h2 class="text-lg font-semibold">3. Join a Call</h2>
        <div class="flex gap-2">
          <Input
            v-model="callIdInput"
            type="text"
            placeholder="Paste call ID here"
            @keyup.enter="handleJoinCall"
          />
          <Button :disabled="!callIdInput.trim()" @click="handleJoinCall">Join Call</Button>
        </div>
      </div>
    </div>

    <!-- Creating/Joining Call Loading -->
    <div v-if="isCreatingCall || isJoiningCall" class="flex items-center gap-3 p-4 bg-muted rounded-lg">
      <Spinner size="sm" />
      <span class="text-sm text-muted-foreground">
        {{ isCreatingCall ? 'Creating call...' : 'Joining call...' }}
      </span>
    </div>

    <!-- In Call: Show Call ID and End Button -->
    <div v-if="isInCall" class="space-y-4">
      <div v-if="callId" class="space-y-3">
        <div class="flex justify-between items-center">
          <h3 class="text-base font-semibold">Your Call ID:</h3>
          <span class="px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
            Connected
          </span>
        </div>
        <div class="flex gap-2">
          <code class="flex-1 p-3 bg-muted border-2 border-primary rounded-lg font-mono text-sm break-all">
            {{ callId }}
          </code>
          <Button variant="outline" size="sm" @click="copyCallId">
            {{ showCopiedMessage ? 'Copied!' : 'Copy ID' }}
          </Button>
        </div>
        <p class="text-sm text-muted-foreground">Share this ID with the person you want to call</p>
      </div>

      <Button variant="destructive" class="w-full" @click="emit('end-call')">End Call</Button>
    </div>
  </Card>
</template>

