import { type Action, toast as sonnerToast } from 'vue-sonner';

export type ToastVariant = 'default' | 'success' | 'destructive';

export interface ToastOptions {
  title: string;
  description?: string;
  duration?: number;
  variant?: ToastVariant;
  action?: Action;
  cancel?: Action;
}

export function dismissToast(id: number | string) {
  sonnerToast.dismiss(id);
}

// Only the latest notification shows: a new one replaces whatever is on screen. Neutral notifications use
// Sonner's info type, so they get an icon like the others.
export function toast({ title, description, duration, variant, action, cancel }: ToastOptions) {
  const options = { description, duration, action, cancel };
  sonnerToast.dismiss();
  if (variant === 'destructive') return sonnerToast.error(title, options);
  if (variant === 'success') return sonnerToast.success(title, options);
  return sonnerToast.info(title, options);
}

/**
 * A dialog or sheet calls this for a press or focus outside it: a press on a notification, such as a swipe to
 * dismiss it, must not also close the dialog.
 */
export function keepOpenForToasts(event: Event) {
  const original = (event as CustomEvent<{ originalEvent?: Event }>).detail?.originalEvent;
  const target = original?.target ?? event.target;
  if (target instanceof Element && target.closest('[data-sonner-toaster]')) event.preventDefault();
}
