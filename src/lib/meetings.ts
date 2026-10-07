import { PhoneCall } from 'lucide-vue-next';

import { meetingAccessOption } from '@/config/meeting-access.config';
import type { MeetingPerson, MeetingSession } from '@/services/social-api';

/** Compact meeting length, such as "45 s", "12 min", or "1 h 5 min". */
export function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

/** Length of a meeting, counting a live meeting up to `now`. */
export function meetingDuration(startedAt: string, endedAt: string | null, now: number = Date.now()) {
  return (endedAt ? Date.parse(endedAt) : now) - Date.parse(startedAt);
}

/** Names the other people in a meeting, the way a call list identifies a call. */
export function meetingTitle(people: MeetingPerson[], participantCount: number) {
  const others = people.filter((person) => !person.isYou);
  if (!others.length) return participantCount > 1 ? 'Meeting' : 'Only you';
  const names = others.slice(0, 2).map((person) => person.name);
  // participantCount includes you, so the remainder excludes you and the named people.
  const remaining = participantCount - 1 - names.length;
  return remaining > 0 ? `${names.join(', ')} +${remaining}` : names.join(' and ');
}

/** Conversation calls are calls; meetings are named by who could join them. */
export function meetingType(meeting: Pick<MeetingSession, 'conversationId' | 'accessPolicy'>) {
  if (meeting.conversationId) return { label: 'Call', icon: PhoneCall };
  const option = meetingAccessOption(meeting.accessPolicy);
  return { label: `${option.label} meeting`, icon: option.icon };
}

export function participantCountLabel(count: number) {
  return `${count} ${count === 1 ? 'participant' : 'participants'}`;
}

/** Registered people, other than you, whom "call again" rings. Guests cannot be called. */
export function callAgainTargets(meeting: Pick<MeetingSession, 'participants'>) {
  const seen = new Set<string>();
  return meeting.participants.filter((person): person is MeetingPerson & { userId: string } => {
    if (!person.userId || person.isYou || seen.has(person.userId)) return false;
    seen.add(person.userId);
    return true;
  });
}
