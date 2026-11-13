<script setup lang="ts">
import { LockKeyhole } from 'lucide-vue-next';
import { ref, watch } from 'vue';

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
import { type Conversation, type GroupInvitation, SocialApiError, socialApi } from '@/services/social-api';

const props = defineProps<{
  open: boolean;
  invitation: GroupInvitation | null;
  accessToken?: string;
}>();
const emit = defineEmits<{
  (event: 'update:open', value: boolean): void;
  (event: 'accepted', invitationId: string, conversation: Conversation): void;
}>();

const password = ref('');
const error = ref('');
const isAccepting = ref(false);

watch(
  () => [props.open, props.invitation?.id],
  () => {
    password.value = '';
    error.value = '';
  },
);

function setOpen(open: boolean) {
  if (!open && isAccepting.value) return;
  emit('update:open', open);
}

async function accept() {
  const invitation = props.invitation;
  if (!invitation || !props.accessToken || isAccepting.value) return;
  const requiresPassword = invitation.accessPolicy === 'password';
  if (requiresPassword && !password.value) return;

  error.value = '';
  isAccepting.value = true;
  try {
    const conversation = await socialApi.acceptGroupInvitation(
      props.accessToken,
      invitation.id,
      requiresPassword ? password.value : undefined,
    );
    emit('accepted', invitation.id, conversation);
  } catch (acceptError) {
    console.error('[AcceptGroupInvitationDialog] Failed to accept invitation:', acceptError);
    error.value =
      acceptError instanceof SocialApiError && acceptError.status === 403
        ? acceptError.message
        : 'Could not join the group. Try again.';
  } finally {
    isAccepting.value = false;
  }
}
</script>
<template>
  <Dialog :open="open" @update:open="setOpen"
    ><HarborDialogContent
      overlay-class="bg-harbor-ink/30 backdrop-blur-md"
      class="marketing-font w-[calc(100%-2rem)] max-w-md rounded-[1.75rem] border-harbor-line bg-harbor-surface p-6 text-harbor-ink shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full"
      ><DialogHeader
        ><DialogTitle>Join {{ invitation?.groupTitle }}</DialogTitle
        ><DialogDescription class="text-harbor-muted"
          >{{ invitation?.inviterName }} invited you. Enter the group password to join.</DialogDescription
        ></DialogHeader
      >
      <form class="space-y-4" @submit.prevent="accept">
        <div v-if="invitation?.accessPolicy === 'password'" class="space-y-2">
          <Label for="group-invitation-password">Password</Label>
          <div class="relative">
            <LockKeyhole
              class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-harbor-subtle"
            />
            <Input
              id="group-invitation-password"
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              placeholder="Group password"
              :disabled="isAccepting"
              class="h-11 rounded-xl border-harbor-line bg-white pl-10 focus-visible:ring-0"
            />
          </div>
        </div>
        <p
          v-if="error"
          class="rounded-xl border border-harbor-danger/25 bg-harbor-danger-soft px-3 py-2 text-sm text-harbor-danger-strong"
          role="alert"
        >
          {{ error }}
        </p>
        <DialogFooter
          ><Button type="button" variant="pill" size="pill" :disabled="isAccepting" @click="setOpen(false)"
            >Cancel</Button
          ><Button
            type="submit"
            variant="accent"
            size="pill"
            :disabled="isAccepting || (invitation?.accessPolicy === 'password' && !password)"
            ><LoadingRipple v-if="isAccepting" size="sm" />{{ isAccepting ? 'Joining...' : 'Join group' }}</Button
          ></DialogFooter
        >
      </form>
    </HarborDialogContent></Dialog
  >
</template>
