import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

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
        { id: 'friend-1', name: 'Friend', role: 'member', joinedAt: '2026-08-17T12:00:00Z' },
        { id: 'member-1', name: 'Member', role: 'member', joinedAt: '2026-08-17T12:00:00Z' },
      ],
      friends: [{ id: 'friend-1', name: 'Friend', email: 'friend@example.com', isOnline: true }],
      avatarLoading: false,
      currentUserId: 'current-user',
      accessToken: 'token',
      mutationBusy: false,
      beginMutation: () => Symbol('group-1'),
      endMutation: () => undefined,
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
      },
    },
  });
}

describe('GroupInfoDialog', () => {
  it('only requests profiles for accepted friends', async () => {
    const wrapper = mountDialog();

    await wrapper.get('[title="Open profile"]').trigger('click');
    await wrapper.get('[title="Profile details are available to accepted friends only."]').trigger('click');

    expect(wrapper.emitted('profile')).toEqual([['friend-1', 'Friend']]);
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
