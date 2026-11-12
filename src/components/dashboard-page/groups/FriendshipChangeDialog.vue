<script setup lang="ts">
import { UserMinus, UserPlus } from 'lucide-vue-next';
import { ref } from 'vue';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { GroupMember } from '@/services/social-api';

export type FriendshipChange = 'add' | 'remove';
export interface PendingFriendshipChange {
  member: GroupMember;
  change: FriendshipChange;
}

const props = defineProps<{
  pending: PendingFriendshipChange | null;
  changeFriendship: (member: GroupMember, change: FriendshipChange) => Promise<boolean>;
}>();
const emit = defineEmits<{ (event: 'update:pending', value: PendingFriendshipChange | null): void }>();

const isChanging = ref(false);

function setOpen(open: boolean) {
  if (!open && !isChanging.value) emit('update:pending', null);
}

async function confirm() {
  const pending = props.pending;
  if (!pending || isChanging.value) return;
  isChanging.value = true;
  try {
    if (await props.changeFriendship(pending.member, pending.change)) emit('update:pending', null);
  } finally {
    isChanging.value = false;
  }
}
</script>

<template>
  <ConfirmDialog
    :open="pending !== null"
    :icon="pending?.change === 'remove' ? UserMinus : UserPlus"
    :tone="pending?.change === 'remove' ? 'danger' : 'accent'"
    :title="
      pending?.change === 'remove'
        ? `Remove ${pending.member.name}?`
        : `Send a friend request to ${pending?.member.name}?`
    "
    :description="
      pending?.change === 'remove'
        ? 'They leave your friends. You can send another request later.'
        : 'They become your friend once they accept.'
    "
    :action-label="pending?.change === 'remove' ? 'Remove friend' : 'Send request'"
    :busy-label="pending?.change === 'remove' ? 'Removing...' : 'Sending...'"
    :busy="isChanging"
    @update:open="setOpen"
    @confirm="confirm"
  />
</template>
