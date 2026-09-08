<script setup lang="ts">
import { useMachine } from '@xstate/vue';
import { onMounted, onUnmounted, provide, watch } from 'vue';
import { RouterView, useRouter } from 'vue-router';

import TheNavbar from '@/components/layout/TheNavbar.vue';
import { Toaster } from '@/components/ui/toast';
import { dismissToast, toast } from '@/components/ui/toast/store';
import { i18n } from '@/i18n';
import { showSystemNotification } from '@/services/notifications';
import {
  type CallInvitation,
  type CallSessionNotification,
  type UserNotification,
  socialApi,
} from '@/services/social-api';
import { type SocialEventResource, socialEventsService } from '@/services/social-events';

import { cookieUtils } from './utils';
import { authMachine } from './xstate/machines/auth';
import { AuthEventType } from './xstate/machines/auth/types';
import { webrtcMachine } from './xstate/machines/webrtc';

const router = useRouter();

const authActor = useMachine(authMachine, {
  input: {
    initialAccessToken: cookieUtils.get('accessToken'),
    initialRefreshToken: cookieUtils.get('refreshToken'),
    router,
  },
});

const webrtcActor = useMachine(webrtcMachine);

provide('authActor', authActor);
provide('webrtcActor', webrtcActor);

const handleSessionExpired = () => authActor.send({ type: AuthEventType.LOGOUT });
const knownIncomingCallIds = new Set<string>();
const knownIncomingCallSessionIds = new Set<string>();
const knownNotificationIds = new Set<string>();
const incomingCallNotifications = new Map<string, Notification>();
const incomingCallToasts = new Map<string, number | string>();
const incomingCallExpiryTimers = new Map<string, number>();
let presenceTimer: ReturnType<typeof setInterval> | undefined;
let pollingGeneration = 0;
let incomingCallInFlightGeneration: number | null = null;
let notificationInFlightGeneration: number | null = null;
let incomingCallRefreshPending = false;
let notificationRefreshPending = false;
let incomingCallRetryTimer: number | undefined;
let incomingCallRetryAttempts = 0;

function resolveIncomingCall(callId: string) {
  window.dispatchEvent(new CustomEvent<string>('openmeet:incoming-call-resolved', { detail: callId }));
}

async function acceptCall(call: CallInvitation) {
  const token = authActor.snapshot.value.context.accessToken;
  if (!token) return;

  try {
    const acceptedCall = await socialApi.respondToCall(token, call.id, true);
    resolveIncomingCall(call.id);
    await router.push(`/room/${acceptedCall.roomId}`);
  } catch (error) {
    console.error('[App] Failed to accept incoming call:', error);
    toast({ title: 'Could not join call', description: 'Call may no longer be available.', variant: 'destructive' });
  }
}

async function declineCall(callId: string) {
  const token = authActor.snapshot.value.context.accessToken;
  if (!token) return;

  try {
    await socialApi.respondToCall(token, callId, false);
    resolveIncomingCall(callId);
  } catch (error) {
    console.error('[App] Failed to decline incoming call:', error);
  }
}

async function acceptCallSession(call: CallSessionNotification) {
  const token = authActor.snapshot.value.context.accessToken;
  if (!token) return;

  try {
    const response = await socialApi.respondToCallSession(token, call.id, true);
    if (!response.accepted || !response.roomId) throw new Error('Call session was not accepted');
    resolveIncomingCall(call.id);
    await router.push({ path: `/room/${call.id}`, query: { conversation: call.conversationId } });
  } catch (error) {
    try {
      const existing = await socialApi.getCallSession(token, call.id);
      if (existing.roomId) {
        resolveIncomingCall(call.id);
        await router.push({ path: `/room/${call.id}`, query: { conversation: call.conversationId } });
        return;
      }
    } catch {
      // Original response may have been lost after server committed acceptance.
    }
    console.error('[App] Failed to accept conversation call:', error);
    toast({ title: 'Could not join call', description: 'Call may no longer be available.', variant: 'destructive' });
    void pollIncomingCalls();
  }
}

async function declineCallSession(callId: string) {
  const token = authActor.snapshot.value.context.accessToken;
  if (!token) return;

  try {
    await socialApi.respondToCallSession(token, callId, false);
    resolveIncomingCall(callId);
  } catch (error) {
    console.error('[App] Failed to decline conversation call:', error);
  }
}

