import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import SharedMediaPanel from '@/components/dashboard-page/shared-media/SharedMediaPanel.vue';
import { socialApi } from '@/services/social-api';

const photo = {
  sequence: 12,
  senderId: 'user-2',
  senderName: 'Alice',
  createdAt: '2026-10-07T10:00:00Z',
  attachment: {
    id: 'photo-1',
    fileName: 'board.png',
    contentType: 'image/png',
    byteSize: 2048,
    url: '/social/conversations/chat-1/attachments/photo-1',
  },
};
const linkMessage = {
  sequence: 9,
  senderId: 'user-2',
  senderName: 'Alice',
  createdAt: '2026-10-06T10:00:00Z',
  content: 'Docs at https://example.com/guide and www.openmeets.eu/pricing.',
};

function mountPanel() {
  return mount(SharedMediaPanel, {
    props: { conversationId: 'chat-1', accessToken: 'token', userId: 'user-1' },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false })],
      stubs: {
        FilePreview: true,
        SharedLinkRow: { props: ['href', 'text', 'meta'], template: '<a :href="href">{{ text }}</a>' },
      },
    },
  });
}

describe('SharedMediaPanel', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:photo-1'), revokeObjectURL: vi.fn() }),
    );
    vi.spyOn(socialApi, 'loadConversationAttachment').mockResolvedValue(new Blob(['image']));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows only tabs with shared items and opens the first one', async () => {
    vi.spyOn(socialApi, 'getSharedMediaCounts').mockResolvedValue({ media: 1, files: 0, voice: 0, links: 1, gifs: 0 });
    const list = vi.spyOn(socialApi, 'listSharedMedia').mockResolvedValue({ items: [photo], nextBefore: null });

    const wrapper = mountPanel();
    await flushPromises();

    expect(wrapper.findAll('[data-shared-tab]').map((tab) => tab.attributes('data-shared-tab'))).toEqual([
      'media',
      'links',
    ]);
    expect(wrapper.get('[data-shared-tab="media"]').attributes('aria-selected')).toBe('true');
    expect(list).toHaveBeenCalledWith('token', 'chat-1', 'media', undefined);
    expect(wrapper.findAll('[data-shared-visual]')).toHaveLength(1);
    expect(socialApi.loadConversationAttachment).toHaveBeenCalledWith('token', photo.attachment.url);
  });

  it('keeps loading older media while the end of the grid stays in view', async () => {
    let report: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(function IntersectionObserver(callback: typeof report) {
        report = callback;
        return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
      }),
    );
    vi.spyOn(socialApi, 'getSharedMediaCounts').mockResolvedValue({ media: 3, files: 0, voice: 0, links: 0, gifs: 0 });
    const page = (sequence: number, nextBefore: number | null) => ({
      items: [{ ...photo, sequence, attachment: { ...photo.attachment, id: `photo-${sequence}` } }],
      nextBefore,
    });
    const list = vi
      .spyOn(socialApi, 'listSharedMedia')
      .mockResolvedValueOnce(page(30, 30))
      .mockResolvedValueOnce(page(20, 20))
      .mockResolvedValueOnce(page(10, null));

    const wrapper = mountPanel();
    await flushPromises();
    report?.([{ isIntersecting: true }]);
    await flushPromises();

    expect(list.mock.calls.map((call) => call[3])).toEqual([undefined, 30, 20]);
    expect(wrapper.findAll('[data-shared-visual]')).toHaveLength(3);
  });

  it('lists every link found in shared messages', async () => {
    vi.spyOn(socialApi, 'getSharedMediaCounts').mockResolvedValue({ media: 0, files: 0, voice: 0, links: 1, gifs: 0 });
    vi.spyOn(socialApi, 'listSharedMedia').mockResolvedValue({ items: [linkMessage], nextBefore: null });

    const wrapper = mountPanel();
    await flushPromises();

    expect(wrapper.findAll('a').map((link) => link.attributes('href'))).toEqual([
      'https://example.com/guide',
      'https://www.openmeets.eu/pricing',
    ]);
  });

  it('invites sharing when the chat has nothing shared yet', async () => {
    vi.spyOn(socialApi, 'getSharedMediaCounts').mockResolvedValue({ media: 0, files: 0, voice: 0, links: 0, gifs: 0 });
    const list = vi.spyOn(socialApi, 'listSharedMedia');

    const wrapper = mountPanel();
    await flushPromises();

    expect(wrapper.text()).toContain('Photos, files, voice messages, and links sent in this chat appear here.');
    expect(list).not.toHaveBeenCalled();
  });
});
