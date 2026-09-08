import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dismissToast, toast } from '@/components/ui/toast/store';

const sonner = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), {
    dismiss: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  });
  return { toast };
});

vi.mock('vue-sonner', () => ({ toast: sonner.toast }));

describe('toast adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('routes neutral, success, and destructive notifications to Sonner', () => {
    toast({ title: 'Notice', description: 'Details', duration: 4000 });
    toast({ title: 'Saved', variant: 'success' });
    toast({ title: 'Failed', variant: 'destructive' });

    expect(sonner.toast).toHaveBeenCalledWith('Notice', {
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

  it('dismisses a Sonner notification by id', () => {
    dismissToast('toast-id');

    expect(sonner.toast.dismiss).toHaveBeenCalledWith('toast-id');
  });
});
