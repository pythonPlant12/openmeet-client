import { isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile, remove, stat } from '@tauri-apps/plugin-fs';

// Bridge to the system photo picker of the OpenMeet iOS app (dialog and fs plugins, registered in
// openmeet-native/src-tauri/src/lib.rs). In WKWebView a file input first shows a Photo Library /
// Take Photo / Choose File menu; the native picker opens the library directly. Other platforms keep
// the file input: desktop file inputs already open the system dialog, and browsers cannot skip the menu.

export interface PickMediaOptions {
  /** `image` limits the library to photos, for avatars. */
  kind: 'media' | 'image';
  multiple: boolean;
  /** Picked files larger than this are not read, only counted in `oversized`. */
  maxBytes: number;
}

export interface PickedMedia {
  files: File[];
  oversized: number;
}

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
};

/** Images in these formats are kept as picked. Others (HEIC from the camera) become JPEG. */
const PORTABLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/** WebKit on iOS refuses canvases above 16,777,216 pixels, smaller than a 24 MP photo. */
const MAX_CANVAS_PIXELS = 4096 * 4096;
const JPEG_QUALITY = 0.9;

export function hasNativeMediaPicker() {
  if (!isTauri()) return false;
  // iPadOS reports a Mac user agent; touch support tells it apart from the macOS app.
  const { userAgent, maxTouchPoints } = navigator;
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Resolves with no files when the user cancels. */
export async function pickNativeMedia({ kind, multiple, maxBytes }: PickMediaOptions): Promise<PickedMedia> {
  const picked = await open({ multiple, pickerMode: kind });
  const paths = picked === null ? [] : [picked].flat();
  const files: File[] = [];
  let oversized = 0;
  try {
    // One at a time, so a selection of large videos is not held in memory at once.
    for (const path of paths) {
      if ((await stat(path)).size > maxBytes) {
        oversized += 1;
        continue;
      }
      files.push(await toPortableFile(path, await readFile(path)));
    }
  } finally {
    // The picker copies every file into the app's caches, including ones left out above.
    for (const path of paths) {
      remove(path).catch((error) => console.error('[MediaPicker] Failed to remove picked copy:', error));
    }
  }
  return { files, oversized };
}

function fileName(path: string) {
  const name = path.split('/').pop() ?? '';
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

async function toPortableFile(path: string, bytes: Uint8Array<ArrayBuffer>) {
  const name = fileName(path);
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  const type = MIME_TYPES[extension] ?? '';
  if (!type.startsWith('image/') || PORTABLE_IMAGE_TYPES.has(type)) return new File([bytes], name, { type });
  try {
    const jpeg = await encodeJpeg(new Blob([bytes], { type }));
    return new File([jpeg], `${name.replace(/\.[^.]*$/, '')}.jpg`, { type: 'image/jpeg' });
  } catch (error) {
    // The upload checks still run on the original, so an unsupported format fails there visibly.
    console.error('[MediaPicker] Failed to convert image to JPEG:', error);
    return new File([bytes], name, { type });
  }
}

async function encodeJpeg(image: Blob) {
  const bitmap = await createImageBitmap(image);
  try {
    const scale = Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (bitmap.width * bitmap.height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(bitmap.width * scale);
    canvas.height = Math.floor(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context is unavailable');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas produced no JPEG'))),
        'image/jpeg',
        JPEG_QUALITY,
      );
    });
  } finally {
    bitmap.close();
  }
}
