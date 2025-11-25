<script setup lang="ts">
import { Grid3x3, Maximize2 } from 'lucide-vue-next';
import { computed, nextTick, onMounted, ref, watch } from 'vue';

import { Button } from '@/components/ui/button';

interface Props {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isVideoOff: boolean;
}

const props = defineProps<Props>();

const localVideoRef = ref<HTMLVideoElement | null>(null);
const remoteVideoRef = ref<HTMLVideoElement | null>(null);

const focusedVideo = ref<'local' | 'remote' | null>(null);

const hasRemoteParticipant = computed(() => {
  return props.remoteStream && props.remoteStream.getTracks().length > 0;
});

watch(
  () => props.localStream,
  async (stream) => {
    console.log('[VideoGrid] localStream changed:', stream);
    console.log('[VideoGrid] localStream tracks:', stream?.getTracks());
    await nextTick();
    const videos = document.querySelectorAll('video.local-video');
    console.log('[VideoGrid] Found local video elements:', videos.length);
    videos.forEach((video: any, index) => {
      if (stream) {
        console.log(`[VideoGrid] Setting srcObject for local video ${index}`);
        video.srcObject = stream;
      }
    });
  },
);

watch(
  () => props.remoteStream,
  async (stream) => {
    console.log('[VideoGrid] remoteStream changed:', stream);
    console.log('[VideoGrid] remoteStream tracks:', stream?.getTracks());
    await nextTick();
    const videos = document.querySelectorAll('video.remote-video');
    console.log('[VideoGrid] Found remote video elements:', videos.length);
    videos.forEach((video: any, index) => {
      if (stream) {
        console.log(`[VideoGrid] Setting srcObject for remote video ${index}`);
        video.srcObject = stream;
      }
    });
  },
);

watch(focusedVideo, async (newValue, oldValue) => {
  console.log('[VideoGrid] focusedVideo changed from:', oldValue, 'to:', newValue);
  await nextTick();

  const localVideos = document.querySelectorAll('video.local-video');
  const remoteVideos = document.querySelectorAll('video.remote-video');

  console.log('[VideoGrid] After layout change - local videos:', localVideos.length);
  console.log('[VideoGrid] After layout change - remote videos:', remoteVideos.length);

  localVideos.forEach((video: any, index) => {
    if (props.localStream && !video.srcObject) {
      console.log(`[VideoGrid] Re-attaching local stream to video ${index}`);
      video.srcObject = props.localStream;
    }
  });

  remoteVideos.forEach((video: any, index) => {
    if (props.remoteStream && !video.srcObject) {
      console.log(`[VideoGrid] Re-attaching remote stream to video ${index}`);
      video.srcObject = props.remoteStream;
    }
  });
});

onMounted(async () => {
  console.log('[VideoGrid] Component mounted');
  console.log('[VideoGrid] Initial localStream:', props.localStream);
  console.log('[VideoGrid] Initial remoteStream:', props.remoteStream);

  await nextTick();
  const localVideos = document.querySelectorAll('video.local-video');
  console.log('[VideoGrid] Found local video elements on mount:', localVideos.length);
  localVideos.forEach((video: any, index) => {
    if (props.localStream) {
      console.log(`[VideoGrid] Setting srcObject for local video ${index} on mount`);
      video.srcObject = props.localStream;
    }
  });

  const remoteVideos = document.querySelectorAll('video.remote-video');
  console.log('[VideoGrid] Found remote video elements on mount:', remoteVideos.length);
  remoteVideos.forEach((video: any, index) => {
    if (props.remoteStream) {
      console.log(`[VideoGrid] Setting srcObject for remote video ${index} on mount`);
      video.srcObject = props.remoteStream;
    }
  });
});

const toggleFocus = (video: 'local' | 'remote') => {
  console.log('toggleFocus called with:', video);
  console.log('Current focusedVideo:', focusedVideo.value);
  console.log('localStream:', props.localStream);
  console.log('remoteStream:', props.remoteStream);

  if (focusedVideo.value === video) {
    focusedVideo.value = null;
  } else {
    focusedVideo.value = video;
  }

  console.log('New focusedVideo:', focusedVideo.value);
};

const resetLayout = () => {
  console.log('resetLayout called');
  focusedVideo.value = null;
};
</script>

