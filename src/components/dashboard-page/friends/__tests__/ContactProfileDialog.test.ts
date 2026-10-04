import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ContactProfileDialog from '@/components/dashboard-page/friends/ContactProfileDialog.vue';

describe('ContactProfileDialog', () => {
  it('opens an image-only profile picture preview', async () => {
    const wrapper = mount(ContactProfileDialog, {
      props: {
        open: true,
        confirmationOpen: false,
        profile: {
          id: 'friend-1',
          name: 'Alex Smith',
          nickname: 'alex',
          email: 'alex@example.com',
          avatarUrl: '/avatars/alex.jpg',
          status: 'available',
          statusMessage: 'Available',
          createdAt: '2026-08-17T12:00:00Z',
          lastSeenAt: null,
          isOnline: true,
        },
        profileFriend: null,
        loading: false,
        error: '',
        removingId: null,
        opening: null,
        callActive: false,
        avatarUrls: { 'friend-1': '/avatars/alex.jpg' },
        avatarLoading: false,
        formatDate: () => '17 Aug 2026',
      },
      global: {
        stubs: {
          Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
          HarborDialogContent: { template: '<div><slot /></div>' },
          DialogHeader: { template: '<div><slot /></div>' },
          DialogTitle: { template: '<div><slot /></div>' },
          DialogDescription: { template: '<div><slot /></div>' },
          DialogFooter: { template: '<div><slot /></div>' },
        },
      },
    });

    await wrapper.get('button[aria-label="View Alex Smith\'s profile picture"]').trigger('click');

    expect(wrapper.findAll('img')).toHaveLength(2);
  });
});
