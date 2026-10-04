<script setup lang="ts">
import { Ban, CalendarDays, Check, CircleCheck, Clock3, Copy, MinusCircle, Phone, UserMinus } from 'lucide-vue-next';
import { ref } from 'vue';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  HarborDialogContent,
} from '@/components/ui/dialog';
import { LoadingRipple } from '@/components/ui/loading';
import { toast } from '@/components/ui/toast';
import type { ContactProfile, Friend } from '@/services/social-api';

defineProps<{
  open: boolean;
  confirmationOpen: boolean;
  profile: ContactProfile | null;
  profileFriend: Friend | null;
  loading: boolean;
  error: string;
  removingId: string | null;
  opening: string | null;
  callActive: boolean;
  avatarUrls: Record<string, string>;
  avatarLoading: boolean;
  formatDate: (value: string | null) => string;
}>();
const isAvatarPreviewOpen = ref(false);
const copiedNickname = ref(false);
const emit = defineEmits<{
  (event: 'update:open', value: boolean): void;
  (event: 'update:confirmationOpen', value: boolean): void;
  (event: 'call'): void;
  (event: 'remove'): void;
}>();
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
function statusIcon(status: ContactProfile['status']) {
  return { available: CircleCheck, away: Clock3, doNotDisturb: MinusCircle, offline: Ban }[status];
}
function statusLabel(status: ContactProfile['status']) {
  return { available: 'Available', away: 'Away', doNotDisturb: 'Do not disturb', offline: 'Offline' }[status];
}
function statusClass(status: ContactProfile['status']) {
  return {
    available: 'bg-[#EAF7F4] text-[#17645F]',
    away: 'bg-[#FFF8E8] text-[#80601D]',
    doNotDisturb: 'bg-[#FFF0EA] text-[#9D4636]',
    offline: 'bg-[#F0F4F3] text-[#61777B]',
  }[status];
}
async function copyNickname(nickname: string) {
  try {
    await navigator.clipboard.writeText(nickname);
    copiedNickname.value = true;
    window.setTimeout(() => (copiedNickname.value = false), 2_000);
  } catch (error) {
    console.error('[ContactProfileDialog] Failed to copy nickname:', error);
    toast({ title: 'Could not copy nickname.', variant: 'destructive' });
  }
}
</script>
<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)"
    ><HarborDialogContent
      overlay-class="bg-[#102F35]/30 backdrop-blur-md"
      class="marketing-font flex top-[calc(50%+2.25rem)] max-h-[calc(100dvh-6rem)] min-h-[min(34rem,calc(100dvh-6rem))] w-[calc(100%-2rem)] max-w-3xl flex-col rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-5 text-[#102F35] shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full sm:p-6"
      @open-auto-focus="$event.preventDefault()"
      @close-auto-focus="$event.preventDefault()"
      ><DialogHeader
        ><DialogTitle>Contact profile</DialogTitle
        ><DialogDescription class="text-[#61777B]"
          >Profile details shared with accepted friends.</DialogDescription
        ></DialogHeader
      >
      <div v-if="loading" class="flex min-h-64 items-center justify-center">
        <LoadingRipple class="size-7 text-[#0B7A75]" />
      </div>
      <div v-else-if="profile" class="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
        <p
          v-if="error"
          class="rounded-xl border border-[#F2C7BE] bg-[#FFF4F0] px-4 py-3 text-sm text-[#9D4636]"
          role="alert"
        >
          {{ error }}
        </p>
        <section
          class="flex flex-col items-center justify-center gap-5 rounded-2xl border border-[#D8E7E3] bg-white p-5 text-center sm:p-6"
        >
          <button
            v-if="avatarUrls[profile.id]"
            type="button"
            class="harbor-ghost-action size-20 shrink-0 overflow-hidden rounded-full bg-[#DDF1ED] p-0 text-xl font-semibold text-[#0B7A75]"
            :aria-label="`View ${profile.name}'s profile picture`"
            @click="isAvatarPreviewOpen = true"
          >
            <img
              :src="avatarUrls[profile.id]"
              :alt="`${profile.name}'s profile picture`"
              class="size-full object-cover"
            />
          </button>
          <span
            v-else-if="profile.avatarUrl && avatarLoading"
            class="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED]"
          >
            <LoadingRipple class="size-6 text-[#0B7A75]" />
          </span>
          <span
            v-else
            class="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] text-xl font-semibold text-[#0B7A75]"
            >{{ initials(profile.name) }}</span
          >
          <div class="flex min-w-0 flex-col items-center">
            <span
              class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
              :class="statusClass(profile.status)"
              ><component :is="statusIcon(profile.status)" class="size-4" />{{ statusLabel(profile.status) }}</span
            >
            <h3 class="mt-5 truncate text-xl font-semibold tracking-[-0.025em]">{{ profile.name }}</h3>
            <div v-if="profile.nickname" class="mt-2 flex items-center gap-1.5 text-sm text-[#61777B]">
              <span>#{{ profile.nickname }}</span>
              <button
                type="button"
                class="harbor-ghost-action rounded-md p-1 text-[#0B7A75]"
                :aria-label="copiedNickname ? 'Nickname copied' : 'Copy nickname'"
                :title="copiedNickname ? 'Copied' : 'Copy nickname'"
                @click="copyNickname(profile.nickname)"
              >
                <Check v-if="copiedNickname" class="size-3.5" /><Copy v-else class="size-3.5" />
              </button>
            </div>
            <p class="mt-3 truncate text-sm text-[#61777B]">{{ profile.email }}</p>
            <p class="mt-5 text-sm leading-6 text-[#4E6B70]">{{ profile.statusMessage || 'No status message.' }}</p>
          </div>
        </section>
        <section
          class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-[#D8E7E3] bg-white px-4 py-3 text-sm"
        >
          <span class="inline-flex items-center gap-2 text-[#61777B]"
            ><CalendarDays class="size-4 text-[#0B7A75]" /><span>Joined</span
            ><strong class="font-semibold text-[#102F35]">{{ formatDate(profile.createdAt) }}</strong></span
          >
          <span class="hidden h-4 w-px bg-[#D8E7E3] sm:block" aria-hidden="true" />
          <span class="inline-flex items-center gap-2 text-[#61777B]"
            ><Clock3 class="size-4 text-[#0B7A75]" /><span>Last active</span
            ><strong class="font-semibold text-[#102F35]">{{ formatDate(profile.lastSeenAt) }}</strong></span
          >
        </section>
        <section class="rounded-2xl border border-[#D8E7E3] bg-[#F0F7F5] p-4">
          <p class="text-sm font-semibold">Shared media</p>
        </section>
        <DialogFooter class="flex-row items-center justify-center gap-3 sm:justify-center sm:gap-x-3"
          ><Button
            v-if="profileFriend"
            variant="ghost"
            class="group size-11 rounded-full bg-[#FFF0EA] p-0 text-[#9D4636] hover:bg-[#F9DED6] sm:w-auto sm:px-4"
            :disabled="removingId !== null"
            aria-label="Remove friend"
            title="Remove friend"
            @click="emit('update:confirmationOpen', true)"
            ><UserMinus
              class="size-4 transition-transform duration-200 group-hover:scale-90 group-hover:rotate-6 motion-reduce:transition-none"
            /><span class="hidden sm:inline">Remove friend</span></Button
          ><Button
            v-if="profileFriend"
            class="harbor-ghost-action group size-11 rounded-full bg-[#E6F4F1] p-0 text-[#0B7A75] hover:bg-[#D8E7E3] hover:text-[#08635F] sm:w-auto sm:px-4"
            :disabled="opening !== null || callActive"
            aria-label="Start direct call"
            title="Start direct call"
            @click="emit('call')"
            ><Phone
              class="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-110 motion-reduce:transition-none"
            /><span class="hidden sm:inline">Start direct call</span></Button
          ></DialogFooter
        >
      </div></HarborDialogContent
    ></Dialog
  ><Dialog :open="isAvatarPreviewOpen" @update:open="isAvatarPreviewOpen = $event"
    ><HarborDialogContent
      overlay-class="bg-[#102F35]/50 backdrop-blur-lg"
      hide-close
      class="w-auto max-w-[min(88dvw,42rem)] border-0 bg-transparent p-0 shadow-none"
      ><DialogTitle class="sr-only">{{ profile?.name }} profile picture</DialogTitle
      ><img
        v-if="profile && avatarUrls[profile.id]"
        :src="avatarUrls[profile.id]"
        :alt="`${profile.name}'s profile picture`"
        class="max-h-[78dvh] max-w-[min(88dvw,42rem)] rounded-full object-contain shadow-[0_24px_70px_rgba(16,47,53,0.35)]"
      />
    </HarborDialogContent> </Dialog
  ><Dialog :open="confirmationOpen" @update:open="emit('update:confirmationOpen', $event)"
    ><HarborDialogContent
      overlay-class="bg-[#102F35]/30 backdrop-blur-md"
      class="marketing-font w-[calc(100%-2rem)] max-w-md rounded-[1.75rem] border-[#F2C7BE] bg-[#FBFCF8] p-5 text-[#102F35] shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full sm:p-6"
      ><DialogHeader
        ><DialogTitle>Remove friend?</DialogTitle
        ><DialogDescription class="text-[#61777B]"
          >Remove {{ profileFriend?.name }} from your friends? You can send another request later.</DialogDescription
        ></DialogHeader
      ><DialogFooter class="gap-2"
        ><Button
          variant="outline"
          class="rounded-full border-[#D8E7E3] bg-white text-[#27595D]"
          :disabled="removingId !== null"
          @click="emit('update:confirmationOpen', false)"
          >Cancel</Button
        ><Button
          class="rounded-full bg-[#C4513D] text-white hover:bg-[#9D4636]"
          :disabled="!profileFriend || removingId !== null"
          @click="emit('remove')"
          ><LoadingRipple v-if="removingId === profileFriend?.id" size="sm" /><UserMinus v-else class="size-4" />{{
            removingId ? 'Removing...' : 'Remove friend'
          }}</Button
        ></DialogFooter
      ></HarborDialogContent
    ></Dialog
  >
</template>
