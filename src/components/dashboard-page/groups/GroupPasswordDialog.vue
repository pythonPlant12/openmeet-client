<script setup lang="ts">
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
import { LoadingRipple } from '@/components/ui/loading';

// A password group found by search asks only for its password; its info and Join show once the password is right.
defineProps<{
  open: boolean;
  groupTitle: string;
  checking: boolean;
  error: string;
}>();
const emit = defineEmits<{
  (event: 'update:open', value: boolean): void;
  (event: 'submit'): void;
}>();
const password = defineModel<string>('password', { required: true });
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)"
    ><HarborDialogContent
      overlay-class="bg-harbor-ink/30 backdrop-blur-md"
      class="marketing-font w-[calc(100%-2rem)] max-w-md rounded-[1.75rem] border-harbor-line bg-harbor-surface p-6 text-harbor-ink shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full"
      ><DialogHeader
        ><DialogTitle>Enter group password</DialogTitle
        ><DialogDescription class="text-harbor-muted"
          >{{ groupTitle }} is protected with a password.</DialogDescription
        ></DialogHeader
      >
      <form class="space-y-4" @submit.prevent="emit('submit')">
        <div class="space-y-2">
          <Label for="group-password">Password</Label
          ><Input
            id="group-password"
            v-model="password"
            type="password"
            required
            autofocus
            autocomplete="current-password"
            placeholder="Group password"
            :disabled="checking"
            class="h-11 rounded-xl border-harbor-line bg-white focus-visible:ring-0"
          />
        </div>
        <p
          v-if="error"
          class="rounded-xl border border-harbor-danger/25 bg-harbor-danger-soft px-3 py-2 text-sm text-harbor-danger-strong"
          role="alert"
        >
          {{ error }}
        </p>
        <DialogFooter
          ><Button type="button" variant="pill" size="pill" :disabled="checking" @click="emit('update:open', false)"
            >Cancel</Button
          ><Button type="submit" variant="accent" size="pill" :disabled="checking || !password"
            ><LoadingRipple v-if="checking" size="sm" />{{ checking ? 'Checking' : 'Continue' }}</Button
          ></DialogFooter
        >
      </form></HarborDialogContent
    ></Dialog
  >
</template>
