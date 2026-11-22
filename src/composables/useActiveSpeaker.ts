import { type Ref, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';

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

interface SpeakingOptions {
  releaseMs?: number;
  threshold?: number;
}

/**
 * Everyone talking right now, for the speaking borders. Unlike the one active speaker that picks the layout, any
 * number of people can talk at once. A person counts as speaking from the first sample their voice passes the
 * threshold, and stops after a short silence, so pauses between words do not blink the border.
 */
export function createSpeakingTracker(options: SpeakingOptions = {}) {
  const releaseMs = options.releaseMs ?? 600;
  const threshold = options.threshold ?? 0.012;
  const lastHeard = new Map<string, number>();

  return {
    update(levels: Map<string, number>, now = Date.now()): ReadonlySet<string> {
      for (const [participantId, level] of levels) if (level > threshold) lastHeard.set(participantId, now);
      const speaking = new Set<string>();
      for (const [participantId, heardAt] of lastHeard) {
        if (!levels.has(participantId) || now - heardAt > releaseMs) lastHeard.delete(participantId);
        else speaking.add(participantId);
      }
      return speaking;
    },
  };
}

function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  return a.size === b.size && [...a].every((id) => b.has(id));
}

interface AudioAnalyserEntry {
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  source: MediaStreamAudioSourceNode;
  stream: MediaStream;
}

export function useActiveSpeaker(participants: Ref<Participant[]>, options: ActiveSpeakerOptions = {}) {
  const activeSpeakerId = ref<string | null>(null);
  const speakingIds = shallowRef<ReadonlySet<string>>(new Set());
  // Levels are read often so a speaking border lights up quickly. The layout's speaker still needs about 0.8 s of
  // voice to take over and 1.6 s of silence to let go, so the main tile does not jump between people talking over
  // each other.
  const pollMs = options.pollMs ?? 150;
  const detector = createActiveSpeakerDetector({
    attackSamples: Math.ceil(800 / pollMs),
    releaseSamples: Math.ceil(1_600 / pollMs),
    ...options,
  });
  const speakingTracker = createSpeakingTracker();
  const analysers = new Map<string, AudioAnalyserEntry>();
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
      if (stopped) return;
      activeSpeakerId.value = detector.update(participantLevels);
      const speaking = speakingTracker.update(participantLevels);
      if (!sameIds(speaking, speakingIds.value)) speakingIds.value = speaking;
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
        speakingIds.value = speakingTracker.update(new Map());
      });
    }, pollMs);
  });
  onUnmounted(() => {
    stopped = true;
    if (timer) clearInterval(timer);
    cleanupAnalysers();
  });

  return { activeSpeakerId, speakingIds, resumeAudioAnalysis };
}