function showIncomingCall(call: CallInvitation) {
  const description = call.caller
    ? i18n.global.t('dashboard.isCalling', { name: call.caller.name })
    : i18n.global.t('notifications.incomingCallBody');
  const toastId = toast({
    title: i18n.global.t('notifications.incomingCallTitle'),
    description,
    duration: Number.POSITIVE_INFINITY,
    action: { label: i18n.global.t('dashboard.answer'), onClick: () => void acceptCall(call) },
    cancel: { label: i18n.global.t('dashboard.decline'), onClick: () => void declineCall(call.id) },
  });
  incomingCallToasts.set(call.id, toastId);
  scheduleCallExpiry(call.id, call.expiresAt);
}

function showIncomingCallSession(call: CallSessionNotification) {
  const toastId = toast({
    title: i18n.global.t('notifications.incomingCallTitle'),
    description: i18n.global.t('notifications.incomingCallBody'),
    duration: Number.POSITIVE_INFINITY,
    action: { label: i18n.global.t('dashboard.answer'), onClick: () => void acceptCallSession(call) },
    cancel: { label: i18n.global.t('dashboard.decline'), onClick: () => void declineCallSession(call.id) },
  });
  incomingCallToasts.set(call.id, toastId);
  scheduleCallExpiry(call.id, call.expiresAt);
}

function scheduleCallExpiry(callId: string, expiresAt: string) {
  window.clearTimeout(incomingCallExpiryTimers.get(callId));
  const delay = Math.max(Date.parse(expiresAt) - Date.now(), 0) + 100;
  incomingCallExpiryTimers.set(
    callId,
    window.setTimeout(() => {
      incomingCallExpiryTimers.delete(callId);
      void pollIncomingCalls();
    }, delay),
  );
}

function scheduleCallRefreshRetry() {
  if (incomingCallRetryTimer !== undefined) return;
  const delay = Math.min(1_000 * 2 ** incomingCallRetryAttempts, 15_000);
  incomingCallRetryAttempts += 1;
  incomingCallRetryTimer = window.setTimeout(() => {
    incomingCallRetryTimer = undefined;
    void pollIncomingCalls();
  }, delay);
}

