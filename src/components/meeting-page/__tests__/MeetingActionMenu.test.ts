import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import MeetingActionMenu from '@/components/meeting-page/MeetingActionMenu.vue';
import type { Participant } from '@/xstate/machines/webrtc/types';

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

describe('MeetingActionMenu', () => {
  it('mirrors live chat and media state', async () => {
    const wrapper = mountMenu();
    await wrapper.get('button[aria-label="Open meeting actions"]').trigger('click');
    await flushPromises();

    expect(document.body.textContent).toContain('Open chat');
    expect(document.body.textContent).toContain('Mute microphone');
    expect(document.body.textContent).toContain('Turn camera off');

    await wrapper.setProps({ isChatOpen: true, isMuted: true, isVideoOff: true });
    expect(document.body.textContent).toContain('Close chat');
    expect(document.body.textContent).toContain('Unmute microphone');
    expect(document.body.textContent).toContain('Turn camera on');
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

  it('reports unavailable tracks instead of presenting false enabled actions', async () => {
    const wrapper = mountMenu();
    await wrapper.setProps({ audioAvailable: false, videoAvailable: false });
    await wrapper.get('button[aria-label="Open meeting actions"]').trigger('click');
    await flushPromises();

    expect(document.body.textContent).toContain('Microphone unavailable');
    expect(document.body.textContent).toContain('Camera unavailable');
  });
});
