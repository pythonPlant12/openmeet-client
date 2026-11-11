import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';

import PaneHeader from '@/components/dashboard-page/PaneHeader.vue';

function mountHeader(props: Record<string, unknown> = {}) {
  return mount(PaneHeader, {
    props: { title: 'Group chats', searchLabel: 'Search group chats', query: '', ...props },
    slots: { trailing: () => h('button', { 'aria-label': 'Switch' }) },
    attachTo: document.body,
  });
}

describe('PaneHeader search', () => {
  it('starts as a round search button beside the title', () => {
    const wrapper = mountHeader();
    expect(wrapper.get('[data-pane-search]').attributes('data-expanded')).toBe('false');
    expect(wrapper.get('h1').text()).toContain('Group chats');
    expect(wrapper.get('input').attributes('placeholder')).toBe('Search group chats');
    expect(wrapper.get('input').attributes('aria-label')).toBe('Search group chats');
    wrapper.unmount();
  });

  it('expands over the title while focused and collapses when left empty', async () => {
    const wrapper = mountHeader();
    await wrapper.get('input').trigger('focus');
    expect(wrapper.get('[data-pane-search]').attributes('data-expanded')).toBe('true');
    expect(wrapper.get('h1').attributes('data-hidden')).toBe('true');
    expect(wrapper.emitted('search-focus')).toHaveLength(1);

    await wrapper.get('input').trigger('blur');
    expect(wrapper.get('[data-pane-search]').attributes('data-expanded')).toBe('false');
    expect(wrapper.emitted('search-blur')).toHaveLength(1);
    wrapper.unmount();
  });

  it('stays expanded while it holds a query, and clears it', async () => {
    const wrapper = mountHeader({ query: 'team' });
    expect(wrapper.get('[data-pane-search]').attributes('data-expanded')).toBe('true');
    await wrapper.get('button[aria-label="Clear search"]').trigger('click');
    expect(wrapper.emitted('update:query')).toEqual([['']]);
    wrapper.unmount();
  });

  it('clears and closes on Escape', async () => {
    const wrapper = mountHeader({ query: 'team' });
    await wrapper.get('input').trigger('keydown', { key: 'Escape' });
    expect(wrapper.emitted('update:query')).toEqual([['']]);
    wrapper.unmount();
  });

  it('keeps the plain title without a search', () => {
    const wrapper = mount(PaneHeader, { props: { title: 'Calls' } });
    expect(wrapper.find('[data-pane-search]').exists()).toBe(false);
    expect(wrapper.get('h1').text()).toBe('Calls');
  });
});
