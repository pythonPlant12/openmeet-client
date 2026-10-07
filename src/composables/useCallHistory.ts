import { useIntervalFn } from '@vueuse/core';
import { type Ref, computed, ref } from 'vue';

import { toast } from '@/components/ui/toast';
import { useAvatarCache } from '@/composables/useAvatarCache';
import { type MeetingPerson, type MeetingSession, socialApi } from '@/services/social-api';

// Live calls change while they are listed, so the list refreshes until they end.
const LIVE_REFRESH_MS = 20_000;

/** Meetings and calls the user joined, newest first, with "load earlier" paging. */
export function useCallHistory(accessToken: Ref<string | null | undefined>) {
  const meetings = ref<MeetingSession[]>([]);
  const nextBefore = ref<string | null>(null);
  const isLoading = ref(false);
  const isLoadingMore = ref(false);
  const hasLoaded = ref(false);
  const error = ref('');
  const avatarCache = useAvatarCache((path) => socialApi.loadAvatar(accessToken.value ?? '', path));

  const hasLiveMeeting = computed(() => meetings.value.some((meeting) => !meeting.endedAt));

  function loadAvatars(people: MeetingPerson[]) {
    void avatarCache.ensure(people.flatMap((person) => (person.avatarUrl ? [person.avatarUrl] : [])));
  }

  function avatarFor(person: MeetingPerson) {
    return person.avatarUrl ? avatarCache.urls.value[person.avatarUrl] : undefined;
  }

  async function load({ quiet = false } = {}) {
    const token = accessToken.value;
    if (!token) return;
    if (!quiet) isLoading.value = true;
    try {
      const page = await socialApi.listMeetingSessions(token);
      // A quiet refresh keeps pages loaded with "load earlier", replacing only the newest rows.
      const refreshedIds = new Set(page.meetings.map((meeting) => meeting.id));
      const older = quiet ? meetings.value.filter((meeting) => !refreshedIds.has(meeting.id)) : [];
      const oldestRefreshed = page.meetings[page.meetings.length - 1]?.startedAt;
      meetings.value = [
        ...page.meetings,
        ...older.filter((meeting) => !oldestRefreshed || meeting.startedAt < oldestRefreshed),
      ];
      if (!quiet) nextBefore.value = page.nextBefore;
      error.value = '';
      hasLoaded.value = true;
      loadAvatars(page.meetings.flatMap((meeting) => meeting.participants));
    } catch (loadError) {
      console.error('[useCallHistory] Failed to load calls:', loadError);
      if (!quiet) error.value = 'Could not load your calls.';
    } finally {
      isLoading.value = false;
    }
  }

  async function loadMore() {
    const token = accessToken.value;
    if (!token || !nextBefore.value || isLoadingMore.value) return;
    isLoadingMore.value = true;
    try {
      const page = await socialApi.listMeetingSessions(token, nextBefore.value);
      const known = new Set(meetings.value.map((meeting) => meeting.id));
      meetings.value = [...meetings.value, ...page.meetings.filter((meeting) => !known.has(meeting.id))];
      nextBefore.value = page.nextBefore;
      loadAvatars(page.meetings.flatMap((meeting) => meeting.participants));
    } catch (loadError) {
      console.error('[useCallHistory] Failed to load earlier calls:', loadError);
      toast({ title: 'Could not load earlier calls.', variant: 'destructive' });
    } finally {
      isLoadingMore.value = false;
    }
  }

  /** Updates a call's dot right away; the server confirms it in the background. */
  function setUnread(meetingId: string, unread: boolean) {
    meetings.value = meetings.value.map((meeting) => (meeting.id === meetingId ? { ...meeting, unread } : meeting));
  }

  useIntervalFn(() => {
    if (hasLiveMeeting.value) void load({ quiet: true });
  }, LIVE_REFRESH_MS);

  return {
    meetings,
    nextBefore,
    isLoading,
    isLoadingMore,
    hasLoaded,
    error,
    avatarFor,
    loadAvatars,
    load,
    loadMore,
    setUnread,
  };
}
