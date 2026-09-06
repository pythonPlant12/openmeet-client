import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import DashboardFriendsPanel from '@/components/dashboard-page/DashboardFriendsPanel.vue';
import type { Friend, FriendRequest } from '@/services/social-api';

const friends: Friend[] = Array.from({ length: 7 }, (_, index) => ({
  id: `friend-${index + 1}`,
  name: `Friend ${index + 1}`,
  email: `friend-${index + 1}@example.com`,
  isOnline: index % 2 === 0,
}));

const incomingRequests: FriendRequest[] = [
  {
    id: 'request-1',
    user: friends[0]!,
    createdAt: '2026-08-12T12:00:00Z',
  },
];

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  messages: {
    en: {
      dashboard: {
        acceptRequest: 'Accept friend request',
        addFriend: 'Add a friend',
        callFriend: 'Call {name}',
        declineRequest: 'Decline friend request',
        friendEmailPlaceholder: "friend{'@'}example.com",
        friendRequests: 'Friend requests',
        friends: 'Friends',
        noFriendSearchResults: 'No friends match your search.',
        offline: 'Offline',
        online: 'Online now',
        onlineCount: '{count} online',
        people: 'Your circle',
        searchFriends: 'Search friends',
        sendFriendRequest: 'Send friend request',
        showAllFriends: 'Show all friends',
        showLess: 'Show less',
        yourFriends: 'Your friends',
      },
    },
  },
});

enableAutoUnmount(afterEach);

function mountPanel(props: Partial<InstanceType<typeof DashboardFriendsPanel>['$props']> = {}) {
  return mount(DashboardFriendsPanel, {
    props: {
      friendEmail: '',
      friends,
      incomingRequests: [],
      isLoading: false,
      isAddingFriend: false,
      callingFriendId: null,
      onlineFriends: 4,
      desktop: false,
      prefersReducedMotion: true,
      entranceInitial: false,
      ...props,
    },
    global: { plugins: [i18n] },
  });
}

function callButtons(wrapper: ReturnType<typeof mountPanel>) {
  return wrapper.findAll('button').filter((button) => button.attributes('aria-label')?.startsWith('Call '));
}

describe('DashboardFriendsPanel', () => {
  it('limits mobile friends and expands or collapses the accessible list', async () => {
    const wrapper = mountPanel();

    expect(callButtons(wrapper)).toHaveLength(5);
    expect(wrapper.get('button[aria-controls="dashboard-friend-list"]').attributes('aria-expanded')).toBe('false');

    await wrapper.get('button[aria-controls="dashboard-friend-list"]').trigger('click');
    expect(callButtons(wrapper)).toHaveLength(7);
    expect(wrapper.get('button[aria-controls="dashboard-friend-list"]').attributes('aria-expanded')).toBe('true');

    await wrapper.get('button[aria-controls="dashboard-friend-list"]').trigger('click');
    expect(callButtons(wrapper)).toHaveLength(5);
  });

  it('searches names and emails without case or surrounding whitespace', async () => {
    const wrapper = mountPanel();
    const search = wrapper.get('input[aria-label="Search friends"]');

    await search.setValue(' FRIEND-7@EXAMPLE.COM ');
    expect(callButtons(wrapper)).toHaveLength(1);
    expect(wrapper.text()).toContain('Friend 7');
    expect(wrapper.find('button[aria-controls="dashboard-friend-list"]').exists()).toBe(false);

    await search.setValue('missing');
    expect(callButtons(wrapper)).toHaveLength(0);
    expect(wrapper.text()).toContain('No friends match your search.');
  });

  it('shows every friend without an expansion control on desktop', () => {
    const wrapper = mountPanel({ desktop: true });

    expect(callButtons(wrapper)).toHaveLength(7);
    expect(wrapper.find('button[aria-controls="dashboard-friend-list"]').exists()).toBe(false);
  });

  it('emits its model and friend actions for parent orchestration', async () => {
    const wrapper = mountPanel({ friendEmail: 'new@example.com', incomingRequests });

    await wrapper.get('input[type="email"]').setValue('updated@example.com');
    expect(wrapper.emitted('update:friendEmail')).toEqual([['updated@example.com']]);
    expect(wrapper.emitted('clear-feedback')).toHaveLength(1);

    await wrapper.get('form').trigger('submit');
    await wrapper.get('button[aria-label="Accept friend request"]').trigger('click');
    await wrapper.get('button[aria-label="Decline friend request"]').trigger('click');
    await wrapper.get('button[aria-label="Call Friend 1"]').trigger('click');

    expect(wrapper.emitted('add-friend')).toHaveLength(1);
    expect(wrapper.emitted('answer-friend-request')).toEqual([
      ['request-1', true],
      ['request-1', false],
    ]);
    expect(wrapper.emitted('call-friend')).toEqual([[friends[0]]]);
  });
});
