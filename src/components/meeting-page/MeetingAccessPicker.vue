<script setup lang="ts">
import { computed } from 'vue';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MEETING_ACCESS_OPTIONS } from '@/config/meeting-access.config';
import type { GroupAccessPolicy } from '@/services/social-api';

const props = defineProps<{
  disabled?: boolean;
  /** The room already has a password, so leaving the field empty keeps it. */
  hasPassword?: boolean;
}>();
const policy = defineModel<GroupAccessPolicy>('policy', { required: true });
const password = defineModel<string>('password', { default: '' });
const passwordPlaceholder = computed(() =>
  props.hasPassword ? 'Leave empty to keep the current password' : 'At least 4 characters',
);
</script>

<template>
  <fieldset class="space-y-2" :disabled="disabled" data-meeting-access-picker>
    <legend class="mb-2 text-sm font-medium">Who can join</legend>
    <div class="grid grid-cols-2 gap-2">
      <label
        v-for="option in MEETING_ACCESS_OPTIONS"
        :key="option.value"
        class="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#D8E7E3] bg-white px-3 py-2.5 has-[:checked]:border-[#0B7A75] has-[:checked]:bg-[#EAF7F4] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#0B7A75]/40 has-[:disabled]:cursor-not-allowed"
      >
        <input
          v-model="policy"
          type="radio"
          name="meeting-access"
          :value="option.value"
          class="sr-only"
          :data-access-option="option.value"
        />
        <component :is="option.icon" class="mt-0.5 size-4 shrink-0 text-[#0B7A75]" />
        <span class="min-w-0">
          <span class="block text-sm font-semibold">{{ option.label }}</span>
          <span class="block text-xs leading-snug text-[#61777B]">{{ option.description }}</span>
        </span>
      </label>
    </div>
    <div v-if="policy === 'password'" class="space-y-1.5 pt-1">
      <Label for="meeting-access-password" class="text-xs text-[#4E6B70]">Meeting password</Label>
      <Input
        id="meeting-access-password"
        v-model="password"
        type="password"
        autocomplete="new-password"
        maxlength="256"
        :placeholder="passwordPlaceholder"
        class="h-10 rounded-xl border-[#D8E7E3] bg-white focus-visible:ring-0"
      />
    </div>
  </fieldset>
</template>
