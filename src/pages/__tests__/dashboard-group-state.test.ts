import { describe, expect, it } from 'vitest';

import {
  beginGroupMutation,
  buildGroupSettingsRequest,
  dashboardPanelState,
  endGroupMutation,
  selectableGroupMemberIds,
  shouldApplyDashboardRequest,
  sidebarForPanelQuery,
  sortGroupMembers,
} from '@/pages/dashboard-group-state';
import type { GroupMember } from '@/services/social-api';

const members: GroupMember[] = [
  {
    id: 'member-b',
    name: 'Zed',
    nickname: 'member_b',
    avatarUrl: null,
    isOnline: false,
    status: null,
    role: 'member',
    joinedAt: '',
  },
  {
    id: 'admin',
    name: 'Ada',
    nickname: 'admin',
    avatarUrl: null,
    isOnline: false,
    status: null,
    role: 'admin',
    joinedAt: '',
  },
  {
    id: 'creator',
    name: 'Creator',
    nickname: 'creator',
    avatarUrl: null,
    isOnline: false,
    status: null,
    role: 'creator',
    joinedAt: '',
  },
  {
    id: 'member-a',
    name: 'Alice',
    nickname: 'member_a',
    avatarUrl: null,
    isOnline: false,
    status: null,
    role: 'member',
    joinedAt: '',
  },
];

describe('dashboard group state', () => {
  it('sorts creator, admin, then members by name', () => {
    expect(sortGroupMembers(members).map(({ id }) => id)).toEqual(['creator', 'admin', 'member-a', 'member-b']);
  });

  it('excludes creators and current user from bulk member selection', () => {
    expect(selectableGroupMemberIds(members, 'admin')).toEqual(['member-b', 'member-a']);
  });

  it('only excludes creators when current user is unavailable', () => {
    expect(selectableGroupMemberIds(members)).toEqual(['member-b', 'admin', 'member-a']);
  });

  it('only applies the latest request while the dashboard is mounted', () => {
    expect(shouldApplyDashboardRequest(2, 2, false)).toBe(true);
    expect(shouldApplyDashboardRequest(1, 2, false)).toBe(false);
    expect(shouldApplyDashboardRequest(2, 2, true)).toBe(false);
  });

  it('omits a stale password after access switches away from password policy', () => {
    expect(buildGroupSettingsRequest('Harbor team', 'friendsOnly', 'stale-secret')).toEqual({
      title: 'Harbor team',
      accessPolicy: 'friendsOnly',
    });
    expect(buildGroupSettingsRequest('Harbor team', 'password', 'new-secret')).toEqual({
      title: 'Harbor team',
      accessPolicy: 'password',
      password: 'new-secret',
    });
  });

  it('allows one mutation per group and ignores stale releases', () => {
    const activeMutations = new Map<string, symbol>();
    const first = beginGroupMutation(activeMutations, 'group-1');

    expect(first).not.toBeNull();
    expect(beginGroupMutation(activeMutations, 'group-1')).toBeNull();
    expect(beginGroupMutation(activeMutations, 'group-2')).not.toBeNull();

    endGroupMutation(activeMutations, 'group-1', Symbol('stale'));
    expect(activeMutations.has('group-1')).toBe(true);

    endGroupMutation(activeMutations, 'group-1', first!);
    expect(activeMutations.has('group-1')).toBe(false);
  });
});

describe('dashboard workspace tabs', () => {
  it('maps panel deep links to one sidebar section', () => {
    expect(sidebarForPanelQuery('messages')).toEqual({ section: 'messages', calls: 'collapsed' });
    expect(sidebarForPanelQuery('friends')).toEqual({ section: 'friends', calls: 'collapsed' });
    expect(sidebarForPanelQuery('calls')).toEqual({ calls: 'top' });
    expect(sidebarForPanelQuery(undefined)).toBeNull();
    expect(sidebarForPanelQuery(['friends'])).toBeNull();
  });

  it('shows Calls while it is open and otherwise the remembered section', () => {
    expect(dashboardPanelState('friends', 'collapsed')).toBe('friends');
    expect(dashboardPanelState(null, 'collapsed')).toBe('messages');
    expect(dashboardPanelState('friends', 'top')).toBe('calls');
  });
});
