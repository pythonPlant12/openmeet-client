import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as nativeNotifications from '@/services/native-notifications';
import { Ringtone } from '@/services/ringtone';
import type { SocialAlert } from '@/services/social-events';
import { SystemAlerts } from '@/services/system-alerts';

vi.mock('@/services/native-notifications', () => ({
  hasNativeNotifications: vi.fn(() => false),
  startNativeNotifications: vi.fn(() => Promise.resolve({ ringsNatively: false, stop: vi.fn() })),
  showNativeMessageNotification: vi.fn(() => Promise.resolve()),
  showNativeCallNotification: vi.fn(() => Promise.resolve()),
  dismissNativeCallNotification: vi.fn(() => Promise.resolve()),
  takeNativeNotificationActions: vi.fn(() => Promise.resolve([])),
}));

const messageAlert: SocialAlert = {
  kind: 'message',
  conversationId: 'conversation-1',
  sequence: 4,
  senderId: 'user-1',
  senderName: 'Maya',
  conversationTitle: null,
  avatarUrl: null,
  preview: 'Hello',
  hasAttachments: false,
};

const callAlert: SocialAlert = {
  kind: 'incomingCall',
  callId: 'call-1',
  callKind: 'session',
  callerName: 'Maya',
  conversationId: 'conversation-1',
  conversationTitle: 'Team',
  avatarUrl: null,
  expiresAt: '2026-10-10T12:00:00Z',
};

const avatarBytes = new Uint8Array([137, 80, 78, 71]);
// The test DOM's Blob lacks arrayBuffer(), which WebKit and WebView2 provide.
const avatarBlob = Object.assign(new Blob([avatarBytes], { type: 'image/png' }), {
  arrayBuffer: () => Promise.resolve(avatarBytes.buffer),
});

function createAlerts(onScreen = false, loadAvatar = vi.fn(() => Promise.resolve(avatarBlob))) {
  const onAction = vi.fn();
  const alerts = new SystemAlerts({
    translate: (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key),
    isConversationOnScreen: () => onScreen,
    canHandleActions: () => true,
    onAction,
    loadAvatar,
  });
  return { alerts, onAction, loadAvatar };
}

