import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ChatPane from '@/components/dashboard-page/chat/ChatPane.vue';
import type { Conversation, ConversationMessage } from '@/services/social-api';

const conversation: Conversation = {
  id: 'conversation-1',
  kind: 'direct',
  title: null,
  accessPolicy: null,
  groupCode: null,
  avatarUrl: null,
  role: null,
  otherUserId: 'friend-1',
  messageCount: 1,
  unreadCount: 0,
  markedUnread: false,
  createdAt: '2026-10-02T12:00:00Z',
  updatedAt: '2026-10-02T12:00:00Z',
};

const message: ConversationMessage = {
  sequence: 1,
  conversationId: conversation.id,
  senderId: 'friend-1',
  senderName: 'Friend',
  senderNickname: 'friend',
  content: 'Hello',
  createdAt: '2026-10-02T12:00:00Z',
};

enableAutoUnmount(afterEach);

function mountPane(props: Record<string, unknown> = {}) {
  return mount(ChatPane, {
    props: {
      content: '',
      conversation: null,
      pendingFriend: null,
      selectedFriend: null,
      selectedTitle: 'Conversation',
      selectedIsGroup: false,
      friendAvatarUrls: {},
      isFriendAvatarLoading: () => false,
      isGroupAvatarLoading: () => false,
      messages: [],
      loading: false,
      loadingOlder: false,
      sending: false,
      callActive: false,
      notificationWarning: false,
      canRequestNotificationPermission: false,
      isDesktop: false,
      prefersReducedMotion: true,
      isDraft: false,
      shouldAnimate: () => false,
      isLocal: () => false,
      formatTime: () => '12:00 PM',
      ...props,
    },
    global: {
      stubs: {
        Button: { template: '<button><slot /></button>' },
        EmojiPickerButton: { template: '<div />' },
        LoadingRipple: { template: '<span data-loading />' },
      },
    },
  });
}

describe('ChatPane', () => {
  it('does not mount the empty conversation state on mobile', () => {
    expect(mountPane().text()).not.toContain('Choose a conversation');
  });

  it('lets the blocked-notifications notice be dismissed', async () => {
    const wrapper = mountPane({ conversation, messages: [message], notificationWarning: true });

    expect(wrapper.text()).toContain('Notifications are blocked');
    await wrapper.get('[aria-label="Dismiss notification notice"]').trigger('click');

    expect(wrapper.emitted('dismiss-notifications')).toHaveLength(1);
  });

  it('keeps rendered history visible during a message refresh', () => {
    const wrapper = mountPane({ conversation, loading: true, messages: [message] });

    expect(wrapper.text()).toContain('Hello');
    expect(wrapper.find('[data-loading]').exists()).toBe(false);
  });

  it('shows remote sender nicknames', () => {
    const wrapper = mountPane({ conversation, messages: [message] });

    expect(wrapper.text()).toContain('@friend');
  });

  it('smoothly scrolls to the newest message when requested', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const wrapper = mountPane({ conversation, messages: [message], prefersReducedMotion: false });
    const history = wrapper.get('[aria-label="Message history"]').element as HTMLElement;
    Object.defineProperty(history, 'scrollHeight', { configurable: true, value: 640 });
    history.scrollTo = vi.fn();

    (wrapper.vm as unknown as { scrollToBottom: (behavior: ScrollBehavior) => void }).scrollToBottom('smooth');
    await wrapper.vm.$nextTick();

    expect(history.scrollTo).toHaveBeenCalledWith({ top: 640, behavior: 'smooth' });
  });

  it('scrolls to newest message after the history pane mounts', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const wrapper = mountPane({ messages: [message], prefersReducedMotion: false });
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 640 });
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo });

    (wrapper.vm as unknown as { scrollToBottom: (behavior: ScrollBehavior) => void }).scrollToBottom('auto');
    await wrapper.setProps({ conversation });
    await wrapper.vm.$nextTick();

    expect(scrollTo).toHaveBeenCalledWith({ top: 640, behavior: 'auto' });
  });

  it('keeps the visible message anchored when older history is prepended', () => {
    const wrapper = mountPane({ conversation, messages: [message] });
    const history = wrapper.get('[aria-label="Message history"]').element as HTMLElement;
    Object.defineProperty(history, 'scrollHeight', { configurable: true, value: 640 });
    Object.defineProperty(history, 'scrollTop', { configurable: true, value: 120, writable: true });
    const pane = wrapper.vm as unknown as {
      getScrollState: () => { height: number; top: number };
      restoreScroll: (state: { height: number; top: number }) => void;
    };
    const scrollState = pane.getScrollState();
    Object.defineProperty(history, 'scrollHeight', { configurable: true, value: 920 });

    pane.restoreScroll(scrollState);

    expect(history.scrollTop).toBe(400);
  });
});