<template>
  <div class="flex-1 relative bg-[hsl(0,0%,8%)] w-full h-full">
    <!-- Single participant - centered large video -->
    <div v-if="!hasRemoteParticipant" class="absolute h-[83vh] inset-0 flex items-center justify-center p-8">
      <div class="relative w-full h-full max-w-6xl">
        <video
          v-if="localStream"
          autoplay
          playsinline
          muted
          class="local-video w-full h-full object-contain rounded-lg bg-[hsl(0,0%,12%)]"
        />
        <div v-else class="w-full h-full rounded-lg bg-[hsl(0,0%,12%)] flex items-center justify-center">
          <div class="w-32 h-32 rounded-full bg-primary flex items-center justify-center text-5xl font-bold text-white">
            Y
          </div>
        </div>
        <div class="absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded text-sm text-white">You</div>
      </div>
    </div>

    <!-- Two participants -->
    <div v-else class="h-[78vh] w-full relative">
      <Button
        v-if="focusedVideo"
        variant="secondary"
        size="icon"
        @click="resetLayout"
        class="absolute top-8 right-8 z-10 h-10 w-10 rounded-full"
      >
        <Grid3x3 class="h-5 w-5" />
      </Button>

      <!-- Equal grid layout -->
      <div v-if="!focusedVideo" class="h-[78vh] w-full flex items-center justify-center p-4">
        <div class="grid md:grid-cols-2 grid-cols-1 gap-4 w-full h-full max-w-7xl">
          <!-- Remote participant -->
          <div class="relative w-full h-full group cursor-pointer" @click="toggleFocus('remote')">
            <video
              v-if="remoteStream"
              autoplay
              playsinline
              class="remote-video w-full h-full object-cover rounded-lg bg-[hsl(0,0%,12%)]"
            />
            <div class="absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded text-sm text-white">
              Remote Participant
            </div>
            <div
              class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center"
            >
              <Maximize2 class="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <!-- Local participant -->
          <div class="relative w-full h-full group cursor-pointer" @click="toggleFocus('local')">
            <video
              v-if="localStream && !isVideoOff"
              autoplay
              playsinline
              muted
              class="local-video w-full h-full object-cover rounded-lg bg-[hsl(0,0%,12%)]"
            />
            <div v-else class="w-full h-full rounded-lg bg-[hsl(0,0%,12%)] flex items-center justify-center">
              <div
                class="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-4xl font-bold text-white"
              >
                Y
              </div>
            </div>
            <div class="absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded text-sm text-white">You</div>
            <div
              class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center"
            >
              <Maximize2 class="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </div>

      <!-- Desktop: Expanded layout -->
      <div v-else class="hidden md:flex h-full w-full gap-4 p-4">
        <div class="flex-1 relative min-w-0">
          <div v-if="focusedVideo === 'remote'" class="h-full flex items-center justify-center">
            <div class="relative w-full h-full max-h-full group cursor-pointer" @click="toggleFocus('remote')">
              <video
                v-if="remoteStream"
                autoplay
                playsinline
                class="remote-video w-full h-full object-contain rounded-lg bg-[hsl(0,0%,12%)]"
              />
              <div class="absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded text-sm text-white">
                Remote Participant
              </div>
              <div
                class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center"
              >
                <Grid3x3 class="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>

          <div v-else class="h-full flex items-center justify-center">
            <div class="relative w-full h-full max-h-full group cursor-pointer" @click="toggleFocus('local')">
              <video
                v-if="localStream && !isVideoOff"
                autoplay
                playsinline
                muted
                class="local-video w-full h-full object-contain rounded-lg bg-[hsl(0,0%,12%)]"
              />
              <div v-else class="w-full h-full rounded-lg bg-[hsl(0,0%,12%)] flex items-center justify-center">
                <div
                  class="w-32 h-32 rounded-full bg-primary flex items-center justify-center text-5xl font-bold text-white"
                >
                  Y
                </div>
              </div>
              <div class="absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded text-sm text-white">You</div>
              <div
                class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center"
              >
                <Grid3x3 class="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        </div>

        <!-- Desktop sidebar with minimized video -->
        <div class="w-80 flex flex-col gap-4">
          <div
            v-if="focusedVideo === 'local'"
            class="relative aspect-video cursor-pointer group"
            @click="toggleFocus('remote')"
          >
            <video
              v-if="remoteStream"
              autoplay
              playsinline
              class="remote-video w-full h-full object-cover rounded-lg bg-[hsl(0,0%,12%)]"
            />
            <div class="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white">Remote</div>
            <div
              class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center"
            >
              <Maximize2 class="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div v-else class="relative aspect-video cursor-pointer group" @click="toggleFocus('local')">
            <video
              v-if="localStream && !isVideoOff"
              autoplay
              playsinline
              muted
              class="local-video w-full h-full object-cover rounded-lg bg-[hsl(0,0%,12%)]"
            />
            <div v-else class="w-full h-full rounded-lg bg-[hsl(0,0%,12%)] flex items-center justify-center">
              <div
                class="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-2xl font-bold text-white"
              >
                Y
              </div>
            </div>
            <div class="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white">You</div>
            <div
              class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center"
            >
              <Maximize2 class="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile: Expanded layout -->
      <div v-if="focusedVideo" class="md:hidden h-full w-full">
        <!-- Expanded video - centered on screen -->
        <div class="absolute inset-0 flex items-center justify-center p-4">
          <div v-if="focusedVideo === 'remote'" class="relative w-full h-full">
            <div class="h-full w-full flex items-center justify-center">
              <div class="relative max-w-full max-h-full cursor-pointer" @click="toggleFocus('remote')">
                <video
                  v-if="remoteStream"
                  autoplay
                  playsinline
                  class="remote-video max-w-full max-h-full object-contain rounded-lg bg-[hsl(0,0%,12%)]"
                />
                <div class="absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded text-sm text-white">
                  Remote Participant
                </div>
              </div>
            </div>
          </div>

          <div v-else class="relative w-full h-full">
            <div class="h-full w-full flex items-center justify-center">
              <div class="relative max-w-full max-h-full cursor-pointer" @click="toggleFocus('local')">
                <video
                  v-if="localStream && !isVideoOff"
                  autoplay
                  playsinline
                  muted
                  class="local-video max-w-full max-h-full object-contain rounded-lg bg-[hsl(0,0%,12%)]"
                />
                <div
                  v-else
                  class="w-full h-full min-h-[300px] rounded-lg bg-[hsl(0,0%,12%)] flex items-center justify-center"
                >
                  <div
                    class="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-4xl font-bold text-white"
                  >
                    Y
                  </div>
                </div>
                <div class="absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded text-sm text-white">You</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile: Horizontal strip with minimized participants (fixed at bottom, above controls) -->
        <div class="fixed bottom-24 left-0 right-0 h-28 flex gap-2 overflow-x-auto px-4 pb-2 bg-[hsl(0,0%,8%)] z-10">
          <div
            v-if="focusedVideo === 'local'"
            class="relative flex-shrink-0 w-40 h-full cursor-pointer"
            @click="toggleFocus('remote')"
          >
            <video
              v-if="remoteStream"
              autoplay
              playsinline
              class="remote-video w-full h-full object-cover rounded-lg bg-[hsl(0,0%,12%)]"
            />
            <div class="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white">Remote</div>
            <div
              class="absolute inset-0 bg-black/0 active:bg-black/20 transition-colors rounded-lg flex items-center justify-center"
            >
              <Maximize2 class="h-5 w-5 text-white opacity-0 active:opacity-100 transition-opacity" />
            </div>
          </div>

          <div v-else class="relative flex-shrink-0 w-40 h-full cursor-pointer" @click="toggleFocus('local')">
            <video
              v-if="localStream && !isVideoOff"
              autoplay
              playsinline
              muted
              class="local-video w-full h-full object-cover rounded-lg bg-[hsl(0,0%,12%)]"
            />
            <div v-else class="w-full h-full rounded-lg bg-[hsl(0,0%,12%)] flex items-center justify-center">
              <div
                class="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-white"
              >
                Y
              </div>
            </div>
            <div class="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white">You</div>
            <div
              class="absolute inset-0 bg-black/0 active:bg-black/20 transition-colors rounded-lg flex items-center justify-center"
            >
              <Maximize2 class="h-5 w-5 text-white opacity-0 active:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
