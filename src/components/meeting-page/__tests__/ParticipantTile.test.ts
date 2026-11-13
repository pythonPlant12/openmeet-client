import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import ParticipantTile from '@/components/meeting-page/ParticipantTile.vue';
import type { UserStatus } from '@/services/social-api';

const participant = {
  id: 'p-1',
  name: 'Ada Lovelace',
  isLocal: false,
  stream: null,
  audioEnabled: true,
  videoEnabled: true,
};

function mountTile(
  status: UserStatus | null,
  size: 'grid' | 'sidebar' | 'full' = 'grid',
  extra: { speaking?: boolean; participant?: typeof participant; avatarUrl?: string } = {},
) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: { meeting: { participant: { offline: 'Offline', status: 'Status: {status}' } } } },
    missingWarn: false,
  });
  return mount(ParticipantTile, {
    props: {
      participant: extra.participant ?? participant,
      status,
      size,
      speaking: extra.speaking,
      avatarUrl: extra.avatarUrl,
    },
    global: { plugins: [i18n] },
  });
}

describe('ParticipantTile status', () => {
  it('shows only the status dot in the name tag and announces the status to screen readers', () => {
    const tag = mountTile('doNotDisturb', 'full').get('[data-participant-name-tag]');

    expect(tag.get('[data-participant-status]').attributes('data-status')).toBe('doNotDisturb');
    expect(tag.get('.sr-only').text()).toBe('Status: Do not disturb');
    expect(tag.text().replace('Status: Do not disturb', '')).not.toContain('Do not disturb');
  });

  it('shows "appear offline" as plain offline to others', () => {
    expect(mountTile('offline', 'full').get('[data-participant-name-tag]').text()).toContain('Offline');
  });

  it('shows no status for guests', () => {
    expect(mountTile(null).find('[data-participant-status]').exists()).toBe(false);
  });

  it('keeps only the dot on grid and small tiles', () => {
    for (const size of ['grid', 'sidebar'] as const) {
      const tag = mountTile('away', size).get('[data-participant-name-tag]');
      expect(tag.find('[data-participant-status]').exists()).toBe(true);
      expect(tag.text()).toBe('ALAda LovelaceStatus: Away');
    }
  });

  it('starts the name tag with a mini avatar, falling back to initials', () => {
    const withImage = mountTile(null, 'grid', { avatarUrl: 'blob:ada' }).get('[data-participant-mini-avatar]');
    expect(withImage.get('img').attributes('src')).toBe('blob:ada');

    const withInitials = mountTile(null).get('[data-participant-mini-avatar]');
    expect(withInitials.find('img').exists()).toBe(false);
    expect(withInitials.text()).toBe('AL');
  });

  it('keeps the name tag in the bottom-left corner, tighter on small tiles', () => {
    expect(mountTile(null).get('[data-participant-name-tag]').classes()).toEqual(
      expect.arrayContaining(['bottom-2', 'left-2', 'text-xs']),
    );
    expect(mountTile(null, 'sidebar').get('[data-participant-name-tag]').classes()).toEqual(
      expect.arrayContaining(['bottom-1.5', 'left-1.5', 'text-[11px]']),
    );
  });
});

describe('ParticipantTile media states', () => {
  it('highlights the active speaker', () => {
    expect(mountTile(null, 'grid', { speaking: true }).attributes('data-speaking')).toBe('true');
    expect(mountTile(null).attributes('data-speaking')).toBe('false');
  });

  it('shows a loader until a remote camera has a stream', () => {
    expect(mountTile(null).find('[data-participant-loading]').exists()).toBe(true);
  });

  it('shows no loader for your own tile or a camera that is off', () => {
    expect(
      mountTile(null, 'grid', { participant: { ...participant, isLocal: true } })
        .find('[data-participant-loading]')
        .exists(),
    ).toBe(false);
    expect(
      mountTile(null, 'grid', { participant: { ...participant, videoEnabled: false } })
        .find('[data-participant-loading]')
        .exists(),
    ).toBe(false);
  });
});

