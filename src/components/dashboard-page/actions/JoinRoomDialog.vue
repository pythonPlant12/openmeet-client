<script setup lang="ts">
import { ref, watch } from 'vue';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMeetingNavigation } from '@/composables/useMeetingNavigation';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (event: 'update:open', value: boolean): void }>();

const { t } = useI18n();
const { joinMeeting } = useMeetingNavigation();
const code = ref('');
const error = ref('');

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    code.value = '';
    error.value = '';
  },
);

function handleJoin() {
  if (!joinMeeting(code.value)) {
    error.value = t('landing.invalidRoom');
    return;
  }
  emit('update:open', false);
}
</script>
<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)"
    ><HarborDialogContent
      overlay-class="bg-harbor-ink/30 backdrop-blur-md"
      class="marketing-font w-[calc(100%-2rem)] max-w-md rounded-[1.75rem] border-harbor-line bg-harbor-surface p-5 text-harbor-ink shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full sm:p-6"
      ><DialogHeader
        ><DialogTitle>{{ t('common.joinMeeting') }}</DialogTitle
        ><DialogDescription class="text-harbor-muted">{{ t('landing.joinTitle') }}</DialogDescription></DialogHeader
      >
      <form class="space-y-4" @submit.prevent="handleJoin">
        <div class="space-y-2">
          <Label for="join-room-code">{{ t('landing.roomInputLabel') }}</Label>
          <Input
            id="join-room-code"
            v-model="code"
            required
            autocomplete="off"
            :placeholder="t('landing.roomPlaceholder')"
            :aria-invalid="!!error"
            :aria-describedby="error ? 'join-room-error' : undefined"
            class="h-11 rounded-xl border-harbor-line bg-white focus-visible:ring-0"
            @input="error = ''"
          />
        </div>
        <p
          v-if="error"
          id="join-room-error"
          class="rounded-xl border border-harbor-danger/25 bg-harbor-danger-soft px-3 py-2 text-sm text-harbor-danger-strong"
          role="alert"
        >
          {{ error }}
        </p>
        <DialogFooter
          ><Button
            type="button"
            variant="outline"
            class="rounded-full border-harbor-line bg-white text-harbor-ink-soft"
            @click="emit('update:open', false)"
            >{{ t('common.cancel') }}</Button
          ><Button
            type="submit"
            class="harbor-primary-action rounded-full bg-harbor-accent text-white"
            :disabled="!code.trim()"
            >{{ t('landing.joinRoom') }}</Button
          ></DialogFooter
        >
      </form></HarborDialogContent
    ></Dialog
  >
</template>
