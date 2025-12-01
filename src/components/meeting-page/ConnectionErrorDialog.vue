<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  connectionState?: string | null;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'reload'): void;
  (e: 'leave'): void;
  (e: 'close'): void;
}>();

const handleReload = () => {
  emit('reload');
  window.location.reload();
};

const handleLeave = () => {
  emit('leave');
};

const handleClose = () => {
  emit('close');
};
</script>

<template>
  <Dialog :open="open" @update:open="(val) => !val && handleClose()">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-destructive/10 rounded-full">
            <AlertTriangle class="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle>Connection Lost</DialogTitle>
        </div>
        <DialogDescription class="pt-2">
          <span v-if="connectionState === 'failed'">
            Failed to establish a connection to the meeting. This could be due to network issues or server problems.
          </span>
          <span v-else> Your connection to the meeting was lost. This could be due to network issues. </span>
        </DialogDescription>
      </DialogHeader>

      <DialogFooter class="flex-col sm:flex-row gap-2">
        <Button variant="outline" @click="handleLeave"> Leave Meeting </Button>
        <Button @click="handleReload"> Reload Page </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
