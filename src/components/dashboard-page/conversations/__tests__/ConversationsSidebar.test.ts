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
      badge: 0,
      groupAvatarUrls: {},
      isLoading: false,
      isRefreshing: false,
      searchOpen: false,
      unreadCount: (item: Conversation) => item.unreadCount,
      conversationName: () => 'Alex',
      conversationIdentifier: () => '@alex',
      directAvatarUrl: () => undefined,
      isDirectOnline: () => true,
      directStatus: () => 'available',
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
  it('shows conversations that need attention beside the title, also while collapsed', () => {
    expect(mountSidebar().find('[data-section-badge]').exists()).toBe(false);
    const badge = mountSidebar({ badge: 2, expanded: false }).get('h1 [data-section-badge]');
    expect(badge.text()).toBe('2');
  });

  it('keeps listed conversations mounted during a background refresh', () => {
    const wrapper = mountSidebar({ isRefreshing: true });

    expect(wrapper.find('[data-swipeable-row]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Loading conversations');
  });

  it('shows the loader only while there is nothing to list yet', () => {
    const wrapper = mountSidebar({ conversations: [], isLoading: true });

    expect(wrapper.text()).toContain('Loading conversations');
  });

  it('shows the online dot for direct conversations with an online participant', () => {
    const wrapper = mountSidebar();
    const dot = wrapper.get('[data-presence-dot]');
    const avatar = dot.element.previousElementSibling as HTMLElement;

    expect(avatar.classList).toContain('border-2');
    expect(avatar.classList).toContain('border-[#2DA58F]');
    expect(dot.classes()).toContain('border-[3px]');
    expect(dot.classes()).toContain('border-[#FBFCF8]');
    const offline = mountSidebar({ isDirectOnline: () => false });
    const offlineAvatar = offline.findAll('span').find((element) => element.classes().includes('size-10'))!
      .element as HTMLElement;

    expect(offlineAvatar.classList).toContain('border-2');
    expect(offlineAvatar.classList).toContain('border-[#B8C6C5]');
    expect(offline.find('[data-presence-dot]').exists()).toBe(false);
  });

  it('swipes left to Profile and Delete for direct chats, and Info only for group creators', async () => {
    const direct = mountSidebar();
    const labels = (wrapper: ReturnType<typeof mountSidebar>) =>
      wrapper.findAll('[data-swipe-pane="trailing"] button').map((button) => button.text());

    expect(labels(direct)).toEqual(['Profile', 'Delete']);
    await direct.get('[data-swipe-pane="trailing"] button').trigger('click');
    expect(direct.emitted('details')?.[0]?.[0]).toMatchObject({ id: 'conversation-1' });

    const creatorGroup = mountSidebar({
      conversations: [{ ...conversation, kind: 'group', title: 'Team', role: 'creator', otherUserId: null }],
    });
    expect(labels(creatorGroup)).toEqual(['Info']);
  });

  it('marks manually unread conversations without an unread count', () => {
    const wrapper = mountSidebar();

    expect(wrapper.find('[data-marked-unread]').exists()).toBe(true);
    expect(wrapper.get('[data-swipe-pane="leading"] button').attributes('aria-label')).toBe('Mark as read');
  });

  it('opens invited group info from its avatar card while keeping join explicit', async () => {
    const invitation = {
      id: 'invite-1',
      groupId: 'group-1',
      groupTitle: 'Harbor Crew',
      groupAvatarUrl: '/groups/harbor.jpg',
      accessPolicy: 'password' as const,
      inviterId: 'ada',
      inviterName: 'Ada',
      createdAt: '2026-10-11T12:00:00Z',
    };
    const wrapper = mountSidebar({
      groupInvitations: [invitation],
      groupAvatarUrls: { 'group-1': '/groups/harbor.jpg' },
    });
    const card = wrapper.get('[aria-label="View Harbor Crew group info"]');

    expect(card.get('img').attributes('src')).toBe('/groups/harbor.jpg');
    expect(card.find('[data-presence-dot]').exists()).toBe(false);
    await card.trigger('click');
    expect(wrapper.emitted('group-invitation-details')?.[0]).toEqual([invitation]);
    expect(wrapper.emitted('accept-group-invitation')).toBeUndefined();

    await wrapper.get('[aria-label="Join Harbor Crew"]').trigger('click');
    expect(wrapper.emitted('accept-group-invitation')?.[0]).toEqual([invitation]);
  });
});
