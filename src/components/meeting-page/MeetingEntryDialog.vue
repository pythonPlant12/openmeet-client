<script setup lang="ts">
import { Lock, ShieldAlert, User } from 'lucide-vue-next';
import { computed, ref } from 'vue';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingRipple } from '@/components/ui/loading';
import type { MeetingRoomAccess } from '@/services/social-api';

// Asks only what a meeting cannot know: a guest's name, or the password of a protected room. Everyone else
// enters the call directly, and devices are chosen in the call.
interface Props {
  open: boolean;
  meetingId: string;
  initialName?: string;
  showNameInput?: boolean;
  /** Access rules of the room; null for conversation calls. */
  access?: MeetingRoomAccess | null;
  /** Why the last join attempt was refused, such as a wrong password. */
  accessError?: string;
  joining?: boolean;
}

export interface EntrySettings {
  name: string;
  /** The password a password-protected room asked for. */
  password?: string;
}

const props = withDefaults(defineProps<Props>(), {
  initialName: '',
  showNameInput: true,
  access: null,
  accessError: '',
  joining: false,
});
const emit = defineEmits<{
  (e: 'join', settings: EntrySettings): void;
  (e: 'cancel'): void;
}>();
const { t } = useI18n();

const participantName = ref(props.initialName);
const joinPassword = ref('');
const error = ref('');

const isRefused = computed(() => !!props.access && !props.access.canJoin && !props.access.requiresPassword);
const accessReady = computed(() => {
  if (isRefused.value) return false;
  return !props.access?.requiresPassword || joinPassword.value.length > 0;
});
const canJoin = computed(() => participantName.value.trim().length >= 2 && accessReady.value && !props.joining);

const handleJoin = () => {
  const name = participantName.value.trim();

  if (!name || name.length < 2) {
    error.value = name ? t('meeting.join.nameTooShort') : t('meeting.join.nameRequired');
    return;
  }
  if (name.length > 50) {
    error.value = t('meeting.join.nameTooLong');
    return;
  }
  if (!accessReady.value) return;

  sessionStorage.setItem('participantName', name);
  emit('join', { name, ...(props.access?.requiresPassword ? { password: joinPassword.value } : {}) });
};
</script>

<template>
  <Dialog :open="open" :modal="false">
    <DialogContent
      overlay-class="pointer-events-none bg-white/55 backdrop-blur-[2px]"
      class="marketing-font fixed left-1/2 top-[calc(50%+2.25rem)] max-h-[calc(100dvh-6rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border-transparent bg-white text-harbor-ink shadow-[0_24px_70px_rgba(16,47,53,0.14)] sm:max-w-md"
    >
      <DialogHeader>
        <DialogTitle class="flex items-center justify-center sm:justify-start gap-2">
          <User class="h-5 w-5" />
          {{ t('meeting.join.title') }}
        </DialogTitle>
        <DialogDescription class="text-harbor-icon">
          {{ t('meeting.join.entryDescription') }}
          <span class="font-mono text-xs block mt-1 text-harbor-icon">{{ meetingId }}</span>
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div v-if="access?.requiresPassword" class="space-y-1.5" data-meeting-password>
          <Label for="meeting-password" class="flex items-center gap-1.5">
            <Lock class="size-3.5 text-harbor-accent" />{{ t('meeting.join.passwordLabel') }}
          </Label>
          <Input
            id="meeting-password"
            v-model="joinPassword"
            type="password"
            autocomplete="off"
            maxlength="256"
            :placeholder="t('meeting.join.passwordPlaceholder')"
            class="border-harbor-line bg-white text-harbor-ink placeholder:text-harbor-icon"
            @keyup.enter="handleJoin"
          />
        </div>
        <p
          v-else-if="isRefused"
          class="flex items-start gap-2 rounded-xl bg-harbor-danger-soft px-3 py-2.5 text-sm text-harbor-danger-strong"
          data-meeting-refused
        >
          <ShieldAlert class="mt-0.5 size-4 shrink-0" />{{ access?.deniedReason }}
        </p>
        <p v-if="accessError" class="text-sm text-harbor-danger" data-meeting-access-error>{{ accessError }}</p>

        <div v-if="showNameInput" class="space-y-2">
          <Label for="participant-name">{{ t('meeting.join.yourName') }}</Label>
          <Input
            id="participant-name"
            v-model="participantName"
            type="text"
            :placeholder="t('meeting.join.namePlaceholder')"
            class="border-harbor-line bg-white text-harbor-ink placeholder:text-harbor-icon"
            maxlength="50"
            @keyup.enter="handleJoin"
            @input="error = ''"
          />
          <p v-if="error" class="text-sm text-harbor-danger">{{ error }}</p>
        </div>
      </div>

      <DialogFooter class="flex-col gap-3 sm:flex-row sm:justify-end">
        <div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:justify-end">
          <Button
            variant="outline"
            class="meeting-setting-action meeting-setting-on w-full rounded-full border-transparent bg-harbor-hover px-5 text-harbor-ink sm:w-auto"
            @click="emit('cancel')"
          >
            {{ t('common.cancel') }}
          </Button>
          <Button
            class="meeting-primary-action w-full rounded-full bg-harbor-accent px-5 text-white shadow-harbor-soft sm:w-auto"
            :disabled="!canJoin"
            @click="handleJoin"
          >
            <LoadingRipple v-if="joining" size="sm" />
            <template v-else>{{ t('meeting.join.title') }}</template>
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
