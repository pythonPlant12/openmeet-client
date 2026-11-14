import { loadCallSettings, saveCallSettings } from '@/lib/call-settings';

// Where the call is heard, for browsers that can switch outputs with setSinkId. Other people's audio plays from
// media elements across the page, so the chosen output is applied to every media element, including ones that
// appear later. Null means the system default.

let outputId: string | null = loadCallSettings().speakerId;

export function canChooseAudioOutput(): boolean {
  return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
}

export function getAudioOutput(): string | null {
  return outputId;
}

function applyTo(element: HTMLMediaElement) {
  const sinkElement = element as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
  // A saved speaker that is unplugged fails here; the element keeps playing on the system default.
  sinkElement.setSinkId?.(outputId ?? '').catch((error: unknown) => {
    console.warn('[AudioOutput] Failed to switch the speaker:', error);
  });
}

function applyToPage() {
  document.querySelectorAll<HTMLMediaElement>('audio, video').forEach(applyTo);
}

export async function setAudioOutput(id: string | null) {
  outputId = id;
  saveCallSettings({ speakerId: id });
  applyToPage();
}

/** Applies the chosen output to the page's media elements now and as they are added; returns a stop function. */
export function followAudioOutput(): () => void {
  if (!canChooseAudioOutput()) return () => {};
  if (outputId) applyToPage();
  const observer = new MutationObserver((records) => {
    if (!outputId) return;
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node instanceof HTMLMediaElement) applyTo(node);
        node.querySelectorAll<HTMLMediaElement>('audio, video').forEach(applyTo);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