describe('SystemAlerts in a browser', () => {
  let instances: {
    title: string;
    options: NotificationOptions;
    close: ReturnType<typeof vi.fn>;
    onclick: (() => void) | null;
  }[];

  beforeEach(() => {
    instances = [];
    const NotificationMock = vi.fn(function (this: unknown, title: string, options: NotificationOptions) {
      const instance = { title, options, close: vi.fn(), onclick: null };
      instances.push(instance);
      return instance;
    });
    Object.defineProperty(NotificationMock, 'permission', { value: 'granted' });
    vi.stubGlobal('Notification', NotificationMock);
    vi.spyOn(window, 'focus').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function setVisibility(state: DocumentVisibilityState, focused: boolean) {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
    vi.spyOn(document, 'hasFocus').mockReturnValue(focused);
  }

  it('notifies about messages only while the tab is hidden', async () => {
    const { alerts, onAction } = createAlerts();

    setVisibility('visible', true);
    alerts.show(messageAlert);
    expect(instances).toHaveLength(0);

    setVisibility('hidden', false);
    alerts.show(messageAlert);
    await vi.waitFor(() => expect(instances).toHaveLength(1));
    expect(instances[0]!.title).toBe('Maya');
    expect(instances[0]!.options.icon).toBe('/favicon.svg');
    expect(instances[0]!.options.body).toBe('Hello');

    instances[0]!.onclick?.();
    expect(onAction).toHaveBeenCalledWith({ action: 'openConversation', conversationId: 'conversation-1' });
  });

  it('skips messages for the conversation on screen', () => {
    setVisibility('visible', true);
    const { alerts } = createAlerts(true);

    alerts.show(messageAlert);

    expect(instances).toHaveLength(0);
  });

  it('names the sender and group for group messages and describes attachments', async () => {
    setVisibility('hidden', false);
    const { alerts } = createAlerts();

    alerts.show({ ...messageAlert, conversationTitle: 'Team', preview: '', hasAttachments: true });
    await vi.waitFor(() => expect(instances).toHaveLength(1));

    expect(instances[0]!.title).toBe('Team');
    expect(instances[0]!.options.body).toBe('Maya: notifications.attachmentBody');
  });

  it('shows the avatar as the notification icon', async () => {
    setVisibility('hidden', false);
    const { alerts, loadAvatar } = createAlerts();

    alerts.show({ ...messageAlert, avatarUrl: '/social/users/user-1/avatar?v=1' });

    await vi.waitFor(() => expect(instances).toHaveLength(1));
    expect(loadAvatar).toHaveBeenCalledWith('/social/users/user-1/avatar?v=1');
    expect(instances[0]!.options.icon).toMatch(/^data:image\/png;base64,/);
  });

  it('does not notify after the app returns to the foreground while its avatar loads', async () => {
    setVisibility('hidden', false);
    let resolveAvatar: (blob: Blob) => void = () => undefined;
    const { alerts } = createAlerts(
      false,
      vi.fn(() => new Promise<Blob>((resolve) => (resolveAvatar = resolve))),
    );

    alerts.show({ ...messageAlert, avatarUrl: '/social/users/user-1/avatar?v=1' });
    setVisibility('visible', true);
    resolveAvatar(avatarBlob);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(instances).toHaveLength(0);
  });

  it('does not notify after alerts stop while an avatar loads', async () => {
    setVisibility('hidden', false);
    let resolveAvatar: (blob: Blob) => void = () => undefined;
    const { alerts } = createAlerts(
      false,
      vi.fn(() => new Promise<Blob>((resolve) => (resolveAvatar = resolve))),
    );

    alerts.show({ ...messageAlert, avatarUrl: '/social/users/user-1/avatar?v=1' });
    alerts.stop();
    resolveAvatar(avatarBlob);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(instances).toHaveLength(0);
  });

  it('falls back to the app icon when the avatar fails to load', async () => {
    setVisibility('hidden', false);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { alerts } = createAlerts(
      false,
      vi.fn(() => Promise.reject(new Error('offline'))),
    );

    alerts.show({ ...messageAlert, avatarUrl: '/social/users/user-1/avatar?v=1' });

    await vi.waitFor(() => expect(instances).toHaveLength(1));
    expect(instances[0]!.options.icon).toBe('/favicon.svg');
  });

  it('titles call notifications with the caller or group', async () => {
    setVisibility('hidden', false);
    const { alerts } = createAlerts();

    alerts.show(callAlert);
    alerts.show({ ...callAlert, callId: 'call-2', conversationId: null, conversationTitle: null });

    await vi.waitFor(() => expect(instances).toHaveLength(2));
    expect(instances[0]!.title).toBe('Team');
    expect(instances[0]!.options.body).toBe('notifications.groupCallBody:{"name":"Maya"}');
    expect(instances[1]!.title).toBe('Maya');
    expect(instances[1]!.options.body).toBe('notifications.callBody');
  });

  it('does not show a call that stopped ringing while its avatar loaded', async () => {
    setVisibility('hidden', false);
    let resolveAvatar: (blob: Blob) => void = () => undefined;
    const { alerts } = createAlerts(
      false,
      vi.fn(() => new Promise<Blob>((resolve) => (resolveAvatar = resolve))),
    );

    alerts.show({ ...callAlert, avatarUrl: '/social/conversations/groups/g/avatar?v=1' });
    alerts.dismissCall(callAlert.callId);
    resolveAvatar(avatarBlob);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(instances).toHaveLength(0);
  });

  it('closes a call notification once the call stops ringing', async () => {
    setVisibility('hidden', false);
    const { alerts } = createAlerts();
    const pollStartedAt = Date.now() - 1_000;

    alerts.show(callAlert);
    alerts.show(callAlert);
    await vi.waitFor(() => expect(instances).toHaveLength(1));

    // A poll that started before the alert may not include the call yet.
    alerts.retainCalls(new Set(), pollStartedAt);
    expect(instances[0]!.close).not.toHaveBeenCalled();

    alerts.retainCalls(new Set(), Date.now() + 1);
    expect(instances[0]!.close).toHaveBeenCalledOnce();
  });
});

describe('SystemAlerts in the native app', () => {
  beforeEach(() => {
    vi.mocked(nativeNotifications.hasNativeNotifications).mockReturnValue(true);
    vi.mocked(nativeNotifications.startNativeNotifications).mockReset();
    vi.mocked(nativeNotifications.startNativeNotifications).mockResolvedValue({ ringsNatively: true, stop: vi.fn() });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
  });

  afterEach(() => {
    vi.mocked(nativeNotifications.hasNativeNotifications).mockReturnValue(false);
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('passes avatar bytes with message and call notifications', async () => {
    const { alerts } = createAlerts();
    await alerts.start();

    alerts.show({ ...messageAlert, avatarUrl: '/social/users/user-1/avatar?v=1' });
    alerts.show({ ...callAlert, avatarUrl: null });

    await vi.waitFor(() => expect(nativeNotifications.showNativeCallNotification).toHaveBeenCalled());
    await vi.waitFor(() => expect(nativeNotifications.showNativeMessageNotification).toHaveBeenCalled());
    expect(nativeNotifications.showNativeMessageNotification).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      sequence: 4,
      title: 'Maya',
      body: 'Hello',
      avatar: [137, 80, 78, 71],
    });
    expect(nativeNotifications.showNativeCallNotification).toHaveBeenCalledWith({
      callId: 'call-1',
      callKind: 'session',
      title: 'Team',
      body: 'notifications.groupCallBody:{"name":"Maya"}',
      avatar: null,
    });
    alerts.stop();
  });

  it('rings an active iOS call when its notification falls back', async () => {
    let onCallFallback: ((callId: string) => void) | undefined;
    vi.mocked(nativeNotifications.startNativeNotifications).mockImplementation(
      (_labels, _onActionsQueued, onFallback) => {
        onCallFallback = onFallback;
        return Promise.resolve({ ringsNatively: true, stop: vi.fn() });
      },
    );
    const ringtoneStart = vi.spyOn(Ringtone.prototype, 'start').mockImplementation(() => undefined);
    const { alerts } = createAlerts();
    await alerts.start();
    alerts.show(callAlert);

    onCallFallback?.(callAlert.callId);
    expect(ringtoneStart).toHaveBeenCalledOnce();

    alerts.dismissCall(callAlert.callId);
    onCallFallback?.(callAlert.callId);
    expect(ringtoneStart).toHaveBeenCalledOnce();
    alerts.stop();
  });
});
