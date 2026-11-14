import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import MeetingActionMenu from '@/components/meeting-page/MeetingActionMenu.vue';
import en from '@/locales/en.json';
import { playHaptic } from '@/services/haptics';
import type { Participant } from '@/xstate/machines/webrtc/types';

vi.mock('@/services/haptics', () => ({ playHaptic: vi.fn() }));

const participants: Participant[] = [
  { id: 'local', name: 'Local Person', isLocal: true, stream: null, audioEnabled: true, videoEnabled: true },
  { id: 'remote', name: 'Remote Person', isLocal: false, stream: null, audioEnabled: true, videoEnabled: true },
];

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

enableAutoUnmount(afterEach);

beforeEach(() => {
  // Animated menu icons watch the viewport, which jsdom has no observer for.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

function mountMenu(props: Partial<InstanceType<typeof MeetingActionMenu>['$props']> = {}) {
  return mount(MeetingActionMenu, {
    attachTo: document.body,
    props: {
      participants,
      pinnedParticipantId: null,
      viewMode: 'grid',
      meetingId: 'team-sync',
      inviteMode: 'enabled',
      canPresent: true,
      ...props,
    },
    global: { plugins: [i18n] },
  });
}

afterEach(() => vi.clearAllMocks());

async function openMenu(wrapper: ReturnType<typeof mountMenu>) {
  await wrapper.get('button[aria-label="Open meeting actions"]').trigger('click');
  await flushPromises();
  return document.body.querySelector<HTMLElement>('[role="menu"]')!;
}

async function openSubmenu(trigger: HTMLElement) {
  trigger.focus();
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await flushPromises();
  const menus = document.body.querySelectorAll<HTMLElement>('[role="menu"]');
  return menus[menus.length - 1]!;
}

describe('MeetingActionMenu', () => {
  it('holds screen share, invite, layout, pin participant, participants, dev tools, and report bug', async () => {
    const menu = await openMenu(mountMenu());
    const topLevel = Array.from(menu.querySelectorAll(':scope [role^="menuitem"]'))
      .filter((item) => item.closest('[role="menu"]') === menu)
      .map((item) => item.textContent?.trim());

    expect(topLevel).toEqual([
      'Screen share',
      'Invite',
      'Grid view',
      'Speaker view',
      'Pin participant',
      'Participants (2)',
      'Developer tools',
      'Report a bug',
    ]);
    expect(menu.textContent).not.toContain('Open chat');
    expect(menu.textContent).not.toContain('Mute microphone');
    expect(menu.textContent).not.toContain('Full screen');
  });

  it('leaves out screen share where the screen cannot be shared, and pinning when alone', async () => {
    const menu = await openMenu(mountMenu({ canPresent: false, participants: participants.slice(0, 1) }));

    expect(menu.querySelector('[data-menu-screen-share]')).toBeNull();
    expect(menu.querySelector('[data-menu-pin]')).toBeNull();
  });

  it('starts and stops the screen share from its submenu', async () => {
    const wrapper = mountMenu({ canSelectArea: true });
    const menu = await openMenu(wrapper);
    const submenu = await openSubmenu(menu.querySelector<HTMLElement>('[data-menu-screen-share]')!);
    const items = Array.from(submenu.querySelectorAll<HTMLElement>('[role="menuitem"]'));

    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'Present a screen, window, or tab',
      'Present part of a screen',
    ]);
    items[1]!.click();
    await flushPromises();
    expect(wrapper.emitted('startScreenShare')).toEqual([[{ selectArea: true }]]);
  });

  it('pins from the pin submenu and lists the participants', async () => {
    const wrapper = mountMenu({ pinnedParticipantId: 'remote' });
    const menu = await openMenu(wrapper);
    const pins = await openSubmenu(menu.querySelector<HTMLElement>('[data-menu-pin]')!);

    expect(pins.querySelector('[role="menuitemcheckbox"][aria-checked="true"]')?.getAttribute('aria-label')).toBe(
      'Unpin Remote Person',
    );
    pins.querySelector<HTMLElement>('[aria-label="Pin Local Person"]')!.click();
    await flushPromises();
    expect(wrapper.emitted('togglePin')).toEqual([['local']]);
  });

  it('toggles dev tools and keeps bug reports privacy-safe', async () => {
    const wrapper = mountMenu({ showConnectionStatus: true });
    const menu = await openMenu(wrapper);
    const devTools = menu.querySelector<HTMLElement>('[data-menu-dev-tools]')!;
    const reportLink = menu.querySelector<HTMLAnchorElement>('a[target="_blank"]');

    expect(devTools.getAttribute('aria-checked')).toBe('true');
    expect(reportLink?.href).toContain('Area%3A+meeting');
    expect(reportLink?.href).not.toContain('/room/');
    devTools.click();
    await flushPromises();
    expect(wrapper.emitted('toggleStats')).toHaveLength(1);
  });
});

describe('MeetingActionMenu layout menu', () => {
  function mountLayoutMenu() {
    return mount(MeetingActionMenu, {
      attachTo: document.body,
      props: {
        context: true,
        participants,
        pinnedParticipantId: null,
        viewMode: 'grid',
      },
      slots: { default: '<div data-testid="tile-area">tiles</div>' },
      global: { plugins: [i18n] },
    });
  }

  it('opens on a right-click on the tile area with only Grid and Speaker, and a medium haptic', async () => {
    const wrapper = mountLayoutMenu();
    await wrapper.get('[data-testid="tile-area"]').trigger('contextmenu');
    await flushPromises();
    const menu = document.body.querySelector('[role="menu"]');

    expect(
      Array.from(menu?.querySelectorAll('[role^="menuitem"]') ?? []).map((item) => item.textContent?.trim()),
    ).toEqual(['Grid view', 'Speaker view']);
    expect(menu?.querySelector('[role="menuitemradio"][aria-checked="true"]')?.textContent).toContain('Grid view');
    expect(playHaptic).toHaveBeenCalledWith('medium');
  });

  it('switches the layout from the menu', async () => {
    const wrapper = mountLayoutMenu();
    await wrapper.get('[data-testid="tile-area"]').trigger('contextmenu');
    await flushPromises();
    Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]'))
      .find((item) => item.textContent?.includes('Speaker view'))!
      .click();
    await flushPromises();

    expect(wrapper.emitted('setViewMode')).toEqual([['speaker']]);
  });
});
