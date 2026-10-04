<script setup lang="ts">
import {
  Ban,
  CalendarDays,
  Check,
  CircleCheck,
  Clock3,
  Copy,
  Mail,
  MinusCircle,
  Phone,
  UserCheck,
  UserMinus,
} from 'lucide-vue-next';
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
import { useFullAvatar } from '@/composables/useFullAvatar';
import type { ContactProfile, Friend } from '@/services/social-api';

const props = defineProps<{
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
const fullAvatarUrl = useFullAvatar(
  () => props.profile?.avatarUrl,
  () => isAvatarPreviewOpen.value,
);
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
        ><DialogTitle>Profile info</DialogTitle
        ><DialogDescription class="text-[#61777B]"
          >Profile details shared with accepted friends.</DialogDescription
        ></DialogHeader
      >
      <!-- Render the fallback profile immediately and update it in place: swapping a spinner for the
           loaded body changes the centered dialog's height and makes it jump vertically. -->
      <div v-if="loading && !profile" class="flex min-h-64 items-center justify-center">
        <LoadingRipple class="size-7 text-[#0B7A75]" />
      </div>
      <div v-else-if="profile" class="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1" :aria-busy="loading">
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
          <span class="relative shrink-0">
            <button
              v-if="avatarUrls[profile.id]"
              type="button"
              class="harbor-ghost-action flex size-20 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] p-0"
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
              class="flex size-20 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED]"
            >
              <LoadingRipple class="size-6 text-[#0B7A75]" />
            </span>
            <span
              v-else
              class="flex size-20 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] text-xl font-semibold text-[#0B7A75]"
              >{{ initials(profile.name) }}</span
            >
            <span
              v-if="profile.isOnline"
              data-online-indicator
              role="img"
              aria-label="Online"
              class="absolute bottom-1 right-1 size-4 rounded-full border-[3px] border-white bg-[#2DA58F]"
            />
          </span>
          <div class="min-w-0 max-w-full">
            <h3 class="truncate text-xl font-semibold tracking-[-0.025em]">{{ profile.name }}</h3>
            <div
              class="mt-1 flex items-center justify-center gap-1 text-sm text-[#61777B]"
              :class="{ invisible: !profile.nickname }"
              :aria-hidden="!profile.nickname"
            >
              <span class="truncate">@{{ profile.nickname || 'nickname' }}</span>
              <button
                type="button"
                class="harbor-ghost-action shrink-0 rounded-md p-1 text-[#0B7A75]"
                :aria-label="copiedNickname ? 'Nickname copied' : 'Copy nickname'"
                :title="copiedNickname ? 'Copied' : 'Copy nickname'"
                @click="copyNickname(profile.nickname)"
              >
                <Check v-if="copiedNickname" class="size-3.5" /><Copy v-else class="size-3.5" />
              </button>
            </div>
            <div class="mt-4 flex flex-wrap justify-center gap-2">
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                :class="statusClass(profile.status)"
                ><component :is="statusIcon(profile.status)" class="size-3.5" />{{ statusLabel(profile.status) }}</span
              ><span
                v-if="profileFriend"
                class="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4F1] px-3 py-1.5 text-xs font-semibold text-[#102F35]"
                ><UserCheck class="size-3.5" />Friend</span
              >
            </div>
            <p
              class="mx-auto mt-4 max-w-md text-sm leading-6"
              :class="profile.statusMessage ? 'text-[#4E6B70]' : 'text-[#809697]'"
            >
              {{ profile.statusMessage ? `“${profile.statusMessage}”` : 'No status message.' }}
            </p>
          </div>
        </section>
        <section
          v-if="profileFriend"
          class="flex flex-wrap items-center justify-center gap-2"
          aria-label="Profile actions"
        >
          <Button
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
            class="harbor-ghost-action group size-11 rounded-full bg-[#E6F4F1] p-0 text-[#0B7A75] hover:bg-[#D8E7E3] hover:text-[#102F35] sm:w-auto sm:px-4"
            :disabled="opening !== null || callActive"
            aria-label="Start direct call"
            title="Start direct call"
            @click="emit('call')"
            ><Phone
              class="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-110 motion-reduce:transition-none"
            /><span class="hidden sm:inline">Start direct call</span></Button
          >
        </section>
        <section class="grid gap-3 rounded-2xl border border-[#D8E7E3] bg-white p-4 text-sm sm:grid-cols-3">
          <div class="inline-flex min-w-0 items-center gap-2 text-[#61777B]">
            <Mail class="size-4 shrink-0 text-[#0B7A75]" /><span class="min-w-0"
              ><span class="block text-xs">Email</span
              ><strong class="block truncate font-semibold text-[#102F35]">{{ profile.email }}</strong></span
            >
          </div>
          <div class="inline-flex items-center gap-2 text-[#61777B]">
            <CalendarDays class="size-4 shrink-0 text-[#0B7A75]" /><span class="min-w-0"
              ><span class="block text-xs">Joined</span
              ><strong class="block font-semibold text-[#102F35]">{{ formatDate(profile.createdAt) }}</strong></span
            >
          </div>
          <div class="inline-flex items-center gap-2 text-[#61777B]">
            <Clock3 class="size-4 shrink-0 text-[#0B7A75]" /><span class="min-w-0"
              ><span class="block text-xs">Last active</span
              ><strong class="block font-semibold text-[#102F35]">{{ formatDate(profile.lastSeenAt) }}</strong></span
            >
          </div>
        </section>
        <section class="rounded-2xl border border-[#D8E7E3] bg-[#F0F7F5] p-4">
          <p class="text-sm font-semibold">Shared media</p>
        </section>
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
        :src="fullAvatarUrl ?? avatarUrls[profile.id]"
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
