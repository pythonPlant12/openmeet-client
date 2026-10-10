<script setup lang="ts">
import { Clock3, Phone, UsersRound, Video } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogHeader, DialogTitle, HarborDialogContent } from '@/components/ui/dialog';
import { LoadingRipple } from '@/components/ui/loading';
import { callAgainTargets, formatDuration, meetingDuration, meetingTitle, meetingType } from '@/lib/meetings';
import { type MeetingPerson, type MeetingSession, SocialApiError, socialApi } from '@/services/social-api';

const props = defineProps<{
  /** The call as the history lists it; the dialog loads everyone who joined. */
  meeting: MeetingSession | null;
  accessToken: string;
  now: number;
  calling: boolean;
  avatarFor: (person: MeetingPerson) => string | undefined;
  loadAvatars: (people: MeetingPerson[]) => void;
}>();
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{
  (event: 'call', meeting: MeetingSession): void;
  (event: 'join', meeting: MeetingSession): void;
  (event: 'profile', person: MeetingPerson): void;
}>();

const detail = ref<MeetingSession | null>(null);
const isLoading = ref(false);
const error = ref('');
let request = 0;

const shown = computed(() => detail.value ?? props.meeting);
// Conversation calls ring the conversation again; other meetings ring the registered people who joined.
const canCallAgain = computed(
  () => !!detail.value && (!!detail.value.conversationId || callAgainTargets(detail.value).length > 0),
);

