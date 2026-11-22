import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import GroupPasswordDialog from '@/components/dashboard-page/groups/GroupPasswordDialog.vue';

const stubs = {
  Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  HarborDialogContent: { template: '<div><slot /></div>' },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<div><slot /></div>' },
  DialogDescription: { template: '<div><slot /></div>' },
  DialogFooter: { template: '<div><slot /></div>' },
  LoadingRipple: { template: '<span data-loading />' },
};

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(GroupPasswordDialog, {
    props: { open: true, groupTitle: 'Harbor', password: '', checking: false, error: '', ...props },
    global: { stubs },
  });
}

describe('GroupPasswordDialog', () => {
  it('asks only for the password, and continues once one is entered', async () => {
    const wrapper = mountDialog();
    expect(wrapper.text()).toContain('Harbor is protected with a password.');
    expect(wrapper.findAll('input').map((input) => input.attributes('type'))).toEqual(['password']);
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();

    await wrapper.setProps({ password: 'secret' });
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined();
    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  it('shows a wrong password in the dialog', () => {
    const wrapper = mountDialog({ password: 'nope', error: 'That password is not right.' });
    expect(wrapper.get('[role="alert"]').text()).toBe('That password is not right.');
  });
});
