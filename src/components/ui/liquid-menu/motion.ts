import type { InjectionKey } from 'vue';

/** Provide `false` to keep every menu icon below a component still. */
export const menuIconMotionKey: InjectionKey<boolean> = Symbol('menuIconMotion');
