import { describe, expect, it } from 'vitest';

import {
  CHAT_FILTER_VIEWS,
  filterConversations,
  nextChatFilter,
  previousChatFilter,
} from '@/components/dashboard-page/conversations/chat-filter';
import type { Conversation } from '@/services/social-api';

function conversation(id: string, kind: Conversation['kind'], name: string) {
  return { id, kind, title: name } as Conversation;
}

const conversations = [
  conversation('1', 'group', 'Team'),
  conversation('2', 'direct', 'Bob'),
  conversation('3', 'group', 'Bowling club'),
  conversation('4', 'direct', 'Alice'),
];
const nameOf = (item: Conversation) => item.title ?? '';

describe('chat filter', () => {
  it('cycles all → groups → direct → all and back', () => {
    expect(nextChatFilter('all')).toBe('groups');
    expect(nextChatFilter('groups')).toBe('direct');
    expect(nextChatFilter('direct')).toBe('all');
    expect(previousChatFilter('all')).toBe('direct');
    expect(previousChatFilter('groups')).toBe('all');
  });

  it('filters by kind and query together, keeping order', () => {
    expect(filterConversations(conversations, 'groups', '', nameOf).map(({ id }) => id)).toEqual(['1', '3']);
    expect(filterConversations(conversations, 'direct', 'bo', nameOf).map(({ id }) => id)).toEqual(['2']);
    expect(filterConversations(conversations, 'all', ' BO ', nameOf).map(({ id }) => id)).toEqual(['2', '3']);
  });

  it('has distinct titles, labels and empty texts per view', () => {
    expect(CHAT_FILTER_VIEWS.all.title).toBe('Chats');
    expect(CHAT_FILTER_VIEWS.groups.title).toBe('Group chats');
    expect(CHAT_FILTER_VIEWS.direct.title).toBe('Friends chats');
    expect(CHAT_FILTER_VIEWS.groups.searchLabel).toBe('Search group chats');
    expect(CHAT_FILTER_VIEWS.direct.noMatchText).toBe('No friends chats match your search.');
    expect(CHAT_FILTER_VIEWS.direct.switchLabel).toBe('Show all chats');
  });
});
