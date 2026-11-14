<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue';

import type { Participant } from '@/xstate/machines/webrtc/types';

// Everyone's audio, apart from the tiles: each other person, and each screen share with sound, plays from a hidden
// audio element, so hiding a tile, scrolling it off a grid page or out of the strip, or collapsing the strip
// never silences anyone. The tiles' own videos stay muted. A muted person sends no sound, so their element
// plays silence.
const props = defineProps<{ participants: readonly Participant[] }>();

const sources = computed(() =>
  props.participants.flatMap((participant) =>
    !participant.isLocal && participant.stream ? [{ id: participant.id, stream: participant.stream }] : [],
  ),
);

// A browser can block playback until the person interacts with the page; the next press anywhere retries.
const blocked = new Set<HTMLAudioElement>();
function retryBlocked() {
  for (const element of blocked) void play(element);
}
async function play(element: HTMLAudioElement) {
  try {
    await element.play();
    blocked.delete(element);
  } catch {
    if (!blocked.size) document.addEventListener('pointerdown', retryBlocked, { capture: true });
    blocked.add(element);
    return;
  }
  if (!blocked.size) document.removeEventListener('pointerdown', retryBlocked, { capture: true });
}

function attach(element: unknown, stream: MediaStream) {
  if (!(element instanceof HTMLAudioElement) || element.srcObject === stream) return;
  element.srcObject = stream;
  void play(element);
}

onBeforeUnmount(() => {
  blocked.clear();
  document.removeEventListener('pointerdown', retryBlocked, { capture: true });
});
</script>

<template>
  <div class="hidden" aria-hidden="true" data-call-audio>
    <audio
      v-for="source in sources"
      :key="source.id"
      :ref="(element) => attach(element, source.stream)"
      autoplay
      :data-participant-id="source.id"
    />
  </div>
</template>
