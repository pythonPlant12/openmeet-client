import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import GroupInfoDialog from '@/components/dashboard-page/groups/GroupInfoDialog.vue';

const groupInfo = {
  id: 'group-1',
  title: 'Harbor',
  groupCode: '2aIFX0J6L4w7Y9KzQp8VrN',
  avatarUrl: null,
  accessPolicy: 'password' as const,
  createdAt: '2026-08-17T12:00:00Z',
  memberCount: 3,
  isMember: true,
  role: 'member',
  canJoin: false,
};

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(GroupInfoDialog, {
    props: {
      open: true,
      loading: false,
      error: '',
      info: groupInfo,
      members: [
        {
          id: 'friend-1',
          name: 'Friend',
          nickname: 'friend_1',
          avatarUrl: null,
          isOnline: false,
          status: null,
          role: 'member',
          joinedAt: '2026-08-17T12:00:00Z',
        },
        {
          id: 'member-1',
          name: 'Member',
          nickname: 'member_1',
          avatarUrl: '/social/users/member-1/avatar',
          isOnline: false,
          status: null,
          role: 'member',
          joinedAt: '2026-08-17T12:00:00Z',
        },
      ],
      memberAvatarUrls: {},
      membersHasMore: false,
      membersLoadingMore: false,
      friends: [{ id: 'friend-1', name: 'Friend', email: 'friend@example.com', isOnline: true }],
      avatarLoading: false,
      currentUserId: 'current-user',
      accessToken: 'token',
      mutationBusy: false,
      beginMutation: () => Symbol('group-1'),
      endMutation: () => undefined,
      changeFriendship: vi.fn().mockResolvedValue(true),
      accessLabel: () => 'Password protected',
      formatDate: () => '17 Aug 2026',
      ...props,
    },
    global: {
      stubs: {
        Dialog: { template: '<div><slot /></div>' },
        HarborDialogContent: { template: '<div><slot /></div>' },
        DialogHeader: { template: '<div><slot /></div>' },
        DialogTitle: { template: '<div><slot /></div>' },
        DialogDescription: { template: '<div><slot /></div>' },
        LoadingRipple: { template: '<span data-loading />' },
      },
    },
  });
}

