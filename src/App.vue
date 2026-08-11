<script setup lang="ts">
import { useMachine } from '@xstate/vue';
import { onMounted, onUnmounted, provide, watch } from 'vue';
import { RouterView, useRouter } from 'vue-router';

import TheNavbar from '@/components/layout/TheNavbar.vue';
import { Toaster } from '@/components/ui/toast';
import { i18n } from '@/i18n';
import { showSystemNotification } from '@/services/notifications';
import { type CallInvitation, socialApi } from '@/services/social-api';

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
const incomingCallNotifications = new Map<string, Notification>();
let incomingCallTimer: ReturnType<typeof setInterval> | undefined;
let presenceTimer: ReturnType<typeof setInterval> | undefined;
let pollingGeneration = 0;
let inFlightGeneration: number | null = null;

async function pollIncomingCalls() {
  const token = authActor.snapshot.value.context.accessToken;
  const userId = authActor.snapshot.value.context.user?.id;
  const generation = pollingGeneration;
  if (!token || !userId || authActor.snapshot.value.value !== 'authenticated' || inFlightGeneration === generation) {
    return;
  }
  inFlightGeneration = generation;

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
    if (inFlightGeneration === generation) inFlightGeneration = null;
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
  if (presenceTimer) clearInterval(presenceTimer);
  incomingCallTimer = undefined;
  presenceTimer = undefined;
  knownIncomingCallIds.clear();
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
    void updatePresence();
    incomingCallTimer = setInterval(pollIncomingCalls, 4_000);
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
        <component :is="Component" :key="route.path" :class="route.meta.isAuthPage ? '' : 'pt-[84px]'" />
      </Transition>
    </RouterView>
  </div>
</template>
