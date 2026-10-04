import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import { PresenceDot } from '@/components/ui/presence-dot';
import { PRESENCE_INDICATOR_SURFACES } from '@/config/presence.config';

afterEach(() => {
  PRESENCE_INDICATOR_SURFACES.friends = true;
});

describe('PresenceDot', () => {
  it('renders only for online users', () => {
    expect(
      mount(PresenceDot, { props: { online: true, surface: 'friends' } })
        .find('[data-presence-dot]')
        .exists(),
    ).toBe(true);
    expect(
      mount(PresenceDot, { props: { online: false, surface: 'friends' } })
        .find('[data-presence-dot]')
        .exists(),
    ).toBe(false);
  });

  it('colours the dot by status and labels it', () => {
    const dot = mount(PresenceDot, { props: { online: true, surface: 'friends', status: 'doNotDisturb' } }).get(
      '[data-presence-dot]',
    );

    expect(dot.classes()).toContain('bg-[#C4513D]');
    expect(dot.attributes('aria-label')).toBe('Do not disturb');
  });

  it('respects the per-surface configuration', () => {
    PRESENCE_INDICATOR_SURFACES.friends = false;

    expect(
      mount(PresenceDot, { props: { online: true, surface: 'friends' } })
        .find('[data-presence-dot]')
        .exists(),
    ).toBe(false);
  });
});
