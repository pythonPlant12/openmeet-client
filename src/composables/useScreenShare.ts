import { ref, shallowRef } from 'vue';

import { toast } from '@/components/ui/toast';
import { loadScreenQuality, saveScreenQuality } from '@/lib/video-quality';
import { type ScreenShareEndReason, ScreenShareSession } from '@/services/screen-share';
import type { VideoQuality } from '@/services/video-quality';
import { SFU_SERVER_URL } from '@/xstate/machines/webrtc/actors';

// One screen share per tab, shared by the meeting page and its controls.
const session = shallowRef<ScreenShareSession | null>(null);
const stream = shallowRef<MediaStream | null>(null);
const isStarting = ref(false);
const quality = ref<VideoQuality>(loadScreenQuality());
const sentHeight = ref<number | null>(null);

export function useScreenShare() {
  const isSupported = ScreenShareSession.isSupported();

  async function start(options: {
    roomId: string;
    presenterId: string;
    presenterName: string;
    password: string | null;
  }) {
    if (session.value || isStarting.value) return;
    isStarting.value = true;
    const current = new ScreenShareSession();
    current.onLevelChange = (height) => (sentHeight.value = height);
    current.onEnded = (reason: ScreenShareEndReason) => {
      if (session.value === current) {
        session.value = null;
        stream.value = null;
        sentHeight.value = null;
      }
      if (reason === 'lost') toast({ title: 'Screen sharing stopped because the connection dropped.' });
      if (reason === 'error') toast({ title: 'Screen sharing stopped.', variant: 'destructive' });
    };
    try {
      stream.value = await current.start({ ...options, serverUrl: SFU_SERVER_URL, quality: quality.value });
      session.value = current;
    } catch (error) {
      stream.value = null;
      // Closing the browser's picker is a choice, not a failure.
      if (!(error instanceof DOMException && error.name === 'NotAllowedError')) {
        console.error('[useScreenShare] Failed to share the screen:', error);
        toast({ title: 'Could not share your screen.', variant: 'destructive' });
      }
    } finally {
      isStarting.value = false;
    }
  }

  function stop() {
    session.value?.stop('stopped');
  }

  async function setQuality(value: VideoQuality) {
    quality.value = value;
    saveScreenQuality(value);
    await session.value?.setQuality(value);
  }

  function setAudienceSize(otherPeople: number) {
    session.value?.setAudienceSize(otherPeople);
  }

  return { isSupported, session, stream, isStarting, quality, sentHeight, start, stop, setQuality, setAudienceSize };
}
