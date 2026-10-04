import type { Conversation, MessageReaction } from '@/services/social-api';

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

/** Applies the viewer's own toggle to a reaction summary before the server confirms it. */
export function toggledReactions(reactions: MessageReaction[], emoji: string): MessageReaction[] {
  const existing = reactions.find((reaction) => reaction.emoji === emoji);
  if (!existing) return [...reactions, { emoji, count: 1, reactedByMe: true }];
  if (!existing.reactedByMe) {
    return reactions.map((reaction) =>
      reaction === existing ? { ...reaction, count: reaction.count + 1, reactedByMe: true } : reaction,
    );
  }
  if (existing.count <= 1) return reactions.filter((reaction) => reaction !== existing);
  return reactions.map((reaction) =>
    reaction === existing ? { ...reaction, count: reaction.count - 1, reactedByMe: false } : reaction,
  );
}
