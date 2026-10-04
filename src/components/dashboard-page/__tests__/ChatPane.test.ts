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

function mountPane(props: Record<string, unknown> = {}, options: { attachTo?: Element } = {}) {
  return mount(ChatPane, {
    ...options,
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

const reply: ConversationMessage = {
  ...message,
  sequence: 2,
  senderId: 'me',
  senderName: 'Me',
  content: 'Hi back',
  replyTo: { sequence: 1, senderId: 'friend-1', senderName: 'Friend', senderNickname: 'friend', content: 'Hello' },
  reactions: [{ emoji: '👍', count: 2, reactedByMe: true }],
};

describe('ChatPane', () => {
  it('quotes a message in the composer and cancels the reply', async () => {
    const wrapper = mountPane({ conversation, messages: [message] });

    await wrapper.findComponent({ name: 'ChatMessage' }).vm.$emit('reply');
    expect(wrapper.emitted('update:replyTo')?.[0]?.[0]).toMatchObject({ sequence: 1 });

    await wrapper.setProps({ replyTo: message });
    expect(wrapper.get('[data-reply-preview]').text()).toContain('Replying to Friend');

    await wrapper.get('[aria-label="Cancel reply"]').trigger('click');
    const replyUpdates = wrapper.emitted('update:replyTo') ?? [];
    expect(replyUpdates[replyUpdates.length - 1]).toEqual([null]);
  });

  it('shows quotes and reaction chips, and forwards reaction toggles', async () => {
    const wrapper = mountPane({
      conversation,
      messages: [message, reply],
      isLocal: (item: ConversationMessage) => item.senderId === 'me',
    });

    expect(wrapper.get('[data-message-quote]').text()).toContain('Hello');
    await wrapper.get('[data-reaction-chip]').trigger('click');

    expect(wrapper.emitted('react')?.[0]).toEqual([reply, '👍']);
  });

  it('lifts the selected message and draws quotes without a coloured edge', async () => {
    const wrapper = mountPane({ conversation, messages: [message, reply] });
    const [first] = wrapper.findAllComponents({ name: 'ChatMessage' });

    expect(
      wrapper
        .get('[data-message-quote]')
        .classes()
        .some((name) => name.startsWith('border-l')),
    ).toBe(false);
    expect(wrapper.findAll('[data-message-bubble]')[0]!.classes()).toContain('harbor-message-resting');

    await first!.vm.$emit('open-reactions');
    expect(wrapper.findAll('[data-message-bubble]')[0]!.classes()).toContain('harbor-message-lifted');
  });

  it('opens one reaction picker at a time and closes it on an outside press', async () => {
    const wrapper = mountPane({ conversation, messages: [message, reply] }, { attachTo: document.body });
    const [first, second] = wrapper.findAllComponents({ name: 'ChatMessage' });

    await first!.vm.$emit('open-reactions');
    await second!.vm.$emit('open-reactions');
    expect(wrapper.findAll('[data-reaction-picker]')).toHaveLength(1);

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-reaction-picker]').exists()).toBe(false);
  });

  it("starts a quote instead of going back when the swipe begins on someone else's message", () => {
    const wrapper = mountPane({ conversation, messages: [message] });
    const bubble = wrapper.get('[data-message-bubble]').element;
    const pointer = (type: string, clientX: number) =>
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 8,
        pointerType: 'touch',
        clientX,
        clientY: 100,
      });

    bubble.dispatchEvent(pointer('pointerdown', 40));
    bubble.dispatchEvent(pointer('pointermove', 120));
    bubble.dispatchEvent(pointer('pointermove', 220));
    bubble.dispatchEvent(pointer('pointerup', 220));

    expect(wrapper.emitted('back')).toBeUndefined();
  });

  it('goes back to the conversation list when the chat body is swiped right on mobile', async () => {
    const wrapper = mountPane({ conversation, messages: [message] });
    const pane = wrapper.get('[data-chat-pane]').element;
    const pointer = (type: string, clientX: number) =>
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType: 'touch',
        clientX,
        clientY: 100,
      });

    pane.dispatchEvent(pointer('pointerdown', 140));
    pane.dispatchEvent(pointer('pointermove', 200));
    pane.dispatchEvent(pointer('pointermove', 280));
    pane.dispatchEvent(pointer('pointerup', 280));

    expect(wrapper.emitted('back')).toHaveLength(1);
  });

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

  it('names senders in group chats but not in direct chats', () => {
    expect(mountPane({ conversation, messages: [message], selectedIsGroup: true }).text()).toContain('@friend');
    expect(mountPane({ conversation, messages: [message] }).text()).not.toContain('@friend');
  });

  it("only lets other people's messages be quoted", async () => {
    const own: ConversationMessage = { ...message, sequence: 3, senderId: 'me', content: 'Mine' };
    const wrapper = mountPane({
      conversation,
      messages: [message, own],
      isLocal: (item: ConversationMessage) => item.senderId === 'me',
    });
    const [theirs, mine] = wrapper.findAll('[data-message-bubble]');

    expect(theirs!.attributes('data-repliable')).toBe('true');
    expect(mine!.attributes('data-repliable')).toBe('false');
    await wrapper.findAllComponents({ name: 'ChatMessage' })[1]!.vm.$emit('reply');
    expect(wrapper.emitted('update:replyTo')).toBeUndefined();
  });

  it('groups consecutive messages from the same sender', () => {
    const followUp: ConversationMessage = { ...message, sequence: 4, createdAt: '2026-10-02T12:01:00Z' };
    const later: ConversationMessage = { ...message, sequence: 5, createdAt: '2026-10-02T12:30:00Z' };
    const items = mountPane({ conversation, messages: [message, followUp, later] }).findAll('[data-message-sequence]');

    expect(items[1]!.classes()).toContain('mt-0.5');
    expect(items[2]!.classes()).not.toContain('mt-0.5');
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
