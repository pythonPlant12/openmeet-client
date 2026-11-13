import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { RoundButton } from '@/components/ui/round-button';

describe('RoundButton', () => {
  it('renders the accent tone as the teal glass', () => {
    const button = mount(RoundButton, { props: { tone: 'accent' }, attrs: { 'aria-label': 'New chat' } });

    expect(button.attributes('aria-label')).toBe('New chat');
    expect(button.classes()).toContain('liquid-glass-primary');
  });

  it('renders the danger tone as the red glass', () => {
    const button = mount(RoundButton, { props: { tone: 'danger' } });

    expect(button.classes()).toContain('liquid-glass-danger');
    expect(button.classes()).not.toContain('liquid-glass-primary');
  });

  it.each(['default', 'soft', 'plain', 'destructive'] as const)('keeps the %s tone flat', (tone) => {
    const button = mount(RoundButton, { props: { tone } });

    expect(button.classes()).not.toContain('liquid-glass-primary');
    expect(button.classes()).not.toContain('liquid-glass-danger');
  });
});
