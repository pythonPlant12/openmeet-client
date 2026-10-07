import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';

import ChatPanel from '@/components/meeting-page/ChatPanel.vue';
import type { ChatMessage } from '@/xstate/machines/webrtc/types';

enableAutoUnmount(afterEach);

const messages: ChatMessage[] = [
  { id: 1, participantId: 'bob', participantName: 'Bob', message: 'Hello https://example.com', timestamp: 1 },
  {
    id: 2,
    participantId: 'me',
    participantName: 'Me',
    message: 'Hi Bob',
    timestamp: 2,
    replyTo: { id: 1, participantId: 'bob', participantName: 'Bob', message: 'Hello' },
    reactions: [{ emoji: '👍', participantIds: ['bob', 'me'] }],
  },
];

const passthrough = { template: '<div><slot /></div>' };

function mountPanel() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: passthrough }] });
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false });
  return mount(ChatPanel, {
    props: { open: true, roomId: 'room-1', messages, localParticipantId: 'me' },
    global: {
      plugins: [router, i18n],
      stubs: {
        Sheet: passthrough,
        SheetContent: passthrough,
        SheetHeader: passthrough,
        SheetTitle: passthrough,
        SheetDescription: passthrough,
      },
    },
  });
}

describe('ChatPanel', () => {
  it('renders meeting messages with the conversation chat bubbles, quotes, reactions, and links', () => {
    const wrapper = mountPanel();
    const bubbles = wrapper.findAll('[data-message-bubble]');

    expect(bubbles).toHaveLength(2);
    expect(bubbles[0]!.attributes('data-repliable')).toBe('true');
    expect(bubbles[1]!.attributes('data-repliable')).toBe('false');
    expect(wrapper.get('[data-message-quote]').text()).toContain('Bob');
    const chip = wrapper.get('[data-reaction-chip]');
    expect(chip.attributes('aria-pressed')).toBe('true');
    expect(chip.text()).toContain('2');
    const link = bubbles[0]!.get('a[href="https://example.com"]');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toContain('noopener');
  });

  it('sends replies with the quoted message ID and clears the composer', async () => {
    const wrapper = mountPanel();
    await wrapper.findAllComponents({ name: 'ChatMessage' })[0]!.vm.$emit('reply');
    await wrapper.get('textarea').setValue('Sure');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('send')).toEqual([['Sure', 1]]);
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('');
    expect(wrapper.find('[data-reply-preview]').exists()).toBe(false);
  });

  it('reacts by message ID', async () => {
    const wrapper = mountPanel();
    await wrapper.get('[data-reaction-chip]').trigger('click');

    expect(wrapper.emitted('react')).toEqual([[2, '👍']]);
  });
});
