<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  isIdle: boolean;
  isInitializingMedia: boolean;
  isMediaReady: boolean;
  isCreatingCall: boolean;
  isJoiningCall: boolean;
  isInCall: boolean;
  callId: string | null;
}

interface Emits {
  (e: 'init-media'): void;
  (e: 'create-call'): void;
  (e: 'join-call', callId: string): void;
  (e: 'end-call'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const callIdInput = ref('');
const showCopiedMessage = ref(false);

const handleJoinCall = () => {
  if (callIdInput.value.trim()) {
    emit('join-call', callIdInput.value.trim());
  }
};

const copyCallId = async () => {
  if (props.callId) {
    try {
      await navigator.clipboard.writeText(props.callId);
      showCopiedMessage.value = true;
      setTimeout(() => {
        showCopiedMessage.value = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy call ID:', error);
    }
  }
};
</script>

<template>
  <div class="call-controls">
    <!-- Step 1: Start Webcam -->
    <div v-if="isIdle" class="control-section">
      <h2>1. Start Your Webcam</h2>
      <button class="btn btn-primary" @click="emit('init-media')">Start Webcam</button>
    </div>

    <div v-if="isInitializingMedia" class="control-section">
      <div class="loading">
        <span class="spinner"></span>
        Accessing camera and microphone...
      </div>
    </div>

    <!-- Step 2: Create or Join Call -->
    <div v-if="isMediaReady" class="control-section">
      <div class="create-call-section">
        <h2>2. Create a New Call</h2>
        <button class="btn btn-success" @click="emit('create-call')">Create Call</button>
      </div>

      <div class="divider">OR</div>

      <div class="join-call-section">
        <h2>3. Join a Call</h2>
        <div class="input-group">
          <input
            v-model="callIdInput"
            type="text"
            placeholder="Paste call ID here"
            class="input"
            @keyup.enter="handleJoinCall"
          />
          <button class="btn btn-primary" :disabled="!callIdInput.trim()" @click="handleJoinCall">Join Call</button>
        </div>
      </div>
    </div>

    <!-- Creating/Joining Call Loading -->
    <div v-if="isCreatingCall || isJoiningCall" class="control-section">
      <div class="loading">
        <span class="spinner"></span>
        {{ isCreatingCall ? 'Creating call...' : 'Joining call...' }}
      </div>
    </div>

    <!-- In Call: Show Call ID and End Button -->
    <div v-if="isInCall" class="control-section in-call">
      <div v-if="callId" class="call-id-display">
        <div class="call-id-header">
          <h3>Your Call ID:</h3>
          <span class="status-badge">Connected</span>
        </div>
        <div class="call-id-content">
          <code class="call-id-code">{{ callId }}</code>
          <button class="btn btn-secondary btn-sm" @click="copyCallId">
            {{ showCopiedMessage ? 'Copied!' : 'Copy ID' }}
          </button>
        </div>
        <p class="help-text">Share this ID with the person you want to call</p>
      </div>

      <button class="btn btn-danger" @click="emit('end-call')">End Call</button>
    </div>
  </div>
</template>

<style scoped>
.call-controls {
  padding: 24px;
  background: var(--color-bg-secondary, #1f2937);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-surface, #374151);
}

.control-section {
  margin-bottom: 24px;
}

.control-section:last-child {
  margin-bottom: 0;
}

h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--color-text-primary, #f9fafb);
}

h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text-primary, #f9fafb);
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

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary);
}

.btn-success {
  background-color: var(--color-success);
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: #059669;
}

.btn-danger {
  background-color: #ef4444;
  color: white;
  width: 100%;
  margin-top: 16px;
}

.btn-danger:hover {
  background-color: #dc2626;
}

.btn-secondary {
  background-color: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background-color: #4b5563;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 14px;
}

.divider {
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
  font-weight: 500;
  margin: 24px 0;
  position: relative;
}

.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 40%;
  height: 1px;
  background-color: #4b5563;
}

.divider::before {
  left: 0;
}

.divider::after {
  right: 0;
}

.input-group {
  display: flex;
  gap: 8px;
}

.input {
  flex: 1;
  padding: 12px;
  border: 2px solid var(--color-surface, #4b5563);
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
  background-color: var(--color-bg-tertiary, #111827);
  color: var(--color-text-primary, #f9fafb);
}

.input:focus {
  outline: none;
  border-color: #3b82f6;
}

.input::placeholder {
  color: var(--color-text-secondary, #9ca3af);
}

.loading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background-color: var(--color-bg-tertiary, #111827);
  border-radius: 8px;
  color: var(--color-text-secondary, #9ca3af);
  font-size: 14px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid #e5e7eb;
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.in-call {
  background-color: var(--color-bg-secondary, #065f46);
  padding: 20px;
}

.call-id-display {
  margin-bottom: 16px;
}

.call-id-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.status-badge {
  padding: 4px 12px;
  background-color: #10b981;
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.call-id-content {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.call-id-code {
  flex: 1;
  padding: 12px;
  background-color: var(--color-bg-secondary, #1f2937);
  border: 2px solid #10b981;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: var(--color-text-primary, #f9fafb);
  word-break: break-all;
}

.help-text {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary, #9ca3af);
}

@media (max-width: 768px) {
  .call-controls {
    padding: 16px;
  }

  h2 {
    font-size: 16px;
    margin-bottom: 12px;
  }

  .control-section {
    margin-bottom: 16px;
  }

  .btn {
    padding: 10px 20px;
    font-size: 14px;
  }

  .divider {
    margin: 16px 0;
  }
}

@media (max-width: 480px) {
  .call-controls {
    padding: 12px;
  }

  h2 {
    font-size: 15px;
  }

  .input-group {
    flex-direction: column;
  }

  .input {
    width: 100%;
  }

  .call-id-code {
    font-size: 12px;
    padding: 10px;
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 13px;
  }
}
</style>
