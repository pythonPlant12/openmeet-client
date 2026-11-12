import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { UserMinus } from 'lucide-vue-next';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { i18n } from '@/i18n';
import { playHaptic } from '@/services/haptics';

vi.mock('@/services/haptics', () => ({ playHaptic: vi.fn() }));

enableAutoUnmount(afterEach);

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

/** Phones match the app's `(max-width: 639px)` breakpoint. */
function useViewport(phone: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: phone && query.includes('max-width: 639px'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })),
  );
}

async function mountConfirm(props: Record<string, unknown> = {}) {
  const wrapper = mount(ConfirmDialog, {
    props: {
      open: true,
      icon: UserMinus,
      title: 'Remove Alex?',
      description: 'You can send another request later.',
      actionLabel: 'Remove friend',
      ...props,
    },
    attachTo: document.body,
    global: { plugins: [i18n] },
  });
  await flushPromises();
  return wrapper;
}

function buttons() {
  return [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] [data-confirm-dialog-actions] button')];
}

describe('ConfirmDialog', () => {
  it('shows the icon, title, consequence line, and both actions', async () => {
    useViewport(false);
    await mountConfirm();

    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.querySelector('[data-confirm-dialog-icon] svg')).not.toBeNull();
    expect(dialog.textContent).toContain('Remove Alex?');
    expect(dialog.textContent).toContain('You can send another request later.');
    expect(buttons().map((button) => button.textContent?.trim())).toEqual(['Cancel', 'Remove friend']);
  });

  it('puts the action on top of Cancel in the phone action sheet', async () => {
    useViewport(true);
    await mountConfirm();

    expect(document.querySelector('[role="dialog"]')!.hasAttribute('data-confirm-dialog-sheet')).toBe(true);
    expect(buttons().map((button) => button.textContent?.trim())).toEqual(['Remove friend', 'Cancel']);
  });

  it('starts focus on Cancel', async () => {
    useViewport(false);
    await mountConfirm();

    expect(document.activeElement?.textContent?.trim()).toBe('Cancel');
  });

  it('confirms with a warning haptic for a destructive action', async () => {
    useViewport(false);
    const wrapper = await mountConfirm({ tone: 'danger' });

    buttons()
      .find((button) => button.textContent?.includes('Remove friend'))!
      .click();

    expect(wrapper.emitted('confirm')).toHaveLength(1);
    expect(wrapper.emitted('cancel')).toBeUndefined();
    expect(playHaptic).toHaveBeenCalledWith('warning');
  });

  it('confirms an accent action without the warning haptic', async () => {
    useViewport(false);
    const wrapper = await mountConfirm({ tone: 'accent', actionLabel: 'Join' });

    buttons()
      .find((button) => button.textContent?.includes('Join'))!
      .click();

    expect(wrapper.emitted('confirm')).toHaveLength(1);
    expect(playHaptic).not.toHaveBeenCalled();
  });

  it('cancels and closes from the Cancel button', async () => {
    useViewport(false);
    const wrapper = await mountConfirm();

    buttons()
      .find((button) => button.textContent?.includes('Cancel'))!
      .click();

    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false]);
    expect(wrapper.emitted('confirm')).toBeUndefined();
  });

  it('cancels on Escape', async () => {
    useViewport(false);
    const wrapper = await mountConfirm();

    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();

    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false]);
  });

  it('disables both actions and ignores Escape while busy', async () => {
    useViewport(false);
    const wrapper = await mountConfirm({ busy: true, busyLabel: 'Removing…' });

    expect(buttons().every((button) => button.disabled)).toBe(true);
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Removing…');
    document
      .querySelector('[role="dialog"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();

    expect(wrapper.emitted('cancel')).toBeUndefined();
  });
});
