<script setup lang="ts">
import { type PresenceSurface, showsPresenceIndicator } from '@/config/presence.config';

defineProps<{
  online: boolean;
  surface: PresenceSurface;
}>();
</script>

<template>
  <!-- Size and border colour come from the caller's class so the ring matches the surface behind it. -->
  <span
    v-if="online && showsPresenceIndicator(surface)"
    data-presence-dot
    role="img"
    aria-label="Online"
    class="pointer-events-none absolute bottom-0 right-0 rounded-full bg-[#2DA58F]"
  />
</template>
