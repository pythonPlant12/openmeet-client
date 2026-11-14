import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type EffectScope, effectScope, nextTick, ref } from 'vue';

import { AUTO_HIDE_MS, useCallControlsVisibility } from '@/composables/useCallControlsVisibility';

function mouseMove() {
  document.dispatchEvent(Object.assign(new Event('pointermove'), { pointerType: 'mouse' }));
}

describe('useCallControlsVisibility', () => {
  let scope: EffectScope;

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    scope.stop();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  function setUp(desktop = true) {
    scope = effectScope();
    const autoHide = ref(desktop);
    const controls = scope.run(() => useCallControlsVisibility(autoHide))!;
    return { autoHide, ...controls };
  }

  describe('on desktop', () => {
    it('shows the controls, then hides them after 3 s without mouse movement', () => {
      const { shown } = setUp();
      expect(AUTO_HIDE_MS).toBe(3000);
      expect(shown.value).toBe(true);
      vi.advanceTimersByTime(AUTO_HIDE_MS - 1);
      expect(shown.value).toBe(true);
      vi.advanceTimersByTime(1);
      expect(shown.value).toBe(false);
    });

    it('brings the controls back on mouse movement and restarts the countdown', () => {
      const { shown } = setUp();
      vi.advanceTimersByTime(AUTO_HIDE_MS);
      mouseMove();
      expect(shown.value).toBe(true);
      vi.advanceTimersByTime(AUTO_HIDE_MS - 500);
      mouseMove();
      vi.advanceTimersByTime(AUTO_HIDE_MS - 500);
      expect(shown.value).toBe(true);
      vi.advanceTimersByTime(500);
      expect(shown.value).toBe(false);
    });

    it.each([
      ['a menu', '<div role="menu"></div>'],
      ['a sheet or dialog', '<div role="dialog"></div>'],
      ['the chat', '<div class="harbor-chat-panel" data-state="open"></div>'],
    ])('keeps the controls while %s is open', (_, html) => {
      const { shown } = setUp();
      document.body.innerHTML = html;
      vi.advanceTimersByTime(AUTO_HIDE_MS * 2);
      expect(shown.value).toBe(true);

      document.body.innerHTML = '';
      vi.advanceTimersByTime(AUTO_HIDE_MS);
      expect(shown.value).toBe(false);
    });

    it('starts the countdown when a window grows from phone to desktop', async () => {
      const { autoHide, shown } = setUp(false);
      autoHide.value = true;
      await nextTick();
      vi.advanceTimersByTime(AUTO_HIDE_MS);
      expect(shown.value).toBe(false);
    });
  });

  describe('on a phone', () => {
    it('keeps the controls until a long-press, with no automatic hiding', () => {
      const { shown } = setUp(false);
      vi.advanceTimersByTime(AUTO_HIDE_MS * 10);
      expect(shown.value).toBe(true);
    });

    it('hides and shows the controls on each long-press', () => {
      const { shown, toggle } = setUp(false);
      toggle();
      expect(shown.value).toBe(false);
      vi.advanceTimersByTime(AUTO_HIDE_MS * 2);
      expect(shown.value).toBe(false);
      toggle();
      expect(shown.value).toBe(true);
    });

    it.each([
      ['the chat', '<div class="harbor-chat-panel" data-state="open"></div>'],
      ['the drag-up panel', '<div data-call-phone-controls data-state="open"></div>'],
      ['a sheet', '<div role="dialog"></div>'],
    ])('keeps the controls on a long-press while %s is open', (_, html) => {
      const { shown, toggle } = setUp(false);
      document.body.innerHTML = html;
      toggle();
      expect(shown.value).toBe(true);
    });

    it('ignores mouse movement', () => {
      const { shown, toggle } = setUp(false);
      toggle();
      mouseMove();
      expect(shown.value).toBe(false);
    });
  });

  it('shows and hides on request', () => {
    const { shown, show, hide } = setUp(false);
    hide();
    expect(shown.value).toBe(false);
    show();
    expect(shown.value).toBe(true);
  });
});
