// Outgoing video quality for the camera and screen shares: fixed levels, or "auto", which starts at 720p
// and follows the network and the SFU's load through the sender's WebRTC statistics.

export type VideoQuality = 'auto' | '360p' | '720p' | '1080p';

export interface VideoLevel {
  height: number;
  width: number;
  maxBitrate: number;
  frameRate: number;
}

// Rungs auto mode moves between. 1080p is the highest quality a meeting allows.
export const CAMERA_LEVELS: VideoLevel[] = [
  { height: 360, width: 640, maxBitrate: 600_000, frameRate: 24 },
  { height: 540, width: 960, maxBitrate: 1_000_000, frameRate: 30 },
  { height: 720, width: 1280, maxBitrate: 1_800_000, frameRate: 30 },
  { height: 1080, width: 1920, maxBitrate: 3_500_000, frameRate: 30 },
];

// Screens are mostly still text, so they trade frame rate for sharpness.
export const SCREEN_LEVELS: VideoLevel[] = [
  { height: 360, width: 640, maxBitrate: 400_000, frameRate: 10 },
  { height: 540, width: 960, maxBitrate: 800_000, frameRate: 15 },
  { height: 720, width: 1280, maxBitrate: 1_500_000, frameRate: 15 },
  { height: 1080, width: 1920, maxBitrate: 2_500_000, frameRate: 15 },
];

const FIXED_LEVEL_INDEX: Record<Exclude<VideoQuality, 'auto'>, number> = { '360p': 0, '720p': 2, '1080p': 3 };
export const AUTO_START_INDEX = 2;
export const VIDEO_QUALITIES: VideoQuality[] = ['auto', '360p', '720p', '1080p'];

const SAMPLE_INTERVAL_MS = 4_000;
// The browser's bandwidth estimate starts low and ramps up, so early samples would look like congestion.
const WARM_UP_MS = 10_000;
// One bad sample can be a blip; two in a row lower the quality.
const DOWNGRADE_SAMPLES = 2;
// Rising needs consistently good samples; a fall waits out a cooldown before any new rise.
const QUICK_UPGRADE_SAMPLES = 2;
const SLOW_UPGRADE_SAMPLES = 6;
const UPGRADE_COOLDOWN_MS = 30_000;
const HIGH_LOSS = 0.05;
const LOW_LOSS = 0.02;
const HIGH_RTT_SECONDS = 0.4;
const LOW_RTT_SECONDS = 0.25;

/** Capture constraints: fixed levels capture what they send; auto captures the top rung and scales down. */
export function captureConstraints(levels: VideoLevel[], quality: VideoQuality): MediaTrackConstraints {
  const level = levels[quality === 'auto' ? levels.length - 1 : FIXED_LEVEL_INDEX[quality]]!;
  return {
    width: { ideal: level.width, max: level.width },
    height: { ideal: level.height, max: level.height },
    frameRate: { ideal: level.frameRate, max: level.frameRate },
  };
}

/**
 * Highest auto rung for the number of other people receiving this video. The SFU sends one copy to each
 * of them, so a bigger meeting means more load on the server and on everyone's download.
 */
export function maxLevelForAudience(otherPeople: number, kind: 'camera' | 'screen') {
  if (kind === 'screen') return otherPeople <= 4 ? 3 : 2;
  if (otherPeople <= 1) return 3;
  if (otherPeople <= 3) return 2;
  if (otherPeople <= 6) return 1;
  return 0;
}

export interface QualitySample {
  limitation: 'none' | 'bandwidth' | 'cpu' | 'other';
  /** Sender-side bandwidth estimate in bits per second. */
  availableBitrate: number | null;
  /** Share of packets the SFU reports lost, 0 to 1. */
  lossRatio: number | null;
  roundTripTime: number | null;
}

export interface AutoQualityState {
  index: number;
  goodSamples: number;
  badSamples: number;
  lastDowngradeAt: number;
}

/** One auto-mode decision. Pure, so the rules are testable without WebRTC. */
export function nextAutoState(
  state: AutoQualityState,
  sample: QualitySample,
  levels: VideoLevel[],
  maxIndex: number,
  now: number,
): AutoQualityState {
  const index = Math.min(state.index, maxIndex);
  // Bandwidth or CPU limits on the encoder, loss the SFU reports, or a slow round trip all mean the
  // network or the server cannot keep up.
  const struggling =
    sample.limitation === 'bandwidth' ||
    sample.limitation === 'cpu' ||
    (sample.lossRatio ?? 0) > HIGH_LOSS ||
    (sample.roundTripTime ?? 0) > HIGH_RTT_SECONDS;
  if (struggling) {
    const badSamples = state.badSamples + 1;
    if (badSamples < DOWNGRADE_SAMPLES || index === 0) return { ...state, index, goodSamples: 0, badSamples };
    return { index: index - 1, goodSamples: 0, badSamples: 0, lastDowngradeAt: now };
  }

  const next = levels[index + 1];
  const healthy =
    sample.limitation === 'none' && (sample.lossRatio ?? 0) < LOW_LOSS && (sample.roundTripTime ?? 0) < LOW_RTT_SECONDS;
  if (!next || index + 1 > maxIndex || !healthy || now - state.lastDowngradeAt < UPGRADE_COOLDOWN_MS) {
    return { ...state, index, goodSamples: 0, badSamples: 0 };
  }
  // A bandwidth estimate with clear headroom rises quickly; without one the rise waits longer.
  const hasHeadroom = sample.availableBitrate !== null && sample.availableBitrate >= next.maxBitrate * 1.3;
  const goodSamples = state.goodSamples + 1;
  if (goodSamples >= (hasHeadroom ? QUICK_UPGRADE_SAMPLES : SLOW_UPGRADE_SAMPLES)) {
    return { ...state, index: index + 1, goodSamples: 0, badSamples: 0 };
  }
  return { ...state, index, goodSamples, badSamples: 0 };
}

