import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import MeetingActionMenu from '@/components/meeting-page/MeetingActionMenu.vue';
import { playHaptic } from '@/services/haptics';
import type { Participant } from '@/xstate/machines/webrtc/types';

vi.mock('@/services/haptics', () => ({ playHaptic: vi.fn() }));

const participants: Participant[] = [
  { id: 'local', name: 'Local Person', isLocal: true, stream: null, audioEnabled: true, videoEnabled: true },
  { id: 'remote', name: 'Remote Person', isLocal: false, stream: null, audioEnabled: true, videoEnabled: true },
];

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      meeting: {
        participant: {
          pin: 'Pin {name}',
          unpin: 'Unpin {name}',
        },
        actions: {
          open: 'Open meeting actions',
          openChat: 'Open chat',
          closeChat: 'Close chat',
          mute: 'Mute microphone',
          unmute: 'Unmute microphone',
          audioUnavailable: 'Microphone unavailable',
          stopVideo: 'Turn camera off',
          startVideo: 'Turn camera on',
          videoUnavailable: 'Camera unavailable',
          layout: 'Layout',
          grid: 'Grid view',
          speaker: 'Speaker view',
          fullscreen: 'Full screen',
          exitFullscreen: 'Exit full screen',
          pinParticipant: 'Pin participant',
          reportBug: 'Report a bug',
          disconnect: 'Disconnect',
        },
      },
    },
  },
});

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

function mountMenu() {
  return mount(MeetingActionMenu, {
    attachTo: document.body,
    props: {
      audioAvailable: true,
      isChatOpen: false,
      isMuted: false,
      isVideoOff: false,
      participants,
      pinnedParticipantId: null,
      videoAvailable: true,
      viewMode: 'grid',
    },
    global: { plugins: [i18n] },
  });
}

afterEach(() => vi.clearAllMocks());

describe('MeetingActionMenu', () => {
  it('mirrors live chat and media state', async () => {
    const wrapper = mountMenu();
    await wrapper.get('button[aria-label="Open meeting actions"]').trigger('click');
    await flushPromises();

    const menuItems = () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const actionItem = (label: string) => menuItems().find((item) => item.textContent?.includes(label));

    expect(document.body.textContent).toContain('Open chat');
    expect(document.body.textContent).toContain('Mute microphone');
    expect(document.body.textContent).toContain('Turn camera off');
    expect(actionItem('Mute microphone')?.classList).toContain('harbor-context-menu-danger');
    expect(actionItem('Turn camera off')?.classList).toContain('harbor-context-menu-danger');

    await wrapper.setProps({ isChatOpen: true, isMuted: true, isVideoOff: true });
    expect(document.body.textContent).toContain('Close chat');
    expect(document.body.textContent).toContain('Unmute microphone');
    expect(document.body.textContent).toContain('Turn camera on');
    expect(actionItem('Unmute microphone')?.classList).not.toContain('harbor-context-menu-danger');
    expect(actionItem('Turn camera on')?.classList).not.toContain('harbor-context-menu-danger');
  });

  it('shows pin actions only in speaker view and keeps reports privacy-safe', async () => {
    const wrapper = mountMenu();
    await wrapper.setProps({ viewMode: 'speaker', pinnedParticipantId: 'remote' });
    await wrapper.get('button[aria-label="Open meeting actions"]').trigger('click');
    await flushPromises();
    const menu = document.body.querySelector('[role="menu"]');
    const reportLink = menu?.querySelector<HTMLAnchorElement>('a[target="_blank"]');

    expect(menu?.textContent).toContain('Pin participant');
    expect(menu?.textContent).toContain('Local Person');
    expect(menu?.textContent).toContain('Remote Person');
    expect(menu?.querySelector('[role="menuitemradio"][aria-checked="true"]')?.textContent).toContain('Speaker view');
    expect(menu?.querySelector('[role="menuitemcheckbox"][aria-checked="true"]')?.getAttribute('aria-label')).toBe(
      'Unpin Remote Person',
    );
    expect(reportLink?.href).toContain('Area%3A+meeting');
    expect(reportLink?.href).not.toContain('/room/');
    expect(menu?.querySelectorAll('svg').length).toBeGreaterThanOrEqual(10);
  });

  it('toggles full screen from the menu in either layout', async () => {
    const wrapper = mountMenu();
    await wrapper.get('button[aria-label="Open meeting actions"]').trigger('click');
    await flushPromises();
    const toggle = () => document.body.querySelector<HTMLElement>('[data-fullscreen-toggle]');

    expect(toggle()?.textContent).toContain('Full screen');
    expect(toggle()?.getAttribute('aria-checked')).toBe('false');
    toggle()?.click();
    await flushPromises();
    expect(wrapper.emitted('toggleFullscreen')).toHaveLength(1);

    await wrapper.setProps({ fullscreen: true, viewMode: 'speaker' });
    await wrapper.get('button[aria-label="Open meeting actions"]').trigger('click');
    await flushPromises();
    expect(toggle()?.textContent).toContain('Exit full screen');
    expect(toggle()?.getAttribute('aria-checked')).toBe('true');
  });

  it('reports unavailable tracks instead of presenting false enabled actions', async () => {
    const wrapper = mountMenu();
    await wrapper.setProps({ audioAvailable: false, videoAvailable: false });
    await wrapper.get('button[aria-label="Open meeting actions"]').trigger('click');
    await flushPromises();

    expect(document.body.textContent).toContain('Microphone unavailable');
    expect(document.body.textContent).toContain('Camera unavailable');
  });
});

describe('MeetingActionMenu layout menu', () => {
  function mountLayoutMenu() {
    return mount(MeetingActionMenu, {
      attachTo: document.body,
      props: {
        context: true,
        audioAvailable: true,
        isChatOpen: false,
        isMuted: false,
        isVideoOff: false,
        participants,
        pinnedParticipantId: null,
        videoAvailable: true,
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
