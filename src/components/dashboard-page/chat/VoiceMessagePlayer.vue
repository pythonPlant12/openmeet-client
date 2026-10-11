<script setup lang="ts">
import { Pause, Play } from 'lucide-vue-next';
import { computed, ref, toRef, watch } from 'vue';

import { LoadingRipple } from '@/components/ui/loading';
import { useVoicePlayback } from '@/composables/useVoicePlayback';
import { playHaptic } from '@/services/haptics';
import type { ConversationMessageAttachment } from '@/services/social-api';

import VoiceWaveform from './VoiceWaveform.vue';
import { decodeVoiceMessage, formatVoiceDuration } from './voice-message';

// A voice message inside a chat bubble.
const props = defineProps<{
  attachment: ConversationMessageAttachment;
  /** Object URL of the loaded file. */
  url?: string;
  loading: boolean;
  error: boolean;
  local: boolean;
  /** Message time, shown on the duration row when the voice message is the whole message. */
  sentAt?: string;
  formatTime?: (value: string) => string;
}>();
const emit = defineEmits<{ (event: 'load'): void }>();

const durationMs = ref(0);
const levels = ref<number[]>([]);
const decodeFailed = ref(false);
const playback = useVoicePlayback(toRef(props, 'url'), durationMs);
const clock = computed(() =>
  formatVoiceDuration(
    playback.playing.value || playback.positionMs.value ? playback.positionMs.value : durationMs.value,
  ),
);

watch(
  () => props.url,
  async (url) => {
    durationMs.value = 0;
    levels.value = [];
    decodeFailed.value = false;
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
  <div data-voice-message class="flex w-60 max-w-full items-center sm:w-72 lg:w-80 gap-2.5 py-0.5">
    <button
      type="button"
      class="flex size-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
      :class="local ? 'bg-white text-[#0B7A75]' : 'bg-[#0B7A75] text-white'"
      :aria-label="playback.playing.value ? 'Pause voice message' : 'Play voice message'"
      :disabled="loading"
      @click.stop="togglePlayback"
    >
      <LoadingRipple v-if="loading" class="size-4" />
      <Pause v-else-if="playback.playing.value" class="size-4 fill-current" />
      <Play v-else class="ml-0.5 size-4 fill-current" />
    </button>
    <div class="min-w-0 flex-1">
      <VoiceWaveform
        :levels="levels"
        :progress="playback.progress.value"
        :playing="playback.playing.value"
        :seekable="!!url && durationMs > 0"
        :played-class="local ? 'bg-white' : 'bg-[#0B7A75]'"
        :unplayed-class="local ? 'bg-white/45' : 'bg-[#B8C6C5]'"
        @seek="playback.seek"
      />
      <p
        class="mt-0.5 flex items-baseline justify-between gap-2 text-[0.6875rem] tabular-nums"
        :class="local ? 'text-white/75' : 'text-[#61777B]'"
      >
        <span class="min-w-0 truncate">
          <template v-if="error">Could not load. Tap to retry.</template>
          <template v-else-if="decodeFailed">Voice message</template>
          <template v-else>{{ url && durationMs ? clock : '0:00' }}</template>
        </span>
        <time
          v-if="sentAt && formatTime"
          :datetime="sentAt"
          class="shrink-0"
          :class="local ? 'text-white/70' : 'text-[#8A9C9E]'"
          >{{ formatTime(sentAt) }}</time
        >
      </p>
    </div>
  </div>
</template>
