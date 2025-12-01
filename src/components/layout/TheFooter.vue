<script setup lang="ts">
import { useTheme } from '@/composables/useTheme';

const { theme } = useTheme();
</script>

<template>
  <footer class="py-8 px-6 border-t border-border">
    <p class="text-center text-sm text-muted-foreground">
      {{ theme.branding.companyName }} — Open source video conferencing for everyone.
    </p>
  </footer>
</template>