describe('ParticipantTile avatar', () => {
  const cameraOff = { ...participant, videoEnabled: false };

  it('shows the real avatar while the camera is off', () => {
    const tile = mountTile(null, 'full', { participant: cameraOff, avatarUrl: 'blob:ada' });
    expect(tile.get('[data-participant-avatar] img').attributes('src')).toBe('blob:ada');
  });

  it('falls back to initials without an avatar', () => {
    const tile = mountTile(null, 'full', { participant: cameraOff });
    expect(tile.get('[data-participant-avatar]').text()).toBe('AL');
  });

  it('marks the pinned person with a badge that needs no hover', () => {
    const tile = mount(ParticipantTile, {
      props: { participant, isExpanded: true },
      global: { plugins: [createI18n({ legacy: false, locale: 'en', missingWarn: false })] },
    });
    expect(tile.find('[data-participant-pinned]').exists()).toBe(true);
  });
});

describe('ParticipantTile interactions', () => {
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
    HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  });

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        meeting: {
          actions: { fullscreen: 'Full screen', exitFullscreen: 'Exit full screen' },
          participant: {
            pin: 'Pin {name}',
            unpin: 'Unpin {name}',
            options: 'Options for {name}',
            showName: 'Show name',
            hideName: 'Hide name',
          },
        },
      },
    },
    missingWarn: false,
  });

  function mountInteractive(props: Record<string, unknown> = {}) {
    return mount(ParticipantTile, {
      attachTo: document.body,
      props: { participant, ...props },
      global: { plugins: [i18n] },
    });
  }

  async function openOptions(tile: ReturnType<typeof mountInteractive>) {
    await tile.get('button[aria-label="Options for Ada Lovelace"]').trigger('click');
    await flushPromises();
    return Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }

  it('shrinks while pressed', async () => {
    const tile = mountInteractive();
    const surface = tile.get('[data-participant-surface]');
    await surface.trigger('pointerdown');
    expect(tile.attributes('data-pressed')).toBe('true');
    await surface.trigger('pointerup');
    expect(tile.attributes('data-pressed')).toBeUndefined();
  });

  it('rings the person speaking in the Harbor accent', () => {
    const tile = mountInteractive({ speaking: true });
    expect(tile.get('[data-participant-surface]').classes()).toEqual(
      expect.arrayContaining(['border-harbor-accent', 'ring-harbor-accent/25']),
    );
  });

  it('offers pin and full screen from the tile options', async () => {
    const tile = mountInteractive();
    const items = await openOptions(tile);
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Pin Ada Lovelace', 'Full screen']);

    items[0]!.click();
    await flushPromises();
    expect(tile.emitted('togglePin')).toHaveLength(1);

    (await openOptions(tile))[1]!.click();
    await flushPromises();
    expect(tile.emitted('toggleFullscreen')).toHaveLength(1);
  });

  it('offers unpin and leaving full screen for the pinned full screen tile', async () => {
    const tile = mountInteractive({ isExpanded: true, isFullscreen: true });
    const labels = (await openOptions(tile)).map((item) => item.textContent?.trim());
    expect(labels).toEqual(['Unpin Ada Lovelace', 'Exit full screen']);
  });

  it('offers the name toggle on tiles that hide the name', async () => {
    const tile = mountInteractive({ showNameTag: false, nameToggle: true });
    const items = await openOptions(tile);
    expect(items.map((item) => item.textContent?.trim())).toContain('Show name');
    items.find((item) => item.textContent?.includes('Show name'))!.click();
    await flushPromises();
    expect(tile.emitted('toggleName')).toHaveLength(1);
  });

  it('shows no options button when the tile has no actions', () => {
    expect(
      mountInteractive({ showActions: false }).find('button[aria-label="Options for Ada Lovelace"]').exists(),
    ).toBe(false);
  });
});
