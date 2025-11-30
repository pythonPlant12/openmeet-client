<script setup lang="ts">
import { useMachine } from '@xstate/vue';
import { assign, createMachine } from 'xstate';

const toggleMachine = createMachine({
  id: 'toggle',
  types: {
    context: {} as {
      count: number;
      maxCount: number;
    },
    events: {} as { type: 'toggle' },
    input: {} as { maxCount: number },
  },
  context: ({ input }) => ({
    count: 0,
    maxCount: input.maxCount,
  }),
  initial: 'Inactive',
  states: {
    Inactive: {
      on: {
        toggle: {
          target: 'Active',
          guard: ({ context }) => context.count < context.maxCount,
        },
      },
    },
    Active: {
      entry: assign({
        count: ({ context }) => context.count + 1,
      }),
      on: { toggle: 'Inactive' },
      after: { 2000: 'Inactive' },
    },
  },
});

const { send, actorRef } = useMachine(toggleMachine, {
  input: {
    maxCount: 10,
  },
});

actorRef.subscribe();

function sendEventToMachine() {
  send({ type: 'toggle' });
}
</script>
<template>
  <h1>XstateView.vue</h1>
  <h2>Xstate Study Project</h2>
  <button @click="sendEventToMachine()">Test button</button>
</template>
<style scoped></style>
