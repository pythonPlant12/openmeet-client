import type { Conversation } from '@/services/social-api';

export interface ConversationActivity {
  lastActivityAt: number;
  unreadCount: number;
}

function updatedAt(conversation: Conversation) {
  const timestamp = Date.parse(conversation.updatedAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortConversationsByActivity(
  conversations: Conversation[],
  activity: Record<string, ConversationActivity>,
) {
  return conversations
    .map((conversation, index) => ({
      conversation,
      index,
      activityAt: activity[conversation.id]?.lastActivityAt ?? updatedAt(conversation),
    }))
    .sort((left, right) => right.activityAt - left.activityAt || left.index - right.index)
    .map(({ conversation }) => conversation);
}

export function upsertConversationByActivity(
  conversations: Conversation[],
  conversation: Conversation,
  activity: Record<string, ConversationActivity>,
) {
  return sortConversationsByActivity(
    [conversation, ...conversations.filter((item) => item.id !== conversation.id)],
    activity,
  );
}
