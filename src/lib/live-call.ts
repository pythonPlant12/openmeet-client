import type { Conversation } from '@/services/social-api';

/**
 * Whether going to the room `targetId` means leaving the active call (ADR 0001: one active call at a time).
 * Returning to the active call, by its call session or its room, never asks.
 */
export function leavesActiveCall(
  active: { connected: boolean; callSessionId: string | null; roomId: string | null },
  targetId: string,
) {
  if (!active.connected) return false;
  return targetId !== active.callSessionId && targetId !== active.roomId;
}

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
