<script setup lang="ts">
defineProps<{ title: string; headingId?: string }>();
</script>

<template>
  <!-- The top of each sidebar pane: a round button on each side, the centered title with its badge, and an
       optional row below it, usually the search field. -->
  <div class="shrink-0 px-3 pb-2 pt-3 lg:px-4 lg:pt-4">
    <div class="relative flex h-11 items-center justify-between">
      <div class="relative z-[1] flex"><slot name="leading" /></div>
      <h1
        :id="headingId"
        class="pointer-events-none absolute inset-x-0 flex items-center justify-center gap-2 text-[1.0625rem] font-semibold text-harbor-ink"
      >
        <span>{{ title }}</span
        ><slot name="badge" />
      </h1>
      <div class="relative z-[1] flex"><slot name="trailing" /></div>
    </div>
    <div v-if="$slots.default" class="mt-3"><slot /></div>
  </div>
</template>
