import { describe, expect, it } from 'vitest';

import { LIQUID_PAD, createLiquidState, isLiquidActive, setLiquidTarget, stepLiquid } from '@/lib/liquid-glass';

const bar = { width: 400, height: 44 };

describe('liquid drop', () => {
  it('moves one drop to a new item and settles there', () => {
    const state = createLiquidState();
    setLiquidTarget(state, bar, { left: 4, top: 4, width: 100, height: 36 });
    expect(state.drop.x).toBe(LIQUID_PAD + 54);

    setLiquidTarget(state, bar, { left: 250, top: 4, width: 100, height: 36 });
    expect(state.moving).toBe(true);
    for (let frame = 0; frame < 240 && state.moving; frame += 1) stepLiquid(state, 1 / 60);

    expect(state.moving).toBe(false);
    expect(state.drop.x).toBeCloseTo(LIQUID_PAD + 300, 0);
    // Settling leaves a single ripple behind, not trailing droplets.
    expect(state.rips).toHaveLength(1);
  });

  it('jumps straight to the target with reduced motion', () => {
    const state = createLiquidState();
    state.reduce = true;
    setLiquidTarget(state, bar, { left: 4, top: 4, width: 100, height: 36 });
    setLiquidTarget(state, bar, { left: 250, top: 4, width: 100, height: 36 });
    stepLiquid(state, 1 / 60);

    expect(state.drop.x).toBe(LIQUID_PAD + 300);
    expect(state.rips).toHaveLength(0);
    expect(isLiquidActive(state)).toBe(false);
  });
});
