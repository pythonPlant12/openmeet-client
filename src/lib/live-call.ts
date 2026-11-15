import type { Conversation } from '@/services/social-api';

/**
 * Whether a conversation's picture shows the live call ring. A group rings while anyone is in its call. A
 * friend rings only while they are in the direct call with you: your own waiting never rings their picture.
 */
export function showsLiveCallRing(conversation: Pick<Conversation, 'kind' | 'otherUserId' | 'liveCall'>) {
  const live = conversation.liveCall;
  if (!live) return false;
  if (conversation.kind === 'group') return live.memberIds.length > 0;
  return !!conversation.otherUserId && live.memberIds.includes(conversation.otherUserId);
}
