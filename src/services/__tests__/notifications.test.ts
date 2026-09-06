import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getSystemNotificationPermission,
  requestSystemNotificationPermission,
  showSystemNotification,
} from '@/services/notifications';

describe('system notifications', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports unsupported browsers without requesting permission', async () => {
    vi.stubGlobal('Notification', undefined);

    expect(getSystemNotificationPermission()).toBe('unsupported');
    await expect(requestSystemNotificationPermission()).resolves.toBe('unsupported');
  });

  it('creates a notification only after permission is granted', () => {
    const close = vi.fn();
    const notification = { close, onclick: null as (() => void) | null };
    const NotificationMock = vi.fn(() => notification);
    Object.defineProperty(NotificationMock, 'permission', { value: 'granted' });
    vi.stubGlobal('Notification', NotificationMock);
    vi.spyOn(window, 'focus').mockImplementation(() => undefined);
    const onClick = vi.fn();

    expect(showSystemNotification('Incoming call', { body: 'Maya is calling' }, onClick)).toBe(notification);
    notification.onclick?.();

    expect(NotificationMock).toHaveBeenCalledWith('Incoming call', { body: 'Maya is calling' });
    expect(onClick).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not create notifications when permission is not granted', () => {
    const NotificationMock = vi.fn();
    Object.defineProperty(NotificationMock, 'permission', { value: 'default' });
    vi.stubGlobal('Notification', NotificationMock);

    expect(showSystemNotification('Incoming call', { body: 'Open OpenMeet' })).toBeNull();
    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it('does not interrupt application state when notification construction fails', () => {
    const NotificationMock = vi.fn(() => {
      throw new Error('Notifications unavailable');
    });
    Object.defineProperty(NotificationMock, 'permission', { value: 'granted' });
    vi.stubGlobal('Notification', NotificationMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(showSystemNotification('Incoming call', { body: 'Open OpenMeet' })).toBeNull();
  });
});
