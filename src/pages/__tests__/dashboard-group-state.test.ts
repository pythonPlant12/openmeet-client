import { describe, expect, it } from 'vitest';

import {
  beginGroupMutation,
  buildGroupSettingsRequest,
  callsPanelAfterDrag,
  endGroupMutation,
  selectableGroupMemberIds,
  shouldApplyDashboardRequest,
  sidebarPanelAfterDrag,
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

  it.each([
    ['messages downward from default', 'messages', null, 60, 0, 'messages'],
    ['messages upward while expanded', 'messages', 'messages', -60, 0, null],
    ['friends upward from default', 'friends', null, 0, -500, 'friends'],
    ['friends downward from default', 'friends', null, 0, 500, 'messages'],
    ['friends downward while expanded', 'friends', 'friends', 0, 500, null],
    ['messages movement while friends are expanded', 'messages', 'friends', 60, 0, null],
    ['friends movement while messages are expanded', 'friends', 'messages', -60, 0, null],
  ] as const)('snaps %s', (_, panel, current, offset, velocity, expected) => {
    expect(sidebarPanelAfterDrag(panel, current, offset, velocity)).toBe(expected);
  });

  it.each([
    ['collapsed', -60, 0, 'middle'],
    ['middle', 0, -500, 'top'],
    ['top', -60, 0, 'top'],
    ['top', 60, 0, 'middle'],
    ['middle', 0, 500, 'collapsed'],
    ['collapsed', 60, 0, 'collapsed'],
    ['middle', 20, 100, 'middle'],
  ] as const)('moves the calls list from %s by %i/%i to %s', (current, offset, velocity, expected) => {
    expect(callsPanelAfterDrag(current, offset, velocity)).toBe(expected);
  });

  it('keeps neutral drag state unchanged', () => {
    expect(sidebarPanelAfterDrag('messages', null, 20, 100)).toBeNull();
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
