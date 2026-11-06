import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Harbor shadow sizes from tailwind.config.js. Without them, tailwind-merge reads `shadow-harbor-*` as a
// shadow color and keeps a component's default `shadow-sm`, which then wins.
const twMerge = extendTailwindMerge({
  extend: { theme: { shadow: ['harbor-soft', 'harbor-raised', 'harbor-float', 'harbor-around'] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
