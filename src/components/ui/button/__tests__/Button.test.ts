import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders the accent variant as the teal glass', () => {
    const button = mount(Button, { props: { variant: 'accent' }, slots: { default: 'Start meeting' } });

    expect(button.text()).toBe('Start meeting');
    expect(button.classes()).toContain('liquid-glass-primary');
    expect(button.classes()).not.toContain('liquid-glass-danger');
  });

  it('renders the danger variant as the red glass', () => {
    const button = mount(Button, { props: { variant: 'danger' }, slots: { default: 'Remove' } });

    expect(button.classes()).toContain('liquid-glass-danger');
    expect(button.classes()).not.toContain('liquid-glass-primary');
  });

  it.each(['default', 'ghost', 'pill', 'pill-danger'] as const)('keeps the %s variant flat', (variant) => {
    const button = mount(Button, { props: { variant } });

    expect(button.classes()).not.toContain('liquid-glass-primary');
    expect(button.classes()).not.toContain('liquid-glass-danger');
  });
});
