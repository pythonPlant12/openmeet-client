import { useMediaQuery, useTimeoutFn } from '@vueuse/core';
import { type Ref, computed, ref, watch } from 'vue';

const TITLE_BLUR_SECONDS = 0.2;
const TITLE_BLURRED = { opacity: 0, filter: 'blur(6px)' };
const TITLE_CLEAR = { opacity: 1, filter: 'blur(0px)' };

/**
 * A sidebar pane header that shows one view at a time: the old title blurs out, the title and the search placeholder
 * change together at the peak of the blur, and the new title blurs in. A timer of the blur's length makes the swap,
 * so the header changes even where the animation never runs. Bind `titleMotion` to the title's `motion.span` and
 * read the header text from `shown`.
 */
export function usePaneTitleSwap<T>(view: Ref<T>) {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const shown = ref(view.value) as Ref<T>;
  const blurred = ref(false);
  const { start: swapAtPeakBlur } = useTimeoutFn(
    () => {
      shown.value = view.value;
      blurred.value = false;
    },
    TITLE_BLUR_SECONDS * 1000,
    { immediate: false },
  );

  watch(view, (next) => {
    if (prefersReducedMotion.value) {
      shown.value = next;
      return;
    }
    blurred.value = true;
    swapAtPeakBlur();
  });

  const titleMotion = computed(() => ({
    initial: false,
    animate: blurred.value ? TITLE_BLURRED : TITLE_CLEAR,
    transition: { duration: TITLE_BLUR_SECONDS, ease: 'easeOut' as const },
  }));

  return { shown, titleMotion };
}
