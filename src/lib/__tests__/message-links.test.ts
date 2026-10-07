import { describe, expect, it } from 'vitest';

import { formatDuration, meetingTitle } from '@/lib/meetings';
import { findMeetingReferences, firstPreviewableLink, splitMessageLinks } from '@/lib/message-links';

const ROOM_ID = '3f2b8c1e-4d5a-4b6c-9e7f-0a1b2c3d4e5f';

describe('splitMessageLinks', () => {
  it('turns web links into link segments and keeps surrounding text', () => {
    expect(splitMessageLinks('See https://example.com/a?b=1, then www.test.org.')).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'link', text: 'https://example.com/a?b=1', href: 'https://example.com/a?b=1' },
      { kind: 'text', text: ', then ' },
      { kind: 'link', text: 'www.test.org', href: 'https://www.test.org' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('keeps balanced brackets in links and drops a closing bracket from prose', () => {
    const [, wiki] = splitMessageLinks('(https://en.wikipedia.org/wiki/Rust_(language))');
    expect(wiki).toMatchObject({ kind: 'link', text: 'https://en.wikipedia.org/wiki/Rust_(language)' });
    expect(splitMessageLinks('(see https://example.com)')[1]).toMatchObject({ text: 'https://example.com' });
  });

  it('never links non-web schemes', () => {
    expect(splitMessageLinks('javascript:alert(1) ftp://host')).toEqual([
      { kind: 'text', text: 'javascript:alert(1) ftp://host' },
    ]);
  });
});

describe('findMeetingReferences', () => {
  it('reads OpenMeet room links, including conversation calls', () => {
    expect(
      findMeetingReferences(`Join https://openmeets.eu/room/${ROOM_ID} or openmeets.eu/room/abc?conversation=c-1`),
    ).toEqual([
      { roomRef: ROOM_ID, route: `/room/${ROOM_ID}`, fromLink: true },
      { roomRef: 'abc', route: '/room/abc?conversation=c-1', fromLink: true },
    ]);
  });

  it('finds bare meeting IDs that are not part of a link', () => {
    expect(findMeetingReferences(`Meeting ID: ${ROOM_ID.toUpperCase()}`)).toEqual([
      { roomRef: ROOM_ID, route: `/room/${ROOM_ID}`, fromLink: false },
    ]);
    expect(findMeetingReferences(`https://example.com/${ROOM_ID}`)).toEqual([]);
  });

  it('ignores other sites and other OpenMeet pages', () => {
    expect(findMeetingReferences('https://evil.example/room/abc https://openmeets.eu/dashboard')).toEqual([]);
  });
});

describe('firstPreviewableLink', () => {
  it('skips meeting links, which get a meeting card instead', () => {
    expect(firstPreviewableLink(`https://openmeets.eu/room/abc and https://example.com/post`)).toBe(
      'https://example.com/post',
    );
    expect(firstPreviewableLink('no links here')).toBeNull();
  });
});

describe('meeting formatting', () => {
  it('formats durations compactly', () => {
    expect(formatDuration(45_000)).toBe('45 s');
    expect(formatDuration(12 * 60_000)).toBe('12 min');
    expect(formatDuration(65 * 60_000)).toBe('1 h 5 min');
    expect(formatDuration(120 * 60_000)).toBe('2 h');
  });

  it('names a call after the other people in it', () => {
    const person = (name: string, isYou = false) => ({
      userId: null,
      name,
      nickname: null,
      avatarUrl: null,
      joinedAt: '',
      leftAt: null,
      isYou,
    });
    expect(meetingTitle([person('Ada'), person('Bob')], 3)).toBe('Ada and Bob');
    expect(meetingTitle([person('Ada'), person('Bob'), person('Cy')], 5)).toBe('Ada, Bob +2');
    expect(meetingTitle([], 1)).toBe('Only you');
  });
});
