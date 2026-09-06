export type SystemNotificationPermission = NotificationPermission | 'unsupported';

export function getSystemNotificationPermission(): SystemNotificationPermission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export async function requestSystemNotificationPermission(): Promise<SystemNotificationPermission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.requestPermission();
}

export function showSystemNotification(
  title: string,
  options: NotificationOptions,
  onClick?: () => void,
): Notification | null {
  if (getSystemNotificationPermission() !== 'granted') return null;

  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      onClick?.();
      notification.close();
    };
    return notification;
  } catch (error) {
    console.error('[Notifications] Failed to show system notification:', error);
    return null;
  }
}