async function loadDetail(meeting: MeetingSession) {
  const current = ++request;
  detail.value = null;
  error.value = '';
  isLoading.value = true;
  try {
    const loaded = await socialApi.getMeetingSession(props.accessToken, meeting.id);
    if (current !== request) return;
    detail.value = loaded;
    props.loadAvatars(loaded.participants);
  } catch (loadError) {
    if (current !== request) return;
    console.error('[CallDetailsDialog] Failed to load call details:', loadError);
    error.value =
      loadError instanceof SocialApiError && loadError.status === 404
        ? 'This call is not in your history.'
        : 'Could not load this call.';
  } finally {
    if (current === request) isLoading.value = false;
  }
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function duration(from: string, to: string | null) {
  return formatDuration(meetingDuration(from, to, props.now));
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
  [open, () => props.meeting?.id],
  ([isOpen]) => {
    if (isOpen && props.meeting) void loadDetail(props.meeting);
    else request += 1;
  },
  { immediate: true },
);
</script>

<template>
  <Dialog v-model:open="open">
    <HarborDialogContent
      overlay-class="bg-[#102F35]/30 backdrop-blur-md"
      class="marketing-font top-[calc(50%+2.25rem)] max-h-[calc(100dvh-6rem)] w-[calc(100%-2rem)] max-w-lg grid-cols-[minmax(0,1fr)] overflow-y-auto rounded-[1.75rem] border-[#D8E7E3] bg-[#FBFCF8] p-5 text-[#102F35] sm:p-6"
      data-call-details
    >
      <DialogHeader v-if="shown">
        <DialogTitle class="truncate pr-6">{{ meetingTitle(shown.participants, shown.participantCount) }}</DialogTitle>
        <DialogDescription class="flex items-center gap-1.5 text-[#61777B]" data-call-detail-type>
          <component :is="meetingType(shown).icon" class="size-3.5 shrink-0" aria-hidden="true" />{{
            meetingType(shown).label
          }}
          · {{ formatDateTime(shown.startedAt) }}
        </DialogDescription>
      </DialogHeader>

      <template v-if="shown">
        <dl class="grid grid-cols-3 gap-2" data-call-stats>
          <div class="rounded-2xl border border-[#E5EFEC] bg-white p-3">
            <dt class="flex items-center gap-1.5 text-xs font-semibold text-[#61777B]">
              <Clock3 class="size-3.5" />Duration
            </dt>
            <dd class="mt-1 font-semibold" data-call-duration>{{ duration(shown.startedAt, shown.endedAt) }}</dd>
          </div>
          <div class="rounded-2xl border border-[#E5EFEC] bg-white p-3">
            <dt class="flex items-center gap-1.5 text-xs font-semibold text-[#61777B]">
              <UsersRound class="size-3.5" />People
            </dt>
            <dd class="mt-1 font-semibold" data-call-participant-count>{{ shown.participantCount }}</dd>
          </div>
          <div class="rounded-2xl border border-[#E5EFEC] bg-white p-3">
            <dt class="text-xs font-semibold text-[#61777B]">{{ shown.endedAt ? 'Time' : 'Status' }}</dt>
            <dd class="mt-1 text-sm font-semibold">
              <template v-if="shown.endedAt"
                >{{ formatTime(shown.startedAt) }} – {{ formatTime(shown.endedAt) }}</template
              >
              <span v-else class="inline-flex items-center gap-1.5 text-[#17645F]"
                ><span class="size-2 rounded-full bg-[#2DA58F]" aria-hidden="true" />Live</span
              >
            </dd>
          </div>
        </dl>

        <div>
          <h3 class="mb-2 text-sm font-semibold">Participants</h3>
          <div v-if="isLoading" class="flex justify-center py-6"><LoadingRipple class="size-6 text-[#0B7A75]" /></div>
          <p v-else-if="error" class="rounded-xl bg-[#FFF0EA] px-3 py-2.5 text-sm text-[#9D4636]">{{ error }}</p>
          <ul
            v-else-if="detail"
            class="max-h-64 overflow-y-auto rounded-2xl border border-[#E5EFEC] bg-white"
            data-call-participants
          >
            <li
              v-for="(person, index) in detail.participants"
              :key="`${person.userId ?? `guest-${person.name}`}-${index}`"
              class="border-[#EEF3F1] [&:not(:first-child)]:border-t"
            >
              <component
                :is="person.userId ? 'button' : 'div'"
                :type="person.userId ? 'button' : undefined"
                class="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
                :class="person.userId ? 'transition-colors [@media(hover:hover)]:hover:bg-[#EDF8F5]' : ''"
                :data-registered="!!person.userId"
                :aria-label="person.userId ? `Show ${person.name}'s profile` : undefined"
                @click="person.userId && emit('profile', person)"
              >
                <span
                  class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[28%] text-xs font-semibold"
                  :class="person.userId ? 'bg-[#DDF1ED] text-[#0B7A75]' : 'bg-[#F0F4F3] text-[#61777B]'"
                  ><img
                    v-if="avatarFor(person)"
                    :src="avatarFor(person)"
                    alt=""
                    class="size-full object-cover"
                  /><template v-else>{{ initials(person.name) }}</template></span
                >
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-1.5">
                    <span class="truncate text-sm font-semibold">{{ person.name }}</span>
                    <span v-if="person.isYou" class="shrink-0 text-xs font-semibold text-[#0B7A75]">You</span>
                    <span
                      v-if="!person.userId"
                      class="shrink-0 rounded-full bg-[#F0F4F3] px-1.5 py-px text-[0.625rem] font-bold uppercase tracking-wide text-[#61777B]"
                      >Guest</span
                    >
                  </span>
                  <span class="block truncate text-xs text-[#61777B]">
                    <template v-if="person.nickname">@{{ person.nickname }} · </template
                    >{{ person.leftAt ? `${duration(person.joinedAt, person.leftAt)} in the call` : 'In the call now' }}
                  </span>
                </span>
              </component>
            </li>
          </ul>
        </div>

        <div class="flex flex-wrap justify-end gap-2">
          <Button
            v-if="!shown.endedAt"
            variant="ghost"
            class="harbor-ghost-action h-10 rounded-full px-4 font-semibold text-[#0B7A75]"
            @click="emit('join', shown)"
          >
            <Video class="size-4" />Join
          </Button>
          <Button
            data-call-again
            class="harbor-primary-action h-10 rounded-full bg-[#0B7A75] px-5 text-white"
            :disabled="!canCallAgain || calling"
            :title="detail && !canCallAgain ? 'No registered participants to call' : undefined"
            @click="detail && emit('call', detail)"
          >
            <LoadingRipple v-if="calling" size="sm" />
            <template v-else><Phone class="size-4" />Call</template>
          </Button>
        </div>
      </template>
    </HarborDialogContent>
  </Dialog>
</template>
