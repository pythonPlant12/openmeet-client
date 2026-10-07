import { type Ref, onScopeDispose, reactive, shallowRef, watch } from 'vue';

import { type MeetingRoomSummary, SocialApiError, hasStoredSession, socialApi } from '@/services/social-api';
import { cookieUtils } from '@/utils';

// Live meetings are polled so their cards turn into "ended" without a reload.
const LIVE_POLL_MS = 20_000;
// Links to meetings that have not started yet are checked less often.
const IDLE_POLL_MS = 60_000;

export interface MeetingRoomSummaryState {
  status: 'loading' | 'ready' | 'missing' | 'error';
  summary: MeetingRoomSummary | null;
}

interface Entry {
  state: MeetingRoomSummaryState;
  subscribers: number;
  timer: number | undefined;
  inFlight: boolean;
}

const entries = new Map<string, Entry>();

async function refresh(roomRef: string, entry: Entry) {
  if (entry.inFlight) return;
  entry.inFlight = true;
  try {
    entry.state.summary = await socialApi.getMeetingRoomSummary(cookieUtils.get('accessToken') ?? '', roomRef);
    entry.state.status = 'ready';
  } catch (error) {
    if (error instanceof SocialApiError && error.status === 404) {
      entry.state.status = 'missing';
      entry.state.summary = null;
    } else {
      console.error('[useMeetingRoomSummary] Failed to load meeting summary:', error);
      if (entry.state.status === 'loading') entry.state.status = 'error';
    }
  } finally {
    entry.inFlight = false;
    schedule(roomRef, entry);
  }
}

function schedule(roomRef: string, entry: Entry) {
  window.clearTimeout(entry.timer);
  entry.timer = undefined;
  if (!entry.subscribers || entry.state.summary?.status === 'ended') return;
  const delay = entry.state.summary?.status === 'live' ? LIVE_POLL_MS : IDLE_POLL_MS;
  entry.timer = window.setTimeout(() => void refresh(roomRef, entry), delay);
}

function subscribe(roomRef: string) {
  let entry = entries.get(roomRef);
  if (!entry) {
    entry = {
      state: reactive({ status: 'loading', summary: null }) as MeetingRoomSummaryState,
      subscribers: 0,
      timer: undefined,
      inFlight: false,
    };
    entries.set(roomRef, entry);
  }
  entry.subscribers += 1;
  // Ended meetings never change, so a cached answer is final; everything else is refreshed on use.
  if (entry.state.summary?.status !== 'ended' && !entry.timer) void refresh(roomRef, entry);
  const subscribed = entry;
  return () => {
    subscribed.subscribers -= 1;
    if (!subscribed.subscribers) {
      window.clearTimeout(subscribed.timer);
      subscribed.timer = undefined;
    }
  };
}

const SIGNED_OUT_STATE: MeetingRoomSummaryState = { status: 'error', summary: null };

/** Shared, self-refreshing summary of the meeting behind a room link or ID. */
export function useMeetingRoomSummary(roomRef: Ref<string>) {
  // Every card for the same room reads the same reactive entry, so they update together.
  const state = shallowRef<MeetingRoomSummaryState>(SIGNED_OUT_STATE);
  let unsubscribe: (() => void) | undefined;

  watch(
    roomRef,
    (current) => {
      unsubscribe?.();
      unsubscribe = undefined;
      if (!hasStoredSession()) {
        state.value = SIGNED_OUT_STATE;
        return;
      }
      unsubscribe = subscribe(current);
      state.value = entries.get(current)!.state;
    },
    { immediate: true },
  );

  onScopeDispose(() => unsubscribe?.());
  return state;
}
