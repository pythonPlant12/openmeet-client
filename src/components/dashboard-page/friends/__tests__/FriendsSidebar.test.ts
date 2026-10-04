import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import FriendsSidebar from '@/components/dashboard-page/friends/FriendsSidebar.vue';

function mountSidebar(props: Record<string, unknown> = {}) {
  return mount(FriendsSidebar, {
    props: {
      query: 'sam',
      activeContextMenuId: null,
      expanded: true,
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
      ...props,
    },
    global: { stubs: { LoadingRipple: { template: '<span />' } } },
  });
}

describe('FriendsSidebar', () => {
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

  it('shows a friendly empty state that opens people search', async () => {
    const wrapper = mountSidebar({ query: '', results: [], peopleSearchActive: false, searchOpen: false });

    expect(wrapper.get('[data-friends-empty]').text()).toContain('No friends yet');
    await wrapper.get('[data-friends-empty] button').trigger('click');
    expect(wrapper.emitted('update:searchOpen')).toEqual([[true]]);
  });
});
