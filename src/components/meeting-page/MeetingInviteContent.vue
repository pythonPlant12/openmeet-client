<script setup lang="ts">
import { refDebounced } from '@vueuse/core';
import { Check, Search } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingRipple } from '@/components/ui/loading';
import { toast } from '@/components/ui/toast';
import { useAvatarCache } from '@/composables/useAvatarCache';
import { meetingAccessOption, meetingInvitesAnyone } from '@/config/meeting-access.config';
import {
  type GroupAccessPolicy,
  type MeetingInvitationCandidate,
  type MeetingRoomAccess,
  SocialApiError,
  socialApi,
} from '@/services/social-api';
import { cookieUtils } from '@/utils';

import MeetingAccessPicker from './MeetingAccessPicker.vue';
import MeetingShareRow from './MeetingShareRow.vue';

// The invite's content, shared by the phone bottom sheet and the desktop dialog: the room's access, a search,
// and your friends (or anyone the search finds) with an Invite button each.
const props = defineProps<{
  roomId: string;
  access: MeetingRoomAccess | null;
  /** The sheet or dialog is open, so the people list loads. */
  active: boolean;
  /** Inviting people needs an account, so guests get the share targets and the access line only. */
  guest?: boolean;
  /**
   * Fill the phone sheet's height: the people box takes the space left and scrolls on its own, so its rounded
   * corners stay in view at both ends of the list.
   */
  fill?: boolean;
}>();
const emit = defineEmits<{ (event: 'access-updated', access: MeetingRoomAccess): void }>();

const token = () => cookieUtils.get('accessToken') ?? '';
const avatarCache = useAvatarCache((path) => socialApi.loadAvatar(token(), path));
const query = ref('');
const debouncedQuery = refDebounced(query, 300);
const candidates = ref<MeetingInvitationCandidate[]>([]);
const isSearching = ref(false);
const searchError = ref('');
const invitingId = ref<string | null>(null);
const invitedIds = ref(new Set<string>());
let searchRequest = 0;

const isHost = computed(() => !!props.access?.managed && props.access.isOwner);
const policy = computed(() => props.access?.accessPolicy ?? 'open');
const searchPlaceholder = computed(() =>
  meetingInvitesAnyone(policy.value) ? 'Search people by name or @nickname' : 'Search people the host knows',
);
const emptyText = computed(() =>
  debouncedQuery.value.trim()
    ? 'No one matches who can join this meeting.'
    : 'Your friends who can join appear here. Search to find more people.',
);

const isSavingAccess = ref(false);

async function search() {
  const request = ++searchRequest;
  const text = debouncedQuery.value.trim();
  // The server needs at least two characters to search everyone; shorter text lists friends.
  const effectiveQuery = text.length >= 2 ? text : '';
  isSearching.value = true;
  searchError.value = '';
  try {
    const results = await socialApi.listMeetingInvitationCandidates(token(), props.roomId, effectiveQuery);
    if (request !== searchRequest) return;
    candidates.value = results;
    void avatarCache.ensure(results.flatMap((candidate) => (candidate.avatarUrl ? [candidate.avatarUrl] : [])));
  } catch (error) {
    if (request !== searchRequest) return;
    console.error('[MeetingInviteContent] Failed to load people:', error);
    candidates.value = [];
    searchError.value = error instanceof SocialApiError ? error.message : 'Could not load people.';
  } finally {
    if (request === searchRequest) isSearching.value = false;
  }
}

async function invite(candidate: MeetingInvitationCandidate) {
  invitingId.value = candidate.id;
  try {
    await socialApi.inviteToMeetingRoom(token(), props.roomId, candidate.id);
    invitedIds.value = new Set([...invitedIds.value, candidate.id]);
    toast({ title: `${candidate.name} was invited.`, variant: 'success' });
  } catch (error) {
    console.error('[MeetingInviteContent] Failed to invite:', error);
    toast({
      title: `Could not invite ${candidate.name}.`,
      description: error instanceof SocialApiError ? error.message : undefined,
      variant: 'destructive',
    });
  } finally {
    invitingId.value = null;
  }
}

