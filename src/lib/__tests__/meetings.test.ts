import { describe, expect, it } from 'vitest';

import { callAgainTargets } from '@/lib/meetings';
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
