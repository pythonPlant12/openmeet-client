export type PresenceSurface = 'directMessages' | 'groupParticipants' | 'friends';

// Which lists render online indicators. Who may see a user's status is decided by the server's presence
// visibility rules, so these flags only choose surfaces; per-user privacy settings belong on the server.
export const PRESENCE_INDICATOR_SURFACES: Record<PresenceSurface, boolean> = {
  directMessages: true,
  groupParticipants: true,
  friends: true,
};

export function showsPresenceIndicator(surface: PresenceSurface) {
  return PRESENCE_INDICATOR_SURFACES[surface];
}