async function saveAccess(change: { policy: GroupAccessPolicy; password?: string }) {
  if (isSavingAccess.value) return;
  isSavingAccess.value = true;
  try {
    const updated = await socialApi.updateMeetingRoom(token(), props.roomId, {
      accessPolicy: change.policy,
      ...(change.password ? { password: change.password } : {}),
    });
    emit('access-updated', updated);
    toast({ title: `Meeting access: ${meetingAccessOption(updated.accessPolicy).label}`, variant: 'success' });
  } catch (error) {
    console.error('[MeetingInviteContent] Failed to update access:', error);
    toast({
      title: 'Could not change meeting access.',
      description: error instanceof SocialApiError ? error.message : undefined,
      variant: 'destructive',
    });
  } finally {
    isSavingAccess.value = false;
  }
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

watch(
  () => props.active,
  (isActive) => {
    if (!isActive || props.guest) return;
    void search();
  },
  { immediate: true },
);
watch(debouncedQuery, () => {
  if (props.active && !props.guest) void search();
});
// Changing who may join changes who can be invited.
watch(policy, () => {
  if (props.active && !props.guest) void search();
});
</script>

<template>
  <div class="flex flex-col gap-4" :class="{ 'h-full': fill }" data-meeting-invite-content>
    <MeetingShareRow class="shrink-0" :meeting-id="roomId" />
    <div class="flex min-h-0 flex-1 flex-col gap-4">
      <div v-if="!guest" class="relative shrink-0">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-harbor-subtle" />
        <Input
          v-model="query"
          type="search"
          maxlength="80"
          :placeholder="searchPlaceholder"
          aria-label="Search people to invite"
          class="h-11 rounded-xl border border-harbor-line bg-harbor-canvas pl-9 text-sm focus-visible:ring-0"
        />
      </div>
      <MeetingAccessPicker
        class="shrink-0"
        :policy="policy"
        :editable="isHost"
        :saving="isSavingAccess"
        @save="saveAccess"
      />
      <div
        v-if="!guest"
        class="min-h-24 rounded-2xl bg-harbor-hover"
        :class="
          fill
            ? 'flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'overflow-hidden'
        "
        data-invite-candidates
      >
        <div v-if="isSearching && !candidates.length" class="flex justify-center py-8">
          <LoadingRipple class="size-6 text-harbor-accent" />
        </div>
        <p v-else-if="searchError" class="px-4 py-6 text-center text-sm text-harbor-danger-strong">
          {{ searchError }}
        </p>
        <p v-else-if="!candidates.length" class="px-4 py-6 text-center text-sm text-harbor-muted">
          {{ emptyText }}
        </p>
        <ul v-else :class="{ 'max-h-72 overflow-y-auto': !fill }">
          <li v-for="(candidate, index) in candidates" :key="candidate.id" class="flex items-center gap-3 pl-3">
            <span
              class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-harbor-avatar text-xs font-semibold text-harbor-icon"
              ><img
                v-if="candidate.avatarUrl && avatarCache.urls.value[candidate.avatarUrl]"
                :src="avatarCache.urls.value[candidate.avatarUrl]"
                alt=""
                class="size-full object-cover"
              /><template v-else>{{ initials(candidate.name) }}</template></span
            >
            <!-- The divider starts after the avatar, like a settings list. -->
            <span
              class="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-3"
              :class="{ 'border-t border-harbor-ink/10': index > 0 }"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[15px] font-semibold">{{ candidate.name }}</span>
                <span class="block truncate text-xs text-harbor-muted">@{{ candidate.nickname }}</span>
              </span>
              <Button
                v-if="candidate.invited || invitedIds.has(candidate.id)"
                variant="ghost"
                size="sm"
                disabled
                class="h-8 shrink-0 rounded-lg px-3 text-sm font-semibold text-harbor-muted disabled:opacity-100 [&_svg]:text-harbor-accent"
                ><Check class="size-4" />Invited</Button
              >
              <Button
                v-else
                size="sm"
                variant="secondary"
                class="!h-8 min-w-[4.25rem] shrink-0 rounded-lg bg-harbor-ink/10 px-4 text-sm font-semibold text-harbor-ink hover:bg-harbor-ink/15"
                :disabled="invitingId !== null"
                :data-invite="candidate.id"
                @click="invite(candidate)"
              >
                <LoadingRipple v-if="invitingId === candidate.id" size="sm" />
                <template v-else>Invite</template>
              </Button>
            </span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
