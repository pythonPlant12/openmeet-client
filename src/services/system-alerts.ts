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

// A slow avatar must not hold back the notification for long; past this, it shows without one.
const AVATAR_TIMEOUT_MS = 2_000;
const APP_ICON = '/favicon.svg';

export interface SystemAlertsOptions {
  translate: (key: string, values?: Record<string, string>) => string;
  /** The conversation is open in the dashboard, so the user already sees its messages. */
  isConversationOnScreen: (conversationId: string) => boolean;
  /** Responses stay queued in the native app until the client can act on them (signed in). */
  canHandleActions: () => boolean;
  onAction: (action: NotificationAction) => void;
  /** Fetches an avatar thumbnail; avatars need the user's access token. */
  loadAvatar: (path: string) => Promise<Blob>;
}

interface RingingCall {
  callKind: AlertCallKind;
  alertedAt: number;
  webNotification: Notification | null;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
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
  private generation = 0;

  constructor(private readonly options: SystemAlertsOptions) {}

  async start() {
    if (!this.native || this.nativeSession) return;
    try {
      this.nativeSession = await startNativeNotifications(
        this.actionLabels(),
        () => void this.drainActions(),
        (callId) => {
          if (this.calls.has(callId)) this.ringtone.start();
        },
      );
    } catch (error) {
      console.error('[SystemAlerts] Native notifications are unavailable:', error);
    }
  }

  stop() {
    this.generation += 1;
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
    const generation = this.generation;

    if (this.nativeSession) {
      void this.avatarBytes(alert.avatarUrl)
        .then((avatar) => {
          if (generation !== this.generation || !this.nativeSession) return;
          return showNativeMessageNotification({
            conversationId: alert.conversationId,
            sequence: alert.sequence,
            title,
            body,
            avatar,
          });
        })
        .catch((error) => console.error('[SystemAlerts] Failed to show message notification:', error));
      return;
    }
    // In a browser, the open tab already shows new messages.
    if (document.visibilityState === 'visible') return;
    void this.avatarIcon(alert.avatarUrl).then((icon) => {
      if (generation !== this.generation || isAppInFront()) return;
      showSystemNotification(title, { body, icon, tag: `openmeet-message-${alert.conversationId}` }, () =>
        this.options.onAction({ action: 'openConversation', conversationId: alert.conversationId }),
      );
    });
  }

  private showCall(alert: CallAlert) {
    if (this.calls.has(alert.callId)) return;
    const { translate } = this.options;
    const title = alert.conversationTitle ?? alert.callerName;
    const body = alert.conversationTitle
      ? translate('notifications.groupCallBody', { name: alert.callerName })
      : translate('notifications.callBody');
    const call: RingingCall = { callKind: alert.callKind, alertedAt: Date.now(), webNotification: null };
    this.calls.set(alert.callId, call);
    const generation = this.generation;

    // In front, the app rings in its own incoming call bar.
    const notify = !isAppInFront();
    const nativeSession = this.nativeSession;
    if (nativeSession && (!notify || !nativeSession.ringsNatively)) this.ringtone.start();
    if (!notify) return;
    // The call can stop ringing while its avatar loads; it is then not shown at all.
    const isRinging = () => this.calls.get(alert.callId) === call;
    if (nativeSession) {
      void this.avatarBytes(alert.avatarUrl)
        .then((avatar) => {
          if (generation !== this.generation || !this.nativeSession || !isRinging()) return;
          return showNativeCallNotification({ callId: alert.callId, callKind: alert.callKind, title, body, avatar });
        })
        .catch((error) => console.error('[SystemAlerts] Failed to show call notification:', error));
      return;
    }
    void this.avatarIcon(alert.avatarUrl).then((icon) => {
      if (generation !== this.generation || !isRinging()) return;
      call.webNotification = showSystemNotification(
        title,
        { body, icon, tag: `openmeet-call-${alert.callId}`, requireInteraction: true },
        // Web notifications have no buttons: a click on a conversation call answers it, as before.
        () =>
          this.options.onAction({
            action: alert.callKind === 'session' ? 'answerCall' : 'openCall',
            callId: alert.callId,
            callKind: alert.callKind,
          }),
      );
    });
  }

  /** Native notifications take the avatar's bytes. Null when there is none, or it fails or takes too long. */
  private async avatarBytes(path: string | null) {
    const avatar = await this.loadAvatar(path);
    return avatar && [...new Uint8Array(await avatar.arrayBuffer())];
  }

  /** Web Notifications take an icon URL; the avatar is inlined because it needs the access token. */
  private async avatarIcon(path: string | null) {
    const avatar = await this.loadAvatar(path);
    return avatar ? blobToDataUrl(avatar).catch(() => APP_ICON) : APP_ICON;
  }

  private async loadAvatar(path: string | null): Promise<Blob | null> {
    if (!path) return null;
    let timer: number | undefined;
    const timeout = new Promise<null>((resolve) => (timer = window.setTimeout(() => resolve(null), AVATAR_TIMEOUT_MS)));
    try {
      return await Promise.race([this.options.loadAvatar(path), timeout]);
    } catch (error) {
      console.error('[SystemAlerts] Failed to load notification avatar:', error);
      return null;
    } finally {
      window.clearTimeout(timer);
    }
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
