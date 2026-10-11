import { onBeforeUnmount, ref } from 'vue';

import {
  levelFromTimeDomain,
  pickRecordingMimeType,
  voiceMessageFile,
} from '@/components/dashboard-page/chat/voice-message';

export interface VoiceRecording {
  file: File;
  durationMs: number;
  /** Loudness samples, one per LEVEL_SAMPLE_MS. */
  levels: number[];
}

// The live waveform adds one bar per interval, so it scrolls at a steady pace.
export const LEVEL_SAMPLE_MS = 80;

export interface VoiceRecorderFrame {
  elapsedMs: number;
  /** Finished level samples, oldest first. */
  levels: readonly number[];
  /** Loudest level since the last sample: the bar that is still coming in. */
  pendingLevel: number;
  /** How far the next sample is, from 0 to 1, so the live waveform can scroll between samples. */
  samplePhase: number;
}

type AudioContextConstructor = typeof AudioContext;

/**
 * Microphone recording for voice messages, with a live loudness level for the waveform.
 * Call `prepare()` inside the pointer handler that starts the gesture: iOS only lets audio run when
 * the audio context starts from a user gesture, and the recording itself starts after a hold delay.
 *
 * Per-frame values go to `onFrame` instead of reactive state: re-rendering the recorder on every
 * frame made its animations stutter in the iOS web view.
 */
export function useVoiceRecorder(options: {
  maxDurationMs: number;
  onLimit: () => void;
  onFrame?: (frame: VoiceRecorderFrame) => void;
}) {
  /** Whole seconds recorded, for assistive technology. */
  const elapsedSeconds = ref(0);
  const recording = ref(false);
  let levels: number[] = [];

  let context: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let samples: Uint8Array<ArrayBuffer> | null = null;
  let chunks: Blob[] = [];
  // The clock starts with the recording UI; the audio starts once the microphone has opened.
  let clockStartedAt = 0;
  let audioStartedAt = 0;
  let audioLevelOffset = 0;
  let streamRequest: Promise<MediaStream | null> | null = null;
  let starting: Promise<boolean> | null = null;
  let frame: number | undefined;
  let nextSampleAt = 0;
  let sampleLevel = 0;
  // Cancelling during the microphone prompt invalidates the start that is still waiting for it.
  let generation = 0;

  function prepare() {
    if (context) return;
    const Context = (window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext) as
      | AudioContextConstructor
      | undefined;
    if (!Context) return;
    context = new Context();
    void context.resume().catch(() => undefined);
  }

  /**
   * Starts opening the microphone. Call it as soon as a press begins: on iOS opening the audio session
   * takes long enough to show as a frozen counter if it waits for the hold to complete.
   */
  function openMicrophone() {
    if (streamRequest) return;
    const requestGeneration = generation;
    streamRequest = navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then((nextStream) => {
        if (requestGeneration !== generation) {
          nextStream.getTracks().forEach((track) => track.stop());
          return null;
        }
        stream = nextStream;
        return nextStream;
      });
    // A tap that is cancelled before the request settles still owns its failure.
    streamRequest.catch(() => undefined);
  }

  /**
   * Starts the clock and waveform at once and the audio as soon as the microphone is open. Resolves
   * `false` when the recording was cancelled first, and rejects when the microphone cannot open.
   */
  function start() {
    prepare();
    openMicrophone();
    const startGeneration = generation;
    clockStartedAt = performance.now();
    nextSampleAt = clockStartedAt + LEVEL_SAMPLE_MS;
    sampleLevel = 0;
    elapsedSeconds.value = 0;
    levels = [];
    recording.value = true;
    frame = requestAnimationFrame(tick);
    starting = (async () => {
      const nextStream = await streamRequest;
      if (!nextStream || startGeneration !== generation) return false;
      const mimeType = pickRecordingMimeType();
      recorder = new MediaRecorder(nextStream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
      // Each recording keeps its own chunks. A cancelled recorder still delivers its last chunk after
      // stop(), and with a shared list that chunk led the next recording, whose file then had no header.
      const recordingChunks: Blob[] = [];
      chunks = recordingChunks;
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size) recordingChunks.push(event.data);
      });
      recorder.start(250);
      audioStartedAt = performance.now();
      audioLevelOffset = levels.length;
      if (context) {
        source = context.createMediaStreamSource(nextStream);
        analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        samples = new Uint8Array(analyser.fftSize);
        source.connect(analyser);
      }
      return true;
    })();
    return starting;
  }

  function tick(now: number) {
    const elapsedMs = Math.max(0, now - clockStartedAt);
    if (analyser && samples) {
      analyser.getByteTimeDomainData(samples);
      sampleLevel = Math.max(sampleLevel, levelFromTimeDomain(samples));
    }
    if (now >= nextSampleAt) {
      levels.push(sampleLevel);
      sampleLevel = 0;
      // A frame that arrives late (a busy or hidden tab) skips ahead instead of adding a burst of bars.
      nextSampleAt = Math.max(nextSampleAt + LEVEL_SAMPLE_MS, now);
    }
    const seconds = Math.floor(elapsedMs / 1000);
    if (seconds !== elapsedSeconds.value) elapsedSeconds.value = seconds;
    options.onFrame?.({
      elapsedMs,
      levels,
      pendingLevel: sampleLevel,
      samplePhase: Math.min(1, Math.max(0, 1 - (nextSampleAt - now) / LEVEL_SAMPLE_MS)),
    });
    if (elapsedMs >= options.maxDurationMs) {
      frame = undefined;
      options.onLimit();
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  /** Finishes the recording; resolves `null` when nothing was recorded. */
  async function stop(): Promise<VoiceRecording | null> {
    // Released before the microphone opened: wait for it, so a quick message still has its audio.
    try {
      if (starting && !(await starting)) return null;
    } catch {
      release();
      return null;
    }
    const activeRecorder = recorder;
    if (!activeRecorder || activeRecorder.state === 'inactive') {
      release();
      return null;
    }
    // Durations and the waveform describe the audio, not the time the microphone took to open.
    const durationMs = performance.now() - audioStartedAt;
    const recordedLevels = levels.slice(audioLevelOffset);
    const stopped = new Promise<void>((resolve) => {
      activeRecorder.addEventListener('stop', () => resolve(), { once: true });
    });
    activeRecorder.stop();
    await stopped;
    const recordedChunks = chunks;
    const mimeType = activeRecorder.mimeType;
    release();
    if (!recordedChunks.length) return null;
    return { file: voiceMessageFile(recordedChunks, mimeType), durationMs, levels: recordedLevels };
  }

  function cancel() {
    generation += 1;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch (error) {
        console.warn('[useVoiceRecorder] Failed to stop the recorder:', error);
      }
    }
    release();
  }

  function release() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    stream?.getTracks().forEach((track) => track.stop());
    source?.disconnect();
    void context?.close().catch(() => undefined);
    context = null;
    stream = null;
    streamRequest = null;
    starting = null;
    recorder = null;
    source = null;
    analyser = null;
    samples = null;
    chunks = [];
    recording.value = false;
  }

  onBeforeUnmount(cancel);

  return { elapsedSeconds, recording, prepare, openMicrophone, start, stop, cancel };
}
