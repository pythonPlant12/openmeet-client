import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import VoiceRecorder from '../VoiceRecorder.vue';

const { playHaptic, prepareHaptics, toast } = vi.hoisted(() => ({
  playHaptic: vi.fn(),
  prepareHaptics: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/services/haptics', () => ({ playHaptic, prepareHaptics }));
vi.mock('@/components/ui/toast', () => ({ toast }));

class FakeMediaRecorder extends EventTarget {
  static isTypeSupported = (type: string) => type.startsWith('audio/webm');
  state: RecordingState = 'inactive';
  mimeType: string;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    super();
    this.mimeType = options?.mimeType ?? 'audio/webm';
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.dispatchEvent(
      Object.assign(new Event('dataavailable'), { data: new Blob(['voice'], { type: this.mimeType }) }),
    );
    this.dispatchEvent(new Event('stop'));
  }
}

const stopTrack = vi.fn();
const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] }) as unknown as MediaStream);
let now = 0;

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  URL.createObjectURL = vi.fn(() => 'blob:voice');
  URL.revokeObjectURL = vi.fn();
  playHaptic.mockClear();
  prepareHaptics.mockClear();
  toast.mockClear();
  getUserMedia.mockClear();
  stopTrack.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function shown(
  wrapper: { find: (selector: string) => { attributes: (name: string) => string | undefined } },
  selector: string,
) {
  return wrapper.find(selector).attributes('data-visible') === 'true';
}

function mountRecorder() {
  return mount(VoiceRecorder, { props: { disabled: false, prefersReducedMotion: true, visible: true } });
}

async function pointer(wrapper: ReturnType<typeof mountRecorder>, type: string, clientX: number, clientY: number) {
  wrapper
    .get('[data-voice-record-button]')
    .element.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, clientX, clientY, button: 0 }),
    );
  await flushPromises();
}

async function press(wrapper: ReturnType<typeof mountRecorder>, x = 300, y = 500) {
  await pointer(wrapper, 'pointerdown', x, y);
}

async function holdUntilRecording(wrapper: ReturnType<typeof mountRecorder>) {
  await press(wrapper);
  await vi.advanceTimersByTimeAsync(200);
  await flushPromises();
}

function move(wrapper: ReturnType<typeof mountRecorder>, clientX: number, clientY: number) {
  return pointer(wrapper, 'pointermove', clientX, clientY);
}

function release(wrapper: ReturnType<typeof mountRecorder>) {
  return pointer(wrapper, 'pointerup', 0, 0);
}

