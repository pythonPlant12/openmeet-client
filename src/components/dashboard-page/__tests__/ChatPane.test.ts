import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ChatPane from '@/components/dashboard-page/chat/ChatPane.vue';
import VoiceRecorder from '@/components/dashboard-page/chat/VoiceRecorder.vue';
import type { Conversation, ConversationMessage, GroupMember } from '@/services/social-api';

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

const groupConversation: Conversation = {
  ...conversation,
  id: 'group-1',
  kind: 'group',
  title: 'Team',
  groupCode: 'team',
  otherUserId: null,
};

const groupMember: GroupMember = {
  id: 'ada',
  name: 'Ada Lovelace',
  nickname: 'ada',
  avatarUrl: null,
  isOnline: true,
  status: 'available',
  role: 'member',
  joinedAt: '2026-10-02T12:00:00Z',
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
  it('frames offline direct-contact avatars without showing a presence dot', () => {
    const wrapper = mountPane({
      conversation,
      selectedFriend: {
        id: 'friend-1',
        name: 'Friend',
        nickname: 'friend',
        email: 'friend@example.com',
        isOnline: false,
        status: 'available',
      },
    });
    const avatar = wrapper.get('header .relative > span').element as HTMLElement;

    expect(avatar.classList).toContain('border-2');
    expect(avatar.classList).toContain('border-[#B8C6C5]');
    expect(wrapper.find('[data-presence-dot]').exists()).toBe(false);
  });

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

  it('renders attachment quote labels above reply text with the same quote surface for both senders', () => {
    const attachmentReply: ConversationMessage = {
      ...reply,
      replyTo: {
        sequence: 1,
        senderId: 'friend-1',
        senderName: 'Friend',
        senderNickname: 'friend',
        content: 'Look at this',
        attachmentFileName: 'clip.gif',
        attachmentCount: 2,
      },
    };
    const wrapper = mountPane({
      conversation,
      messages: [{ ...attachmentReply, senderId: 'friend-1' }, attachmentReply],
      isLocal: (item: ConversationMessage) => item.senderId === 'me',
    });
    const [remoteQuote, localQuote] = wrapper.findAll('[data-message-quote]');

    expect(remoteQuote!.get('strong').text()).toBe('clip.gif, +1');
    expect(remoteQuote!.get('strong').classes()).toContain('block');
    expect(remoteQuote!.text()).toContain('Look at this');
    expect(remoteQuote!.classes()).toEqual(localQuote!.classes());
  });

  it('completes an entire mention token from a middle caret position and preserves its exact caret', async () => {
    const wrapper = mountPane({
      conversation: groupConversation,
      selectedIsGroup: true,
      groupMembers: [groupMember],
    });
    const composer = wrapper.get('textarea');

    await composer.setValue('Hi @adword next');
    const textarea = composer.element as HTMLTextAreaElement;
    textarea.setSelectionRange(6, 6);
    await composer.trigger('input');

    expect(composer.attributes('aria-expanded')).toBe('true');
    expect(composer.attributes('aria-controls')).toBe('mention-menu');
    expect(composer.attributes('aria-activedescendant')).toBe('mention-option-ada');
    await wrapper.get('#mention-option-ada').trigger('click');
    await wrapper.vm.$nextTick();

    const contentUpdates = wrapper.emitted('update:content') ?? [];
    expect(contentUpdates[contentUpdates.length - 1]).toEqual(['Hi @ada next']);
    expect(textarea.selectionStart).toBe(7);
  });

  it('invalidates Giphy search immediately, blocks sends, and exposes its active result to assistive tech', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = mountPane({
        conversation,
        gifResults: [{ id: 'gif-1', title: 'Wave', width: 320, height: 180 }],
      });
      const composer = wrapper.get('textarea');

      await composer.setValue('/giphy wave');
      expect(wrapper.emitted('search-gifs')?.[0]).toEqual(['']);
      expect(composer.attributes('aria-expanded')).toBe('true');
      expect(composer.attributes('aria-controls')).toBe('gif-picker');
      expect(composer.attributes('aria-activedescendant')).toBe('gif-option-gif-1');
      expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
      const gifOption = wrapper.get('#gif-option-gif-1');
      expect(gifOption.classes()).toContain('self-start');
      expect(gifOption.attributes('style')).toContain('aspect-ratio: 320 / 180');

      await composer.trigger('keydown', { key: 'Enter' });
      await wrapper.get('form').trigger('submit');
      expect(wrapper.emitted('send')).toBeUndefined();

      await vi.advanceTimersByTimeAsync(300);
      const gifSearches = wrapper.emitted('search-gifs') ?? [];
      expect(gifSearches[gifSearches.length - 1]).toEqual(['wave']);
    } finally {
      vi.useRealTimers();
    }
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

  it('floats the reaction picker over the list and tucks reactions under the bubble', async () => {
    const solo: ConversationMessage = {
      ...message,
      sequence: 9,
      reactions: [{ emoji: '🎉', count: 1, reactedByMe: false }],
    };
    const wrapper = mountPane({ conversation, messages: [reply, solo] });
    const [first, second] = wrapper.findAllComponents({ name: 'ChatMessage' });

    await second!.vm.$emit('open-reactions');
    expect(wrapper.get('[data-reaction-picker]').classes()).toEqual(
      expect.arrayContaining(['absolute', 'bottom-full']),
    );

    await first!.vm.$emit('open-reactions');
    expect(wrapper.get('[data-reaction-picker]').classes()).toContain('top-full');

    const chips = wrapper.findAll('[data-reaction-chip]');
    expect(chips[0]!.text()).toBe('👍2');
    expect(chips[1]!.text()).toBe('🎉');
    // Spacing to the next message lives inside the animated row so it collapses with the chips.
    const row = wrapper.findAll('[data-reaction-row]')[1]!;
    expect(row.classes()).toContain('overflow-hidden');
    // Padding sits on an inner wrapper, so the animated row can collapse to exactly zero height.
    expect(row.classes().some((name) => /^p[tbxy]?-/.test(name))).toBe(false);
    expect(row.get('div').classes()).toContain('pb-1');
    // Message rows clip only sideways, and the lifted message paints above its neighbours.
    expect(wrapper.findAll('[data-swipeable-row]')[0]!.classes()).toContain('harbor-clip-x');
    expect(wrapper.findAll('[data-message-sequence]')[0]!.classes()).toContain('z-10');
  });

  it('closes the reaction picker after a pick', async () => {
    const wrapper = mountPane({ conversation, messages: [message, reply] }, { attachTo: document.body });
    const [, second] = wrapper.findAllComponents({ name: 'ChatMessage' });

    await second!.vm.$emit('open-reactions');
    const picker = wrapper.get('[data-reaction-picker]');
    expect(picker.get('[aria-pressed="true"]').text()).toBe('👍');

    await picker.findAll('button')[1]!.trigger('click');

    expect(wrapper.emitted('react')).toHaveLength(1);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-reaction-picker]').exists()).toBe(false);
  });

  it('keeps history stationary while opening a reply preview', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const wrapper = mountPane({ conversation, messages: [message] });

    await wrapper.findComponent({ name: 'ChatMessage' }).vm.$emit('reply');
    await wrapper.setProps({ replyTo: message });

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(wrapper.get('[data-message-bubble]').classes()).toContain('harbor-message-lifted');
  });

  it('marks the first unread message and jumps back to it from the bottom', async () => {
    const unread = { ...message, sequence: 2 };
    const wrapper = mountPane(
      { conversation, messages: [message, unread], unreadStartSequence: unread.sequence },
      { attachTo: document.body },
    );
    const pane = wrapper.get('[aria-label="Message history"]').element as HTMLElement;
    const unreadMessage = wrapper.get('[data-message-sequence="2"]').element;
    const scrollIntoView = vi.fn();
    unreadMessage.scrollIntoView = scrollIntoView;
    Object.defineProperty(pane, 'scrollHeight', { configurable: true, value: 500 });
    Object.defineProperty(pane, 'clientHeight', { configurable: true, value: 300 });
    pane.scrollTop = 200;
    pane.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => setTimeout(resolve, 30));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-unread-divider]').text()).toContain('Unread messages');
    await wrapper.get('[data-jump-to-latest]').trigger('click');
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }));
  });

  it('asks the parent to load an unread boundary outside loaded history', async () => {
    const wrapper = mountPane(
      { conversation, messages: [message], unreadStartSequence: 99 },
      { attachTo: document.body },
    );
    const pane = wrapper.get('[aria-label="Message history"]').element as HTMLElement;
    Object.defineProperty(pane, 'scrollHeight', { configurable: true, value: 500 });
    Object.defineProperty(pane, 'clientHeight', { configurable: true, value: 300 });
    pane.scrollTop = 200;
    pane.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => setTimeout(resolve, 30));

    await wrapper.get('[data-jump-to-latest]').trigger('click');
    expect(wrapper.emitted('load-unread')).toEqual([[99]]);
  });

  it('offers a jump to the latest message when more than ten messages are below the view', async () => {
    const many = Array.from({ length: 14 }, (_, index) => ({ ...message, sequence: index + 1 }));
    const wrapper = mountPane({ conversation, messages: many }, { attachTo: document.body });
    const pane = wrapper.get('[aria-label="Message history"]').element as HTMLElement;
    const items = wrapper.findAll('[data-message-sequence]').map((item) => item.element as HTMLElement);
    const rect = (top: number) => ({ top, bottom: top + 40 }) as DOMRect;
    pane.getBoundingClientRect = () => rect(0 - 40 + 300);
    items.forEach((item, index) => (item.getBoundingClientRect = () => rect(index < 3 ? 100 : 400 + index * 50)));
    Object.defineProperty(pane, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(pane, 'clientHeight', { configurable: true, value: 300 });
    pane.scrollTop = 200;
    const scrollTo = vi.fn();
    pane.scrollTo = scrollTo;

    pane.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => setTimeout(resolve, 30));
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-jump-to-latest]').trigger('click');
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 2000 }));
    // No exit on click: the button leaves only once the scroll reaches the bottom.
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-jump-to-latest]').exists()).toBe(true);
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

    expect(items[1]!.classes()).toContain('mt-2.5');
    expect(items[2]!.classes()).toContain('mt-2.5');
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

  it('offers a voice message instead of send while nothing is typed and sends it as the only attachment', async () => {
    vi.stubGlobal('MediaRecorder', class {});
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
    try {
      const wrapper = mountPane({ conversation, messages: [message] });
      expect(wrapper.get('[data-voice-record-button]').isVisible()).toBe(true);
      expect(wrapper.get('button[type="submit"]').isVisible()).toBe(false);

      await wrapper.get('textarea').setValue('Hello');
      await wrapper.setProps({ content: 'Hello' });
      // Both stay mounted; typing only swaps which one is shown.
      expect(wrapper.get('[data-voice-record-button]').isVisible()).toBe(false);
      expect(wrapper.get('button[type="submit"]').isVisible()).toBe(true);

      await wrapper.setProps({ content: '' });
      const voice = new File(['voice'], 'voice-message-20261011-135407.webm', { type: 'audio/webm' });
      wrapper.getComponent(VoiceRecorder).vm.$emit('send', voice);
      expect(wrapper.emitted('update:attachments')?.slice(-1)[0]).toEqual([[voice]]);
      expect(wrapper.emitted('send')).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps messages from re-rendering while the composer changes', async () => {
    vi.stubGlobal('MediaRecorder', class {});
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
    let messageUpdates = 0;
    try {
      const wrapper = mount(ChatPane, {
        props: {
          content: '',
          conversation,
          pendingFriend: null,
          selectedFriend: null,
          selectedTitle: 'Conversation',
          selectedIsGroup: false,
          friendAvatarUrls: {},
          isFriendAvatarLoading: () => false,
          isGroupAvatarLoading: () => false,
          messages: [message, { ...message, sequence: 2, content: 'Again' }],
          loading: false,
          loadingOlder: false,
          sending: false,
          callActive: false,
          notificationWarning: false,
          canRequestNotificationPermission: false,
          isDesktop: false,
          prefersReducedMotion: true,
          shouldAnimate: () => false,
          isLocal: () => false,
          formatTime: () => '12:00 PM',
        },
        global: {
          stubs: { EmojiPickerButton: { template: '<div />' } },
          mixins: [
            {
              updated(this: { $options: { __name?: string } }) {
                if (this.$options.__name === 'ChatMessage') messageUpdates += 1;
              },
            },
          ],
        },
      });

      await wrapper.setProps({ content: 'Typing' });
      wrapper.getComponent(VoiceRecorder).vm.$emit('update:active', true);
      await wrapper.vm.$nextTick();
      expect(messageUpdates).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
