<script setup lang="ts">
import { useMachine } from '@xstate/vue';
import { provide } from 'vue';
import { RouterView, useRouter } from 'vue-router';

import TheNavbar from '@/components/layout/TheNavbar.vue';

import { cookieUtils } from './utils';
import { authMachine } from './xstate/machines/auth';
import { webrtcMachine } from './xstate/machines/webrtc';

const router = useRouter();

const authActorRef = useMachine(authMachine, {
  input: {
    initialAccessToken: cookieUtils.get('accessToken'),
    initialRefreshToken: cookieUtils.get('refreshToken'),
    router,
  },
});

const webrtcActor = useMachine(webrtcMachine);

provide('authActor', authActorRef);
provide('webrtcActor', webrtcActor);
</script>

<template>
  <div class="">
    <TheNavbar />

    <main class="flex-1 mt-18">
      <RouterView />
    </main>
  </div>
</template>