describe('VoiceRecorder', () => {
  it('explains the gesture after a tap and releases the microphone it started opening', async () => {
    const wrapper = mountRecorder();
    await press(wrapper);
    await release(wrapper);
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    // The press starts opening the microphone so a hold can record at once; a tap closes it again.
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(stopTrack).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith({ title: 'Hold to record a voice message, release to send.' });
    expect(shown(wrapper, '[data-voice-recorder-bar]')).toBe(false);
  });

  it('starts recording immediately on a mobile layout', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    const wrapper = mountRecorder();

    await press(wrapper);

    expect(shown(wrapper, '[data-voice-recorder-bar]')).toBe(true);
    expect(playHaptic).toHaveBeenCalledWith('medium');
  });

  it('shows the recording at once while the microphone is still opening', async () => {
    let openMicrophone: (stream: MediaStream) => void = () => undefined;
    getUserMedia.mockImplementationOnce(() => new Promise<MediaStream>((resolve) => (openMicrophone = resolve)));
    const wrapper = mountRecorder();
    await holdUntilRecording(wrapper);

    expect(shown(wrapper, '[data-voice-recorder-bar]')).toBe(true);
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    // The microphone opens partway through the hold; the audio from then on is the message.
    now = 400;
    openMicrophone({ getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream);
    await flushPromises();
    now = 2000;
    await release(wrapper);
    expect(shown(wrapper, '[data-voice-recorder-bar]')).toBe(false);
    await flushPromises();
    expect(wrapper.emitted('send')).toHaveLength(1);
  });

  it('records while held and sends the voice message on release', async () => {
    const wrapper = mountRecorder();
    await holdUntilRecording(wrapper);

    expect(prepareHaptics).toHaveBeenCalledTimes(1);
    expect(playHaptic).toHaveBeenCalledWith('medium');
    expect(shown(wrapper, '[data-voice-recorder-bar]')).toBe(true);
    expect(shown(wrapper, '[data-voice-lock-hint]')).toBe(true);
    expect(wrapper.emitted('update:active')?.slice(-1)[0]).toEqual([true]);

    now = 2000;
    await release(wrapper);
    await flushPromises();

    const file = wrapper.emitted('send')?.[0]?.[0] as File;
    expect(file.name).toMatch(/^voice-message-.*\.webm$/);
    expect(file.type).toBe('audio/webm');
    expect(stopTrack).toHaveBeenCalled();
    expect(wrapper.emitted('update:active')?.slice(-1)[0]).toEqual([false]);
  });

  it('keeps the final time while the sent recording fades out and starts the next one from zero', async () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    const runFrames = () => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(now));
    };
    const time = () => wrapper.get('[data-voice-recorder-time]').text();
    const wrapper = mountRecorder();

    await holdUntilRecording(wrapper);
    now = 2000;
    runFrames();
    expect(time()).toBe('0:02,00');

    await release(wrapper);
    now = 2500;
    runFrames();
    expect(time()).toBe('0:02,00');

    await holdUntilRecording(wrapper);
    expect(time()).toBe('0:00,00');
  });

  it('cancels when the finger slides left', async () => {
    const wrapper = mountRecorder();
    await holdUntilRecording(wrapper);
    await move(wrapper, 150, 500);
    await release(wrapper);
    await flushPromises();

    expect(playHaptic).toHaveBeenCalledWith('warning');
    expect(wrapper.emitted('send')).toBeUndefined();
    expect(stopTrack).toHaveBeenCalled();
    expect(shown(wrapper, '[data-voice-recorder-bar]')).toBe(false);
  });

  it('locks when the finger slides up, then sends from the enlarged button', async () => {
    const wrapper = mountRecorder();
    await holdUntilRecording(wrapper);
    await move(wrapper, 300, 400);
    await release(wrapper);
    // The click the browser sends after pointerup is part of the gesture, not a send.
    await wrapper.get('[data-voice-record-button]').trigger('click');
    await flushPromises();

    expect(playHaptic).toHaveBeenCalledWith('success');
    expect(shown(wrapper, '[data-voice-stop]')).toBe(true);
    expect(wrapper.emitted('send')).toBeUndefined();

    now = 3000;
    await wrapper.get('[data-voice-send-locked]').trigger('click');
    await flushPromises();
    expect(wrapper.emitted('send')).toHaveLength(1);
  });

  it('stops a locked recording into a preview that can be deleted or sent', async () => {
    const wrapper = mountRecorder();
    await holdUntilRecording(wrapper);
    await move(wrapper, 300, 400);
    await release(wrapper);

    now = 4000;
    await wrapper.get('[data-voice-stop]').trigger('click');
    await flushPromises();
    expect(shown(wrapper, '[data-voice-preview]')).toBe(true);
    expect(wrapper.get('[data-voice-record-button]').attributes('aria-label')).toBe('Send voice message');

    await wrapper.get('[aria-label="Delete voice message"]').trigger('click');
    expect(shown(wrapper, '[data-voice-preview]')).toBe(false);
    expect(wrapper.emitted('send')).toBeUndefined();

    await holdUntilRecording(wrapper);
    await move(wrapper, 300, 400);
    await release(wrapper);
    now = 6000;
    await wrapper.get('[data-voice-stop]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-voice-record-button]').trigger('click');
    expect(wrapper.emitted('send')).toHaveLength(1);
  });

  it('keeps a cancelled recording out of the next one', async () => {
    // Real recorders deliver their last chunk after stop() returns, sometimes after a new recording began.
    const late: Array<() => void> = [];
    const stop = FakeMediaRecorder.prototype.stop;
    FakeMediaRecorder.prototype.stop = function (this: FakeMediaRecorder) {
      this.state = 'inactive';
      late.push(() => {
        this.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob(['stale-tail']) }));
        this.dispatchEvent(new Event('stop'));
      });
    };
    try {
      const wrapper = mountRecorder();
      await holdUntilRecording(wrapper);
      await move(wrapper, 150, 500);
      await release(wrapper);

      now = 10_000;
      await holdUntilRecording(wrapper);
      late.shift()!();
      now = 12_000;
      await release(wrapper);
      late.shift()!();
      await flushPromises();

      const file = wrapper.emitted('send')?.[0]?.[0] as File;
      // Only the second recording's own final chunk, not the cancelled one's in front of it.
      expect(file.size).toBe('stale-tail'.length);
    } finally {
      FakeMediaRecorder.prototype.stop = stop;
    }
  });

  it('discards recordings that are too short to be a message', async () => {
    const wrapper = mountRecorder();
    await holdUntilRecording(wrapper);
    now = 300;
    await release(wrapper);
    await flushPromises();

    expect(wrapper.emitted('send')).toBeUndefined();
    expect(toast).toHaveBeenCalledWith({ title: 'Voice message too short. Hold the microphone to keep recording.' });
  });

  it('reports a blocked microphone', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    const wrapper = mountRecorder();
    await holdUntilRecording(wrapper);

    expect(playHaptic).toHaveBeenCalledWith('error');
    expect(toast).toHaveBeenCalledWith({
      title: 'Allow microphone access to record voice messages.',
      variant: 'destructive',
    });
    expect(shown(wrapper, '[data-voice-recorder-bar]')).toBe(false);
  });
});
