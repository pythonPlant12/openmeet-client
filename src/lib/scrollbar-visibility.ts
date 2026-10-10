// Scrollbars stay in the layout but are transparent until their element scrolls (see `[data-scrolling]` in
// index.css). Scroll events do not bubble, so one capturing listener on the document sees every scroller.
const HIDE_DELAY_MS = 800;

export function installScrollbarVisibility(target: Document = document) {
  const timers = new WeakMap<Element, number>();

  const mark = (element: Element) => {
    element.setAttribute('data-scrolling', '');
    window.clearTimeout(timers.get(element));
    timers.set(
      element,
      window.setTimeout(() => element.removeAttribute('data-scrolling'), HIDE_DELAY_MS),
    );
  };

  const onScroll = (event: Event) => {
    // WebKit and Chromium style the page scrollbar from <body>; Firefox reads `scrollbar-color` from <html>.
    const elements = event.target === target ? [target.scrollingElement, target.body] : [event.target];
    for (const element of elements) if (element instanceof Element) mark(element);
  };

  target.addEventListener('scroll', onScroll, { capture: true, passive: true });
  return () => target.removeEventListener('scroll', onScroll, { capture: true });
}
