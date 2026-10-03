<script setup lang="ts">
import { Search } from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { computed } from 'vue';

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
import type { Friend, GroupAccessPolicy } from '@/services/social-api';

const props = defineProps<{
  open: boolean;
  title: string;
  policy: GroupAccessPolicy;
  password: string;
  memberSearch: string;
  memberIds: string[];
  friends: Friend[];
  creating: boolean;
  prefersReducedMotion: boolean;
}>();
const emit = defineEmits<{
  (event: 'update:open', value: boolean): void;
  (event: 'update:title', value: string | number): void;
  (event: 'update:policy', value: GroupAccessPolicy): void;
  (event: 'update:password', value: string | number): void;
  (event: 'update:memberSearch', value: string | number): void;
  (event: 'toggle-member', id: string): void;
  (event: 'submit'): void;
}>();
const candidates = computed(() => {
  const query = props.memberSearch.trim().toLocaleLowerCase();
  return [...props.friends]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(
      (friend) =>
        !query || friend.name.toLocaleLowerCase().includes(query) || friend.email.toLocaleLowerCase().includes(query),
    );
});
</script>
<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)"
    ><HarborDialogContent
      overlay-class="bg-[#102F35]/30 backdrop-blur-md"
      class="marketing-font top-[calc(50%+2.25rem)] max-h-[calc(100dvh-6rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-5 text-[#102F35] shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full sm:p-6"
      ><DialogHeader
        ><DialogTitle>Create group</DialogTitle
        ><DialogDescription class="text-[#61777B]"
          >Set access and invite accepted friends.</DialogDescription
        ></DialogHeader
      ><motion.form
        layout
        :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }"
        class="space-y-5"
        @submit.prevent="emit('submit')"
        ><div class="space-y-2">
          <Label for="group-title">Title</Label
          ><Input
            id="group-title"
            :model-value="title"
            required
            maxlength="120"
            placeholder="Group name"
            :disabled="creating"
            class="h-11 rounded-xl border-[#D8E7E3] bg-white focus-visible:ring-0"
            @update:model-value="emit('update:title', $event)"
          />
        </div>
        <fieldset class="space-y-2" :disabled="creating">
          <legend class="text-sm font-medium">Access policy</legend>
          <label
            v-for="item in ['open', 'password', 'friendsOnly'] as GroupAccessPolicy[]"
            :key="item"
            class="flex cursor-pointer items-center gap-3 rounded-xl border border-[#D8E7E3] bg-white px-3 py-3 has-[:checked]:border-[#0B7A75] has-[:checked]:bg-[#EAF7F4]"
            ><input
              type="radio"
              name="group-policy"
              :value="item"
              :checked="policy === item"
              class="size-4 accent-[#0B7A75]"
              @change="emit('update:policy', item)"
            /><span class="text-sm font-medium">{{
              item === 'open' ? 'Open' : item === 'password' ? 'Password' : 'Friends-only'
            }}</span></label
          >
        </fieldset>
        <AnimatePresence
          ><motion.div
            v-if="policy === 'password'"
            :initial="prefersReducedMotion ? false : { height: 0, opacity: 0 }"
            :animate="{ height: 'auto', opacity: 1 }"
            :exit="prefersReducedMotion ? undefined : { height: 0, opacity: 0 }"
            class="space-y-2 overflow-hidden"
            ><Label for="group-password">Password</Label
            ><Input
              id="group-password"
              :model-value="password"
              type="password"
              required
              autocomplete="new-password"
              placeholder="Group password"
              :disabled="creating"
              class="h-11 rounded-xl border-[#D8E7E3] bg-white focus-visible:ring-0"
              @update:model-value="emit('update:password', $event)" /></motion.div
        ></AnimatePresence>
        <fieldset class="space-y-2" :disabled="creating">
          <div class="flex items-baseline justify-between gap-3">
            <legend class="text-sm font-medium">Invite friends</legend>
            <span class="text-xs text-[#61777B]">{{ memberIds.length }} selected</span>
          </div>
          <label class="relative block"
            ><Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#809697]" /><Input
              :model-value="memberSearch"
              type="search"
              placeholder="Filter accepted friends"
              class="h-10 rounded-xl border-[#D8E7E3] bg-white pl-9 focus-visible:ring-0"
              @update:model-value="emit('update:memberSearch', $event)"
          /></label>
          <div class="max-h-44 overflow-y-auto rounded-2xl border border-[#D8E7E3] bg-white">
            <p v-if="!candidates.length" class="p-4 text-center text-sm text-[#61777B]">No accepted friends match.</p>
            <label
              v-for="friend in candidates"
              :key="friend.id"
              class="flex cursor-pointer items-center gap-3 border-b border-[#E5EFEC] px-3 py-3 last:border-b-0"
              ><input
                type="checkbox"
                class="size-4 accent-[#0B7A75]"
                :checked="memberIds.includes(friend.id)"
                @change="emit('toggle-member', friend.id)"
              /><span class="min-w-0 flex-1"
                ><span class="block truncate text-sm font-semibold">{{ friend.name }}</span
                ><span class="block truncate text-xs text-[#61777B]">{{ friend.email }}</span></span
              ></label
            >
          </div>
        </fieldset>
        <DialogFooter class="gap-2"
          ><Button
            type="button"
            variant="outline"
            class="rounded-full border-[#D8E7E3] bg-white text-[#27595D]"
            :disabled="creating"
            @click="emit('update:open', false)"
            >Cancel</Button
          ><Button
            type="submit"
            class="harbor-primary-action rounded-full bg-[#0B7A75] text-white"
            :disabled="creating"
            >{{ creating ? 'Creating...' : 'Create group' }}</Button
          ></DialogFooter
        ></motion.form
      ></HarborDialogContent
    ></Dialog
  >
</template>
