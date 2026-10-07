<script setup lang="ts">
import { computed } from 'vue';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MEETING_ACCESS_OPTIONS, meetingAccessOption } from '@/config/meeting-access.config';
import type { GroupAccessPolicy } from '@/services/social-api';

import MeetingSelect from './MeetingSelect.vue';

const props = defineProps<{
  disabled?: boolean;
  /** The room already has a password, so leaving the field empty keeps it. */
  hasPassword?: boolean;
}>();
const policy = defineModel<GroupAccessPolicy>('policy', { required: true });
const password = defineModel<string>('password', { default: '' });
const selectedOption = computed(() => meetingAccessOption(policy.value));
const passwordPlaceholder = computed(() =>
  props.hasPassword ? 'Leave empty to keep the current password' : 'At least 4 characters',
);
</script>

<template>
  <div class="space-y-1.5" data-meeting-access-picker>
    <Label for="meeting-privacy" class="text-xs text-[#4E6B70]">Privacy</Label>
    <MeetingSelect
      id="meeting-privacy"
      v-model="policy"
      :options="MEETING_ACCESS_OPTIONS"
      :disabled="disabled"
      data-access-select
    />
    <p class="text-xs leading-snug text-[#61777B]" data-access-description>{{ selectedOption.description }}</p>
    <div v-if="policy === 'password'" class="space-y-1.5 pt-1">
      <Label for="meeting-access-password" class="text-xs text-[#4E6B70]">Meeting password</Label>
      <Input
        id="meeting-access-password"
        v-model="password"
        type="password"
        autocomplete="new-password"
        maxlength="256"
        :disabled="disabled"
        :placeholder="passwordPlaceholder"
        class="h-9 rounded-lg border-[#D8E7E3] bg-white text-sm focus-visible:ring-0"
      />
    </div>
  </div>
</template>