describe('GroupInfoDialog', () => {
  it('swipes right to message friends only, and left to profile plus the friend action', async () => {
    const wrapper = mountDialog({
      members: [
        {
          id: 'friend-1',
          name: 'Friend',
          nickname: 'friend_1',
          avatarUrl: null,
          isOnline: false,
          status: null,
          role: 'member',
          joinedAt: '',
        },
        {
          id: 'member-1',
          name: 'Member',
          nickname: 'member_1',
          avatarUrl: null,
          isOnline: false,
          status: null,
          role: 'member',
          joinedAt: '',
        },
        {
          id: 'current-user',
          name: 'Me',
          nickname: 'me',
          avatarUrl: null,
          isOnline: false,
          status: null,
          role: 'creator',
          joinedAt: '',
        },
      ],
    });
    const [friendRow, memberRow, selfRow] = wrapper.findAll('[data-swipeable-row]');
    const trailingLabels = (row: typeof friendRow) =>
      row!.findAll('[data-swipe-pane="trailing"] button').map((button) => button.text());

    expect(friendRow!.get('[data-swipe-pane="leading"]').text()).toBe('Message');
    expect(memberRow!.find('[data-swipe-pane="leading"]').exists()).toBe(false);
    expect(selfRow!.find('[data-swipe-pane="leading"]').exists()).toBe(false);
    expect(trailingLabels(friendRow)).toEqual(['Profile', 'Remove friend']);
    expect(trailingLabels(memberRow)).toEqual(['Profile', 'Add friend']);
    expect(trailingLabels(selfRow)).toEqual(['Profile']);

    await friendRow!.get('[data-swipe-pane="leading"] button').trigger('click');
    expect(wrapper.emitted('chat-member')?.[0]?.[0]).toMatchObject({ id: 'friend-1' });

    await memberRow!.get('[data-swipe-pane="trailing"] button').trigger('click');
    const profileEvents = wrapper.emitted('profile') ?? [];
    expect(profileEvents[profileEvents.length - 1]).toEqual(['member-1', 'Member']);
  });

  it('confirms before changing a friendship', async () => {
    const changeFriendship = vi.fn().mockResolvedValue(true);
    const wrapper = mountDialog({ changeFriendship });
    const [friendRow] = wrapper.findAll('[data-swipeable-row]');

    await friendRow!.findAll('[data-swipe-pane="trailing"] button')[1]!.trigger('click');
    expect(changeFriendship).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Remove Friend from your friends?');

    await wrapper.get('[data-confirm-friend-change]').trigger('click');
    expect(changeFriendship).toHaveBeenCalledWith(expect.objectContaining({ id: 'friend-1' }), 'remove');
  });

  it('offers the security action only to group managers', async () => {
    expect(mountDialog().find('[data-group-security]').exists()).toBe(false);

    const admin = mountDialog({ info: { ...groupInfo, role: 'admin' } });
    await admin.get('[data-group-security]').trigger('click');

    expect(admin.emitted('group-settings')).toHaveLength(1);
  });

  it('shows the online dot only for participants reported online', () => {
    const wrapper = mountDialog({
      members: [
        {
          id: 'friend-1',
          name: 'Friend',
          nickname: 'friend_1',
          avatarUrl: null,
          isOnline: true,
          status: null,
          role: 'member',
          joinedAt: '',
        },
        {
          id: 'member-1',
          name: 'Member',
          nickname: 'member_1',
          avatarUrl: null,
          isOnline: false,
          status: null,
          role: 'member',
          joinedAt: '',
        },
      ],
    });
    const [onlineRow, offlineRow] = wrapper.findAll('[data-swipeable-row]');

    expect(onlineRow!.find('[data-presence-dot]').exists()).toBe(true);
    expect(offlineRow!.find('[data-presence-dot]').exists()).toBe(false);
  });

  it('marks only participants who are accepted friends', () => {
    const wrapper = mountDialog({
      members: [
        {
          id: 'friend-1',
          name: 'Friend',
          nickname: 'friend_1',
          avatarUrl: null,
          isOnline: false,
          status: null,
          role: 'member',
          joinedAt: '2026-08-17T12:00:00Z',
        },
        {
          id: 'member-1',
          name: 'Member',
          nickname: 'member_1',
          avatarUrl: null,
          isOnline: false,
          status: null,
          role: 'member',
          joinedAt: '2026-08-17T12:00:00Z',
        },
        {
          id: 'current-user',
          name: 'Me',
          nickname: 'me',
          avatarUrl: null,
          isOnline: false,
          status: null,
          role: 'creator',
          joinedAt: '2026-08-17T12:00:00Z',
        },
      ],
      friends: [
        { id: 'friend-1', name: 'Friend', email: 'friend@example.com', isOnline: true },
        { id: 'current-user', name: 'Me', email: 'me@example.com', isOnline: true },
      ],
    });

    const badges = wrapper.findAll('[data-friend-badge]');
    expect(badges).toHaveLength(1);
    expect(badges[0]!.element.closest('button')?.textContent).toContain('Friend');
    expect(badges[0]!.attributes('aria-label')).toBe('Your friend');
  });

  it('opens every participant profile, including people who are not friends yet', async () => {
    const wrapper = mountDialog();
    const [friendRow, memberRow] = wrapper.findAll('[title="Open profile"]');

    await friendRow!.trigger('click');
    await memberRow!.trigger('click');

    expect(wrapper.emitted('profile')).toEqual([
      ['friend-1', 'Friend'],
      ['member-1', 'Member'],
    ]);
  });

  it('only offers icon changes to group managers', () => {
    expect(mountDialog().find('[aria-label="Manage Harbor group icon"]').exists()).toBe(false);

    expect(
      mountDialog({ info: { ...groupInfo, role: 'admin' } })
        .find('[aria-label="Manage Harbor group icon"]')
        .exists(),
    ).toBe(true);
  });
});
