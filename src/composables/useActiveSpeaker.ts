import { type Ref, onMounted, onUnmounted, ref, watch } from 'vue';

import { getServices } from '@/xstate/machines/webrtc/actors';
import type { Participant } from '@/xstate/machines/webrtc/types';

interface ActiveSpeakerOptions {
  attackSamples?: number;
  minHoldMs?: number;
  pollMs?: number;
  releaseSamples?: number;
  threshold?: number;
}

export function createActiveSpeakerDetector(options: ActiveSpeakerOptions = {}) {
  const attackSamples = options.attackSamples ?? 2;
  const minHoldMs = options.minHoldMs ?? 1_200;
  const releaseSamples = options.releaseSamples ?? 4;
  const threshold = options.threshold ?? 0.025;
  let activeId: string | null = null;
  let activeSince = 0;
  let candidateId: string | null = null;
  let candidateSamples = 0;
  let silentSamples = 0;

  return {
    update(levels: Map<string, number>, now = Date.now()) {
      let loudestId: string | null = null;
      let loudestLevel = threshold;
      for (const [participantId, level] of levels) {
        if (level > loudestLevel) {
          loudestId = participantId;
          loudestLevel = level;
        }
      }

      if (!loudestId) {
        candidateId = null;
        candidateSamples = 0;
        silentSamples++;
        if (activeId && silentSamples >= releaseSamples && now - activeSince >= minHoldMs) activeId = null;
        return activeId;
      }

      silentSamples = 0;
      if (loudestId === activeId) {
        candidateId = null;
        candidateSamples = 0;
        return activeId;
      }

      if (candidateId === loudestId) candidateSamples++;
      else {
        candidateId = loudestId;
        candidateSamples = 1;
      }

      if (candidateSamples >= attackSamples && (!activeId || now - activeSince >= minHoldMs)) {
        activeId = loudestId;
        activeSince = now;
        candidateId = null;
        candidateSamples = 0;
      }
      return activeId;
    },
  };
}

interface AudioAnalyserEntry {
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  source: MediaStreamAudioSourceNode;
  stream: MediaStream;
}

export function useActiveSpeaker(participants: Ref<Participant[]>, options: ActiveSpeakerOptions = {}) {
  const activeSpeakerId = ref<string | null>(null);
  const detector = createActiveSpeakerDetector(options);
  const analysers = new Map<string, AudioAnalyserEntry>();
  const pollMs = options.pollMs ?? 400;
  let audioContext: AudioContext | null = null;
  let isSampling = false;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  async function resumeAudioAnalysis() {
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return;
    audioContext ??= new AudioContextConstructor();
    if (audioContext.state === 'suspended') await audioContext.resume();
  }

  function cleanupAnalysers() {
    for (const entry of analysers.values()) entry.source.disconnect();
    analysers.clear();
    void audioContext?.close();
    audioContext = null;
  }

  function syncAnalysers() {
    const currentIds = new Set(participants.value.map((participant) => participant.id));
    for (const [participantId, entry] of analysers) {
      const participant = participants.value.find((candidate) => candidate.id === participantId);
      if (currentIds.has(participantId) && participant?.stream === entry.stream) continue;
      entry.source.disconnect();
      analysers.delete(participantId);
    }
  }

  function fallbackLevel(participant: Participant) {
    const stream = participant.stream;
    if (!stream?.getAudioTracks().some((track) => track.readyState === 'live' && track.enabled)) return 0;
    if (!audioContext || audioContext.state !== 'running') return 0;
    let entry = analysers.get(participant.id);
    if (!entry || entry.stream !== stream) {
      entry?.source.disconnect();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      entry = { analyser, data: new Uint8Array(analyser.frequencyBinCount), source, stream };
      analysers.set(participant.id, entry);
    }

    entry.analyser.getByteTimeDomainData(entry.data);
    let sum = 0;
    for (const sample of entry.data) {
      const normalized = (sample - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / entry.data.length);
  }

  async function sample() {
    if (isSampling || stopped) return;
    isSampling = true;
    try {
      const trackLevels =
        (await getServices()
          .webrtcService?.getInboundAudioLevels()
          .catch(() => null)) ?? new Map();
      if (stopped) return;

      const participantLevels = new Map<string, number>();
      for (const participant of participants.value) {
        const statsLevel = participant.stream
          ?.getAudioTracks()
          .map((track) => trackLevels.get(track.id))
          .find((level): level is number => typeof level === 'number');
        participantLevels.set(participant.id, statsLevel ?? fallbackLevel(participant));
      }
      if (!stopped) activeSpeakerId.value = detector.update(participantLevels);
    } finally {
      isSampling = false;
    }
  }

  watch(participants, syncAnalysers, { deep: false });
  onMounted(() => {
    stopped = false;
    timer = setInterval(() => {
      void sample().catch(() => {
        activeSpeakerId.value = detector.update(new Map());
      });
    }, pollMs);
  });
  onUnmounted(() => {
    stopped = true;
    if (timer) clearInterval(timer);
    cleanupAnalysers();
  });

  return { activeSpeakerId, resumeAudioAnalysis };
}
