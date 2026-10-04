import { ref } from 'vue';

// Only one row stays open at a time across every swipeable list.
export const activeSwipeRowId = ref<string | null>(null);
