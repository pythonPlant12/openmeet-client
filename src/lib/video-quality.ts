import { VIDEO_QUALITIES, type VideoQuality } from '@/services/video-quality';

const CAMERA_STORAGE_KEY = 'openmeet:video-quality';
const SCREEN_STORAGE_KEY = 'openmeet:screen-quality';

export const VIDEO_QUALITY_OPTIONS: { value: VideoQuality; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto', description: 'Starts at 720p and adapts to your connection' },
  { value: '360p', label: '360p', description: 'Data saver' },
  { value: '720p', label: '720p', description: 'HD' },
  { value: '1080p', label: '1080p', description: 'Full HD · needs a fast connection' },
];

function load(key: string): VideoQuality {
  try {
    const stored = localStorage.getItem(key);
    return VIDEO_QUALITIES.includes(stored as VideoQuality) ? (stored as VideoQuality) : 'auto';
  } catch {
    return 'auto';
  }
}

function save(key: string, quality: VideoQuality) {
  try {
    localStorage.setItem(key, quality);
  } catch {
    // A private window may block storage; the choice still applies to this call.
  }
}

/** The viewer's last camera choice; unknown or unavailable storage means auto. */
export const loadVideoQuality = () => load(CAMERA_STORAGE_KEY);
export const saveVideoQuality = (quality: VideoQuality) => save(CAMERA_STORAGE_KEY, quality);
export const loadScreenQuality = () => load(SCREEN_STORAGE_KEY);
export const saveScreenQuality = (quality: VideoQuality) => save(SCREEN_STORAGE_KEY, quality);
