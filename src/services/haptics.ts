import { invoke, isTauri } from '@tauri-apps/api/core';

// Bridge to the haptics command of the OpenMeet native app (openmeet-native/src-tauri/src/haptics.rs).
// Browsers fall back to the Vibration API, which only Android browsers implement.

export type HapticFeedback = 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const VIBRATION_PATTERNS: Record<HapticFeedback, number | number[]> = {
  selection: 8,
  light: 10,
  medium: 15,
  heavy: 25,
  success: [10, 60, 10],
  warning: [20, 80, 20],
  error: [30, 60, 30, 60, 30],
};

/** Fire and forget: missing or failing haptics never affect the action that asked for them. */
export function playHaptic(feedback: HapticFeedback) {
  if (isTauri()) {
    invoke('trigger_haptic', { feedback }).catch((error) => console.error('[Haptics] Failed to play feedback:', error));
    return;
  }
  navigator.vibrate?.(VIBRATION_PATTERNS[feedback]);
}

/**
 * Readies the native haptics hardware before a gesture that plays feedback in quick succession, so
 * its first feedback has no start-up delay. Browsers need no preparation.
 */
export function prepareHaptics() {
  if (!isTauri()) return;
  invoke('prepare_haptics').catch((error) => console.error('[Haptics] Failed to prepare feedback:', error));
}
