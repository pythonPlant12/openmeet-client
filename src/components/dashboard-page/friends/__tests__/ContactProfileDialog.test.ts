import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ContactProfileDialog from '@/components/dashboard-page/friends/ContactProfileDialog.vue';
import { playHaptic } from '@/services/haptics';

vi.mock('@/services/haptics', () => ({ playHaptic: vi.fn() }));

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
    expect(wrapper.get('[data-profile-avatar]').classes()).toEqual(
      expect.arrayContaining(['border-2', 'border-harbor-waveform']),
    );
    expect(wrapper.find('[data-online-indicator]').exists()).toBe(false);
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
    expect(wrapper.text()).not.toContain('Online');
    expect(wrapper.text()).toContain('“Building OpenMeet”');
    expect(wrapper.text()).toContain('alex@example.com');
    expect(wrapper.find('[aria-label="Profile actions"] [aria-label="Start a video call"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Profile actions"] [aria-label="Start an audio call"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Profile actions"] [aria-label="Remove friend"]').exists()).toBe(true);
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

    expect(wrapper.text()).not.toContain('Status shared with friends');
    expect(wrapper.text()).toContain('Shared with friends');
    expect(wrapper.text()).not.toContain('Appear offline');
    await wrapper.get('[data-add-friend]').trigger('click');
    expect(wrapper.emitted('add-friend')).toHaveLength(1);
  });

  it('offers accept or decline instead of Add friend for a pending requester profile', async () => {
    const request = {
      id: 'request-1',
      user: { id: 'person-1', name: 'Sam Lee', email: 'sam@example.com', isOnline: false },
      createdAt: '2026-08-17T12:00:00Z',
    };
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
        pendingRequest: request,
        loading: false,
        error: '',
        removingId: null,
        opening: null,
        respondingId: null,
        callActive: false,
        avatarUrls: {},
        avatarLoading: false,
        formatDate: () => '17 Aug 2026',
      },
      global: { stubs },
    });

    expect(wrapper.find('[data-add-friend]').exists()).toBe(false);
    await wrapper.get('[data-accept-friend-request]').trigger('click');
    await wrapper.get('[data-decline-friend-request]').trigger('click');
    expect(wrapper.emitted('accept-request')?.[0]).toEqual([request]);
    expect(wrapper.emitted('decline-request')?.[0]).toEqual([request]);
  });

  it('shows your own status on the avatar, without status chips', () => {
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
      global: { stubs },
    });

    expect(wrapper.find('[data-status-menu]').exists()).toBe(false);
    const indicator = wrapper.get('[data-online-indicator]');
    const avatar = indicator.element.previousElementSibling as HTMLElement;

    expect(avatar.classList).toContain('border-2');
    expect(avatar.classList).toContain('border-[#6B7BC4]');
    expect(indicator.classes()).toContain('border-[3px]');
    expect(indicator.classes()).toContain('border-harbor-surface');
    expect(indicator.classes()).toContain('bg-[#6B7BC4]');
    expect(indicator.classes()).toEqual(expect.arrayContaining(['bottom-0.5', 'right-0.5']));
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

  it('asks before removing a friend and removes them once confirmed', async () => {
    const friend = { id: 'friend-1', name: 'Alex Smith', email: 'alex@example.com', isOnline: true };
    const props = {
      open: true,
      confirmationOpen: false,
      profile: {
        id: 'friend-1',
        name: 'Alex Smith',
        nickname: 'alex',
        email: 'alex@example.com',
        avatarUrl: null,
        status: 'available' as const,
        statusMessage: '',
        createdAt: '2026-08-17T12:00:00Z',
        lastSeenAt: null,
        isOnline: true,
        relationship: 'friend' as const,
      },
      profileFriend: friend,
      loading: false,
      error: '',
      removingId: null,
      opening: null,
      callActive: false,
      avatarUrls: {},
      avatarLoading: false,
      formatDate: () => '17 Aug 2026',
    };
    const wrapper = mount(ContactProfileDialog, {
      props,
      global: { stubs },
    });

    await wrapper.get('[data-remove-friend]').trigger('click');
    expect(wrapper.emitted('update:confirmationOpen')?.[0]).toEqual([true]);
    expect(wrapper.emitted('remove')).toBeUndefined();

    await wrapper.setProps({ confirmationOpen: true });
    const confirmation = wrapper.get('[data-confirm-dialog-actions]');
    expect(wrapper.text()).toContain('Remove Alex Smith?');
    await confirmation
      .findAll('button')
      .find((button) => button.text().includes('Remove friend'))!
      .trigger('click');

    expect(wrapper.emitted('remove')).toHaveLength(1);
    expect(playHaptic).toHaveBeenCalledWith('warning');
  });
});
