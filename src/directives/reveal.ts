import type { Directive } from 'vue';

const observers = new WeakMap<Element, IntersectionObserver>();

export const reveal: Directive<HTMLElement> = {
  mounted(element) {
    if (!('IntersectionObserver' in window)) {
      element.classList.add('reveal-visible');
      return;
    }

    element.classList.add('reveal-pending');
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.classList.add('reveal-visible');
        observer.disconnect();
        observers.delete(element);
      },
      { threshold: 0.12 },
    );

    observers.set(element, observer);
    observer.observe(element);
  },
  unmounted(element) {
    observers.get(element)?.disconnect();
    observers.delete(element);
  },
};
