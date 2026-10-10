import {
  type NativeNotifications,
  type NotificationAction,
  type NotificationActionLabels,
  dismissNativeCallNotification,
  hasNativeNotifications,
  showNativeCallNotification,
  showNativeMessageNotification,
  startNativeNotifications,
  takeNativeNotificationActions,
} from '@/services/native-notifications';
import { showSystemNotification } from '@/services/notifications';
import { Ringtone } from '@/services/ringtone';
import type { AlertCallKind, SocialAlert } from '@/services/social-events';

type MessageAlert = Extract<SocialAlert, { kind: 'message' }>;
type CallAlert = Extract<SocialAlert, { kind: 'incomingCall' }>;

export interface SystemAlertsOptions {
  translate: (key: string, values?: Record<string, string>) => string;
  /** The conversation is open in the dashboard, so the user already sees its messages. */
  isConversationOnScreen: (conversationId: string) => boolean;
  /** Responses stay queued in the native app until the client can act on them (signed in). */
  canHandleActions: () => boolean;
  onAction: (action: NotificationAction) => void;
}

interface RingingCall {
  callKind: AlertCallKind;
  alertedAt: number;
  webNotification: Notification | null;
}

function isAppInFront() {
  return document.visibilityState === 'visible' && document.hasFocus();
}

/**
 * Turns server alerts into OS notifications: native ones in the OpenMeet app (with inline reply
 * and Answer/Decline), Web Notifications in a browser. The server sends alerts only while the
 * user's status is Online, so this layer does not check the status again.
 */
export class SystemAlerts {
  private readonly native = hasNativeNotifications();
  private nativeSession: NativeNotifications | null = null;
  private readonly calls = new Map<string, RingingCall>();
  private readonly ringtone = new Ringtone();
  private draining = false;

  constructor(private readonly options: SystemAlertsOptions) {}

  async start() {
    if (!this.native || this.nativeSession) return;
    try {
      this.nativeSession = await startNativeNotifications(this.actionLabels(), () => void this.drainActions());
    } catch (error) {
      console.error('[SystemAlerts] Native notifications are unavailable:', error);
    }
  }

  stop() {
    this.dismissAllCalls();
    this.nativeSession?.stop();
    this.nativeSession = null;
  }

  show(alert: SocialAlert) {
    if (alert.kind === 'message') this.showMessage(alert);
    else this.showCall(alert);
  }

  dismissCall(callId: string) {
    const call = this.calls.get(callId);
    if (!call) return;
    this.calls.delete(callId);
    call.webNotification?.close();
    if (this.nativeSession) {
      dismissNativeCallNotification(callId, call.callKind).catch((error) =>
        console.error('[SystemAlerts] Failed to dismiss call notification:', error),
      );
    }
    if (!this.calls.size) this.ringtone.stop();
  }

  /**
   * Dismisses calls that no longer ring according to a poll of incoming calls. A poll that started
   * before an alert arrived may not include that call yet, so such calls are kept.
   */
  retainCalls(ringingCallIds: ReadonlySet<string>, pollStartedAt: number) {
    for (const [callId, call] of this.calls) {
      if (!ringingCallIds.has(callId) && call.alertedAt < pollStartedAt) this.dismissCall(callId);
    }
  }

  dismissAllCalls() {
    [...this.calls.keys()].forEach((callId) => this.dismissCall(callId));
  }

  /** Delivers responses the native app queued, including ones made while the webview was suspended. */
  async drainActions() {
    if (!this.nativeSession || this.draining || !this.options.canHandleActions()) return;
    this.draining = true;
    try {
      const actions = await takeNativeNotificationActions();
      actions.forEach((action) => this.options.onAction(action));
    } catch (error) {
      console.error('[SystemAlerts] Failed to read notification responses:', error);
    } finally {
      this.draining = false;
    }
  }

  private showMessage(alert: MessageAlert) {
    if (isAppInFront() && this.options.isConversationOnScreen(alert.conversationId)) return;
    const { translate } = this.options;
    const text = alert.preview || (alert.hasAttachments ? translate('notifications.attachmentBody') : '');
    const title = alert.conversationTitle ?? alert.senderName;
    const body = alert.conversationTitle ? `${alert.senderName}: ${text}` : text;

    if (this.nativeSession) {
      showNativeMessageNotification({
        conversationId: alert.conversationId,
        sequence: alert.sequence,
        title,
        body,
      }).catch((error) => console.error('[SystemAlerts] Failed to show message notification:', error));
      return;
    }
    // In a browser, the open tab already shows new messages.
    if (document.visibilityState === 'visible') return;
    showSystemNotification(title, { body, icon: '/favicon.svg', tag: `openmeet-message-${alert.conversationId}` }, () =>
      this.options.onAction({ action: 'openConversation', conversationId: alert.conversationId }),
    );
  }

  private showCall(alert: CallAlert) {
    if (this.calls.has(alert.callId)) return;
    const { translate } = this.options;
    const title = translate('notifications.incomingCallTitle');
    const body = alert.conversationTitle
      ? translate('notifications.incomingGroupCallBody', { name: alert.callerName, group: alert.conversationTitle })
      : translate('dashboard.isCalling', { name: alert.callerName });
    const call: RingingCall = { callKind: alert.callKind, alertedAt: Date.now(), webNotification: null };
    this.calls.set(alert.callId, call);

    // In front, the app rings in its own UI (the dashboard Calls header or a toast).
    const notify = !isAppInFront();
    if (this.nativeSession) {
      if (notify) {
        showNativeCallNotification({ callId: alert.callId, callKind: alert.callKind, title, body }).catch((error) =>
          console.error('[SystemAlerts] Failed to show call notification:', error),
        );
      }
      if (!notify || !this.nativeSession.ringsNatively) this.ringtone.start();
      return;
    }
    if (!notify) return;
    call.webNotification = showSystemNotification(
      title,
      { body, icon: '/favicon.svg', tag: `openmeet-call-${alert.callId}`, requireInteraction: true },
      // Web notifications have no buttons: a click on a conversation call answers it, as before.
      () =>
        this.options.onAction({
          action: alert.callKind === 'session' ? 'answerCall' : 'openCall',
          callId: alert.callId,
          callKind: alert.callKind,
        }),
    );
  }

  private actionLabels(): NotificationActionLabels {
    const { translate } = this.options;
    return {
      reply: translate('notifications.reply'),
      replyPlaceholder: translate('notifications.replyPlaceholder'),
      send: translate('notifications.send'),
      answer: translate('dashboard.answer'),
      decline: translate('dashboard.decline'),
    };
  }
}
