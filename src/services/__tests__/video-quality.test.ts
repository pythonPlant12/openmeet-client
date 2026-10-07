import { describe, expect, it } from 'vitest';

import {
  type AutoQualityState,
  CAMERA_LEVELS,
  type QualitySample,
  captureConstraints,
  maxLevelForAudience,
  nextAutoState,
} from '@/services/video-quality';

const good: QualitySample = { limitation: 'none', availableBitrate: null, lossRatio: 0, roundTripTime: 0.05 };
const congested: QualitySample = { ...good, limitation: 'bandwidth' };
const start: AutoQualityState = { index: 2, goodSamples: 0, badSamples: 0, lastDowngradeAt: 0 };
const NOW = 1_000_000;

function run(samples: QualitySample[], state = start, maxIndex = 3, stepMs = 4_000) {
  return samples.reduce(
    (current, sample, step) => nextAutoState(current, sample, CAMERA_LEVELS, maxIndex, NOW + step * stepMs),
    state,
  );
}

describe('auto video quality', () => {
  it('starts at 720p and never captures above 1080p', () => {
    expect(CAMERA_LEVELS[start.index]!.height).toBe(720);
    expect(captureConstraints(CAMERA_LEVELS, 'auto').height).toEqual({ ideal: 1080, max: 1080 });
    expect(captureConstraints(CAMERA_LEVELS, '360p').height).toEqual({ ideal: 360, max: 360 });
  });

  it('steps down after two congested samples in a row, not after one', () => {
    expect(run([congested]).index).toBe(2);
    expect(run([congested, good, congested]).index).toBe(2);
    expect(run([congested, congested]).index).toBe(1);
  });

  it('treats loss or a slow round trip from the SFU as congestion', () => {
    expect(
      run([
        { ...good, lossRatio: 0.08 },
        { ...good, lossRatio: 0.08 },
      ]).index,
    ).toBe(1);
    expect(
      run([
        { ...good, roundTripTime: 0.6 },
        { ...good, roundTripTime: 0.6 },
      ]).index,
    ).toBe(1);
  });

  it('steps up quickly with bandwidth headroom and slowly without it', () => {
    const headroom = { ...good, availableBitrate: 10_000_000 };
    expect(run([headroom, headroom]).index).toBe(3);
    expect(run(Array(5).fill(good)).index).toBe(2);
    expect(run(Array(6).fill(good)).index).toBe(3);
  });

  it('waits out a cooldown after stepping down before rising again', () => {
    const lowered = run([congested, congested]);
    const headroom = { ...good, availableBitrate: 10_000_000 };
    const soon = [headroom, headroom].reduce(
      (state, sample, step) =>
        nextAutoState(state, sample, CAMERA_LEVELS, 3, lowered.lastDowngradeAt + 4_000 * (step + 1)),
      lowered,
    );
    expect(soon.index).toBe(1);
    const later = [headroom, headroom].reduce(
      (state, sample, step) =>
        nextAutoState(state, sample, CAMERA_LEVELS, 3, lowered.lastDowngradeAt + 40_000 + 4_000 * step),
      lowered,
    );
    expect(later.index).toBe(2);
  });

  it('caps auto quality by how many people receive the video', () => {
    expect(maxLevelForAudience(1, 'camera')).toBe(3);
    expect(maxLevelForAudience(3, 'camera')).toBe(2);
    expect(maxLevelForAudience(5, 'camera')).toBe(1);
    expect(maxLevelForAudience(10, 'camera')).toBe(0);
    expect(maxLevelForAudience(3, 'screen')).toBe(3);
    expect(run([{ ...good, availableBitrate: 10_000_000 }], start, 1).index).toBe(1);
  });
});
