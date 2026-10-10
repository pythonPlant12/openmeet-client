import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SocialAlert } from '@/services/social-events';
import { SystemAlerts } from '@/services/system-alerts';

const messageAlert: SocialAlert = {
  kind: 'message',
  conversationId: 'conversation-1',
  sequence: 4,
  senderId: 'user-1',
  senderName: 'Maya',
  conversationTitle: null,
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
  expiresAt: '2026-10-10T12:00:00Z',
};

function createAlerts(onScreen = false) {
  const onAction = vi.fn();
  const alerts = new SystemAlerts({
    translate: (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key),
    isConversationOnScreen: () => onScreen,
    canHandleActions: () => true,
    onAction,
  });
  return { alerts, onAction };
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

  it('notifies about messages only while the tab is hidden', () => {
    const { alerts, onAction } = createAlerts();

    setVisibility('visible', true);
    alerts.show(messageAlert);
    expect(instances).toHaveLength(0);

    setVisibility('hidden', false);
    alerts.show(messageAlert);
    expect(instances).toHaveLength(1);
    expect(instances[0]!.title).toBe('Maya');
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

  it('names the sender and group for group messages and describes attachments', () => {
    setVisibility('hidden', false);
    const { alerts } = createAlerts();

    alerts.show({ ...messageAlert, conversationTitle: 'Team', preview: '', hasAttachments: true });

    expect(instances[0]!.title).toBe('Team');
    expect(instances[0]!.options.body).toBe('Maya: notifications.attachmentBody');
  });

  it('closes a call notification once the call stops ringing', () => {
    setVisibility('hidden', false);
    const { alerts } = createAlerts();
    const pollStartedAt = Date.now() - 1_000;

    alerts.show(callAlert);
    alerts.show(callAlert);
    expect(instances).toHaveLength(1);

    // A poll that started before the alert may not include the call yet.
    alerts.retainCalls(new Set(), pollStartedAt);
    expect(instances[0]!.close).not.toHaveBeenCalled();

    alerts.retainCalls(new Set(), Date.now() + 1);
    expect(instances[0]!.close).toHaveBeenCalledOnce();
  });
});
