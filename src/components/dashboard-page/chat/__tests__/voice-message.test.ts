import { describe, expect, it } from 'vitest';

import { replyAttachmentLabel } from '../chat-composer';
import {
  baseMimeType,
  formatRecordingTime,
  formatVoiceDuration,
  isVoiceMessageFileName,
  levelFromTimeDomain,
  voiceMessageFile,
  waveformBars,
} from '../voice-message';

describe('voice messages', () => {
  it('formats the recording clock with hundredths and the playback clock in seconds', () => {
    expect(formatRecordingTime(2520)).toBe('0:02,52');
    expect(formatRecordingTime(61_005)).toBe('1:01,00');
    expect(formatVoiceDuration(4400)).toBe('0:04');
    expect(formatVoiceDuration(65_600)).toBe('1:06');
  });

  it('names recordings as voice messages with a content type the server accepts', () => {
    const recordedAt = new Date(2026, 9, 11, 13, 54, 7);
    const file = voiceMessageFile([new Blob(['a'])], 'audio/webm;codecs=opus', recordedAt);
    const nextFile = voiceMessageFile([new Blob(['b'])], 'audio/webm;codecs=opus', recordedAt);
    expect(file.name).toMatch(/^voice-message-20261011-135407-\d+\.webm$/);
    expect(nextFile.name).not.toBe(file.name);
    expect(file.type).toBe('audio/webm');
    expect(isVoiceMessageFileName(file.name)).toBe(true);
    expect(baseMimeType('audio/mp4')).toBe('audio/mp4');
    expect(voiceMessageFile([new Blob(['a'])], 'audio/mp4').name).toMatch(/\.m4a$/);
  });

  it('scales level samples to bars with the loudest at full height', () => {
    expect(waveformBars([0.1, 0.5, 0.25, 0.5], 2)).toEqual([1, 1]);
    expect(waveformBars([0, 0.2, 0.4, 0.1], 4)).toEqual([0.08, 0.5, 1, 0.25]);
    expect(waveformBars([], 3)).toEqual([0.08, 0.08, 0.08]);
  });

  it('reads silence as zero and a loud signal as a high level', () => {
    expect(levelFromTimeDomain(new Uint8Array(64).fill(128))).toBe(0);
    const loud = Uint8Array.from({ length: 64 }, (_, index) => (index % 2 ? 255 : 0));
    expect(levelFromTimeDomain(loud)).toBe(1);
  });

  it('quotes a voice message by name instead of its generated file name', () => {
    expect(replyAttachmentLabel({ attachmentFileName: 'voice-message-20261011-135407.webm', attachmentCount: 1 })).toBe(
      'Voice message',
    );
  });
});
