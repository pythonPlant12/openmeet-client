import { Globe, KeyRound, UserCheck, UsersRound } from 'lucide-vue-next';
import type { Component } from 'vue';

import type { GroupAccessPolicy } from '@/services/social-api';

export interface MeetingAccessOption {
  value: GroupAccessPolicy;
  label: string;
  description: string;
  icon: Component;
}

// Meetings use the group access policies; the wording describes who may join the host's meeting.
export const MEETING_ACCESS_OPTIONS: MeetingAccessOption[] = [
  { value: 'open', label: 'Open', description: 'Anyone with the link can join', icon: Globe },
  { value: 'friendsOnly', label: 'Friends', description: 'Only your friends can join', icon: UserCheck },
  {
    value: 'friendsOfFriends',
    label: 'Friends of friends',
    description: 'Your friends and their friends can join',
    icon: UsersRound,
  },
  { value: 'password', label: 'Password', description: 'Anyone with the password can join', icon: KeyRound },
];

export function meetingAccessOption(policy: GroupAccessPolicy | null | undefined) {
  return MEETING_ACCESS_OPTIONS.find((option) => option.value === policy) ?? MEETING_ACCESS_OPTIONS[0]!;
}

/** Who can be invited: friends-limited meetings only admit people the host knows. */
export function meetingInvitesAnyone(policy: GroupAccessPolicy | null | undefined) {
  return !policy || policy === 'open' || policy === 'password';
}

/** Access errors the server sends when a join is refused; anything else is a connection problem. */
export const MEETING_ACCESS_ERRORS = [
  'Meeting password required',
  'Incorrect meeting password',
  'Sign in to join this meeting',
  "This meeting is limited to the host's friends",
  "This meeting is limited to the host's friends and their friends",
  'Too many password attempts. Try again in a minute.',
];
