import { describe, expect, it } from 'vitest';

import {
  type ConversationActivity,
  sortConversationsByActivity,
  upsertConversationByActivity,
} from '@/pages/dashboard-chat-state';
import type { Conversation } from '@/services/social-api';

const first: Conversation = {
  id: 'first',
  kind: 'direct',
  title: null,
  accessPolicy: null,
  role: null,
  otherUserId: 'friend-1',
  messageCount: 0,
  unreadCount: 0,
  createdAt: '2026-08-01T12:00:00Z',
  updatedAt: '2026-08-01T12:00:00Z',
};

const second: Conversation = {
  ...first,
  id: 'second',
  otherUserId: 'friend-2',
  updatedAt: '2026-08-02T12:00:00Z',
};

describe('dashboard chat state', () => {
  it('moves sent and delivered conversations to most-recent position', () => {
    const activity: Record<string, ConversationActivity> = {
      first: { lastActivityAt: Date.parse('2026-08-03T12:00:00Z'), unreadCount: 0 },
    };

    expect(sortConversationsByActivity([second, first], activity).map(({ id }) => id)).toEqual(['first', 'second']);
  });

  it('adds a draft conversation only once its first message is delivered', () => {
    const activity: Record<string, ConversationActivity> = {
      first: { lastActivityAt: Date.parse('2026-08-04T12:00:00Z'), unreadCount: 0 },
    };

    expect(upsertConversationByActivity([second], first, activity).map(({ id }) => id)).toEqual(['first', 'second']);
  });
});
