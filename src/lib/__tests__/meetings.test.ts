import { describe, expect, it } from 'vitest';

import { callAgainTargets, callAvatar } from '@/lib/meetings';
import type { MeetingPerson } from '@/services/social-api';

function person(overrides: Partial<MeetingPerson>): MeetingPerson {
  return {
    userId: null,
    name: 'Someone',
    nickname: null,
    avatarUrl: null,
    joinedAt: '2026-10-07T10:00:00Z',
    leftAt: '2026-10-07T10:30:00Z',
    isYou: false,
    ...overrides,
  };
}

describe('callAgainTargets', () => {
  it('rings each registered person once and skips you and guests', () => {
    const targets = callAgainTargets({
      participants: [
        person({ userId: 'me', name: 'Me', isYou: true }),
        person({ userId: 'bob', name: 'Bob' }),
        person({ name: 'Guest' }),
        person({ userId: 'bob', name: 'Bob' }),
        person({ userId: 'carol', name: 'Carol' }),
      ],
    });
    expect(targets.map((target) => target.userId)).toEqual(['bob', 'carol']);
  });

  it('has no one to ring when only guests joined', () => {
    expect(callAgainTargets({ participants: [person({ userId: 'me', isYou: true }), person({})] })).toEqual([]);
  });
});

describe('callAvatar', () => {
  const others = ['Ada', 'Bob', 'Cy', 'Dee', 'Eve'].map((name) => person({ userId: name, name }));

  it('shows you when nobody else joined', () => {
    expect(callAvatar({ participants: [] }, false)).toEqual({ kind: 'self' });
    expect(callAvatar({ participants: [person({ isYou: true })] }, false)).toEqual({ kind: 'self' });
  });

  it('shows the one other person of a direct call', () => {
    expect(callAvatar({ participants: [others[0]!] }, false)).toEqual({ kind: 'people', people: [others[0]] });
  });

  it('shows up to four other people together', () => {
    expect(callAvatar({ participants: others }, false)).toEqual({ kind: 'people', people: others.slice(0, 4) });
  });

  it('shows the group for a group call, whoever joined', () => {
    expect(callAvatar({ participants: others }, true)).toEqual({ kind: 'group' });
    expect(callAvatar({ participants: [] }, true)).toEqual({ kind: 'group' });
  });
});
