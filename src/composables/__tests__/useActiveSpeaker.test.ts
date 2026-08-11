import { describe, expect, it } from 'vitest';

import { createActiveSpeakerDetector } from '@/composables/useActiveSpeaker';

describe('createActiveSpeakerDetector', () => {
  it('requires sustained audio before selecting a speaker', () => {
    const detector = createActiveSpeakerDetector();

    expect(detector.update(new Map([['speaker-a', 0.08]]), 0)).toBeNull();
    expect(detector.update(new Map([['speaker-a', 0.08]]), 400)).toBe('speaker-a');
  });

  it('holds the current speaker through short competing bursts', () => {
    const detector = createActiveSpeakerDetector();
    detector.update(new Map([['speaker-a', 0.08]]), 0);
    detector.update(new Map([['speaker-a', 0.08]]), 400);

    expect(detector.update(new Map([['speaker-b', 0.2]]), 800)).toBe('speaker-a');
    expect(detector.update(new Map([['speaker-b', 0.2]]), 1_000)).toBe('speaker-a');
    expect(detector.update(new Map([['speaker-b', 0.2]]), 1_600)).toBe('speaker-b');
  });

  it('releases speaker only after sustained silence and minimum hold', () => {
    const detector = createActiveSpeakerDetector();
    detector.update(new Map([['speaker-a', 0.08]]), 0);
    detector.update(new Map([['speaker-a', 0.08]]), 400);

    expect(detector.update(new Map(), 800)).toBe('speaker-a');
    expect(detector.update(new Map(), 1_200)).toBe('speaker-a');
    expect(detector.update(new Map(), 1_600)).toBe('speaker-a');
    expect(detector.update(new Map(), 2_000)).toBeNull();
  });
});
