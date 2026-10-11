import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';

import { claimVoicePlayback, releaseVoicePlayback } from '@/components/dashboard-page/chat/voice-message';

/**
 * Plays one voice message. `durationMs` comes from the recorder or from decoding the file, because
 * MediaRecorder WebM files report an infinite `audio.duration`.
 */
export function useVoicePlayback(url: Ref<string | undefined>, durationMs: Ref<number>) {
  const playing = ref(false);
  const positionMs = ref(0);
  let audio: HTMLAudioElement | null = null;
  let frame: number | undefined;

  const progress = computed(() => (durationMs.value > 0 ? Math.min(1, positionMs.value / durationMs.value) : 0));

  function element() {
    if (audio || !url.value) return audio;
    const player = new Audio(url.value);
    player.preload = 'auto';
    player.addEventListener('play', () => {
      playing.value = true;
      claimVoicePlayback(player);
      stopFollowing();
      follow();
    });
    player.addEventListener('pause', () => {
      playing.value = false;
      stopFollowing();
    });
    player.addEventListener('ended', () => {
      playing.value = false;
      positionMs.value = 0;
      stopFollowing();
    });
    audio = player;
    return player;
  }

  // timeupdate fires only a few times a second; frames keep the played bars moving smoothly.
  function follow() {
    if (!audio) return;
    positionMs.value = Math.min(durationMs.value || Infinity, audio.currentTime * 1000);
    frame = requestAnimationFrame(follow);
  }

  function stopFollowing() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  }

  async function toggle() {
    const player = element();
    if (!player) return;
    if (!player.paused) {
      player.pause();
      return;
    }
    if (durationMs.value > 0 && positionMs.value >= durationMs.value) positionMs.value = 0;
    player.currentTime = positionMs.value / 1000;
    try {
      await player.play();
    } catch (error) {
      console.error('[useVoicePlayback] Failed to play voice message:', error);
      playing.value = false;
    }
  }

  function seek(fraction: number) {
    positionMs.value = Math.min(1, Math.max(0, fraction)) * durationMs.value;
    const player = element();
    if (player) player.currentTime = positionMs.value / 1000;
  }

  function reset() {
    stopFollowing();
    if (audio) {
      audio.pause();
      releaseVoicePlayback(audio);
      audio.removeAttribute('src');
      audio.load();
    }
    audio = null;
    playing.value = false;
    positionMs.value = 0;
  }

  watch(url, reset);
  onBeforeUnmount(reset);

  return { playing, positionMs, progress, toggle, seek, reset };
}
