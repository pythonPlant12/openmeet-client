import { describe, expect, it } from 'vitest';

import { getMeetingId } from '@/composables/useMeetingNavigation';

describe('getMeetingId', () => {
  it.each([
    ['abc123', 'abc123'],
    ['room/abc123', 'abc123'],
    ['/room/abc123', 'abc123'],
    ['https://openmeets.eu/room/abc123?source=invite', 'abc123'],
    ['openmeets.eu/room/abc123', 'abc123'],
    ['  abc-123_test  ', 'abc-123_test'],
  ])('extracts a meeting ID from %s', (reference, expected) => {
    expect(getMeetingId(reference)).toBe(expected);
  });

  it.each(['', 'https://openmeets.eu/room', 'openmeets.eu/about', 'room/invalid code'])(
    'rejects invalid meeting reference %s',
    (reference) => {
      expect(getMeetingId(reference)).toBeNull();
    },
  );
});
