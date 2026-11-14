import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { createI18n } from 'vue-i18n';

import en from '@/locales/en.json';

const route = vi.hoisted(() => ({
  getAudioRouteMode: vi.fn(),
  showSystemAudioRoutePicker: vi.fn(),
  listAudioRoutes: vi.fn(),
  setAudioRoute: vi.fn(),
}));
const settings = vi.hoisted(() => ({ refresh: vi.fn(), changeSpeaker: vi.fn() }));
const haptics = vi.hoisted(() => ({ playHaptic: vi.fn() }));

vi.mock('@/services/audio-route', () => route);
vi.mock('@/services/haptics', () => haptics);
vi.mock('@/composables/useMeetingMediaSettings', () => ({
  useMeetingMediaSettings: () => ({
    speakers: ref([
      { deviceId: 'default', label: 'System default' },
      { deviceId: 'headphones', label: 'Headphones' },
    ]),
    speakerId: ref('default'),
    ...settings,
  }),
}));

const { default: CallAudioOutputButton } = await import('@/components/meeting-page/CallAudioOutputButton.vue');

enableAutoUnmount(afterEach);

const button = () => document.body.querySelector<HTMLElement>('button[aria-label="Audio output"]');
const options = () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));

async function mountButton() {
  const wrapper = mount(CallAudioOutputButton, {
    attachTo: document.body,
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] },
  });
  await flushPromises();
  return wrapper;
}

async function openMenu() {
  button()!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
  button()!.click();
  await flushPromises();
}

describe('CallAudioOutputButton', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    for (const mock of [...Object.values(route), ...Object.values(settings), haptics.playHaptic]) mock.mockReset();
    route.listAudioRoutes.mockResolvedValue([
      { id: 'speaker', name: 'Speaker', selected: false },
      { id: 'earpiece', name: 'Phone', selected: true },
    ]);
  });

  it('is hidden where the platform cannot switch outputs', async () => {
    route.getAudioRouteMode.mockResolvedValue(null);
    await mountButton();
    expect(button()).toBeNull();
  });

  it('opens the system route picker in the iOS app', async () => {
    route.getAudioRouteMode.mockResolvedValue('picker');
    await mountButton();

    button()!.click();
    await flushPromises();

    expect(route.showSystemAudioRoutePicker).toHaveBeenCalledOnce();
    expect(haptics.playHaptic).toHaveBeenCalledWith('medium');
  });

  it("lists the device's outputs in the Android app and switches to the chosen one", async () => {
    route.getAudioRouteMode.mockResolvedValue('list');
    await mountButton();
    await openMenu();

    expect(options().map((option) => option.textContent?.trim())).toEqual(['Speaker', 'Phone']);
    expect(options()[1]!.getAttribute('aria-checked')).toBe('true');
    options()[0]!.click();
    await flushPromises();
    expect(route.setAudioRoute).toHaveBeenCalledWith('speaker');
  });

  it('opens a Speaker menu in browsers that can switch outputs', async () => {
    route.getAudioRouteMode.mockResolvedValue('browser');
    await mountButton();
    await openMenu();

    expect(document.body.querySelector('[role="menu"]')?.textContent).toContain('Speaker');
    expect(options().map((option) => option.textContent?.trim())).toEqual(['System default', 'Headphones']);
    options()[1]!.click();
    await flushPromises();
    expect(settings.changeSpeaker).toHaveBeenCalledWith('headphones');
  });
});
