import { onMounted, onUnmounted } from 'vue';

/**
 * Locks the viewport to prevent scrolling and zooming.
 * Useful for fullscreen experiences like video conferencing.
 * Automatically cleans up when the component unmounts.
 */
export function useFullscreenLock() {
  let originalOverflow: string;
  let originalTouchAction: string;
  let originalUserSelect: string;
  let originalViewport: string | null;

  const lock = () => {
    // Store original values
    originalOverflow = document.body.style.overflow;
    originalTouchAction = document.body.style.touchAction;
    originalUserSelect = document.body.style.userSelect;

    // Apply lock styles to body
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'manipulation';
    document.body.style.userSelect = 'none';

    // Also apply to html element
    document.documentElement.style.overflow = 'hidden';

    // Update viewport meta to prevent zooming
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      originalViewport = viewportMeta.getAttribute('content');
      viewportMeta.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
      );
    }
  };

  const unlock = () => {
    // Restore original styles
    document.body.style.overflow = originalOverflow || '';
    document.body.style.touchAction = originalTouchAction || '';
    document.body.style.userSelect = originalUserSelect || '';
    document.documentElement.style.overflow = '';

    // Restore viewport meta
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta && originalViewport) {
      viewportMeta.setAttribute('content', originalViewport);
    }
  };

  onMounted(() => {
    lock();
  });

  onUnmounted(() => {
    unlock();
  });

  return { lock, unlock };
}
