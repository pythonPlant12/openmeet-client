<script setup lang="ts">
import { User } from 'lucide-vue-next';
import { ref } from 'vue';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  meetingId: string;
}

interface Emits {
  (e: 'join', name: string): void;
  (e: 'cancel'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const participantName = ref('');
const error = ref('');

const handleJoin = () => {
  const trimmedName = participantName.value.trim();

  if (!trimmedName) {
    error.value = 'Please enter your name';
    return;
  }

  if (trimmedName.length < 2) {
    error.value = 'Name must be at least 2 characters';
    return;
  }

  if (trimmedName.length > 50) {
    error.value = 'Name must be less than 50 characters';
    return;
  }

  // Store name in sessionStorage for this meeting session
  sessionStorage.setItem('participantName', trimmedName);

  emit('join', trimmedName);
};

const handleCancel = () => {
  emit('cancel');
};

// Clear error when user types
const handleInput = () => {
  error.value = '';
};
</script>

<template>
  <Dialog :open="open">
    <DialogContent class="sm:max-w-md fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <User class="h-5 w-5" />
          Join Meeting
        </DialogTitle>
        <DialogDescription>
          Enter your name to join the meeting
          <span class="font-mono text-xs block mt-1 text-muted-foreground">{{ meetingId }}</span>
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="participant-name">Your Name</Label>
          <Input
            id="participant-name"
            v-model="participantName"
            type="text"
            placeholder="Enter your name"
            maxlength="50"
            @keyup.enter="handleJoin"
            @input="handleInput"
            autofocus
          />
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          <p class="text-xs text-muted-foreground">
            This name will be visible to other participants
          </p>
        </div>
      </div>

      <DialogFooter class="sm:justify-between">
        <Button variant="outline" @click="handleCancel"> Cancel </Button>
        <Button @click="handleJoin" :disabled="!participantName.trim()"> Join Meeting </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
