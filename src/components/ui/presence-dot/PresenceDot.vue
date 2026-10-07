<script setup lang="ts">
import { computed } from 'vue';

import { type PresenceSurface, showsPresenceIndicator } from '@/config/presence.config';
import { userStatusOption } from '@/config/user-status.config';
import type { UserStatus } from '@/services/social-api';

const props = defineProps<{
  online: boolean;
  surface: PresenceSurface;
  /** Colours the dot by status; an unknown status reads as plain online. */
  status?: UserStatus | null;
}>();

const option = computed(() => userStatusOption(props.status));
</script>

<template>
  <!-- Size and border colour come from the caller's class so the ring matches the surface behind it. -->
  <span
    v-if="online && showsPresenceIndicator(surface)"
    data-presence-dot
    role="img"
    :aria-label="option.label"
    :title="option.label"
    class="pointer-events-none absolute bottom-0 right-0 rounded-full"
    :class="option.dotClass"
  />
</template>
