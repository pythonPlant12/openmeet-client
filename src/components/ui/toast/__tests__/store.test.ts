import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dismissToast, keepOpenForToasts, toast } from '@/components/ui/toast/store';

const sonner = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), {
    dismiss: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  });
  return { toast };
});

vi.mock('vue-sonner', () => ({ toast: sonner.toast }));

describe('toast adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('routes neutral (as info, for its icon), success, and destructive notifications to Sonner', () => {
    toast({ title: 'Notice', description: 'Details', duration: 4000 });
    toast({ title: 'Saved', variant: 'success' });
    toast({ title: 'Failed', variant: 'destructive' });

    expect(sonner.toast.info).toHaveBeenCalledWith('Notice', {
      description: 'Details',
      duration: 4000,
      action: undefined,
      cancel: undefined,
    });
    expect(sonner.toast.success).toHaveBeenCalledWith('Saved', {
      description: undefined,
      duration: undefined,
      action: undefined,
      cancel: undefined,
    });
    expect(sonner.toast.error).toHaveBeenCalledWith('Failed', {
      description: undefined,
      duration: undefined,
      action: undefined,
      cancel: undefined,
    });
  });

  it('replaces the notification on screen, so only the latest one shows', () => {
    toast({ title: 'First' });
    toast({ title: 'Second', variant: 'success' });

    expect(sonner.toast.dismiss).toHaveBeenCalledTimes(2);
    expect(sonner.toast.dismiss).toHaveBeenLastCalledWith();
    expect(sonner.toast.dismiss.mock.invocationCallOrder[1]).toBeLessThan(
      sonner.toast.success.mock.invocationCallOrder[0]!,
    );
  });

  it('dismisses a Sonner notification by id', () => {
    dismissToast('toast-id');

    expect(sonner.toast.dismiss).toHaveBeenCalledWith('toast-id');
  });

  it('keeps a dialog open for a press on a notification, and only then', () => {
    const toaster = document.createElement('section');
    toaster.setAttribute('data-sonner-toaster', '');
    const toastItem = document.createElement('li');
    toaster.append(toastItem);
    const outside = (target: Element) => {
      const event = new CustomEvent('dismissableLayer.pointerDownOutside', {
        cancelable: true,
        detail: { originalEvent: { target } },
      });
      keepOpenForToasts(event);
      return event.defaultPrevented;
    };

    expect(outside(toastItem)).toBe(true);
    expect(outside(document.createElement('div'))).toBe(false);
  });
});
