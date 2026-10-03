<script setup lang="ts">
import {
  CalendarDays,
  Clock3,
  Crown,
  LogOut,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
  UsersRound,
} from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogHeader, DialogTitle, HarborDialogContent } from '@/components/ui/dialog';
import { LoadingRipple } from '@/components/ui/loading';
import type { GroupInfo, GroupMember } from '@/services/social-api';

defineProps<{
  open: boolean;
  loading: boolean;
  error: string;
  info: GroupInfo | null;
  members: GroupMember[];
  avatarUrl?: string;
  currentUserId?: string;
  accessLabel: (policy: GroupInfo['accessPolicy']) => string;
  formatDate: (value: string | null) => string;
}>();
const emit = defineEmits<{
  (event: 'update:open', value: boolean): void;
  (event: 'profile', id: string, name: string): void;
  (event: 'add-members'): void;
  (event: 'quit-group'): void;
  (event: 'remove-group'): void;
}>();
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function roleLabel(role: string | null) {
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Participant';
}

function roleIcon(role: string | null) {
  return role === 'creator' ? Crown : role === 'admin' ? ShieldCheck : UserRound;
}

function roleClass(role: string | null) {
  return role === 'creator'
    ? 'bg-[#FFF8E8] text-[#80601D]'
    : role === 'admin'
      ? 'bg-[#E8F2F8] text-[#27647A]'
      : 'bg-[#EAF7F4] text-[#17645F]';
}

