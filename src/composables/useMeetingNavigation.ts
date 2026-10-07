import { useRouter } from 'vue-router';

import { hasStoredSession, socialApi } from '@/services/social-api';
import { cookieUtils } from '@/utils';

const MEETING_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function getMeetingId(reference: string): string | null {
  const value = reference.trim();
  if (!value) return null;

  const hasProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(value);
  let path = value.split(/[?#]/, 1)[0];
  if (hasProtocol) {
    try {
      path = new URL(value).pathname;
    } catch {
      return null;
    }
  }

  const segments = path.split('/').filter(Boolean);
  const roomSegmentIndex = segments.length - 2;
  const meetingId =
    segments.length === 1 && !hasProtocol
      ? segments[0]
      : roomSegmentIndex >= 0 && segments[roomSegmentIndex] === 'room'
        ? segments[segments.length - 1]
        : null;

  return meetingId && MEETING_ID_PATTERN.test(meetingId) ? meetingId : null;
}

export function useMeetingNavigation() {
  const router = useRouter();

  // Signed-in users host their meeting: the server creates the room so they can choose who may join
  // before entering. Guests, or a failed request, fall back to an open room with a local ID.
  const createMeeting = async () => {
    let meetingId: string | null = null;
    if (hasStoredSession()) {
      try {
        meetingId = (await socialApi.createMeetingRoom(cookieUtils.get('accessToken') ?? '', { accessPolicy: 'open' }))
          .roomId;
      } catch (error) {
        console.error('[useMeetingNavigation] Failed to create a hosted meeting:', error);
      }
    }
    meetingId ??= globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    return router.push({ name: 'meeting', params: { id: meetingId } });
  };

  const joinMeeting = (reference: string) => {
    const meetingId = getMeetingId(reference);
    if (!meetingId) return false;

    router.push({ name: 'meeting', params: { id: meetingId } });
    return true;
  };

  return { createMeeting, joinMeeting };
}
