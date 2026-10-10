import { type PluginListener, addPluginListener, invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

import type { AlertCallKind } from '@/services/social-events';

// Bridge to the notification commands of the OpenMeet native app (openmeet-native/src-tauri/src/notifications).

export interface NotificationActionLabels {
  reply: string;
  replyPlaceholder: string;
  send: string;
  answer: string;
  decline: string;
}

/** What the user did with a notification. Web notifications report clicks in the same shape. */
export type NotificationAction =
  | { action: 'openConversation'; conversationId: string }
  | { action: 'reply'; conversationId: string; text: string }
  | { action: 'openCall' | 'answerCall' | 'declineCall'; callId: string; callKind: AlertCallKind };

export interface NativeMessageNotification {
  conversationId: string;
  sequence: number;
  title: string;
  body: string;
}

export interface NativeCallNotification {
  callId: string;
  callKind: AlertCallKind;
  title: string;
  body: string;
}

export interface NativeNotifications {
  /** The call notification rings by itself, so the client does not play a ringtone. */
  ringsNatively: boolean;
  stop: () => void;
}

interface AndroidActionEvent {
  actionId?: string | null;
  inputValue?: string | null;
  notification?: { extra?: Record<string, unknown> } | null;
}

/**
 * Only the main window notifies. Meetings opened from a call get their own window, which runs
 * its own copy of the client and would repeat every alert.
 */
export function hasNativeNotifications() {
  if (!isTauri()) return false;
  try {
    return getCurrentWindow().label === 'main';
  } catch {
    return false;
  }
}

/** `onActionsQueued` runs when responses wait in `takeNativeNotificationActions`. */
export async function startNativeNotifications(
  labels: NotificationActionLabels,
  onActionsQueued: () => void,
): Promise<NativeNotifications> {
  const { ringsNatively } = await invoke<{ ringsNatively: boolean }>('configure_notifications', {
    actionLabels: labels,
  });
  const unlisten = await listen('notification-action', onActionsQueued);
  let androidListener: PluginListener | undefined;
  // The Android notification plugin reports responses to the webview only.
  if (/android/i.test(navigator.userAgent)) {
    androidListener = await addPluginListener<AndroidActionEvent>('notification', 'actionPerformed', (event) => {
      const identifier = event.notification?.extra?.identifier;
      if (typeof identifier !== 'string') return;
      invoke('report_notification_response', {
        identifier,
        actionId: event.actionId ?? null,
        inputValue: event.inputValue ?? null,
      }).catch((error) => console.error('[NativeNotifications] Failed to report response:', error));
    });
  }
  return {
    ringsNatively,
    stop() {
      unlisten();
      void androidListener?.unregister();
    },
  };
}

export function takeNativeNotificationActions() {
  return invoke<NotificationAction[]>('take_notification_actions');
}

export function showNativeMessageNotification(notification: NativeMessageNotification) {
  return invoke<void>('show_message_notification', { notification });
}

export function showNativeCallNotification(notification: NativeCallNotification) {
  return invoke<void>('show_call_notification', { notification });
}

export function dismissNativeCallNotification(callId: string, callKind: AlertCallKind) {
  return invoke<void>('dismiss_call_notification', { callId, callKind });
}
