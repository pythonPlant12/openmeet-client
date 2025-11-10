<script setup lang="ts">
import { useWebRTC } from '@/composables/useWebRTC';

import CallControls from './CallControls.vue';
import VideoPlayer from './VideoPlayer.vue';

const {
  isIdle,
  isInitializingMedia,
  isMediaReady,
  isCreatingCall,
  isJoiningCall,
  isInCall,
  isError,
  localStream,
  remoteStream,
  callId,
  error,
  connectionState,
  iceConnectionState,
  initMedia,
  createCall,
  joinCall,
  endCall,
  retry,
} = useWebRTC();
</script>

<template>
  <div class="video-call">
    <!-- Error State -->
    <div v-if="isError" class="error-container">
      <div class="error-card">
        <h2>❌ Error</h2>
        <p class="error-message">{{ error }}</p>
        <button class="btn btn-primary" @click="retry">Try Again</button>
      </div>
    </div>

    <!-- Main Interface -->
    <div v-else class="video-call-container">
      <!-- Video Streams -->
      <div class="video-grid">
        <div class="video-column">
          <h3 class="video-title">Local Stream</h3>
          <div class="video-wrapper">
            <VideoPlayer :stream="localStream" label="You" :muted="true" />
          </div>
        </div>

        <div class="video-column">
          <h3 class="video-title">Remote Stream</h3>
          <div class="video-wrapper">
            <VideoPlayer
              :stream="remoteStream"
              :label="isInCall ? 'Remote Participant' : 'Waiting for connection...'"
            />
          </div>
        </div>
      </div>

      <!-- Connection Status -->
      <div v-if="isInCall" class="status-bar">
        <div class="status-item">
          <span class="status-label">Connection:</span>
          <span
            class="status-value"
            :class="{
              'status-success': connectionState === 'connected',
              'status-warning': connectionState === 'connecting',
              'status-danger': connectionState === 'failed' || connectionState === 'disconnected',
            }"
          >
            {{ connectionState || 'unknown' }}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">ICE:</span>
          <span
            class="status-value"
            :class="{
              'status-success': iceConnectionState === 'connected' || iceConnectionState === 'completed',
              'status-warning': iceConnectionState === 'checking' || iceConnectionState === 'new',
              'status-danger': iceConnectionState === 'failed' || iceConnectionState === 'disconnected',
            }"
          >
            {{ iceConnectionState || 'unknown' }}
          </span>
        </div>
      </div>

      <!-- Controls -->
      <CallControls
        :is-idle="isIdle"
        :is-initializing-media="isInitializingMedia"
        :is-media-ready="isMediaReady"
        :is-creating-call="isCreatingCall"
        :is-joining-call="isJoiningCall"
        :is-in-call="isInCall"
        :call-id="callId"
        @init-media="initMedia"
        @create-call="createCall"
        @join-call="joinCall"
        @end-call="endCall"
      />
    </div>
  </div>
</template>

<style scoped>
.video-call {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}

.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.error-card {
  background: white;
  padding: 32px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 500px;
}

.error-card h2 {
  margin: 0 0 16px 0;
  color: #ef4444;
  font-size: 24px;
}

.error-message {
  margin: 0 0 24px 0;
  color: #6b7280;
  font-size: 16px;
}

.video-call-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}

.video-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.video-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: white;
}

.video-wrapper {
  aspect-ratio: 16 / 9;
  min-height: 200px;
  width: 100%;
}

.status-bar {
  display: flex;
  gap: 24px;
  padding: 16px;
  background-color: var(--color-bg-secondary);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label {
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
}

.status-value {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-success {
  background-color: #d1fae5;
  color: #065f46;
}

.status-warning {
  background-color: #fef3c7;
  color: #92400e;
}

.status-danger {
  background-color: #fee2e2;
  color: #991b1b;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background-color: #2563eb;
}

@media (max-width: 768px) {
  .video-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .video-wrapper {
    min-height: 180px;
  }

  .status-bar {
    flex-direction: column;
    gap: 12px;
  }

  .video-call-container {
    gap: 16px;
  }
}

@media (max-width: 480px) {
  .video-grid {
    gap: 12px;
  }

  .video-wrapper {
    min-height: 150px;
  }

  .video-title {
    font-size: 14px;
  }
}
</style>
