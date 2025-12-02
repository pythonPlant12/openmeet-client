<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

interface Props {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  muted: false,
});

const videoRef = ref<HTMLVideoElement | null>(null);

// Attach stream to video element when it changes
watch(
  () => props.stream,
  (newStream) => {
    if (videoRef.value && newStream) {
      videoRef.value.srcObject = newStream;
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (videoRef.value && props.stream) {
    videoRef.value.srcObject = props.stream;
  }
});
</script>

<template>
  <div class="video-player">
    <div class="video-container">
      <video ref="videoRef" :muted="muted" autoplay playsinline class="video" />
      <div class="video-label">
        {{ label }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-player {
  width: 100%;
  height: 100%;
}

.video-container {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #000;
  border-radius: 8px;
  overflow: hidden;
}

.video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-label {
  position: absolute;
  bottom: 12px;
  left: 12px;
  padding: 6px 12px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
}

@media (max-width: 480px) {
  .video-label {
    font-size: 12px;
    padding: 4px 8px;
    bottom: 8px;
    left: 8px;
  }
}
</style>
