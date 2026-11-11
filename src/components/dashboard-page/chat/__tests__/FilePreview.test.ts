import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import FilePreview from '@/components/dashboard-page/chat/FilePreview.vue';
import type { ConversationMessageAttachment } from '@/services/social-api';

function attachment(id: string, fileName: string, contentType = 'image/jpeg'): ConversationMessageAttachment {
  return { id, fileName, contentType, url: `/files/${id}`, byteSize: 10 };
}

const photos = [attachment('1', 'photo.jpg'), attachment('2', 'second.png', 'image/png')];
const urls = { '/files/1': 'blob:one', '/files/2': 'blob:two' };

async function mountPreview(props: Partial<InstanceType<typeof FilePreview>['$props']> = {}) {
  const wrapper = mount(FilePreview, {
    props: { attachments: photos, activeIndex: 0, attachmentUrls: urls, ...props },
    attachTo: document.body,
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false })],
    },
  });
  await flushPromises();
  return wrapper;
}

const stage = () => document.querySelector<HTMLElement>('[data-media-stage]')!;
const image = () => document.querySelector<HTMLImageElement>('[data-media-stage] img');

function swipeLeft() {
  const target = image() ?? stage();
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 200, pointerId: 1 }));
  target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 100, clientY: 200, pointerId: 1 }));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('FilePreview', () => {
  it('shows the file name with the download link beside it', async () => {
    await mountPreview();
    expect(document.querySelector('[data-media-name]')?.textContent).toContain('photo.jpg');
    const download = document.querySelector<HTMLAnchorElement>('a[aria-label="Download attachment"]');
    expect(download?.getAttribute('download')).toBe('photo.jpg');
    expect(document.body.textContent).toContain('1 of 2');
  });

  it('shows a loader until the url is available', async () => {
    const wrapper = await mountPreview({ attachmentUrls: {} });
    expect(image()).toBeNull();
    expect(document.querySelector('[data-media-loading]')).not.toBeNull();

    await wrapper.setProps({ attachmentUrls: urls });
    expect(image()?.getAttribute('src')).toBe('blob:one');
  });

  it('emits the next index on a left swipe and none past the end', async () => {
    const wrapper = await mountPreview();
    swipeLeft();
    expect(wrapper.emitted('update:activeIndex')).toEqual([[1]]);

    await wrapper.setProps({ activeIndex: 1 });
    await flushPromises();
    swipeLeft();
    expect(wrapper.emitted('update:activeIndex')).toEqual([[1]]);
  });

  it('does not move past the first or last item', async () => {
    const wrapper = await mountPreview({ attachments: [photos[0]!] });
    expect(document.querySelector('[aria-label="Previous attachment"]')).toBeNull();
    expect(document.querySelector('[aria-label="Next attachment"]')).toBeNull();
    swipeLeft();
    expect(wrapper.emitted('update:activeIndex')).toBeUndefined();
  });

  it('resets zoom when the item changes', async () => {
    const wrapper = await mountPreview();
    stage().dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -500 }));
    await flushPromises();
    expect(image()?.style.transform).not.toContain('scale(1)');

    await wrapper.setProps({ activeIndex: 1 });
    await flushPromises();
    expect(image()?.style.transform).toContain('scale(1)');
  });

  it('closes on Escape and on a backdrop click', async () => {
    const wrapper = await mountPreview();
    stage().click();
    expect(wrapper.emitted('close')).toHaveLength(1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();
    expect(wrapper.emitted('close')!.length).toBeGreaterThanOrEqual(2);
  });

  it('moves with the arrow keys', async () => {
    const wrapper = await mountPreview();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(wrapper.emitted('update:activeIndex')).toEqual([[1]]);
  });

  it('opens above the navigation bars', async () => {
    await mountPreview();
    expect(document.querySelector('.harbor-media-viewer')?.className).toContain('z-[1060]');
  });

  it('stays open after a mouse drag on the backdrop', async () => {
    const wrapper = await mountPreview();
    stage().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10, pointerId: 1 }));
    stage().dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 10 }));
    expect(wrapper.emitted('close')).toBeUndefined();
  });
});
