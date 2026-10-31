import type { GroupAccessPolicy, GroupMember, UpdateGroupRequest } from '@/services/social-api';

export type SidebarPanel = 'messages' | 'friends';
/** Calls either fills the sidebar or, while someone is calling, shows only its ringing banner. */
export type CallsPanel = 'collapsed' | 'top';
/** The single sidebar section on screen; the navbar workspace tabs switch between them. */
export type DashboardPanelState = SidebarPanel | 'calls';

export function dashboardPanelState(section: SidebarPanel | null, calls: CallsPanel): DashboardPanelState {
  return calls === 'collapsed' ? (section ?? 'messages') : 'calls';
}

/** Sidebar arrangement for a `?panel=` deep link. */
export function sidebarForPanelQuery(panel: unknown): { section?: SidebarPanel; calls: CallsPanel } | null {
  if (panel === 'messages' || panel === 'friends') return { section: panel, calls: 'collapsed' };
  if (panel === 'calls') return { calls: 'top' };
  return null;
}

const ROLE_ORDER: Record<string, number> = { creator: 0, admin: 1, member: 2 };

export type GroupMutationToken = symbol;

export const GROUP_ACCESS_POLICIES: GroupAccessPolicy[] = ['open', 'password', 'friendsOnly', 'friendsOfFriends'];

const GROUP_ACCESS_POLICY_LABELS: Record<GroupAccessPolicy, string> = {
  open: 'Open access',
  password: 'Password protected',
  friendsOnly: 'Friends-only',
  friendsOfFriends: 'Friends of friends',
};

export function groupAccessPolicyLabel(policy: GroupAccessPolicy | null | undefined) {
  return GROUP_ACCESS_POLICY_LABELS[policy ?? 'open'];
}

export function canAddOutsideFriends(policy: GroupAccessPolicy | null | undefined) {
  return policy !== 'friendsOnly';
}

export function groupAddActionLabel(policy: GroupAccessPolicy | null | undefined) {
  if (policy === 'password') return 'Invite people';
  return canAddOutsideFriends(policy) ? 'Add people' : 'Add friends';
}

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
