<script setup lang="ts">
import { ref } from 'vue';

import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogHeader, DialogTitle, HarborDialogContent } from '@/components/ui/dialog';
import { LoadingRipple } from '@/components/ui/loading';
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
  <Dialog :open="pending !== null" @update:open="setOpen"
    ><HarborDialogContent
      overlay-class="bg-[#102F35]/30 backdrop-blur-md"
      class="marketing-font w-[calc(100%-2rem)] max-w-md rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-5 text-[#102F35] sm:w-full"
      ><DialogHeader
        ><DialogTitle>{{ pending?.change === 'remove' ? 'Remove friend?' : 'Send friend request?' }}</DialogTitle
        ><DialogDescription class="text-[#61777B]">{{
          pending?.change === 'remove'
            ? `Remove ${pending.member.name} from your friends? You can send another request later.`
            : `Send a friend request to ${pending?.member.name}?`
        }}</DialogDescription></DialogHeader
      >
      <div class="mt-2 flex justify-end gap-2">
        <Button
          variant="outline"
          class="rounded-full border-[#D8E7E3] bg-white text-[#27595D]"
          :disabled="isChanging"
          @click="setOpen(false)"
          >Cancel</Button
        >
        <Button
          v-if="pending?.change === 'remove'"
          data-confirm-friend-change
          class="rounded-full bg-[#C4513D] text-white hover:bg-[#9D4636]"
          :disabled="isChanging"
          @click="confirm"
          ><LoadingRipple v-if="isChanging" size="sm" />Remove friend</Button
        >
        <Button
          v-else
          data-confirm-friend-change
          class="harbor-primary-action rounded-full bg-[#0B7A75] text-white"
          :disabled="isChanging"
          @click="confirm"
          ><LoadingRipple v-if="isChanging" size="sm" />Send request</Button
        >
      </div>
    </HarborDialogContent></Dialog
  >
</template>
