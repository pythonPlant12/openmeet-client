<script setup lang="ts">
import { ArrowDown, Mic, Pause, Play } from 'lucide-vue-next';
import { computed, ref, toRef, watch } from 'vue';

import { LoadingRipple } from '@/components/ui/loading';
import { useVoicePlayback } from '@/composables/useVoicePlayback';
import { playHaptic } from '@/services/haptics';
import type { ConversationMessageAttachment } from '@/services/social-api';

import VoiceWaveform from './VoiceWaveform.vue';
import { type SenderAvatar, decodeVoiceMessage, formatVoiceDuration, storedWaveformLevels } from './voice-message';

// A voice message inside a chat bubble.
const props = defineProps<{
  attachment: ConversationMessageAttachment;
  /** Object URL of the loaded file. */
  url?: string;
  loading: boolean;
  error: boolean;
  /** Message time, shown on the duration row when the voice message is the whole message. */
  sentAt?: string;
  formatTime?: (value: string) => string;
  /** The sender's picture, with a microphone badge like a recorded note. */
  avatar?: SenderAvatar;
  /** Stretches across its row instead of keeping the chat bubble width. */
  fill?: boolean;
}>();
const emit = defineEmits<{ (event: 'load'): void }>();

const durationMs = ref(0);
const levels = ref<number[]>([]);
const decodeFailed = ref(false);
const playback = useVoicePlayback(toRef(props, 'url'), durationMs);
// The badge turns teal once the message has been played from this device.
const hasPlayed = computed(() => playback.playing.value || playback.positionMs.value > 0);
const clock = computed(() =>
  formatVoiceDuration(
    playback.playing.value || playback.positionMs.value ? playback.positionMs.value : durationMs.value,
  ),
);

watch(
  () => props.url,
  async (url) => {
    decodeFailed.value = false;
    // Measured while recording and stored with the message: no download or decoding needed.
    const stored = props.attachment.voice;
    if (stored) {
      durationMs.value = stored.durationMs;
      levels.value = storedWaveformLevels(stored);
      return;
    }
    durationMs.value = 0;
    levels.value = [];
    if (!url) return;
    try {
      const decoded = await decodeVoiceMessage(url, props.attachment.url);
      if (url !== props.url) return;
      durationMs.value = decoded.durationMs;
      levels.value = decoded.levels;
    } catch (error) {
      console.error('[VoiceMessagePlayer] Failed to read voice message:', error);
      decodeFailed.value = true;
    }
  },
  { immediate: true },
);

function togglePlayback() {
  if (!props.url) {
    emit('load');
    return;
  }
  playHaptic('selection');
  void playback.toggle();
}
</script>

<template>
  <!-- The clock hangs below the waveform, outside the row, so the waveform lines up with the play button. -->
  <div
    data-voice-message
    class="flex max-w-full items-center gap-2 pb-4 pt-0.5"
    :class="fill ? 'w-full' : 'w-64 sm:w-80 lg:w-96'"
  >
    <button
      type="button"
      class="flex size-10 shrink-0 items-center justify-center rounded-full text-harbor-icon transition-transform active:scale-95"
      :aria-label="playback.playing.value ? 'Pause voice message' : 'Play voice message'"
      :disabled="loading"
      @click.stop="togglePlayback"
    >
      <LoadingRipple v-if="loading" class="size-5" />
      <span
        v-else-if="!url"
        class="flex size-9 items-center justify-center rounded-full border-2 border-current"
        aria-hidden="true"
        ><ArrowDown class="size-[1.125rem]" :stroke-width="2.5"
      /></span>
      <Pause v-else-if="playback.playing.value" class="size-6 fill-current" />
      <Play v-else class="ml-0.5 size-6 fill-current" />
    </button>
    <div class="relative min-w-0 flex-1">
      <VoiceWaveform
        :levels="levels"
        :progress="playback.progress.value"
        :playing="playback.playing.value"
        :seekable="!!url && durationMs > 0"
        played-class="bg-harbor-accent"
        unplayed-class="bg-harbor-waveform"
        @seek="playback.seek"
      />
      <p
        class="absolute inset-x-0 top-full mt-0.5 flex items-baseline justify-between gap-2 text-[0.6875rem] tabular-nums text-harbor-muted"
      >
        <span class="min-w-0 truncate">
          <template v-if="error">Could not load. Tap to retry.</template>
          <template v-else-if="decodeFailed">Voice message</template>
          <template v-else>{{ durationMs ? clock : '0:00' }}</template>
        </span>
        <time v-if="sentAt && formatTime" :datetime="sentAt" class="shrink-0">{{ formatTime(sentAt) }}</time>
      </p>
    </div>
    <span v-if="avatar" data-voice-avatar class="relative -mb-4 ml-1 shrink-0" aria-hidden="true">
      <span
        class="flex size-12 items-center justify-center overflow-hidden rounded-full bg-harbor-avatar text-sm font-semibold text-harbor-icon"
        ><img v-if="avatar.url" :src="avatar.url" alt="" class="size-full object-cover" /><template v-else>{{
          avatar.initials
        }}</template></span
      >
      <span
        class="absolute -bottom-1 -left-1.5 flex size-5 items-center justify-center rounded-full bg-white shadow-sm"
        :class="hasPlayed ? 'text-harbor-accent' : 'text-harbor-subtle'"
        ><Mic class="size-3.5" :stroke-width="2.5"
      /></span>
    </span>
  </div>
</template>
