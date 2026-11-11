import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { AvatarMosaic } from '@/components/ui/avatar';

const faces = [
  { src: '/ada.jpg', initials: 'A' },
  { initials: 'B' },
  { src: '/cy.jpg', initials: 'C' },
  { initials: 'D' },
  { initials: 'E' },
];

describe('AvatarMosaic', () => {
  it('fills one circle with up to four faces', () => {
    expect(mount(AvatarMosaic, { props: { faces: faces.slice(0, 2) } }).findAll('[data-mosaic-tile]')).toHaveLength(2);
    expect(mount(AvatarMosaic, { props: { faces: faces.slice(0, 3) } }).findAll('[data-mosaic-tile]')).toHaveLength(3);
    expect(mount(AvatarMosaic, { props: { faces } }).findAll('[data-mosaic-tile]')).toHaveLength(4);
  });

  it('shows pictures, then initials', () => {
    const tiles = mount(AvatarMosaic, { props: { faces: faces.slice(0, 2) } }).findAll('[data-mosaic-tile]');
    expect(tiles[0]!.get('img').attributes('src')).toBe('/ada.jpg');
    expect(tiles[1]!.text()).toBe('B');
  });

  it('is a plain avatar for one face', () => {
    const wrapper = mount(AvatarMosaic, { props: { faces: faces.slice(0, 1) } });
    expect(wrapper.findAll('[data-mosaic-tile]')).toHaveLength(1);
    expect(wrapper.get('img').attributes('src')).toBe('/ada.jpg');
  });
});
