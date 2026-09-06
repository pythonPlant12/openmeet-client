import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import DashboardActionMenu from '@/components/dashboard-page/DashboardActionMenu.vue';
import type { Friend } from '@/services/social-api';

const friends: Friend[] = [
  { id: 'online-id', name: 'Online Friend', email: 'online@example.com', isOnline: true },
  { id: 'offline-id', name: 'Offline Friend', email: 'offline@example.com', isOnline: false },
];

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      dashboard: {
        callFriend: 'Call {name}',
        newMeeting: 'Start a meeting',
        noFriends: 'No friends',
        online: 'Online now',
        offline: 'Offline',
        actions: {
          open: 'Open dashboard actions',
          friends: 'Call a friend',
          loadingFriends: 'Loading friends',
          reportBug: 'Report a bug',
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

function mountMenu(props: Partial<InstanceType<typeof DashboardActionMenu>['$props']> = {}) {
  return mount(DashboardActionMenu, {
    attachTo: document.body,
    props: {
      friends,
      callingFriendId: null,
      ...props,
    },
    global: { plugins: [i18n] },
  });
}

describe('DashboardActionMenu', () => {
  it('exposes new meeting, friend calls, presence, and safe bug reporting', async () => {
    const wrapper = mountMenu();
    await wrapper.get('button[aria-label="Open dashboard actions"]').trigger('click');
    await flushPromises();
    const menu = document.body.querySelector('[role="menu"]');

    expect(menu?.textContent).toContain('Start a meeting');
    expect(menu?.textContent).toContain('Online Friend');
    expect(menu?.textContent).toContain('Offline Friend');
    expect(menu?.textContent).toContain('Report a bug');
    expect(menu?.querySelector('[aria-label="Call Online Friend"]')).not.toBeNull();
    expect(menu?.querySelector('a[target="_blank"]')?.getAttribute('href')).not.toContain('/room/');
    expect(menu?.querySelectorAll('svg').length).toBeGreaterThanOrEqual(4);
  });

  it('keeps global actions available while friends load', async () => {
    const wrapper = mountMenu({ friends: [], isLoading: true });
    await wrapper.get('button[aria-label="Open dashboard actions"]').trigger('click');
    await flushPromises();
    const menu = document.body.querySelector('[role="menu"]');

    expect(menu?.textContent).toContain('Start a meeting');
    expect(menu?.textContent).toContain('Loading friends');
    expect(menu?.textContent).toContain('Report a bug');
  });
});
