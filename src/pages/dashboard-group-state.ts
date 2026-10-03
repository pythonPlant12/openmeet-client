import type { GroupAccessPolicy, GroupMember, UpdateGroupRequest } from '@/services/social-api';

export type SidebarPanel = 'messages' | 'friends';

const ROLE_ORDER: Record<string, number> = { creator: 0, admin: 1, member: 2 };

export type GroupMutationToken = symbol;

export function sortGroupMembers(members: GroupMember[]) {
  return [...members].sort(
    (left, right) =>
      (ROLE_ORDER[left.role] ?? Number.MAX_SAFE_INTEGER) - (ROLE_ORDER[right.role] ?? Number.MAX_SAFE_INTEGER) ||
      left.name.localeCompare(right.name),
  );
}

export function selectableGroupMemberIds(members: GroupMember[], currentUserId?: string) {
  return members
    .filter((member) => member.role !== 'creator' && member.id !== currentUserId)
    .map((member) => member.id);
}

export function shouldApplyDashboardRequest(request: number, currentRequest: number, isUnmounted: boolean) {
  return !isUnmounted && request === currentRequest;
}

export function buildGroupSettingsRequest(
  title: string,
  accessPolicy: GroupAccessPolicy,
  password: string,
): UpdateGroupRequest {
  return {
    title,
    accessPolicy,
    ...(accessPolicy === 'password' && password ? { password } : {}),
  };
}

export function beginGroupMutation(activeMutations: Map<string, GroupMutationToken>, groupId: string) {
  if (activeMutations.has(groupId)) return null;
  const token = Symbol(groupId);
  activeMutations.set(groupId, token);
  return token;
}

export function endGroupMutation(
  activeMutations: Map<string, GroupMutationToken>,
  groupId: string,
  token: GroupMutationToken,
) {
  if (activeMutations.get(groupId) === token) activeMutations.delete(groupId);
}

export function sidebarPanelAfterDrag(
  panel: SidebarPanel,
  current: SidebarPanel | null,
  offsetY: number,
  velocityY: number,
): SidebarPanel | null {
  const movedUp = offsetY < -48 || velocityY < -400;
  const movedDown = offsetY > 48 || velocityY > 400;

  if (current && current !== panel) return movedUp || movedDown ? null : current;
  if (panel === 'messages' && movedDown) return 'messages';
  if (panel === 'messages' && movedUp && current === 'messages') return null;
  if (panel === 'friends' && movedUp) return 'friends';
  if (panel === 'friends' && movedDown) return current === 'friends' ? null : 'messages';
  return current;
}