async function pollIncomingCalls() {
  const token = authActor.snapshot.value.context.accessToken;
  const userId = authActor.snapshot.value.context.user?.id;
  const generation = pollingGeneration;
  if (
    !token ||
    !userId ||
    authActor.snapshot.value.value !== 'authenticated' ||
    incomingCallInFlightGeneration === generation
  ) {
    if (incomingCallInFlightGeneration === generation) incomingCallRefreshPending = true;
    return;
  }
  incomingCallInFlightGeneration = generation;

  try {
    const [callsResult, callSessionsResult] = await Promise.allSettled([
      socialApi.listIncomingCalls(token),
      socialApi.listIncomingCallSessions(token),
    ]);
    if (
      generation !== pollingGeneration ||
      authActor.snapshot.value.value !== 'authenticated' ||
      authActor.snapshot.value.context.user?.id !== userId
    ) {
      return;
    }

    const calls = callsResult.status === 'fulfilled' ? callsResult.value : null;
    const callSessions = callSessionsResult.status === 'fulfilled' ? callSessionsResult.value : null;
    if (!calls || !callSessions) scheduleCallRefreshRetry();
    else {
      window.clearTimeout(incomingCallRetryTimer);
      incomingCallRetryTimer = undefined;
      incomingCallRetryAttempts = 0;
    }
    if (!calls && !callSessions) throw new Error('Incoming call endpoints are unavailable');
    if (callsResult.status === 'rejected') {
      console.error('[App] Failed to refresh legacy calls:', callsResult.reason);
    }
    if (callSessionsResult.status === 'rejected') {
      console.error('[App] Failed to refresh conversation calls:', callSessionsResult.reason);
    }

    const activeCallIds = new Set<string>();
    (calls ?? [...knownIncomingCallIds].map((id) => ({ id }))).forEach((call) => activeCallIds.add(call.id));
    (callSessions ?? [...knownIncomingCallSessionIds].map((id) => ({ id }))).forEach((call) =>
      activeCallIds.add(call.id),
    );

    for (const call of calls ?? []) {
      if (knownIncomingCallIds.has(call.id)) continue;
      showIncomingCall(call);
      const notification = showSystemNotification(
        i18n.global.t('notifications.incomingCallTitle'),
        {
          body: i18n.global.t('notifications.incomingCallBody'),
          icon: '/favicon.svg',
          tag: `openmeet-call-${call.id}`,
          requireInteraction: true,
        },
        () => router.push('/dashboard'),
      );
      if (notification) incomingCallNotifications.set(call.id, notification);
    }

    for (const call of callSessions ?? []) {
      if (knownIncomingCallSessionIds.has(call.id)) continue;
      showIncomingCallSession(call);
      const notification = showSystemNotification(
        i18n.global.t('notifications.incomingCallTitle'),
        {
          body: i18n.global.t('notifications.incomingCallBody'),
          icon: '/favicon.svg',
          tag: `openmeet-call-${call.id}`,
          requireInteraction: true,
        },
        () => void acceptCallSession(call),
      );
      if (notification) incomingCallNotifications.set(call.id, notification);
    }

    for (const [callId, notification] of incomingCallNotifications) {
      if (activeCallIds.has(callId)) continue;
      notification.close();
      incomingCallNotifications.delete(callId);
    }

    for (const [callId, toastId] of incomingCallToasts) {
      if (activeCallIds.has(callId)) continue;
      dismissToast(toastId);
      incomingCallToasts.delete(callId);
    }
    for (const [callId, timer] of incomingCallExpiryTimers) {
      if (activeCallIds.has(callId)) continue;
      window.clearTimeout(timer);
      incomingCallExpiryTimers.delete(callId);
    }

    if (calls) {
      knownIncomingCallIds.clear();
      calls.forEach((call) => knownIncomingCallIds.add(call.id));
      window.dispatchEvent(new CustomEvent<CallInvitation[]>('openmeet:incoming-calls-updated', { detail: calls }));
    }
    if (callSessions) {
      knownIncomingCallSessionIds.clear();
      callSessions.forEach((call) => knownIncomingCallSessionIds.add(call.id));
    }
  } catch (error) {
    console.error('[App] Failed to poll incoming calls:', error);
  } finally {
    if (incomingCallInFlightGeneration === generation) incomingCallInFlightGeneration = null;
    if (incomingCallRefreshPending && generation === pollingGeneration) {
      incomingCallRefreshPending = false;
      void pollIncomingCalls();
    }
  }
}

function notificationCopy(notification: UserNotification) {
  if (notification.kind === 'friendRequest') {
    return {
      title: 'Friend request',
      description: `${notification.actorName} sent you a friend request.`,
    };
  }
  if (notification.kind === 'friendRemoved') {
    return {
      title: 'Friend removed',
      description: `${notification.actorName} removed you from their friends.`,
    };
  }
  return { title: 'OpenMeet notification', description: 'You have a new notification.' };
}

async function pollNotifications() {
  const token = authActor.snapshot.value.context.accessToken;
  const userId = authActor.snapshot.value.context.user?.id;
  const generation = pollingGeneration;
  if (
    !token ||
    !userId ||
    authActor.snapshot.value.value !== 'authenticated' ||
    notificationInFlightGeneration === generation
  ) {
    if (notificationInFlightGeneration === generation) notificationRefreshPending = true;
    return;
  }
  notificationInFlightGeneration = generation;

  try {
    const notifications = await socialApi.listNotifications(token);
    if (
      generation !== pollingGeneration ||
      authActor.snapshot.value.value !== 'authenticated' ||
      authActor.snapshot.value.context.user?.id !== userId
    ) {
      return;
    }

    const received = notifications.filter((notification) => !knownNotificationIds.has(notification.id));
    received.forEach((notification) => knownNotificationIds.add(notification.id));
    if (received.length) {
      window.dispatchEvent(
        new CustomEvent<UserNotification[]>('openmeet:notifications-received', { detail: received }),
      );
      for (const notification of received) {
        const { title, description } = notificationCopy(notification);
        toast({ title, description, duration: 8_000 });
        showSystemNotification(
          title,
          { body: description, icon: '/favicon.svg', tag: `openmeet-${notification.id}` },
          () => router.push('/dashboard'),
        );
      }
    }

    await Promise.all(
      notifications.map((notification) =>
        socialApi.markNotificationRead(token, notification.id).catch((error) => {
          console.error('[App] Failed to mark notification as read:', error);
        }),
      ),
    );
  } catch (error) {
    console.error('[App] Failed to poll notifications:', error);
  } finally {
    if (notificationInFlightGeneration === generation) notificationInFlightGeneration = null;
    if (notificationRefreshPending && generation === pollingGeneration) {
      notificationRefreshPending = false;
      void pollNotifications();
    }
  }
}

