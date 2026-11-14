<script setup lang="ts">
import { Check, ChevronDown } from 'lucide-vue-next';
import { computed, ref, useId, watch } from 'vue';

import { Expand } from '@/components/ui/expand';
import { Input } from '@/components/ui/input';
import { LoadingRipple } from '@/components/ui/loading';
import { MEETING_ACCESS_OPTIONS, meetingAccessOption } from '@/config/meeting-access.config';
import type { GroupAccessPolicy } from '@/services/social-api';

// Who may join the meeting, as one row in the style of the phone controls panel: "Privacy" over the current
// setting. The host's row expands in place to the choices, and a choice applies at once; a password needs to be
// typed first, so it gets a field and a Save button. Everyone else sees the row without the choices.
const props = defineProps<{
  /** The room's current policy. */
  policy: GroupAccessPolicy;
  /** The host may change it. */
  editable?: boolean;
  /** A change is being saved. */
  saving?: boolean;
}>();
const emit = defineEmits<{ (event: 'save', change: { policy: GroupAccessPolicy; password?: string }): void }>();

const listId = `meeting-access-${useId()}`;
const isOpen = ref(false);
// The chosen option; a password choice stays here until its password is saved.
const draftPolicy = ref<GroupAccessPolicy>(props.policy);
const password = ref('');
const current = computed(() => meetingAccessOption(props.policy));
const hasPassword = computed(() => props.policy === 'password');
const canSavePassword = computed(
  () => !props.saving && (password.value.length >= 4 || (hasPassword.value && !password.value)),
);

function toggle() {
  if (props.editable) isOpen.value = !isOpen.value;
}

function choose(value: GroupAccessPolicy) {
  draftPolicy.value = value;
  if (value !== 'password' && value !== props.policy) emit('save', { policy: value });
}

function savePassword() {
  if (!canSavePassword.value) return;
  emit('save', { policy: 'password', ...(password.value ? { password: password.value } : {}) });
}

// A saved change closes the row; the draft follows the room's policy.
watch(
  () => props.policy,
  () => {
    isOpen.value = false;
    draftPolicy.value = props.policy;
    password.value = '';
  },
);
// Saving the password the row already has does not change the policy, so the row also closes once a save of
// the drafted choice ends.
watch(
  () => props.saving,
  (saving, wasSaving) => {
    if (wasSaving && !saving && props.policy === draftPolicy.value) isOpen.value = false;
  },
);
watch(isOpen, (open) => {
  if (open) return;
  draftPolicy.value = props.policy;
  password.value = '';
});
</script>

<template>
  <div class="call-panel-group" data-meeting-access-picker data-meeting-access-line>
    <component
      :is="editable ? 'button' : 'div'"
      :type="editable ? 'button' : undefined"
      class="call-panel-row min-h-[3.25rem] py-2"
      :aria-expanded="editable ? isOpen : undefined"
      :aria-controls="editable ? listId : undefined"
      :data-edit-access="editable ? '' : undefined"
      @click="toggle"
    >
      <component :is="current.icon" class="call-panel-row-icon" aria-hidden="true" />
      <span class="min-w-0 flex-1 text-left">
        <span class="block">Privacy</span>
        <span class="block truncate text-xs font-normal text-harbor-muted" data-meeting-access-summary
          >{{ current.label }} · {{ current.description }}</span
        >
      </span>
      <LoadingRipple v-if="saving" size="sm" class="text-harbor-icon" />
      <ChevronDown
        v-else-if="editable"
        class="size-4 shrink-0 text-harbor-icon transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        aria-hidden="true"
      />
    </component>
    <Expand v-if="editable" :open="isOpen">
      <div :id="listId" class="px-3 pb-3" data-host-access>
        <div class="call-choice-list" role="radiogroup" aria-label="Privacy">
          <button
            v-for="option in MEETING_ACCESS_OPTIONS"
            :key="option.value"
            type="button"
            role="radio"
            class="call-choice"
            :aria-checked="option.value === draftPolicy"
            :disabled="saving"
            :data-access-option="option.value"
            @click="choose(option.value)"
          >
            <component :is="option.icon" class="size-4 shrink-0 text-harbor-icon" aria-hidden="true" />
            <span class="min-w-0 flex-1 text-left">
              <span class="block truncate">{{ option.label }}</span>
              <span class="block text-xs font-normal text-harbor-muted">{{ option.description }}</span>
            </span>
            <Check v-if="option.value === draftPolicy" class="size-4 shrink-0" aria-hidden="true" />
          </button>
          <form v-if="draftPolicy === 'password'" class="flex gap-2 px-3.5 py-3" @submit.prevent="savePassword">
            <Input
              id="meeting-access-password"
              v-model="password"
              type="password"
              autocomplete="new-password"
              maxlength="256"
              aria-label="Meeting password"
              :disabled="saving"
              :placeholder="hasPassword ? 'New password, or empty to keep it' : 'At least 4 characters'"
              class="h-9 min-w-0 flex-1 rounded-lg border-harbor-line bg-harbor-canvas text-sm focus-visible:ring-0"
            />
            <button
              type="submit"
              class="call-button call-chip h-9 w-auto shrink-0 px-4 text-sm font-semibold"
              :disabled="!canSavePassword"
              data-save-access-password
            >
              Save
            </button>
          </form>
        </div>
      </div>
    </Expand>
  </div>
</template>
