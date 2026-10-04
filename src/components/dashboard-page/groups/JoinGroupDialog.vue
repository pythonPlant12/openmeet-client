<script setup lang="ts">
import { UsersRound } from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';

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
import type { GroupInfo } from '@/services/social-api';

defineProps<{
  open: boolean;
  code: string;
  password: string;
  preview: GroupInfo | null;
  previewing: boolean;
  joining: boolean;
  error: string;
  prefersReducedMotion: boolean;
  accessLabel: (policy: GroupInfo['accessPolicy']) => string;
}>();
const emit = defineEmits<{
  (event: 'update:open', value: boolean): void;
  (event: 'update:code', value: string | number): void;
  (event: 'update:password', value: string | number): void;
  (event: 'invalidate-preview'): void;
  (event: 'preview'): void;
  (event: 'join'): void;
}>();
</script>
<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)"
    ><HarborDialogContent
      overlay-class="bg-[#102F35]/30 backdrop-blur-md"
      class="marketing-font w-[calc(100%-2rem)] max-w-md rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-5 text-[#102F35] shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full sm:p-6"
      ><DialogHeader
        ><DialogTitle>Join group</DialogTitle
        ><DialogDescription class="text-[#61777B]"
          >Enter the 22-character Group ID shared by a group member.</DialogDescription
        ></DialogHeader
      ><motion.form
        layout
        :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }"
        class="space-y-4"
        @submit.prevent="preview ? emit('join') : emit('preview')"
        ><div class="space-y-2">
          <Label for="join-group-code">Group ID</Label>
          <div class="flex gap-2">
            <Input
              id="join-group-code"
              :model-value="code"
              required
              autocomplete="off"
              placeholder="2aIFX0J6L4w7Y9KzQp8VrN"
              :disabled="joining"
              class="h-11 min-w-0 rounded-xl border-[#D8E7E3] bg-white focus-visible:ring-0"
              @update:model-value="
                emit('update:code', $event);
                emit('invalidate-preview');
              "
            /><Button
              type="button"
              variant="outline"
              class="rounded-xl border-[#D8E7E3] bg-white text-[#27595D] hover:bg-[#E6F4F1]"
              :disabled="!code.trim() || previewing || joining"
              @click="emit('preview')"
              ><LoadingRipple v-if="previewing" size="sm" />{{ previewing ? 'Checking' : 'Preview' }}</Button
            >
          </div>
        </div>
        <p
          v-if="error"
          class="rounded-xl border border-[#F2C7BE] bg-[#FFF4F0] px-3 py-2 text-sm text-[#9D4636]"
          role="alert"
        >
          {{ error }}
        </p>
        <AnimatePresence
          ><motion.section
            v-if="preview"
            :initial="prefersReducedMotion ? false : { opacity: 0, height: 0 }"
            :animate="{ opacity: 1, height: 'auto' }"
            :exit="prefersReducedMotion ? undefined : { opacity: 0, height: 0 }"
            class="overflow-hidden"
            ><div class="rounded-2xl border border-[#D8E7E3] bg-white p-4">
              <div class="flex items-center gap-3">
                <span class="flex size-11 items-center justify-center rounded-full bg-[#102F35] text-white"
                  ><UsersRound class="size-5"
                /></span>
                <div class="min-w-0 flex-1">
                  <h3 class="truncate font-semibold">{{ preview.title }}</h3>
                  <p class="text-sm text-[#61777B]">{{ accessLabel(preview.accessPolicy) }}</p>
                </div>
              </div>
            </div>
            <div v-if="preview.accessPolicy === 'password'" class="mt-4 space-y-2">
              <Label for="join-group-password">Password</Label
              ><Input
                id="join-group-password"
                :model-value="password"
                type="password"
                required
                autocomplete="current-password"
                placeholder="Group password"
                :disabled="joining"
                class="h-11 rounded-xl border-[#D8E7E3] bg-white focus-visible:ring-0"
                @update:model-value="emit('update:password', $event)"
              /></div></motion.section></AnimatePresence
        ><DialogFooter
          ><Button
            type="button"
            variant="outline"
            class="rounded-full border-[#D8E7E3] bg-white text-[#27595D]"
            :disabled="joining"
            @click="emit('update:open', false)"
            >Cancel</Button
          ><Button
            v-if="preview"
            type="submit"
            class="harbor-primary-action rounded-full bg-[#0B7A75] text-white"
            :disabled="joining || (!preview.canJoin && !preview.isMember)"
            >{{ joining ? 'Joining...' : preview.isMember ? 'Open group' : 'Join group' }}</Button
          ></DialogFooter
        ></motion.form
      ></HarborDialogContent
    ></Dialog
  >
</template>
