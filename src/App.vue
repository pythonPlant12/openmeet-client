<script setup lang="ts">
import { useMachine } from '@xstate/vue';
import { onMounted, onUnmounted, provide, watch } from 'vue';
import { RouterView, useRouter } from 'vue-router';

import TheNavbar from '@/components/layout/TheNavbar.vue';
import { Toaster } from '@/components/ui/toast';
import { toast } from '@/components/ui/toast/store';
import { i18n } from '@/i18n';
import { showSystemNotification } from '@/services/notifications';
import { type CallInvitation, type UserNotification, socialApi } from '@/services/social-api';

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
const knownNotificationIds = new Set<string>();
const incomingCallNotifications = new Map<string, Notification>();
let incomingCallTimer: ReturnType<typeof setInterval> | undefined;
let notificationTimer: ReturnType<typeof setInterval> | undefined;
let presenceTimer: ReturnType<typeof setInterval> | undefined;
let pollingGeneration = 0;
let incomingCallInFlightGeneration: number | null = null;
let notificationInFlightGeneration: number | null = null;

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
    return;
  }
  incomingCallInFlightGeneration = generation;

  try {
    const calls = await socialApi.listIncomingCalls(token);
    if (
      generation !== pollingGeneration ||
      authActor.snapshot.value.value !== 'authenticated' ||
      authActor.snapshot.value.context.user?.id !== userId
    ) {
      return;
    }

    const activeCallIds = new Set(calls.map((call) => call.id));

    for (const call of calls) {
      if (knownIncomingCallIds.has(call.id)) continue;
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

    for (const [callId, notification] of incomingCallNotifications) {
      if (activeCallIds.has(callId)) continue;
      notification.close();
      incomingCallNotifications.delete(callId);
    }

    knownIncomingCallIds.clear();
    activeCallIds.forEach((id) => knownIncomingCallIds.add(id));
    window.dispatchEvent(new CustomEvent<CallInvitation[]>('openmeet:incoming-calls-updated', { detail: calls }));
  } catch (error) {
    console.error('[App] Failed to poll incoming calls:', error);
  } finally {
    if (incomingCallInFlightGeneration === generation) incomingCallInFlightGeneration = null;
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
        toast({ title, description, duration: 3_000 });
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
  }
}

async function updatePresence() {
  const token = authActor.snapshot.value.context.accessToken;
  if (!token || authActor.snapshot.value.value !== 'authenticated') return;
  await socialApi.updatePresence(token).catch((error) => console.error('[App] Failed to update presence:', error));
}

function stopAuthenticatedPolling() {
  pollingGeneration++;
  if (incomingCallTimer) clearInterval(incomingCallTimer);
  if (notificationTimer) clearInterval(notificationTimer);
  if (presenceTimer) clearInterval(presenceTimer);
  incomingCallTimer = undefined;
  notificationTimer = undefined;
  presenceTimer = undefined;
  knownIncomingCallIds.clear();
  knownNotificationIds.clear();
  for (const notification of incomingCallNotifications.values()) notification.close();
  incomingCallNotifications.clear();
}

function handleIncomingCallResolved(event: Event) {
  const callId = (event as CustomEvent<string>).detail;
  pollingGeneration++;
  knownIncomingCallIds.delete(callId);
  incomingCallNotifications.get(callId)?.close();
  incomingCallNotifications.delete(callId);
}

watch(
  () => [authActor.snapshot.value.value, authActor.snapshot.value.context.accessToken] as const,
  ([state, token]) => {
    stopAuthenticatedPolling();
    if (state !== 'authenticated' || !token) return;
    void pollIncomingCalls();
    void pollNotifications();
    void updatePresence();
    incomingCallTimer = setInterval(pollIncomingCalls, 4_000);
    notificationTimer = setInterval(pollNotifications, 30_000);
    presenceTimer = setInterval(updatePresence, 20_000);
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener('openmeet:session-expired', handleSessionExpired);
  window.addEventListener('openmeet:incoming-call-resolved', handleIncomingCallResolved);
});
onUnmounted(() => {
  stopAuthenticatedPolling();
  window.removeEventListener('openmeet:session-expired', handleSessionExpired);
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
