import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ConversationsSidebar from '@/components/dashboard-page/conversations/ConversationsSidebar.vue';
import type { Conversation } from '@/services/social-api';

const conversation: Conversation = {
  id: 'conversation-1',
  kind: 'direct',
  title: null,
  accessPolicy: null,
  groupCode: null,
  avatarUrl: null,
  role: null,
  otherUserId: 'friend-1',
  messageCount: 3,
  unreadCount: 0,
  markedUnread: true,
  createdAt: '2026-10-04T12:00:00Z',
  updatedAt: '2026-10-04T12:00:00Z',
};

function mountSidebar(props: Record<string, unknown> = {}) {
  return mount(ConversationsSidebar, {
    props: {
      query: '',
      activeContextMenuId: null,
      conversations: [conversation],
      directRequests: [],
      groupInvitations: [],
      expanded: true,
      groupAvatarUrls: {},
      isLoading: false,
      isRefreshing: false,
      searchOpen: false,
      unreadCount: (item: Conversation) => item.unreadCount,
      conversationName: () => 'Alex',
      conversationIdentifier: () => '@alex',
      directAvatarUrl: () => undefined,
      isFriendAvatarLoading: () => false,
      isGroupAvatarLoading: () => false,
      directInitials: () => 'A',
      contextMenuKey: (id: string) => id,
      ...props,
    },
    global: { stubs: { LoadingRipple: { template: '<span data-loading />' } } },
  });
}

describe('ConversationsSidebar', () => {
  it('keeps listed conversations mounted during a background refresh', () => {
    const wrapper = mountSidebar({ isRefreshing: true });

    expect(wrapper.find('[data-swipeable-row]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Loading conversations');
  });

  it('shows the loader only while there is nothing to list yet', () => {
    const wrapper = mountSidebar({ conversations: [], isLoading: true });

    expect(wrapper.text()).toContain('Loading conversations');
  });

  it('marks manually unread conversations without an unread count', () => {
    const wrapper = mountSidebar();

    expect(wrapper.find('[data-marked-unread]').exists()).toBe(true);
    expect(wrapper.get('[data-swipe-pane="leading"] button').attributes('aria-label')).toBe('Mark as read');
  });
});
