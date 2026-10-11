import type { ConversationMessage, GroupMember, MessageReplyPreview } from '@/services/social-api';

export const CHAT_COMMANDS = [{ name: 'giphy', description: 'Search GIFs' }];

export function activeMention(value: string, caret: number) {
  const boundedCaret = Math.min(Math.max(caret, 0), value.length);
  const beforeCaret = value.slice(0, boundedCaret);
  const match = beforeCaret.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
  if (!match || match.index === undefined) return null;
  const start = match.index + match[0].length - match[1].length - 1;
  const nextBoundary = value.slice(boundedCaret).search(/[^a-zA-Z0-9_]/);
  const end = nextBoundary < 0 ? value.length : boundedCaret + nextBoundary;
  return { query: value.slice(start + 1, boundedCaret), start, end };
}

export function replaceMention(value: string, start: number, end: number, nickname: string) {
  const remainder = value.slice(end);
  return `${value.slice(0, start)}@${nickname}${remainder ? '' : ' '}${remainder}`;
}

export function mentionReplacement(value: string, start: number, end: number, nickname: string) {
  const remainder = value.slice(end);
  const separator = remainder ? '' : ' ';
  return {
    value: `${value.slice(0, start)}@${nickname}${separator}${remainder}`,
    caret: start + nickname.length + 1 + separator.length,
  };
}

export function matchingMembers(members: GroupMember[], query: string) {
  const normalized = query.toLocaleLowerCase();
  return members.filter((member) => member.nickname.toLocaleLowerCase().includes(normalized));
}

export function replyAttachmentLabel(
  reply: Pick<MessageReplyPreview, 'attachmentFileName' | 'attachmentCount'> | ConversationMessage,
) {
  const attachments = 'attachments' in reply ? reply.attachments : undefined;
  const attachmentFileName = 'attachmentFileName' in reply ? reply.attachmentFileName : attachments?.[0]?.fileName;
  if (!attachmentFileName) return '';
  const attachmentCount = 'attachmentCount' in reply ? reply.attachmentCount : attachments?.length;
  const extraAttachments = Math.max((attachmentCount ?? 1) - 1, 0);
  return extraAttachments ? `${attachmentFileName}, +${extraAttachments}` : attachmentFileName;
}
