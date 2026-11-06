import { ref, shallowRef } from 'vue';

import { toast } from '@/components/ui/toast';
import { loadScreenQuality, saveScreenQuality } from '@/lib/video-quality';
import { type ScreenArea, canShareScreenArea } from '@/services/screen-crop';
import { type ScreenShareEndReason, ScreenShareSession } from '@/services/screen-share';
import type { VideoQuality } from '@/services/video-quality';
import { SFU_SERVER_URL } from '@/xstate/machines/webrtc/actors';

// One screen share per tab, shared by the meeting page and its controls.
const session = shallowRef<ScreenShareSession | null>(null);
const stream = shallowRef<MediaStream | null>(null);
const isStarting = ref(false);
const quality = ref<VideoQuality>(loadScreenQuality());
const sentHeight = ref<number | null>(null);
// The captured screen waiting for the presenter to pick an area; the picker dialog answers it.
const areaRequest = shallowRef<{
  stream: MediaStream;
  resolve: (area: ScreenArea | 'whole' | null) => void;
} | null>(null);

export function useScreenShare() {
  const isSupported = ScreenShareSession.isSupported();
  const canSelectArea = isSupported && canShareScreenArea();

  async function start(options: {
    roomId: string;
    presenterId: string;
    presenterName: string;
    password: string | null;
    /** Lets the presenter share only part of what they pick. */
    selectArea?: boolean;
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
      const { selectArea, ...room } = options;
      stream.value = await current.start({
        ...room,
        serverUrl: SFU_SERVER_URL,
        quality: quality.value,
        chooseArea:
          selectArea && canSelectArea
            ? (captured) =>
                new Promise((resolve) => {
                  // The browser's "Stop sharing" button closes the picker too.
                  const video = captured.getVideoTracks()[0];
                  const answer = (area: ScreenArea | 'whole' | null) => {
                    video?.removeEventListener('ended', cancel);
                    areaRequest.value = null;
                    resolve(area);
                  };
                  const cancel = () => answer(null);
                  video?.addEventListener('ended', cancel);
                  areaRequest.value = { stream: captured, resolve: answer };
                })
            : undefined,
      });
      session.value = current;
    } catch (error) {
      stream.value = null;
      // Closing the browser's picker or the area picker is a choice, not a failure.
      if (!(error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError'))) {
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

  return {
    isSupported,
    canSelectArea,
    session,
    stream,
    isStarting,
    quality,
    sentHeight,
    areaRequest,
    start,
    stop,
    setQuality,
    setAudienceSize,
  };
}