async function readSample(sender: RTCRtpSender): Promise<QualitySample> {
  const sample: QualitySample = { limitation: 'none', availableBitrate: null, lossRatio: null, roundTripTime: null };
  const stats = await sender.getStats();
  stats.forEach((report) => {
    if (report.type === 'outbound-rtp' && report.kind === 'video') {
      const reason = report.qualityLimitationReason;
      sample.limitation = reason === 'bandwidth' || reason === 'cpu' || reason === 'none' ? reason : 'other';
    } else if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
      if (typeof report.fractionLost === 'number') sample.lossRatio = report.fractionLost;
      if (typeof report.roundTripTime === 'number') sample.roundTripTime = report.roundTripTime;
    } else if (report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded') {
      if (typeof report.availableOutgoingBitrate === 'number')
        sample.availableBitrate = report.availableOutgoingBitrate;
    }
  });
  return sample;
}

/** Applies a quality to one video sender and, in auto mode, keeps adjusting it. */
export class SenderQualityController {
  private quality: VideoQuality = 'auto';
  private state: AutoQualityState = { index: AUTO_START_INDEX, goodSamples: 0, badSamples: 0, lastDowngradeAt: 0 };
  private maxIndex: number;
  private sampleFrom = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private levels: VideoLevel[],
    private getSender: () => RTCRtpSender | undefined,
    private getTrack: () => MediaStreamTrack | undefined,
    private onLevelChange?: (height: number) => void,
  ) {
    this.maxIndex = levels.length - 1;
  }

  getQuality() {
    return this.quality;
  }

  /** Height currently sent, which auto mode changes over time. */
  currentHeight() {
    return this.levels[this.state.index]!.height;
  }

  async setQuality(quality: VideoQuality) {
    this.quality = quality;
    this.state = {
      index: quality === 'auto' ? Math.min(AUTO_START_INDEX, this.maxIndex) : FIXED_LEVEL_INDEX[quality],
      goodSamples: 0,
      badSamples: 0,
      lastDowngradeAt: 0,
    };
    this.sampleFrom = Date.now() + WARM_UP_MS;
    const track = this.getTrack();
    if (track) {
      try {
        await track.applyConstraints(captureConstraints(this.levels, quality));
      } catch (error) {
        // Some cameras cannot reach the requested size; the encoder limits below still apply.
        console.warn('[SenderQualityController] Capture rejected quality constraints:', error);
      }
    }
    await this.apply();
    if (quality === 'auto') this.startSampling();
    else this.stopSampling();
  }

  /** Lowers the auto ceiling as more people receive the video; fixed choices are left alone. */
  async setMaxIndex(maxIndex: number) {
    this.maxIndex = Math.max(0, Math.min(maxIndex, this.levels.length - 1));
    if (this.quality === 'auto' && this.state.index > this.maxIndex) {
      this.state = { ...this.state, index: this.maxIndex };
      await this.apply();
    }
  }

  /** Writes the current level into the sender's encoding; call again after renegotiation. */
  async apply() {
    const sender = this.getSender();
    if (!sender) return;
    const parameters = sender.getParameters();
    if (!parameters.encodings?.length) return;
    const level = this.levels[this.state.index]!;
    const captureHeight = this.getTrack()?.getSettings().height ?? level.height;
    parameters.encodings = parameters.encodings.map((encoding) => ({
      ...encoding,
      maxBitrate: level.maxBitrate,
      maxFramerate: level.frameRate,
      scaleResolutionDownBy: Math.max(1, captureHeight / level.height),
    }));
    try {
      await sender.setParameters(parameters);
      this.onLevelChange?.(level.height);
    } catch (error) {
      console.warn('[SenderQualityController] Failed to apply video encoding:', error);
    }
  }

  stop() {
    this.stopSampling();
  }

  private startSampling() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.sample(), SAMPLE_INTERVAL_MS);
  }

  private stopSampling() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async sample() {
    const sender = this.getSender();
    if (!sender || this.quality !== 'auto' || Date.now() < this.sampleFrom) return;
    try {
      const next = nextAutoState(this.state, await readSample(sender), this.levels, this.maxIndex, Date.now());
      const changed = next.index !== this.state.index;
      this.state = next;
      if (changed) {
        console.log('[SenderQualityController] Auto quality now', `${this.levels[next.index]!.height}p`);
        await this.apply();
      }
    } catch (error) {
      console.warn('[SenderQualityController] Failed to read sender statistics:', error);
    }
  }
}
