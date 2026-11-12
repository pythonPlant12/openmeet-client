import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const saved = vi.hoisted(() => ({ speakerId: null as string | null, save: vi.fn() }));
vi.mock('@/lib/call-settings', () => ({
  loadCallSettings: () => ({ speakerId: saved.speakerId }),
  saveCallSettings: saved.save,
}));

async function loadModule() {
  vi.resetModules();
  return import('../audio-output');
}

function mediaElement(tag: 'video' | 'audio') {
  const element = document.createElement(tag) as HTMLMediaElement & { setSinkId: ReturnType<typeof vi.fn> };
  element.setSinkId = vi.fn(async () => {});
  return element;
}

describe('audio output', () => {
  beforeEach(() => {
    saved.speakerId = null;
    saved.save.mockReset();
    Object.defineProperty(HTMLMediaElement.prototype, 'setSinkId', { configurable: true, writable: true, value: vi.fn() });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (HTMLMediaElement.prototype as { setSinkId?: unknown }).setSinkId;
  });

  it('is offered only where the browser can switch outputs', async () => {
    expect((await loadModule()).canChooseAudioOutput()).toBe(true);
    delete (HTMLMediaElement.prototype as { setSinkId?: unknown }).setSinkId;
    expect((await loadModule()).canChooseAudioOutput()).toBe(false);
  });

  it('plays the call on the chosen speaker and saves the choice', async () => {
    const { followAudioOutput, setAudioOutput, getAudioOutput } = await loadModule();
    const existing = mediaElement('video');
    document.body.append(existing);
    const stop = followAudioOutput();

    await setAudioOutput('speaker-2');
    const added = mediaElement('audio');
    document.body.append(added);
    await Promise.resolve();

    expect(existing.setSinkId).toHaveBeenCalledWith('speaker-2');
    expect(added.setSinkId).toHaveBeenCalledWith('speaker-2');
    expect(getAudioOutput()).toBe('speaker-2');
    expect(saved.save).toHaveBeenCalledWith({ speakerId: 'speaker-2' });
    stop();
  });

  it('starts on the saved speaker and keeps playing when it is gone', async () => {
    saved.speakerId = 'unplugged';
    const { followAudioOutput } = await loadModule();
    const element = mediaElement('video');
    element.setSinkId.mockRejectedValue(new DOMException('gone', 'NotFoundError'));
    document.body.append(element);

    const stop = followAudioOutput();
    await Promise.resolve();

    expect(element.setSinkId).toHaveBeenCalledWith('unplugged');
    stop();
  });
});
