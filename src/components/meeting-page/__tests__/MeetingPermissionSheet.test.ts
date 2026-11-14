import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import en from '@/locales/en.json';

const settings = vi.hoisted(() => ({ canOpenSystemSettings: vi.fn(), openSystemSettings: vi.fn() }));
vi.mock('@/services/system-settings', () => settings);

const { default: MeetingPermissionSheet } = await import('@/components/meeting-page/MeetingPermissionSheet.vue');

enableAutoUnmount(afterEach);

const passthrough = { template: '<div><slot /></div>' };

function mountSheet(kind: 'audio' | 'video') {
  return mount(MeetingPermissionSheet, {
    props: { kind, open: true },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
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

describe('MeetingPermissionSheet', () => {
  beforeEach(() => {
    settings.canOpenSystemSettings.mockReset();
    settings.openSystemSettings.mockReset();
  });

  it('explains how to allow the camera in the browser, without a settings button', () => {
    settings.canOpenSystemSettings.mockReturnValue(false);
    const wrapper = mountSheet('video');

    expect(wrapper.text()).toContain('Allow the camera');
    expect(wrapper.text()).toContain('site settings');
    expect(wrapper.find('[data-open-settings]').exists()).toBe(false);
  });

  it('opens the system settings in the native app', async () => {
    settings.canOpenSystemSettings.mockReturnValue(true);
    const wrapper = mountSheet('audio');

    expect(wrapper.text()).toContain('Allow the microphone');
    await wrapper.get('[data-open-settings]').trigger('click');

    expect(settings.openSystemSettings).toHaveBeenCalled();
  });
});
