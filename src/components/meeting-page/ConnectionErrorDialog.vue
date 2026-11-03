<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  HarborDialogContent,
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
  <Dialog :open="open" @update:open="(val) => !val && handleClose()"
    ><HarborDialogContent
      overlay-class="bg-harbor-ink/30 backdrop-blur-md"
      class="marketing-font w-[calc(100%-2rem)] max-w-md rounded-[1.75rem] border-harbor-line bg-harbor-surface p-5 text-harbor-ink shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full sm:p-6"
      data-testid="connection-error-dialog"
      ><DialogHeader class="items-center text-center sm:items-start sm:text-left">
        <span
          class="mb-2 flex size-12 items-center justify-center rounded-full bg-harbor-danger-soft text-harbor-danger"
          ><AlertTriangle class="size-6"
        /></span>
        <DialogTitle>{{ t('meeting.error.title') }}</DialogTitle>
        <DialogDescription class="text-harbor-muted">
          <span v-if="connectionState === 'failed'">{{ t('meeting.error.initial') }}</span>
          <span v-else-if="errorMessage">{{ t('meeting.error.withMessage', { message: errorMessage }) }}</span>
          <span v-else>{{ t('meeting.error.lost') }}</span>
        </DialogDescription></DialogHeader
      ><DialogFooter class="gap-2"
        ><Button
          type="button"
          variant="outline"
          class="rounded-full border-harbor-line bg-white text-harbor-ink-soft"
          data-testid="connection-error-leave"
          @click="handleLeave"
          >{{ t('meeting.error.goHome') }}</Button
        ><Button
          type="button"
          class="harbor-primary-action rounded-full bg-harbor-accent text-white"
          data-testid="connection-error-reload"
          @click="handleReload"
          >{{ t('meeting.error.reconnect') }}</Button
        ></DialogFooter
      ></HarborDialogContent
    ></Dialog
  >
</template>
