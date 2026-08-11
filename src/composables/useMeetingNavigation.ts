import { useRouter } from 'vue-router';

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

  const createMeeting = () => {
    const meetingId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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
