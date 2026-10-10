/**
 * Swallows the click that follows a press used to dismiss an overlay (a menu or the meeting chat), so closing it
 * does not also activate whatever was under the pointer, such as a tile that would pin or a control button.
 * The guard expires if no click follows, for example after a drag.
 */
export function swallowNextClick(timeoutMs = 600) {
  let timer = 0;
  const stop = () => {
    document.removeEventListener('click', swallow, true);
    window.clearTimeout(timer);
  };
  function swallow(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    stop();
    // Reka closes layers on touch from a document-level click listener, which the swallowed click no longer
    // reaches. A click on the document itself still dismisses them without reaching any element.
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
  document.addEventListener('click', swallow, true);
  timer = window.setTimeout(stop, timeoutMs);
}

// Open overlays that a press outside should only dismiss: menus, and panels marked with `data-dismiss-guard`.
const OPEN_OVERLAYS = '[role="menu"], [data-dismiss-guard][data-state="open"]';
// Presses here belong to an overlay, or toggle one, so their click must go through.
const OVERLAY_PARTS =
  '[role="menu"], [role="dialog"], [data-dismiss-guard], [aria-haspopup][data-state="open"], [data-chat-trigger]';

/**
 * Makes every press outside an open menu or guarded panel dismiss-only. Reka reports touch presses outside a
 * layer only after their click has already reached the page, so the guard runs on `pointerdown` in the capture
 * phase, before anything underneath can react.
 */
export function installOverlayClickGuard(target: Document = document) {
  const onPointerDown = (event: PointerEvent) => {
    if (!target.querySelector(OPEN_OVERLAYS)) return;
    if (event.target instanceof Element && event.target.closest(OVERLAY_PARTS)) return;
    swallowNextClick();
  };
  target.addEventListener('pointerdown', onPointerDown, true);
  return () => target.removeEventListener('pointerdown', onPointerDown, true);
}
