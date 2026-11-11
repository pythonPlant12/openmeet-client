import {
  CirclePlusAnimated,
  MessageCircleAnimated,
  MessageSquareAnimated,
  UserRoundPlusAnimated,
  UsersAnimated,
  UsersRoundAnimated,
} from '@respeak/lucide-motion-vue';
import type { Component } from 'vue';

import type { Conversation } from '@/services/social-api';

/** The Chats pane lists every conversation, only groups, or only direct chats with friends. */
export type ChatFilter = 'all' | 'groups' | 'direct';
export type ChatFilterAction = 'start-meeting' | 'create-group' | 'add-friend';

export interface ChatFilterView {
  title: string;
  searchLabel: string;
  emptyText: string;
  noMatchText: string;
  /** The teal action beside the switch. */
  action: ChatFilterAction;
  actionLabel: string;
  actionIcon: Component;
  /** The view the switch button moves to. */
  next: ChatFilter;
  switchLabel: string;
  switchIcon: Component;
}

export const CHAT_FILTER_VIEWS: Record<ChatFilter, ChatFilterView> = {
  all: {
    title: 'Chats',
    searchLabel: 'Search chats',
    emptyText: 'No conversations yet.',
    noMatchText: 'No conversations match your search.',
    action: 'start-meeting',
    actionLabel: 'Start meeting',
    actionIcon: CirclePlusAnimated,
    next: 'groups',
    switchLabel: 'Show group chats',
    switchIcon: UsersAnimated,
  },
  groups: {
    title: 'Group chats',
    searchLabel: 'Search group chats',
    emptyText: 'No group chats yet.',
    noMatchText: 'No group chats match your search.',
    action: 'create-group',
    actionLabel: 'Create group',
    actionIcon: UsersRoundAnimated,
    next: 'direct',
    switchLabel: 'Show friends chats',
    switchIcon: MessageCircleAnimated,
  },
  direct: {
    title: 'Friends chats',
    searchLabel: 'Search friends chats',
    emptyText: 'No friends chats yet.',
    noMatchText: 'No friends chats match your search.',
    action: 'add-friend',
    actionLabel: 'Add friend',
    actionIcon: UserRoundPlusAnimated,
    next: 'all',
    switchLabel: 'Show all chats',
    switchIcon: MessageSquareAnimated,
  },
};

const ORDER: ChatFilter[] = ['all', 'groups', 'direct'];

export function nextChatFilter(filter: ChatFilter): ChatFilter {
  return CHAT_FILTER_VIEWS[filter].next;
}

export function previousChatFilter(filter: ChatFilter): ChatFilter {
  return ORDER[(ORDER.indexOf(filter) + ORDER.length - 1) % ORDER.length]!;
}

/** Keeps the conversations of the view whose name contains the query, in their current order. */
export function filterConversations(
  conversations: Conversation[],
  filter: ChatFilter,
  query: string,
  nameOf: (conversation: Conversation) => string,
): Conversation[] {
  const needle = query.trim().toLocaleLowerCase();
  return conversations.filter(
    (conversation) =>
      (filter === 'all' || conversation.kind === (filter === 'groups' ? 'group' : 'direct')) &&
      (!needle || nameOf(conversation).toLocaleLowerCase().includes(needle)),
  );
}
