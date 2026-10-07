// Finds links and meeting references in chat message text.

export type MessageSegment = { kind: 'text'; text: string } | { kind: 'link'; text: string; href: string };

export interface MeetingReference {
  /** Room ID from the link, or a call session ID for conversation calls. */
  roomRef: string;
  /** In-app route that opens the meeting. */
  route: string;
  /** A bare ID in text only counts once the server confirms the meeting exists. */
  fromLink: boolean;
}

// http(s) and www. links, plus bare openmeets.eu links people paste without a scheme.
const LINK_PATTERN = /\b(?:https?:\/\/|www\.|openmeets\.eu\/)[^\s<>"'`]+/gi;
const BARE_ID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const TRAILING_PUNCTUATION = /[.,!?;:'"]+$/;
const MEETING_HOSTS = new Set(['openmeets.eu', 'www.openmeets.eu']);
const MAX_MEETING_REFERENCES = 3;

/** Trims sentence punctuation and unbalanced closing brackets that follow a link in prose. */
function trimLink(raw: string) {
  let link = raw;
  for (;;) {
    const trimmed = link.replace(TRAILING_PUNCTUATION, '');
    const last = trimmed.slice(-1);
    const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
    const opening = last ? pairs[last] : undefined;
    if (opening && trimmed.split(opening).length <= trimmed.split(last!).length - 1) {
      link = trimmed.slice(0, -1);
      continue;
    }
    if (trimmed === link) return link;
    link = trimmed;
  }
}

function toHref(link: string) {
  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}

function parseUrl(href: string) {
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function splitMessageLinks(text: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const link = trimLink(match[0]);
    const href = toHref(link);
    if (!link || !parseUrl(href)) continue;
    if (match.index > cursor) segments.push({ kind: 'text', text: text.slice(cursor, match.index) });
    segments.push({ kind: 'link', text: link, href });
    cursor = match.index + link.length;
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}

function isMeetingHost(url: URL) {
  return MEETING_HOSTS.has(url.host) || (typeof window !== 'undefined' && url.host === window.location.host);
}

function meetingReferenceFromUrl(url: URL): MeetingReference | null {
  if (!isMeetingHost(url)) return null;
  const match = /^\/room\/([^/]+)\/?$/.exec(url.pathname);
  const roomRef = match ? decodeURIComponent(match[1]!) : null;
  if (!roomRef || !ROOM_ID_PATTERN.test(roomRef)) return null;
  // Conversation calls carry their conversation in the query, which the meeting page needs to join.
  const conversation = url.searchParams.get('conversation');
  const query = conversation ? `?${new URLSearchParams({ conversation }).toString()}` : '';
  return { roomRef, route: `/room/${encodeURIComponent(roomRef)}${query}`, fromLink: true };
}

export function isMeetingLink(href: string) {
  const url = parseUrl(href);
  return !!url && !!meetingReferenceFromUrl(url);
}

/** Meetings a message points at: OpenMeet room links first, then bare meeting IDs outside links. */
export function findMeetingReferences(text: string): MeetingReference[] {
  const references = new Map<string, MeetingReference>();
  const segments = splitMessageLinks(text);
  for (const segment of segments) {
    if (segment.kind !== 'link') continue;
    const url = parseUrl(segment.href);
    const reference = url && meetingReferenceFromUrl(url);
    if (reference && !references.has(reference.roomRef)) references.set(reference.roomRef, reference);
  }
  for (const segment of segments) {
    if (segment.kind !== 'text') continue;
    for (const match of segment.text.matchAll(BARE_ID_PATTERN)) {
      const roomRef = match[0].toLowerCase();
      if (!references.has(roomRef)) references.set(roomRef, { roomRef, route: `/room/${roomRef}`, fromLink: false });
    }
  }
  return [...references.values()].slice(0, MAX_MEETING_REFERENCES);
}

/** The first link worth a page preview: meeting links get a meeting card instead. */
export function firstPreviewableLink(text: string) {
  return (
    splitMessageLinks(text).find(
      (segment): segment is Extract<MessageSegment, { kind: 'link' }> =>
        segment.kind === 'link' && !isMeetingLink(segment.href),
    )?.href ?? null
  );
}
