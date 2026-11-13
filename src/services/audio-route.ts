import { invoke, isTauri } from '@tauri-apps/api/core';

import { canChooseAudioOutput } from '@/services/audio-output';

// Where the call is heard, chosen with the platform's own control: the native app's audio route commands
// (openmeet-native/src-tauri/src/audio_route.rs) open the iOS route picker or list Android's outputs, and
// browsers that can switch outputs use setSinkId (see audio-output.ts).

/** `picker`: the system picker (iOS). `list`: outputs the app lists itself (Android). `browser`: setSinkId. */
export type AudioRouteMode = 'picker' | 'list' | 'browser';

export interface AudioRoute {
  id: string;
  name: string;
  selected: boolean;
}

/** How this platform switches the audio output; null where it cannot, so no control shows. */
export async function getAudioRouteMode(): Promise<AudioRouteMode | null> {
  if (isTauri()) {
    const native = await invoke<'picker' | 'list' | 'none'>('audio_route_mode').catch(() => 'none' as const);
    if (native !== 'none') return native;
  }
  return canChooseAudioOutput() ? 'browser' : null;
}

export async function showSystemAudioRoutePicker() {
  try {
    await invoke('show_audio_route_picker');
  } catch (error) {
    console.error('[AudioRoute] Failed to open the route picker:', error);
  }
}

export async function listAudioRoutes(): Promise<AudioRoute[]> {
  try {
    return await invoke<AudioRoute[]>('list_audio_routes');
  } catch (error) {
    console.error('[AudioRoute] Failed to list the outputs:', error);
    return [];
  }
}

export async function setAudioRoute(id: string) {
  try {
    await invoke('set_audio_route', { id });
  } catch (error) {
    console.error('[AudioRoute] Failed to switch the output:', error);
  }
}
