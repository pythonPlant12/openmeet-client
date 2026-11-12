import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FriendsSidebar from '@/components/dashboard-page/friends/FriendsSidebar.vue';
import { playHaptic } from '@/services/haptics';
import type { Conversation } from '@/services/social-api';

function group(id: string, title: string, groupCode: string) {
  return { id, kind: 'group', title, groupCode, role: 'member' } as Conversation;
}

vi.mock('@/services/haptics', () => ({ playHaptic: vi.fn() }));

const groups = [group('g1', 'Design team', 'AbC123'), group('g2', 'Climbing', 'XyZ789')];

function mountSidebar(props: Record<string, unknown> = {}) {
  return mount(FriendsSidebar, {
    props: {
      query: 'sam',
      activeContextMenuId: null,
      expanded: true,
      badge: 0,
      friendAvatarUrls: {},
      isAvatarLoading: () => false,
      friends: [],
      incomingRequests: [],
      isAdding: false,
      isLoading: false,
      isOpening: null,
      isRefreshing: false,
      isResponding: null,
      isSearching: false,
      peopleSearchActive: true,
      results: [{ id: 'sam', name: 'Sam Lee', nickname: 'sam_lee', avatarUrl: null }],
      resultAvatarUrls: {},
      searchOpen: true,
      contextMenuKey: (id: string) => id,
      groups,
      groupAvatarUrls: {},
      isGroupAvatarLoading: () => false,
      ...props,
    },
    global: { stubs: { LoadingRipple: { template: '<span />' } } },
  });
}

// motion-v watches visibility for its animations; jsdom has no IntersectionObserver.
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => vi.clearAllMocks());