function canManage(role: string | null) {
  return role === 'creator' || role === 'admin';
}
</script>
<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)"
    ><HarborDialogContent
      overlay-class="bg-[#102F35]/30 backdrop-blur-md"
      class="marketing-font top-[calc(50%+2.25rem)] flex max-h-[calc(100dvh-6rem)] w-[calc(100%-2rem)] max-w-4xl flex-col rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-5 text-[#102F35] shadow-[0_24px_70px_rgba(16,47,53,0.18)] sm:w-full sm:p-6"
      @open-auto-focus="$event.preventDefault()"
      @close-auto-focus="$event.preventDefault()"
      ><DialogHeader
        ><DialogTitle>Group info</DialogTitle
        ><DialogDescription class="text-[#61777B]">Members and group access details.</DialogDescription></DialogHeader
      >
      <div v-if="loading" class="flex min-h-72 items-center justify-center">
        <LoadingRipple class="size-7 text-[#0B7A75]" />
      </div>
      <div
        v-else-if="error"
        class="rounded-2xl border border-[#F2C7BE] bg-[#FFF4F0] p-4 text-sm text-[#9D4636]"
        role="alert"
      >
        {{ error }}
      </div>
      <div v-else-if="info" class="min-h-0 space-y-6 overflow-y-auto pr-1">
        <section
          class="flex flex-col gap-5 rounded-2xl border border-[#D8E7E3] bg-white p-5 sm:flex-row sm:items-start sm:p-6"
        >
          <span class="flex size-20 items-center justify-center overflow-hidden rounded-full bg-[#102F35] text-white"
            ><img v-if="avatarUrl" :src="avatarUrl" alt="" class="size-full object-cover" /><UsersRound
              v-else
              class="size-9"
          /></span>
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-xl font-semibold tracking-[-0.025em]">{{ info.title }}</h3>
            <p class="mt-1 text-sm text-[#61777B]">{{ accessLabel(info.accessPolicy) }}</p>
            <div class="mt-4 flex flex-wrap gap-2">
              <span class="rounded-full bg-[#EAF7F4] px-3 py-1.5 text-xs font-semibold text-[#17645F]"
                >{{ info.memberCount }} {{ info.memberCount === 1 ? 'member' : 'members' }}</span
              ><span
                class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                :class="roleClass(info.role)"
                ><component :is="roleIcon(info.role)" class="size-3.5" />{{ roleLabel(info.role) }}</span
              >
            </div>
          </div>
        </section>
        <section
          class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-[#D8E7E3] bg-white px-4 py-3 text-sm"
        >
          <span class="inline-flex items-center gap-2 text-[#61777B]"
            ><ShieldCheck class="size-4 text-[#0B7A75]" /><span>Access</span
            ><strong class="font-semibold text-[#102F35]">{{ accessLabel(info.accessPolicy) }}</strong></span
          >
          <span class="hidden h-4 w-px bg-[#D8E7E3] sm:block" aria-hidden="true" />
          <span class="inline-flex items-center gap-2 text-[#61777B]"
            ><CalendarDays class="size-4 text-[#0B7A75]" /><span>Created</span
            ><strong class="font-semibold text-[#102F35]">{{ formatDate(info.createdAt) }}</strong></span
          >
        </section>
        <section class="flex flex-wrap items-center justify-center gap-2" aria-label="Group actions">
          <Button
            v-if="canManage(info.role)"
            variant="ghost"
            class="group size-11 rounded-full bg-[#E6F4F1] p-0 text-[#0B7A75] hover:bg-[#D8E7E3] hover:text-[#08635F] sm:w-auto sm:px-2"
            aria-label="Add friends"
            title="Add friends"
            @click="emit('add-members')"
          >
            <UserPlus
              class="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-110 motion-reduce:transition-none"
            />
            <span class="hidden sm:inline">Add friends</span>
          </Button>
          <Button
            v-if="info.role !== 'creator'"
            variant="ghost"
            class="group size-11 rounded-full bg-[#FFF0EA] p-0 text-[#9D4636] hover:bg-[#F9DED6] sm:w-auto sm:px-4"
            aria-label="Quit group"
            title="Quit group"
            @click="emit('quit-group')"
          >
            <LogOut
              class="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
            <span class="hidden sm:inline">Quit group</span>
          </Button>
          <Button
            v-if="canManage(info.role)"
            variant="ghost"
            class="group size-11 rounded-full bg-[#FFF0EA] p-0 text-[#9D4636] hover:bg-[#F9DED6] sm:w-auto sm:px-4"
            aria-label="Remove group"
            title="Remove group"
            @click="emit('remove-group')"
          >
            <Trash2
              class="size-4 transition-transform duration-200 group-hover:scale-90 group-hover:rotate-6 motion-reduce:transition-none"
            />
            <span class="hidden sm:inline">Remove group</span>
          </Button>
        </section>
        <section>
          <div class="mb-3 flex items-baseline justify-between gap-3">
            <h3 class="text-sm font-semibold">Participants</h3>
            <span class="text-xs text-[#61777B]">{{ members.length }} listed</span>
          </div>
          <div v-if="members.length" class="overflow-hidden rounded-2xl border border-[#D8E7E3] bg-white">
            <button
              v-for="member in members"
              :key="member.id"
              type="button"
              class="harbor-ghost-action flex w-full items-center gap-3 border-b border-[#E5EFEC] px-4 py-3 text-left last:border-b-0"
              @click="emit('profile', member.id, member.name)"
            >
              <span
                class="flex size-10 items-center justify-center rounded-full bg-[#DDF1ED] text-xs font-semibold text-[#0B7A75]"
                >{{ initials(member.name) }}</span
              ><span class="min-w-0 flex-1"
                ><span class="block truncate text-sm font-semibold">{{ member.name }}</span
                ><span class="inline-flex items-center gap-1 truncate text-xs text-[#61777B]"
                  ><Clock3 class="size-3" />{{ formatDate(member.joinedAt) }}</span
                ></span
              ><span
                class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold"
                :class="roleClass(member.role)"
                ><component :is="roleIcon(member.role)" class="size-3" />{{ roleLabel(member.role) }}</span
              ><span
                v-if="member.id === currentUserId"
                class="rounded-full bg-[#EAF7F4] px-2 py-1 text-[11px] font-semibold text-[#17645F]"
                >You</span
              >
            </button>
          </div>
          <p v-else class="rounded-2xl border border-[#D8E7E3] bg-white p-4 text-sm text-[#61777B]">
            No participants are listed for this group.
          </p>
        </section>
      </div></HarborDialogContent
    ></Dialog
  >
</template>
