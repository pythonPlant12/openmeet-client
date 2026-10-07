import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
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
  it('spells out the status of a registered participant on the pinned tile', () => {
    const tag = mountTile('doNotDisturb', 'full').get('[data-participant-name-tag]');

    expect(tag.get('[data-participant-status]').attributes('data-status')).toBe('doNotDisturb');
    expect(tag.text()).toContain('Do not disturb');
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
