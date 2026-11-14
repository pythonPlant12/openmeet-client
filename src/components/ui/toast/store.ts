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
