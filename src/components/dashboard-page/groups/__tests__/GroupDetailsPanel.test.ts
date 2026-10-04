import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import GroupDetailsPanel from '@/components/dashboard-page/groups/GroupDetailsPanel.vue';
import type { Conversation, GroupInfo, GroupMember } from '@/services/social-api';

const group: Conversation = {
  id: 'group-1',
  kind: 'group',
  title: 'Harbor',
  accessPolicy: 'friendsOnly',
  groupCode: '4ibpDLfbdpK58VVh8efXDm',
  avatarUrl: null,
  role: 'member',
  otherUserId: null,
  messageCount: 0,
  unreadCount: 0,
  markedUnread: false,
  createdAt: '2026-10-03T12:00:00Z',
  updatedAt: '2026-10-03T12:00:00Z',
};

const info: GroupInfo = {
  id: 'group-1',
  title: 'Harbor',
  accessPolicy: 'friendsOnly',
  groupCode: '4ibpDLfbdpK58VVh8efXDm',
  avatarUrl: null,
  createdAt: '2026-10-03T12:00:00Z',
  memberCount: 2,
  isMember: true,
  role: 'member',
  canJoin: false,
};

const member = (id: string, name: string): GroupMember => ({
  id,
  name,
  nickname: id,
  avatarUrl: null,
  isOnline: false,
  status: null,
  role: 'member',
  joinedAt: '',
});

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(GroupDetailsPanel, {
    props: {
      accessToken: 'token',
      currentUserId: 'me',
      friends: [],
      group,
      info,
      loading: false,
      members: [member('me', 'Me'), member('sam', 'Sam')],
      memberAvatarUrls: {},
      membersHasMore: false,
      membersLoadingMore: false,
      mutationBusy: false,
      beginMutation: () => Symbol('group-1'),
      endMutation: () => undefined,
      changeFriendship: async () => true,
      ...props,
    },
    global: {
      stubs: {
        LoadingRipple: { template: '<span />' },
        Dialog: { template: '<div><slot /></div>' },
        HarborDialogContent: { template: '<div><slot /></div>' },
        DialogHeader: { template: '<div><slot /></div>' },
        DialogTitle: { template: '<div><slot /></div>' },
        DialogDescription: { template: '<div><slot /></div>' },
        DialogFooter: { template: '<div><slot /></div>' },
        FriendshipChangeDialog: { template: '<div />' },
      },
    },
  });
}

describe('GroupDetailsPanel', () => {
  it('stacks group facts so long values fit the narrow details pane', () => {
    expect(mountPanel().get('[data-group-facts]').classes()).toContain('flex-col');
  });

  it('makes every participant clickable and swipeable like the mobile list', async () => {
    const wrapper = mountPanel();
    const rows = wrapper.findAll('[data-swipeable-row]');
    const samRow = rows.find((row) => row.text().includes('Sam'))!;

    expect(samRow.findAll('[data-swipe-pane="trailing"] button').map((button) => button.text())).toEqual([
      'Profile',
      'Add friend',
    ]);
    expect(samRow.find('[data-swipe-pane="leading"]').exists()).toBe(false);

    await samRow.get('[title="Open profile"]').trigger('click');
    expect(wrapper.emitted('open-profile')).toEqual([['sam', 'Sam']]);
  });

  it('offers direct messages on the right swipe only for friends', async () => {
    const wrapper = mountPanel({ friends: [{ id: 'sam', name: 'Sam', email: '', isOnline: true }] });
    const samRow = wrapper.findAll('[data-swipeable-row]').find((row) => row.text().includes('Sam'))!;

    expect(samRow.find('[data-friend-icon]').exists()).toBe(true);
    expect(samRow.findAll('[data-swipe-pane="trailing"] button').map((button) => button.text())).toEqual(['Profile']);

    await samRow.get('[data-swipe-pane="leading"] button').trigger('click');
    expect(wrapper.emitted('chat-member')?.[0]?.[0]).toMatchObject({ id: 'sam' });
  });

  it('shows Remove from group only to group managers', () => {
    const admin = mountPanel({ info: { ...info, role: 'admin' }, group: { ...group, role: 'admin' } });
    const samRow = admin.findAll('[data-swipeable-row]').find((row) => row.text().includes('Sam'))!;

    expect(samRow.findAll('[data-swipe-pane="trailing"] button').map((button) => button.text())).toEqual([
      'Profile',
      'Add friend',
      'Remove',
    ]);
  });
});
