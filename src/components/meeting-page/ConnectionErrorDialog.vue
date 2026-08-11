<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

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
  errorMessage?: string | null;
}

defineProps<Props>();
const { t } = useI18n();

const emit = defineEmits<{
  (e: 'reload'): void;
  (e: 'leave'): void;
  (e: 'close'): void;
}>();

const handleReload = () => {
  emit('reload');
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
    <DialogContent class="marketing-font sm:max-w-md border-[#D8E7E3] bg-[#FBFCF8] text-[#102F35]">
      <div data-testid="connection-error-dialog">
        <DialogHeader>
          <div class="flex items-center gap-3">
            <div class="p-2 bg-[#F2765F]/10 rounded-full">
              <AlertTriangle class="h-6 w-6 text-[#F2765F]" />
            </div>
            <DialogTitle>{{ t('meeting.error.title') }}</DialogTitle>
          </div>
          <DialogDescription class="pt-2 text-[#4E6B70]">
            <span v-if="connectionState === 'failed'">
              {{ t('meeting.error.initial') }}
            </span>
            <span v-else-if="errorMessage">
              {{ t('meeting.error.withMessage', { message: errorMessage }) }}
            </span>
            <span v-else>{{ t('meeting.error.lost') }}</span>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter class="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            class="harbor-soft-action border-transparent bg-[#E6F4F1] text-[#27595D]"
            data-testid="connection-error-leave"
            @click="handleLeave"
          >
            {{ t('meeting.error.goHome') }}
          </Button>
          <Button
            class="harbor-primary-action bg-[#0B7A75] text-white"
            data-testid="connection-error-reload"
            @click="handleReload"
          >
            {{ t('meeting.error.reconnect') }}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>
