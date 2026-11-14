import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import en from '@/locales/en.json';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') } }));

const { default: MeetingShareRow } = await import('@/components/meeting-page/MeetingShareRow.vue');

enableAutoUnmount(afterEach);

function mountRow() {
  return mount(MeetingShareRow, {
    props: { meetingId: 'team-sync' },
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] },
  });
}

const target = (wrapper: ReturnType<typeof mountRow>, name: string) => wrapper.find(`[data-share-target="${name}"]`);

describe('MeetingShareRow', () => {
  const link = `${window.location.origin}/room/team-sync`;

  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'share');
  });

  it('offers Copy link, QR code, WhatsApp, Telegram, and Email, and no Share without a system share sheet', () => {
    const names = mountRow()
      .findAll('[data-share-target]')
      .map((button) => button.attributes('data-share-target'));
    expect(names).toEqual(['copy', 'qr', 'whatsapp', 'telegram', 'email']);
  });

  it('opens the system share sheet with the room link where there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    const wrapper = mountRow();
    await target(wrapper, 'share').trigger('click');
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: link }));
  });

  it('copies the room link and says so', async () => {
    const wrapper = mountRow();
    await target(wrapper, 'copy').trigger('click');
    await flushPromises();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(link);
    expect(target(wrapper, 'copy').text()).toContain('Copied');
  });

  it('shows the room link as a QR code', async () => {
    const wrapper = mountRow();
    expect(wrapper.find('[data-share-qr]').exists()).toBe(false);
    await target(wrapper, 'qr').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-share-qr] img').attributes('src')).toBe('data:image/png;base64,qr');
  });

  it('shares through WhatsApp, Telegram, and email', async () => {
    const wrapper = mountRow();
    await target(wrapper, 'whatsapp').trigger('click');
    await target(wrapper, 'telegram').trigger('click');
    expect(window.open).toHaveBeenNthCalledWith(1, expect.stringContaining('https://wa.me/?text='), '_blank');
    expect(window.open).toHaveBeenNthCalledWith(2, expect.stringContaining('https://t.me/share/url?url='), '_blank');
    expect(target(wrapper, 'email').attributes('href')).toContain('mailto:?subject=');
    expect(decodeURIComponent(target(wrapper, 'email').attributes('href')!)).toContain(link);
  });
});
