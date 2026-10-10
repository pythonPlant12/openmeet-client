// The North American ring: 440 Hz and 480 Hz together, 2 s on and 4 s off. Web Audio makes it,
// so the client ships no audio file.
const RING_FREQUENCIES = [440, 480];
const RING_SECONDS = 2;
const CYCLE_SECONDS = 6;
const RING_VOLUME = 0.12;

export class Ringtone {
  private context: AudioContext | null = null;
  private timer: number | undefined;

  get isRinging() {
    return this.timer !== undefined;
  }

  start() {
    if (this.isRinging) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => undefined);
    } catch (error) {
      console.error('[Ringtone] Audio is unavailable:', error);
      return;
    }
    this.ring();
    this.timer = window.setInterval(() => this.ring(), CYCLE_SECONDS * 1_000);
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = undefined;
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }

  private ring() {
    const context = this.context;
    if (!context) return;
    const start = context.currentTime;
    const gain = context.createGain();
    // Short ramps avoid clicks at the start and end of each ring.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(RING_VOLUME, start + 0.02);
    gain.gain.setValueAtTime(RING_VOLUME, start + RING_SECONDS - 0.02);
    gain.gain.linearRampToValueAtTime(0, start + RING_SECONDS);
    gain.connect(context.destination);
    for (const frequency of RING_FREQUENCIES) {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(start);
      oscillator.stop(start + RING_SECONDS);
    }
  }
}