async function updatePresence() {
  const token = authActor.snapshot.value.context.accessToken;
  if (!token || authActor.snapshot.value.value !== 'authenticated') return;
  await socialApi.updatePresence(token).catch((error) => console.error('[App] Failed to update presence:', error));
}

function handleSocialEvent(resource: SocialEventResource) {
  if (resource === 'calls') void pollIncomingCalls();
  if (resource === 'notifications') void pollNotifications();
  if (resource === 'friends') window.dispatchEvent(new Event('openmeet:social-friends-updated'));
  if (resource === 'conversations') window.dispatchEvent(new Event('openmeet:social-conversations-updated'));
}

function refreshSocialState() {
  void pollIncomingCalls();
  void pollNotifications();
  window.dispatchEvent(new Event('openmeet:social-friends-updated'));
  window.dispatchEvent(new Event('openmeet:social-conversations-updated'));
}

function stopAuthenticatedPolling() {
  pollingGeneration++;
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = undefined;
  socialEventsService.disconnect();
  knownIncomingCallIds.clear();
  knownIncomingCallSessionIds.clear();
  knownNotificationIds.clear();
  incomingCallRefreshPending = false;
  notificationRefreshPending = false;
  for (const notification of incomingCallNotifications.values()) notification.close();
  incomingCallNotifications.clear();
  for (const toastId of incomingCallToasts.values()) dismissToast(toastId);
  incomingCallToasts.clear();
  for (const timer of incomingCallExpiryTimers.values()) window.clearTimeout(timer);
  incomingCallExpiryTimers.clear();
  window.clearTimeout(incomingCallRetryTimer);
  incomingCallRetryTimer = undefined;
  incomingCallRetryAttempts = 0;
}

function handleIncomingCallResolved(event: Event) {
  const callId = (event as CustomEvent<string>).detail;
  knownIncomingCallIds.delete(callId);
  knownIncomingCallSessionIds.delete(callId);
  incomingCallNotifications.get(callId)?.close();
  incomingCallNotifications.delete(callId);
  const toastId = incomingCallToasts.get(callId);
  if (toastId !== undefined) dismissToast(toastId);
  incomingCallToasts.delete(callId);
  window.clearTimeout(incomingCallExpiryTimers.get(callId));
  incomingCallExpiryTimers.delete(callId);
}

function handleAccessTokenExpired() {
  if (authActor.snapshot.value.context.refreshToken) {
    authActor.send({ type: AuthEventType.REFRESH_TOKEN });
  } else {
    handleSessionExpired();
  }
}

watch(
  () => [authActor.snapshot.value.value, authActor.snapshot.value.context.accessToken] as const,
  ([state, token]) => {
    stopAuthenticatedPolling();
    if (state !== 'authenticated' || !token) return;
    void pollIncomingCalls();
    void pollNotifications();
    void updatePresence();
    socialEventsService.connect(token, handleSocialEvent, refreshSocialState);
    presenceTimer = setInterval(updatePresence, 20_000);
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener('openmeet:session-expired', handleSessionExpired);
  window.addEventListener('openmeet:access-token-expired', handleAccessTokenExpired);
  window.addEventListener('openmeet:incoming-call-resolved', handleIncomingCallResolved);
});
onUnmounted(() => {
  stopAuthenticatedPolling();
  window.removeEventListener('openmeet:session-expired', handleSessionExpired);
  window.removeEventListener('openmeet:access-token-expired', handleAccessTokenExpired);
  window.removeEventListener('openmeet:incoming-call-resolved', handleIncomingCallResolved);
});
</script>

<template>
  <div class="min-h-screen bg-[#FBFCF8]">
    <TheNavbar />
    <Toaster />

    <RouterView v-slot="{ Component, route }">
      <Transition name="page-fade" mode="out-in">
        <div :key="route.path" :class="route.meta.isAuthPage ? '' : 'pt-[84px]'">
          <component :is="Component" />
        </div>
      </Transition>
    </RouterView>
  </div>
</template>
