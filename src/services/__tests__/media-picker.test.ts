import { afterEach, describe, expect, it, vi } from 'vitest';

import { hasNativeMediaPicker, pickNativeMedia } from '@/services/media-picker';

const tauri = vi.hoisted(() => ({ isTauri: vi.fn(() => false) }));
const dialog = vi.hoisted(() => ({ open: vi.fn() }));
const fs = vi.hoisted(() => ({
  stat: vi.fn(),
  readFile: vi.fn(),
  remove: vi.fn(() => Promise.resolve()),
}));
vi.mock('@tauri-apps/api/core', () => tauri);
vi.mock('@tauri-apps/plugin-dialog', () => dialog);
vi.mock('@tauri-apps/plugin-fs', () => fs);

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
const CACHES = 'file:///var/mobile/Containers/Data/Application/APP/Library/Caches';

function stubFiles(files: Record<string, number>) {
  fs.stat.mockImplementation((path: string) => Promise.resolve({ size: files[path] }));
  fs.readFile.mockImplementation((path: string) => Promise.resolve(new Uint8Array(files[path]!)));
}

describe('media picker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    tauri.isTauri.mockReturnValue(false);
  });

  it('is used only by the iOS app', () => {
    vi.stubGlobal('navigator', { userAgent: IPHONE, maxTouchPoints: 5 });
    expect(hasNativeMediaPicker()).toBe(false);

    tauri.isTauri.mockReturnValue(true);
    expect(hasNativeMediaPicker()).toBe(true);

    vi.stubGlobal('navigator', { userAgent: MAC, maxTouchPoints: 5 });
    expect(hasNativeMediaPicker()).toBe(true);

    vi.stubGlobal('navigator', { userAgent: MAC, maxTouchPoints: 0 });
    expect(hasNativeMediaPicker()).toBe(false);
  });

  it('opens the photo library and returns the picked files', async () => {
    dialog.open.mockResolvedValue([`${CACHES}/IMG_0001.JPG`, `${CACHES}/My%20clip.mov`]);
    stubFiles({ [`${CACHES}/IMG_0001.JPG`]: 3, [`${CACHES}/My%20clip.mov`]: 5 });

    const { files, oversized } = await pickNativeMedia({ kind: 'media', multiple: true, maxBytes: 10 });

    expect(dialog.open).toHaveBeenCalledWith({ multiple: true, pickerMode: 'media' });
    expect(oversized).toBe(0);
    expect(files.map(({ name, type, size }) => ({ name, type, size }))).toEqual([
      { name: 'IMG_0001.JPG', type: 'image/jpeg', size: 3 },
      { name: 'My clip.mov', type: 'video/quicktime', size: 5 },
    ]);
  });

  it('skips files over the size limit and removes every picked copy', async () => {
    dialog.open.mockResolvedValue([`${CACHES}/big.mov`, `${CACHES}/small.png`]);
    stubFiles({ [`${CACHES}/big.mov`]: 11, [`${CACHES}/small.png`]: 2 });

    const { files, oversized } = await pickNativeMedia({ kind: 'media', multiple: true, maxBytes: 10 });

    expect(oversized).toBe(1);
    expect(files.map((file) => file.name)).toEqual(['small.png']);
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(fs.remove).toHaveBeenCalledWith(`${CACHES}/big.mov`);
    expect(fs.remove).toHaveBeenCalledWith(`${CACHES}/small.png`);
  });

  it('accepts a single picked file', async () => {
    dialog.open.mockResolvedValue(`${CACHES}/avatar.png`);
    stubFiles({ [`${CACHES}/avatar.png`]: 4 });

    const { files } = await pickNativeMedia({ kind: 'image', multiple: false, maxBytes: 10 });

    expect(dialog.open).toHaveBeenCalledWith({ multiple: false, pickerMode: 'image' });
    expect(files.map((file) => file.name)).toEqual(['avatar.png']);
  });

  it('returns nothing when the user cancels', async () => {
    dialog.open.mockResolvedValue(null);

    await expect(pickNativeMedia({ kind: 'media', multiple: true, maxBytes: 10 })).resolves.toEqual({
      files: [],
      oversized: 0,
    });
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  it('converts HEIC photos to JPEG', async () => {
    dialog.open.mockResolvedValue([`${CACHES}/IMG_0002.HEIC`]);
    stubFiles({ [`${CACHES}/IMG_0002.HEIC`]: 6 });
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve({ width: 6000, height: 4000, close })),
    );
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
      callback(new Blob([new Uint8Array(2)], { type: 'image/jpeg' })),
    );

    const { files } = await pickNativeMedia({ kind: 'image', multiple: false, maxBytes: 10 });

    expect(files.map(({ name, type }) => ({ name, type }))).toEqual([{ name: 'IMG_0002.jpg', type: 'image/jpeg' }]);
    // 24 MP is above the WebKit canvas limit, so the photo is scaled down to fit it.
    const [, , , width, height] = drawImage.mock.calls[0]!;
    expect(width * height).toBeLessThanOrEqual(4096 * 4096);
    expect(close).toHaveBeenCalled();
  });

  it('keeps the original photo when it cannot be converted', async () => {
    dialog.open.mockResolvedValue([`${CACHES}/IMG_0003.HEIC`]);
    stubFiles({ [`${CACHES}/IMG_0003.HEIC`]: 6 });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.reject(new Error('unsupported'))),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { files } = await pickNativeMedia({ kind: 'image', multiple: false, maxBytes: 10 });

    expect(files.map(({ name, type }) => ({ name, type }))).toEqual([{ name: 'IMG_0003.HEIC', type: 'image/heic' }]);
  });
});
