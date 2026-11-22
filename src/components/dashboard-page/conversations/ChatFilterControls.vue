<script setup lang="ts">
import { computed } from 'vue';

import PaneViewSwitch from '@/components/dashboard-page/PaneViewSwitch.vue';

import { CHAT_FILTER_VIEWS, type ChatFilter } from './chat-filter';

const props = defineProps<{ filter: ChatFilter }>();
const emit = defineEmits<{ switch: [next: ChatFilter] }>();

const view = computed(() => CHAT_FILTER_VIEWS[props.filter]);
</script>

<template>
  <!-- The white switch to the next view: Chats, then Group chats, then Friends chats. -->
  <PaneViewSwitch
    :view-key="filter"
    :icon="view.switchIcon"
    :label="view.switchLabel"
    @click="emit('switch', view.next)"
  />
</template>
