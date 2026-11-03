<script setup lang="ts">
import { Bug, LoaderCircle, MoreHorizontal, PhoneCall, Users, Video } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buildGitHubIssueUrl } from '@/lib/github-issue';
import type { Friend } from '@/services/social-api';

const props = withDefaults(
  defineProps<{
    friends: Friend[];
    callingFriendId: string | null;
    context?: boolean;
    isLoading?: boolean;
  }>(),
  { context: false, isLoading: false },
);

const emit = defineEmits<{
  callFriend: [friend: Friend];
  createMeeting: [];
}>();

const { t } = useI18n();
const MenuRoot = computed(() => (props.context ? ContextMenu : DropdownMenu));
const MenuTrigger = computed(() => (props.context ? ContextMenuTrigger : DropdownMenuTrigger));
const MenuContent = computed(() => (props.context ? ContextMenuContent : DropdownMenuContent));
const MenuItem = computed(() => (props.context ? ContextMenuItem : DropdownMenuItem));
const MenuLabel = computed(() => (props.context ? ContextMenuLabel : DropdownMenuLabel));
const MenuSeparator = computed(() => (props.context ? ContextMenuSeparator : DropdownMenuSeparator));
const reportUrl = buildGitHubIssueUrl('dashboard');
</script>

<template>
  <component :is="MenuRoot" :modal="context ? undefined : false">
    <component :is="MenuTrigger" as-child>
      <slot v-if="context" />
      <Button
        v-else
        variant="outline"
        size="icon"
        class="size-11 rounded-full border-harbor-line bg-white text-harbor-ink-soft shadow-[0_8px_30px_rgba(16,47,53,0.07)] hover:bg-harbor-hover hover:text-harbor-accent"
        :aria-label="t('dashboard.actions.open')"
        @contextmenu.stop
        @pointerdown.stop
      >
        <MoreHorizontal class="size-5" />
      </Button>
    </component>

    <component
      :is="MenuContent"
      align="end"
      :side-offset="10"
      class="harbor-action-menu min-w-72 rounded-[1.25rem] border-harbor-line bg-white p-2 text-harbor-ink shadow-[0_20px_55px_rgba(16,47,53,0.16)]"
    >
      <component
        :is="MenuItem"
        class="min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-harbor-accent focus:bg-harbor-hover focus:text-harbor-accent-hover"
        @select="emit('createMeeting')"
      >
        <Video class="size-4" aria-hidden="true" />
        {{ t('dashboard.newMeeting') }}
      </component>

      <component :is="MenuSeparator" class="mx-1 my-2 bg-harbor-line" />
      <component :is="MenuLabel" class="px-3 py-1 text-xs uppercase tracking-[0.12em] text-harbor-muted">
        {{ t('dashboard.actions.friends') }}
      </component>

      <component :is="MenuItem" v-if="isLoading" disabled class="min-h-11 rounded-xl px-3 py-2.5 text-harbor-muted">
        <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
        {{ t('dashboard.actions.loadingFriends') }}
      </component>
      <component
        :is="MenuItem"
        v-else-if="!friends.length"
        disabled
        class="min-h-11 rounded-xl px-3 py-2.5 text-harbor-muted"
      >
        <Users class="size-4" aria-hidden="true" />
        {{ t('dashboard.noFriends') }}
      </component>
      <component
        :is="MenuItem"
        v-for="friend in friends"
        v-else
        :key="friend.id"
        :disabled="callingFriendId !== null"
        :aria-label="t('dashboard.callFriend', { name: friend.name })"
        class="min-h-11 cursor-pointer rounded-xl px-3 py-2.5 focus:bg-harbor-hover focus:text-harbor-ink"
        @select="emit('callFriend', friend)"
      >
        <span
          class="size-2.5 shrink-0 rounded-full ring-2 ring-white"
          :class="friend.isOnline ? 'bg-[#29A899]' : 'bg-harbor-waveform'"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1 truncate">{{ friend.name }}</span>
        <LoaderCircle v-if="callingFriendId === friend.id" class="size-4 animate-spin" aria-hidden="true" />
        <PhoneCall v-else class="size-4 text-harbor-accent" aria-hidden="true" />
        <span class="sr-only">
          {{ friend.isOnline ? t('dashboard.online') : t('dashboard.offline') }}
        </span>
      </component>

      <component :is="MenuSeparator" class="mx-1 my-2 bg-harbor-line" />
      <component
        :is="MenuItem"
        as-child
        class="min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-harbor-danger focus:bg-harbor-danger-soft focus:text-harbor-danger-strong"
      >
        <a :href="reportUrl" target="_blank" rel="noreferrer">
          <Bug class="size-4" aria-hidden="true" />
          {{ t('dashboard.actions.reportBug') }}
        </a>
      </component>
    </component>
  </component>
</template>
