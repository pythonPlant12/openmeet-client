import { ref } from 'vue';

// Only one active call exists at a time (ADR 0001). Before anything joins a different call, the app asks
// whether to leave the current one. The question is app-wide state: the active call's owner shows it, and
// any entry point (a Join button, a menu item, an incoming call, a room link) awaits the answer.
export const leaveCallPrompt = ref<{ resolve: (leave: boolean) => void } | null>(null);

/** Asks whether to leave the active call for another one; a question already open answers no at once. */
export function askToLeaveActiveCall(): Promise<boolean> {
  if (leaveCallPrompt.value) return Promise.resolve(false);
  return new Promise((resolve) => {
    leaveCallPrompt.value = { resolve };
  });
}

export function answerLeaveCallPrompt(leave: boolean) {
  const prompt = leaveCallPrompt.value;
  leaveCallPrompt.value = null;
  prompt?.resolve(leave);
}
