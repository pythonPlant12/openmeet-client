// Voice messages are ordinary audio attachments. The recorder names them with this prefix so quotes
// and file chips can call them voice messages instead of showing a generated file name.
export const VOICE_MESSAGE_FILE_PREFIX = 'voice-message-';
export const VOICE_MESSAGE_LABEL = 'Voice message';

// Opus in WebM records in Chromium and Firefox; Safari only records AAC in MP4.
const RECORDING_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

const FILE_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
};
let recordingSequence = 0;

export function canRecordVoice() {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

export function pickRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return RECORDING_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

/** The server matches content types exactly, so codec parameters are dropped. */
export function baseMimeType(mimeType: string) {
  return mimeType.split(';')[0]!.trim().toLowerCase() || 'audio/webm';
}

export function voiceMessageFile(chunks: Blob[], mimeType: string, recordedAt = new Date()) {
  const type = baseMimeType(mimeType);
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp =
    `${recordedAt.getFullYear()}${pad(recordedAt.getMonth() + 1)}${pad(recordedAt.getDate())}-` +
    `${pad(recordedAt.getHours())}${pad(recordedAt.getMinutes())}${pad(recordedAt.getSeconds())}`;
  const extension = FILE_EXTENSIONS[type] ?? 'webm';
  return new File(chunks, `${VOICE_MESSAGE_FILE_PREFIX}${stamp}-${recordingSequence++}.${extension}`, { type });
}

export function isAudioAttachment(contentType: string) {
  return contentType.startsWith('audio/');
}

export function isVoiceMessageFileName(fileName: string) {
  return fileName.startsWith(VOICE_MESSAGE_FILE_PREFIX);
}

/** Recording clock, for example 0:02,52. */
export function formatRecordingTime(milliseconds: number) {
  const total = Math.max(0, Math.floor(milliseconds / 10));
  const hundredths = total % 100;
  const seconds = Math.floor(total / 100) % 60;
  const minutes = Math.floor(total / 6000);
  return `${minutes}:${String(seconds).padStart(2, '0')},${String(hundredths).padStart(2, '0')}`;
}

/** Playback clock, for example 0:04. */
export function formatVoiceDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

// Silence still draws a short bar so the waveform keeps its shape.
const MIN_BAR_LEVEL = 0.08;

/** Reduces level samples to a fixed number of bars, scaled so the loudest bar is full height. */
export function waveformBars(levels: number[], bars: number) {
  if (bars <= 0) return [];
  if (!levels.length) return Array.from({ length: bars }, () => MIN_BAR_LEVEL);
  const buckets = Array.from({ length: bars }, (_, index) => {
    const start = Math.floor((index * levels.length) / bars);
    const end = Math.max(start + 1, Math.floor(((index + 1) * levels.length) / bars));
    let peak = 0;
    for (let sample = start; sample < end && sample < levels.length; sample += 1) {
      peak = Math.max(peak, levels[sample]!);
    }
    return peak;
  });
  const loudest = Math.max(...buckets);
  return buckets.map((value) => Math.max(MIN_BAR_LEVEL, loudest > 0 ? value / loudest : 0));
}

/** Loudness of one analyser frame of 8-bit time-domain samples, curved so speech fills the range. */
export function levelFromTimeDomain(samples: Uint8Array) {
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) {
    const centered = (sample - 128) / 128;
    sum += centered * centered;
  }
  const rms = Math.sqrt(sum / samples.length);
  return Math.min(1, Math.pow(rms, 0.6) * 2.2);
}

export interface DecodedVoiceMessage {
  durationMs: number;
  levels: number[];
}

const decodedVoiceMessages = new Map<string, Promise<DecodedVoiceMessage>>();
// Samples per second of audio kept for the waveform; the player scales them to its bar count.
const DECODED_LEVELS_PER_SECOND = 20;

type AudioContextConstructor = typeof AudioContext;

function audioContextConstructor() {
  return (window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext) as
    | AudioContextConstructor
    | undefined;
}

/**
 * Duration and loudness of a recorded voice message. MediaRecorder WebM files carry no duration, so
 * players cannot rely on `audio.duration`. Results are cached for the session under `cacheKey`, the
 * attachment's server path, so a chat opened again reuses them even after its object URLs change.
 */
export function decodeVoiceMessage(url: string, cacheKey = url): Promise<DecodedVoiceMessage> {
  let decoded = decodedVoiceMessages.get(cacheKey);
  if (!decoded) {
    decoded = decode(url);
    decodedVoiceMessages.set(cacheKey, decoded);
    decoded.catch(() => decodedVoiceMessages.delete(cacheKey));
  }
  return decoded;
}

/** Lets a sent voice message reuse what was decoded while it showed as pending. */
export function shareDecodedVoiceMessage(fromKey: string, toKey: string) {
  const decoded = decodedVoiceMessages.get(fromKey);
  if (decoded && !decodedVoiceMessages.has(toKey)) decodedVoiceMessages.set(toKey, decoded);
}

async function decode(url: string): Promise<DecodedVoiceMessage> {
  const Context = audioContextConstructor();
  if (!Context) throw new Error('Web Audio is not available');
  const data = await (await fetch(url)).arrayBuffer();
  const context = new Context();
  try {
    const buffer = await context.decodeAudioData(data);
    const channel = buffer.getChannelData(0);
    const count = Math.max(1, Math.ceil(buffer.duration * DECODED_LEVELS_PER_SECOND));
    const size = Math.max(1, Math.floor(channel.length / count));
    const levels = Array.from({ length: count }, (_, index) => {
      let sum = 0;
      const start = index * size;
      const end = Math.min(channel.length, start + size);
      for (let sample = start; sample < end; sample += 1) sum += channel[sample]! * channel[sample]!;
      return Math.sqrt(sum / Math.max(1, end - start));
    });
    return { durationMs: buffer.duration * 1000, levels };
  } finally {
    void context.close();
  }
}

// One voice message plays at a time across the app, like a messenger.
let activeAudio: HTMLAudioElement | null = null;

export function claimVoicePlayback(audio: HTMLAudioElement) {
  if (activeAudio && activeAudio !== audio) activeAudio.pause();
  activeAudio = audio;
}

export function releaseVoicePlayback(audio: HTMLAudioElement) {
  if (activeAudio === audio) activeAudio = null;
}
