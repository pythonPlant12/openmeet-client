<script setup lang="ts">
import { useMachine } from '@xstate/vue';
import { assign, createMachine } from 'xstate';

// Create a machine, here is where all the logic will be defined.
const toggleMachine = createMachine({
  id: 'toggle',
  types: {
    context: {} as {
      count: number;
      maxCount: number;
    },
    events: {} as { type: 'toggle' },
    input: {} as { maxCount: number }, // Input is how initial data can be provided to a machine actor
  },
  context: ({ input }) => ({
    // Initial context values
    count: 0,
    maxCount: input.maxCount,
  }),
  initial: 'Inactive',
  states: {
    Inactive: {
      on: {
        toggle: {
          target: 'Active',
          guard: ({ context }) => context.count < context.maxCount, // Guards are used to conditionally allow transitions
        },
      }, // Automatically go back to Inactive after 2 seconds
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

/* 
  useMachine returns an object with:
  {
    snapshot,  // ComputedRef<Snapshot>
    send,      // Function to send events
    actorRef   // The actual actor instance
  }
 */
const { snapshot, send, actorRef } = useMachine(toggleMachine, {
  input: {
    maxCount: 10,
  },
});

// Subscribe to changes
actorRef.subscribe();

// Send events
function sendEventToMachine() {
  send({ type: 'toggle' }); // This is 'on' event
}
</script>
<template>
  <h1>XstateView.vue</h1>
  <h2>Xstate Study Project</h2>
  <button @click="sendEventToMachine()">Test button</button>
</template>
<style scoped></style>
