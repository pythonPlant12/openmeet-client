import { describe, expect, it } from 'vitest';

import type { GroupMember } from '@/services/social-api';

import {
  activeMention,
  matchingMembers,
  mentionReplacement,
  replaceMention,
  replyAttachmentLabel,
} from '../chat-composer';

const members: GroupMember[] = [
  {
    id: 'ada',
    name: 'Ada Lovelace',
    nickname: 'ada',
    avatarUrl: null,
    isOnline: true,
    status: 'available',
    role: 'member',
    joinedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'grace',
    name: 'Grace Hopper',
    nickname: 'grace',
    avatarUrl: null,
    isOnline: true,
    status: 'available',
    role: 'member',
    joinedAt: '2026-01-01T00:00:00Z',
  },
];

describe('chat composer helpers', () => {
  it('replaces only active group mention at caret', () => {
    const content = 'Hi @ad and @grace';
    const mention = activeMention(content, 6);

    expect(mention).toEqual({ query: 'ad', start: 3, end: 6 });
    expect(replaceMention(content, mention!.start, mention!.end, 'ada')).toBe('Hi @ada and @grace');
  });

  it('replaces the entire active mention when the caret is inside its token', () => {
    const content = 'Hi @adword next';
    const mention = activeMention(content, 6);

    expect(mention).toEqual({ query: 'ad', start: 3, end: 10 });
    expect(mentionReplacement(content, mention!.start, mention!.end, 'ada')).toEqual({
      value: 'Hi @ada next',
      caret: 7,
    });
  });

  it('stops mentions at nickname boundaries and preserves following punctuation and text', () => {
    const content = 'Hi @ad,then';
    const mention = activeMention(content, 6);

    expect(mention).toEqual({ query: 'ad', start: 3, end: 6 });
    expect(mentionReplacement(content, mention!.start, mention!.end, 'ada')).toEqual({
      value: 'Hi @ada,then',
      caret: 7,
    });
  });

  it('adds a separator after a mention completed at the end of content', () => {
    expect(mentionReplacement('Hi @ad', 3, 6, 'ada')).toEqual({ value: 'Hi @ada ', caret: 8 });
  });

  it('filters group members by nickname', () => {
    expect(matchingMembers(members, 'RA').map(({ nickname }) => nickname)).toEqual(['grace']);
  });

  it('summarizes quoted attachment names', () => {
    expect(replyAttachmentLabel({ attachmentFileName: 'notes.txt', attachmentCount: 3 })).toBe('notes.txt, +2');
    expect(replyAttachmentLabel({ attachmentFileName: 'notes.txt', attachmentCount: 1 })).toBe('notes.txt');
  });
});
