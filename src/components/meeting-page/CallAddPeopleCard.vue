<script setup lang="ts">
import { ChevronRight, UserRoundPlus } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

// The phone call screen asks to add people while you are the only one in the call.
defineProps<{ alone: boolean }>();
const emit = defineEmits<{ (e: 'invite'): void }>();
const { t } = useI18n();
</script>

<template>
  <button
    v-if="alone"
    type="button"
    class="call-tray pointer-events-auto flex w-full max-w-md items-center gap-3 px-4 py-2.5 text-left"
    data-add-people
    @click="emit('invite')"
  >
    <UserRoundPlus class="size-5 shrink-0 text-harbor-icon" aria-hidden="true" />
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-semibold">{{ t('meeting.invite.addPeople') }}</span>
      <span class="block truncate text-xs text-harbor-muted">{{ t('meeting.invite.addPeopleHint') }}</span>
    </span>
    <ChevronRight class="size-4 shrink-0 text-harbor-icon" aria-hidden="true" />
  </button>
</template>
