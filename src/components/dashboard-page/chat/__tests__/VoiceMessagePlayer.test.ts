import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import VoiceMessagePlayer from '../VoiceMessagePlayer.vue';
import * as voiceMessage from '../voice-message';

const attachment = {
  id: 'voice-1',
  fileName: 'voice-message-20261106-120000-0.webm',
  contentType: 'audio/webm',
  byteSize: 2048,
  url: '/social/conversations/chat-1/attachments/voice-1',
};

describe('VoiceMessagePlayer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('draws the stored waveform and length without downloading or decoding the audio', async () => {
    const decode = vi.spyOn(voiceMessage, 'decodeVoiceMessage');
    const wrapper = mount(VoiceMessagePlayer, {
      props: {
        attachment: { ...attachment, voice: { durationMs: 3_400, waveform: [0, 128, 255] } },
        loading: false,
        error: false,
      },
    });

    expect(wrapper.text()).toContain('0:03');
    await wrapper.setProps({ url: 'blob:voice-1' });
    expect(decode).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('0:03');
  });

  it('decodes older voice messages that have no stored waveform', async () => {
    const decode = vi
      .spyOn(voiceMessage, 'decodeVoiceMessage')
      .mockResolvedValue({ durationMs: 5_200, levels: [0.1, 0.9] });
    const wrapper = mount(VoiceMessagePlayer, {
      props: { attachment, url: 'blob:voice-1', loading: false, error: false },
    });
    await vi.waitFor(() => expect(wrapper.text()).toContain('0:05'));
    expect(decode).toHaveBeenCalledWith('blob:voice-1', attachment.url);
  });
});
