import { invoke, isTauri } from '@tauri-apps/api/core';

// Bridge to the native app's command that opens OpenMeet's page in the system settings, where a permanently
// refused microphone or camera permission can be allowed again. Browsers have no way to open their settings.

export const canOpenSystemSettings = () => isTauri();

export async function openSystemSettings() {
  try {
    await invoke('open_app_settings');
  } catch (error) {
    console.error('[SystemSettings] Failed to open the system settings:', error);
  }
}
