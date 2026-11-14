/**
 * Web Audio stage on the outgoing microphone: a gain for the input volume and an analyser for the level meter.
 * The microphone track itself stays the source, so muting it (disabling the track) silences the output too.
 */
export class MicInput {
  private readonly context: AudioContext;
  private readonly gain: GainNode;
  private readonly analyser: AnalyserNode;
  private readonly destination: MediaStreamAudioDestinationNode;
  private readonly samples: Uint8Array<ArrayBuffer>;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(track: MediaStreamTrack) {
    this.context = new AudioContext();
    this.gain = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.samples = new Uint8Array(this.analyser.frequencyBinCount);
    this.destination = this.context.createMediaStreamDestination();
    this.gain.connect(this.analyser);
    this.gain.connect(this.destination);
    this.setSource(track);
  }

  /** Track carrying the microphone at the chosen volume. */
  get outputTrack(): MediaStreamTrack {
    return this.destination.stream.getAudioTracks()[0]!;
  }

  get isRunning(): boolean {
    return this.context.state === 'running';
  }

  setSource(track: MediaStreamTrack) {
    this.source?.disconnect();
    this.source = this.context.createMediaStreamSource(new MediaStream([track]));
    this.source.connect(this.gain);
  }

  setVolume(volume: number) {
    this.gain.gain.value = volume;
  }

  /** Browsers start audio suspended until a gesture; the controls that use this run on one. */
  async resume() {
    if (this.context.state === 'suspended') await this.context.resume();
  }

  /** Root mean square of the current samples after the volume, from 0 (silence) to 1. */
  level(): number {
    this.analyser.getByteTimeDomainData(this.samples);
    let sum = 0;
    for (const sample of this.samples) {
      const normalized = (sample - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / this.samples.length);
  }

  close() {
    this.source?.disconnect();
    void this.context.close();
  }
}
