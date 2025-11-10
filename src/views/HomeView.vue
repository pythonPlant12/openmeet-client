<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <div class="home-page">
    <RouterView />
  </div>
</template>

<style scoped>
.home-page {
  min-height: calc(100vh - 80px);
}
</style>
