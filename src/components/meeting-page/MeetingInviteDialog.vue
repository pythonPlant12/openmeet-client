<script setup lang="ts">
import { refDebounced } from '@vueuse/core';
import { Check, Copy, Search, UserPlus } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogHeader, DialogTitle, HarborDialogContent } from '@/components/ui/dialog';
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

const props = defineProps<{
  roomId: string;
  /** Link people open to join; conversation calls share their own route. */
  meetingLink: string;
  access: MeetingRoomAccess | null;
}>();
const open = defineModel<boolean>('open', { required: true });
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
const copied = ref(false);
let searchRequest = 0;

const isHost = computed(() => !!props.access?.managed && props.access.isOwner);
const policy = computed(() => props.access?.accessPolicy ?? 'open');
const policyOption = computed(() => meetingAccessOption(policy.value));
const searchPlaceholder = computed(() =>
  meetingInvitesAnyone(policy.value) ? 'Search people by name or @nickname' : 'Search people the host knows',
);
const emptyText = computed(() =>
  debouncedQuery.value.trim()
    ? 'No one matches who can join this meeting.'
    : 'Your friends who can join appear here. Search to find more people.',
);

// Host access settings, edited in place and saved explicitly.
const draftPolicy = ref<GroupAccessPolicy>(policy.value);
const draftPassword = ref('');
const isSavingAccess = ref(false);
const accessChanged = computed(() => draftPolicy.value !== policy.value || draftPassword.value.length > 0);
const canSaveAccess = computed(() => {
  if (!accessChanged.value || isSavingAccess.value) return false;
  if (draftPolicy.value !== 'password') return true;
  return draftPassword.value.length >= 4 || (policy.value === 'password' && !draftPassword.value);
});

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
    console.error('[MeetingInviteDialog] Failed to load people:', error);
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
    console.error('[MeetingInviteDialog] Failed to invite:', error);
    toast({
      title: `Could not invite ${candidate.name}.`,
      description: error instanceof SocialApiError ? error.message : undefined,
      variant: 'destructive',
    });
  } finally {
    invitingId.value = null;
  }
}

