<script setup lang="ts">
import { ref, watch } from 'vue';

// Content that opens in place under its row, such as a setting's choices: it slides down to its height and back up.
// It mounts as it starts to open and unmounts once it has closed, so closed content runs nothing, such as a level
// meter. Without an animation (reduced motion) it closes at once.
const props = defineProps<{ open: boolean }>();

const root = ref<HTMLElement | null>(null);
const mounted = ref(props.open);

function finishClosing() {
  if (!props.open) mounted.value = false;
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      mounted.value = true;
      return;
    }
    const element = root.value;
    const duration = element ? parseFloat(getComputedStyle(element).transitionDuration) || 0 : 0;
    if (!duration) finishClosing();
  },
);
</script>

<template>
  <div
    ref="root"
    class="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
    :class="open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
    :data-state="open ? 'open' : 'closed'"
    data-expand
    @transitionend.self="finishClosing"
  >
    <div class="min-h-0 overflow-hidden" :inert="!open || undefined">
      <slot v-if="mounted" />
    </div>
  </div>
</template>
