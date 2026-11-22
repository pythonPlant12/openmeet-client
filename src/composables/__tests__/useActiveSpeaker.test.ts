import { describe, expect, it } from 'vitest';

import { createActiveSpeakerDetector, createSpeakingTracker } from '@/composables/useActiveSpeaker';

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

describe('createSpeakingTracker', () => {
  it('marks everyone talking at once from their first loud sample', () => {
    const tracker = createSpeakingTracker();

    expect([
      ...tracker.update(
        new Map([
          ['a', 0.05],
          ['b', 0.03],
          ['c', 0.001],
        ]),
        0,
      ),
    ]).toEqual(['a', 'b']);
  });

  it('picks up quiet speech', () => {
    expect(
      createSpeakingTracker()
        .update(new Map([['a', 0.015]]), 0)
        .has('a'),
    ).toBe(true);
  });

  it('keeps the border through short pauses and drops it after a longer silence', () => {
    const tracker = createSpeakingTracker();
    tracker.update(new Map([['a', 0.05]]), 0);

    expect(tracker.update(new Map([['a', 0]]), 450).has('a')).toBe(true);
    expect(tracker.update(new Map([['a', 0]]), 750).has('a')).toBe(false);
  });

  it('forgets someone who left', () => {
    const tracker = createSpeakingTracker();
    tracker.update(new Map([['a', 0.05]]), 0);

    expect(tracker.update(new Map(), 150).size).toBe(0);
  });
});
