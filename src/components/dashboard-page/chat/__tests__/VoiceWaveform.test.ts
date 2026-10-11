import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

const { default: VoiceWaveform } = await import('@/components/dashboard-page/chat/VoiceWaveform.vue');

enableAutoUnmount(afterEach);

function mountWaveform(playing = false, progress = 0) {
  return mount(VoiceWaveform, {
    props: {
      bars: [0.1, 0.8, 0.2],
      playing,
      progress,
      playedClass: 'bg-[#0B7A75]',
      unplayedClass: 'bg-[#B8C6C5]',
    },
  });
}

describe('VoiceWaveform', () => {
  it('shows a playhead at the audio progress only while playing', async () => {
    const waveform = mountWaveform(true, 0.25);

    expect(waveform.get('[data-voice-playhead]').attributes('style')).toContain('left: 25%');
    expect(waveform.findAll('[data-voice-waveform] > span')[0]!.classes()).toContain('scale-y-110');

    await waveform.setProps({ playing: false });
    expect(waveform.find('[data-voice-playhead]').exists()).toBe(false);
  });
});
