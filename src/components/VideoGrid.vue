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
    await nextTick();
    const videos = document.querySelectorAll('video.local-video');
    videos.forEach((video: any) => {
      if (stream) {
        video.srcObject = stream;
      }
    });
  },
);

watch(
  () => props.remoteStream,
  async (stream) => {
    await nextTick();
    const videos = document.querySelectorAll('video.remote-video');
    videos.forEach((video: any) => {
      if (stream) {
        video.srcObject = stream;
      }
    });
  },
);

onMounted(async () => {
  await nextTick();
  const localVideos = document.querySelectorAll('video.local-video');
  localVideos.forEach((video: any) => {
    if (props.localStream) {
      video.srcObject = props.localStream;
    }
  });

  const remoteVideos = document.querySelectorAll('video.remote-video');
  remoteVideos.forEach((video: any) => {
    if (props.remoteStream) {
      video.srcObject = props.remoteStream;
    }
  });
});

const toggleFocus = (video: 'local' | 'remote') => {
  focusedVideo.value = focusedVideo.value === video ? null : video;
};

const resetLayout = () => {
  focusedVideo.value = null;
};
</script>

<template>
  <div class="flex-1 relative bg-[hsl(0,0%,8%)]">
    <div v-if="!hasRemoteParticipant" class="absolute inset-0 flex items-center justify-center">
      <div class="relative w-full max-w-2xl aspect-video">
        <video
          v-if="localStream"
          autoplay
          playsinline
          muted
          class="local-video w-full h-full object-cover rounded-lg bg-[hsl(0,0%,12%)]"
        />
        <div v-else class="w-full h-full rounded-lg bg-[hsl(0,0%,12%)] flex items-center justify-center">
          <div class="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-4xl font-bold text-white">
            Y
          </div>
        </div>
        <div class="absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded text-sm text-white">You</div>
      </div>
    </div>

    <div v-else class="h-full p-4 relative">
      <Button
        v-if="focusedVideo"
        variant="secondary"
        size="icon"
        @click="resetLayout"
        class="absolute top-8 right-8 z-10 h-10 w-10 rounded-full"
      >
        <Grid3x3 class="h-5 w-5" />
      </Button>

      <div v-if="!focusedVideo" class="h-full flex items-center justify-center">
        <div class="grid grid-cols-2 gap-4 w-full max-w-6xl">
          <div class="relative aspect-video group cursor-pointer" @click="toggleFocus('remote')">
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

          <div class="relative aspect-video group cursor-pointer" @click="toggleFocus('local')">
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

      <div v-else class="h-full flex gap-4">
        <div class="flex-1 relative">
          <div v-if="focusedVideo === 'remote'" class="h-full flex items-center justify-center">
            <div class="relative w-full h-full max-h-full">
              <video
                v-if="remoteStream"
                autoplay
                playsinline
                class="remote-video w-full h-full object-contain rounded-lg bg-[hsl(0,0%,12%)]"
              />
              <div class="absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded text-sm text-white">
                Remote Participant
              </div>
            </div>
          </div>

          <div v-else class="h-full flex items-center justify-center">
            <div class="relative w-full h-full max-h-full">
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
            </div>
          </div>
        </div>

        <div class="w-64 flex flex-col gap-4">
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
    </div>
  </div>
</template>
