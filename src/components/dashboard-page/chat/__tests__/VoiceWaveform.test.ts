import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

const { default: VoiceWaveform } = await import('@/components/dashboard-page/chat/VoiceWaveform.vue');

enableAutoUnmount(afterEach);

function mountWaveform(props: { playing?: boolean; progress?: number; seekable?: boolean } = {}) {
  return mount(VoiceWaveform, {
    props: {
      bars: [0.1, 0.8, 0.2, 0.5],
      playedClass: 'bg-harbor-accent',
      unplayedClass: 'bg-harbor-waveform',
      ...props,
    },
  });
}

// The track is 200px wide from x = 100.
function pointer(wrapper: ReturnType<typeof mountWaveform>, type: string, clientX: number) {
  const track = wrapper.get('[data-voice-waveform]').element as HTMLElement;
  track.getBoundingClientRect = () => ({ left: 100, width: 200 }) as DOMRect;
  track.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, clientX, button: 0 }));
  return wrapper.vm.$nextTick();
}

const playedBars = (wrapper: ReturnType<typeof mountWaveform>) =>
  wrapper
    .findAll('[data-voice-waveform] > span:not([data-voice-thumb])')
    .filter((bar) => bar.classes('bg-harbor-accent')).length;

describe('VoiceWaveform', () => {
  it('shows a thumb at the audio progress while it can seek or play', async () => {
    const waveform = mountWaveform({ seekable: true, progress: 0.25 });

    expect(waveform.get('[data-voice-thumb]').attributes('style')).toContain('left: 25%');

    await waveform.setProps({ seekable: false });
    expect(waveform.find('[data-voice-thumb]').exists()).toBe(false);

    await waveform.setProps({ playing: true });
    expect(waveform.find('[data-voice-thumb]').exists()).toBe(true);
  });

  it('moves only the thumb while dragging and seeks once, on release', async () => {
    const waveform = mountWaveform({ seekable: true, progress: 0 });

    await pointer(waveform, 'pointerdown', 150);
    await pointer(waveform, 'pointermove', 200);
    await pointer(waveform, 'pointermove', 250);

    expect(waveform.emitted('seek')).toBeUndefined();
    expect(waveform.emitted('scrub')).toEqual([[0.25], [0.5], [0.75]]);
    expect(waveform.get('[data-voice-thumb]').attributes('style')).toContain('left: 75%');
    expect(waveform.get('[data-voice-thumb]').classes()).toContain('scale-125');
    expect(playedBars(waveform)).toBe(3);

    await pointer(waveform, 'pointerup', 250);

    expect(waveform.emitted('seek')).toEqual([[0.75]]);
    expect(waveform.emitted('scrub')!.slice(-1)).toEqual([[null]]);
    // Until the parent applies the seek, the waveform shows the audio's own progress again.
    expect(waveform.get('[data-voice-thumb]').attributes('style')).toContain('left: 0%');
  });

  it('leaves the audio where it was when a drag is cancelled', async () => {
    const waveform = mountWaveform({ seekable: true, progress: 0.5 });

    await pointer(waveform, 'pointerdown', 120);
    await pointer(waveform, 'pointercancel', 120);

    expect(waveform.emitted('seek')).toBeUndefined();
    expect(waveform.emitted('scrub')!.slice(-1)).toEqual([[null]]);
    expect(waveform.get('[data-voice-thumb]').attributes('style')).toContain('left: 50%');
  });

  it('ignores presses while it cannot seek', async () => {
    const waveform = mountWaveform({ progress: 0.5 });

    await pointer(waveform, 'pointerdown', 120);
    await pointer(waveform, 'pointerup', 120);

    expect(waveform.emitted('seek')).toBeUndefined();
    expect(waveform.emitted('scrub')).toBeUndefined();
  });
});