describe('FriendsSidebar', () => {
  it('shows incoming friend requests beside the title, also while collapsed', () => {
    expect(mountSidebar().find('[data-section-badge]').exists()).toBe(false);
    const badge = mountSidebar({ badge: 1, expanded: false }).get('#friends-heading [data-section-badge]');
    expect(badge.attributes('aria-label')).toBe('1 friend request');
  });

  it('shows new people by nickname and opens their profile on click', async () => {
    const wrapper = mountSidebar();
    const result = wrapper.get('[data-people-result]');

    expect(result.text()).toContain('@sam_lee');
    expect(result.text()).not.toContain('@example.com');

    await result.get('[aria-label="View Sam Lee\'s profile"]').trigger('click');
    expect(wrapper.emitted('open-result')?.[0]?.[0]).toMatchObject({ id: 'sam' });
  });

  it('marks friends in search results with an icon instead of a text tag', () => {
    const wrapper = mountSidebar({
      friends: [{ id: 'ada', name: 'Ada', nickname: 'ada', email: 'ada@example.com', isOnline: false }],
      results: [],
    });

    expect(wrapper.find('[data-friend-icon]').attributes('aria-label')).toBe('Friend');
    expect(wrapper.text()).toContain('@ada');
    expect(wrapper.text()).not.toContain('ada@example.com');
  });

  it('frames friend avatars by status while showing dots only for online friends', () => {
    const wrapper = mountSidebar({
      query: '',
      peopleSearchActive: false,
      searchOpen: false,
      results: [],
      friends: [
        { id: 'ada', name: 'Ada', nickname: 'ada', email: 'ada@example.com', isOnline: true, status: 'sleeping' },
        { id: 'sam', name: 'Sam', nickname: 'sam', email: 'sam@example.com', isOnline: false, status: 'offline' },
      ],
    });
    const [onlineRow, offlineRow] = wrapper.findAll('[data-swipeable-row]');
    const dot = onlineRow!.get('[data-presence-dot]');
    const avatar = dot.element.previousElementSibling as HTMLElement;

    expect(avatar.classList).toContain('border-2');
    expect(avatar.classList).toContain('border-[#6B7BC4]');
    expect(dot.classes()).toContain('border-[3px]');
    expect(dot.classes()).toContain('border-harbor-surface');
    const offlineAvatar = offlineRow!.get('[data-friend-avatar]').element as HTMLElement;

    expect(offlineAvatar.classList).toContain('border-2');
    expect(offlineAvatar.classList).toContain('border-harbor-waveform');
    expect(offlineRow!.find('[data-presence-dot]').exists()).toBe(false);
  });

  it('shows requester avatars and opens their profile without accepting the request', async () => {
    const wrapper = mountSidebar({
      query: '',
      peopleSearchActive: false,
      searchOpen: false,
      results: [],
      friendAvatarUrls: { requester: '/avatars/requester.jpg' },
      incomingRequests: [
        {
          id: 'request-1',
          user: {
            id: 'requester',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            avatarUrl: '/avatars/requester.jpg',
            isOnline: true,
            status: 'away',
          },
          createdAt: '2026-10-11T12:00:00Z',
        },
      ],
    });
    const card = wrapper.get('[aria-label="View Ada Lovelace\'s profile"]');
    const avatar = card.get('img').element.parentElement as HTMLElement;

    expect(card.get('img').attributes('src')).toBe('/avatars/requester.jpg');
    expect(avatar.classList).toContain('border-[#D9A441]');
    expect(card.find('[data-presence-dot]').exists()).toBe(true);

    await card.trigger('click');
    expect(wrapper.emitted('profile')?.[0]?.[0]).toMatchObject({ id: 'requester' });
    expect(wrapper.emitted('respond')).toBeUndefined();
  });

  it('shows a friendly empty state that opens people search', async () => {
    const wrapper = mountSidebar({ query: '', results: [], peopleSearchActive: false, searchOpen: false });

    expect(wrapper.get('[data-friends-empty]').text()).toContain('No friends yet');
    await wrapper.get('[data-friends-empty] button').trigger('click');
    expect(wrapper.emitted('update:searchOpen')).toEqual([[true]]);
  });

  it('shows one white switch to groups and the friends search', () => {
    const wrapper = mountSidebar({ query: '' });
    expect(wrapper.find('[data-tone="accent"]').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="Show groups"]').exists()).toBe(true);
    expect(wrapper.get('input').attributes('placeholder')).toBe('Search friends');
  });

  it('switches to the groups view with its own search and Create group', async () => {
    const wrapper = mountSidebar({ query: '' });
    await wrapper.get('button[aria-label="Show groups"]').trigger('click');
    expect(wrapper.get('h1').text()).toContain('Groups');
    expect(wrapper.get('input').attributes('placeholder')).toBe('Search groups');
    expect(wrapper.findAll('[data-group-row]').map((row) => row.text())).toEqual([
      expect.stringContaining('Design team'),
      expect.stringContaining('Climbing'),
    ]);
    await wrapper.get('[data-create-group]').trigger('click');
    expect(wrapper.emitted('create-group')).toHaveLength(1);
  });

  it('searches groups by name or group ID without touching the friends query', async () => {
    const wrapper = mountSidebar({ query: '' });
    await wrapper.get('button[aria-label="Show groups"]').trigger('click');
    await wrapper.get('input').setValue('xyz7');
    expect(wrapper.findAll('[data-group-row]').map((row) => row.text())).toEqual([expect.stringContaining('Climbing')]);
    await wrapper.get('input').setValue('design');
    expect(wrapper.findAll('[data-group-row]').map((row) => row.text())).toEqual([
      expect.stringContaining('Design team'),
    ]);
    expect(wrapper.emitted('update:query')).toBeUndefined();
  });

  it('opens a group from the groups view and switches back to friends', async () => {
    const wrapper = mountSidebar({ query: '' });
    await wrapper.get('button[aria-label="Show groups"]').trigger('click');
    await wrapper.get('[data-group-row]').trigger('click');
    expect(wrapper.emitted('open-group')).toEqual([[groups[0]]]);
    await wrapper.get('button[aria-label="Show friends"]').trigger('click');
    expect(wrapper.get('h1').text()).toContain('Friends');
  });

  it('plays one selection haptic for each change from the view switch', async () => {
    const wrapper = mountSidebar({ query: '' });

    await wrapper.get('button[aria-label="Show groups"]').trigger('click');
    expect(playHaptic).toHaveBeenCalledTimes(1);
    expect(playHaptic).toHaveBeenLastCalledWith('selection');

    await wrapper.get('button[aria-label="Show friends"]').trigger('click');
    expect(playHaptic).toHaveBeenCalledTimes(2);
    expect(playHaptic).toHaveBeenLastCalledWith('selection');
  });
});
