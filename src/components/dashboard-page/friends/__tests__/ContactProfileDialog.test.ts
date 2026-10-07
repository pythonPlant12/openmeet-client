import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ContactProfileDialog from '@/components/dashboard-page/friends/ContactProfileDialog.vue';

const stubs = {
  Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  HarborDialogContent: { template: '<div><slot /></div>' },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<div><slot /></div>' },
  DialogDescription: { template: '<div><slot /></div>' },
  DialogFooter: { template: '<div><slot /></div>' },
};

describe('ContactProfileDialog', () => {
  it('keeps the profile layout while live details load so the dialog does not jump', () => {
    const wrapper = mount(ContactProfileDialog, {
      props: {
        open: true,
        confirmationOpen: false,
        profile: {
          id: 'friend-1',
          name: 'Alex Smith',
          nickname: '',
          email: 'Profile details unavailable',
          avatarUrl: null,
          status: 'offline',
          statusMessage: '',
          createdAt: '',
          lastSeenAt: null,
          isOnline: false,
          relationship: 'friend',
        },
        profileFriend: null,
        loading: true,
        error: '',
        removingId: null,
        opening: null,
        callActive: false,
        avatarUrls: {},
        avatarLoading: false,
        formatDate: () => 'Unavailable',
      },
      global: { stubs },
    });

    expect(wrapper.text()).toContain('Profile info');
    expect(wrapper.text()).toContain('Alex Smith');
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true);
    expect(wrapper.get('.invisible').text()).toContain('@nickname');
  });

  it('presents friends like Group info: status, friend badge, quote, and details', () => {
    const wrapper = mount(ContactProfileDialog, {
      props: {
        open: true,
        confirmationOpen: false,
        profile: {
          id: 'friend-1',
          name: 'Alex Smith',
          nickname: 'alex',
          email: 'alex@example.com',
          avatarUrl: null,
          status: 'available',
          statusMessage: 'Building OpenMeet',
          createdAt: '2026-08-17T12:00:00Z',
          lastSeenAt: null,
          isOnline: true,
          relationship: 'friend',
        },
        profileFriend: { id: 'friend-1', name: 'Alex Smith', email: 'alex@example.com', isOnline: true },
        loading: false,
        error: '',
        removingId: null,
        opening: null,
        callActive: false,
        avatarUrls: {},
        avatarLoading: false,
        formatDate: () => '17 Aug 2026',
      },
      global: { stubs },
    });

    expect(wrapper.find('[data-online-indicator]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Online');
    expect(wrapper.text()).toContain('Friend');
    expect(wrapper.text()).toContain('“Building OpenMeet”');
    expect(wrapper.text()).toContain('alex@example.com');
    expect(wrapper.find('[aria-label="Profile actions"]').text()).toContain('Start direct call');
  });

  it('shows only public details and an Add friend action to people who are not friends', async () => {
    const wrapper = mount(ContactProfileDialog, {
      props: {
        open: true,
        confirmationOpen: false,
        profile: {
          id: 'person-1',
          name: 'Sam Lee',
          nickname: 'sam',
          email: '',
          avatarUrl: null,
          status: 'offline',
          statusMessage: '',
          createdAt: '2026-08-17T12:00:00Z',
          lastSeenAt: null,
          isOnline: false,
          relationship: 'none',
        },
        profileFriend: null,
        loading: false,
        error: '',
        removingId: null,
        opening: null,
        callActive: false,
        avatarUrls: {},
        avatarLoading: false,
        formatDate: () => '17 Aug 2026',
      },
      global: { stubs },
    });

    expect(wrapper.text()).toContain('Status shared with friends');
    expect(wrapper.text()).toContain('Shared with friends');
    expect(wrapper.text()).not.toContain('Appear offline');
    await wrapper.get('[data-add-friend]').trigger('click');
    expect(wrapper.emitted('add-friend')).toHaveLength(1);
  });

  it('lets people change their own status from their profile', () => {
    const wrapper = mount(ContactProfileDialog, {
      props: {
        open: true,
        confirmationOpen: false,
        profile: {
          id: 'me',
          name: 'Me',
          nickname: 'me',
          email: 'me@example.com',
          avatarUrl: null,
          status: 'sleeping',
          statusMessage: '',
          createdAt: '2026-08-17T12:00:00Z',
          lastSeenAt: null,
          isOnline: true,
          relationship: 'owner',
        },
        profileFriend: null,
        loading: false,
        error: '',
        removingId: null,
        opening: null,
        callActive: false,
        avatarUrls: {},
        avatarLoading: false,
        formatDate: () => '17 Aug 2026',
      },
      global: {
        stubs: {
          ...stubs,
          DropdownMenu: { template: '<div><slot /></div>' },
          DropdownMenuTrigger: { template: '<div><slot /></div>' },
          DropdownMenuContent: { template: '<div><slot /></div>' },
          DropdownMenuItem: { template: '<button @click="$emit(\'select\')"><slot /></button>' },
        },
      },
    });

    expect(wrapper.get('[data-status-menu]').text()).toContain('Sleeping');
    expect(wrapper.get('[data-online-indicator]').classes()).toContain('bg-[#6B7BC4]');
  });

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
          relationship: 'friend',
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
      global: { stubs },
    });

    await wrapper.get('button[aria-label="View Alex Smith\'s profile picture"]').trigger('click');

    expect(wrapper.findAll('img')).toHaveLength(2);
  });
});
