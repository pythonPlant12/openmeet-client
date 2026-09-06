import { ref } from 'vue';

export type ToastVariant = 'default' | 'destructive';

export interface ToastOptions {
  title: string;
  description?: string;
  duration?: number;
  variant?: ToastVariant;
}

export interface ToastMessage extends ToastOptions {
  id: number;
}

export const toastMessages = ref<ToastMessage[]>([]);
let nextToastId = 0;

export function dismissToast(id: number) {
  toastMessages.value = toastMessages.value.filter((message) => message.id !== id);
}

export function toast(options: ToastOptions) {
  const message = { ...options, id: ++nextToastId };
  toastMessages.value = [...toastMessages.value, message];
  return message.id;
}
