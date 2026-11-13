import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type EffectScope, effectScope, nextTick, ref } from 'vue';

import { AUTO_HIDE_MS, useAutoHideControls } from '@/composables/useAutoHideControls';

function mouseMove() {
  document.dispatchEvent(Object.assign(new Event('pointermove'), { pointerType: 'mouse' }));
}

describe('useAutoHideControls', () => {
  let scope: EffectScope;

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    scope.stop();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  function setUp(active = true) {
    scope = effectScope();
    const enabled = ref(active);
    const controls = scope.run(() => useAutoHideControls(enabled))!;
    return { enabled, ...controls };
  }

  it('always shows the controls outside full screen', () => {
    const { shown } = setUp(false);
    vi.advanceTimersByTime(AUTO_HIDE_MS * 2);
    expect(shown.value).toBe(true);
  });

  it('shows the controls on entering full screen and hides them after 3 s without mouse movement', async () => {
    const { enabled, shown } = setUp(false);
    enabled.value = true;
    await nextTick();

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
    expect(shown.value).toBe(false);

    mouseMove();
    expect(shown.value).toBe(true);
    vi.advanceTimersByTime(AUTO_HIDE_MS - 500);
    mouseMove();
    vi.advanceTimersByTime(AUTO_HIDE_MS - 500);
    expect(shown.value).toBe(true);
    vi.advanceTimersByTime(500);
    expect(shown.value).toBe(false);
  });

  it('keeps the controls while a menu is open', () => {
    const { shown } = setUp();
    document.body.innerHTML = '<div role="menu"></div>';
    vi.advanceTimersByTime(AUTO_HIDE_MS * 2);
    expect(shown.value).toBe(true);

    document.body.innerHTML = '';
    vi.advanceTimersByTime(AUTO_HIDE_MS);
    expect(shown.value).toBe(false);
  });

  it('shows and hides on request, for touch swipes', () => {
    const { shown, show, hide } = setUp();
    hide();
    expect(shown.value).toBe(false);
    show(false);
    vi.advanceTimersByTime(AUTO_HIDE_MS * 2);
    expect(shown.value).toBe(true);
  });
});