async function saveAccess() {
  if (!canSaveAccess.value) return;
  isSavingAccess.value = true;
  try {
    const updated = await socialApi.updateMeetingRoom(token(), props.roomId, {
      accessPolicy: draftPolicy.value,
      ...(draftPolicy.value === 'password' && draftPassword.value ? { password: draftPassword.value } : {}),
    });
    draftPassword.value = '';
    emit('access-updated', updated);
    toast({ title: `Meeting access: ${meetingAccessOption(updated.accessPolicy).label}`, variant: 'success' });
  } catch (error) {
    console.error('[MeetingInviteDialog] Failed to update access:', error);
    toast({
      title: 'Could not change meeting access.',
      description: error instanceof SocialApiError ? error.message : undefined,
      variant: 'destructive',
    });
  } finally {
    isSavingAccess.value = false;
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(props.meetingLink);
    copied.value = true;
    window.setTimeout(() => (copied.value = false), 2_000);
  } catch (error) {
    console.error('[MeetingInviteDialog] Failed to copy link:', error);
    toast({ title: 'Could not copy the link.', variant: 'destructive' });
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

watch(open, (isOpen) => {
  if (!isOpen) return;
  draftPolicy.value = policy.value;
  draftPassword.value = '';
  void search();
});
watch(debouncedQuery, () => {
  if (open.value) void search();
});
// Changing who may join changes who can be invited.
watch(policy, (current) => {
  draftPolicy.value = current;
  if (open.value) void search();
});
</script>

<template>
  <Dialog v-model:open="open">
    <HarborDialogContent
      overlay-class="bg-[#102F35]/30 backdrop-blur-md"
      class="marketing-font top-[calc(50%+2.25rem)] max-h-[calc(100dvh-6rem)] w-[calc(100%-2rem)] max-w-lg grid-cols-[minmax(0,1fr)] overflow-y-auto rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-5 text-[#102F35] sm:p-6"
      data-meeting-invite
    >
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2"
          ><UserPlus class="size-5 text-[#0B7A75]" />Invite people</DialogTitle
        >
        <DialogDescription class="flex items-center gap-1.5 text-[#61777B]">
          <component :is="policyOption.icon" class="size-3.5 shrink-0" />
          <span data-meeting-access-summary>{{ policyOption.label }} · {{ policyOption.description }}</span>
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-5">
        <div class="flex items-center gap-2 rounded-xl border border-[#D8E7E3] bg-white py-1.5 pl-3 pr-1.5">
          <span class="min-w-0 flex-1 truncate font-mono text-xs text-[#4E6B70]">{{ meetingLink }}</span>
          <Button
            variant="ghost"
            size="sm"
            class="harbor-ghost-action shrink-0 rounded-lg font-semibold text-[#0B7A75]"
            @click="copyLink"
          >
            <Check v-if="copied" class="size-4" /><Copy v-else class="size-4" />{{ copied ? 'Copied' : 'Copy link' }}
          </Button>
        </div>

        <section v-if="isHost" class="space-y-3 rounded-2xl border border-[#E5EFEC] bg-white p-3.5" data-host-access>
          <MeetingAccessPicker
            v-model:policy="draftPolicy"
            v-model:password="draftPassword"
            :has-password="policy === 'password'"
            :disabled="isSavingAccess"
          />
          <div class="flex justify-end">
            <Button
              class="harbor-primary-action h-9 rounded-full bg-[#0B7A75] px-4 text-white"
              :disabled="!canSaveAccess"
              @click="saveAccess"
            >
              <LoadingRipple v-if="isSavingAccess" size="sm" />
              <template v-else>Save access</template>
            </Button>
          </div>
        </section>

        <div class="space-y-2">
          <div class="relative">
            <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8A9C9E]" />
            <Input
              v-model="query"
              type="search"
              maxlength="80"
              :placeholder="searchPlaceholder"
              aria-label="Search people to invite"
              class="h-11 rounded-xl border-[#D8E7E3] bg-white pl-9 focus-visible:ring-0"
            />
          </div>
          <div class="min-h-24 rounded-2xl border border-[#E5EFEC] bg-white" data-invite-candidates>
            <div v-if="isSearching && !candidates.length" class="flex justify-center py-8">
              <LoadingRipple class="size-6 text-[#0B7A75]" />
            </div>
            <p v-else-if="searchError" class="px-4 py-6 text-center text-sm text-[#9D4636]">{{ searchError }}</p>
            <p v-else-if="!candidates.length" class="px-4 py-6 text-center text-sm text-[#61777B]">{{ emptyText }}</p>
            <ul v-else class="max-h-72 overflow-y-auto">
              <li
                v-for="candidate in candidates"
                :key="candidate.id"
                class="flex items-center gap-3 px-3.5 py-2.5 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[#EEF3F1]"
              >
                <span
                  class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#DDF1ED] text-xs font-semibold text-[#0B7A75]"
                  ><img
                    v-if="candidate.avatarUrl && avatarCache.urls.value[candidate.avatarUrl]"
                    :src="avatarCache.urls.value[candidate.avatarUrl]"
                    alt=""
                    class="size-full object-cover"
                  /><template v-else>{{ initials(candidate.name) }}</template></span
                >
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold">{{ candidate.name }}</span>
                  <span class="block truncate text-xs text-[#61777B]"
                    >@{{ candidate.nickname }}<template v-if="candidate.isFriend"> · Friend</template></span
                  >
                </span>
                <Button
                  v-if="candidate.invited || invitedIds.has(candidate.id)"
                  variant="ghost"
                  size="sm"
                  disabled
                  class="shrink-0 rounded-full text-[#17645F] disabled:opacity-100"
                  ><Check class="size-4" />Invited</Button
                >
                <Button
                  v-else
                  size="sm"
                  class="harbor-primary-action shrink-0 rounded-full bg-[#0B7A75] px-3.5 text-white"
                  :disabled="invitingId !== null"
                  :data-invite="candidate.id"
                  @click="invite(candidate)"
                >
                  <LoadingRipple v-if="invitingId === candidate.id" size="sm" />
                  <template v-else>Invite</template>
                </Button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </HarborDialogContent>
  </Dialog>
</template>
