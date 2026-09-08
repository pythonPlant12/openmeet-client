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

export function toast({ title, description, duration, variant, action, cancel }: ToastOptions) {
  const options = { description, duration, action, cancel };
  if (variant === 'destructive') return sonnerToast.error(title, options);
  if (variant === 'success') return sonnerToast.success(title, options);
  return sonnerToast(title, options);
}
