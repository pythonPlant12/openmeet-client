<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { canOpenSystemSettings, openSystemSettings } from '@/services/system-settings';

// Shown when the microphone or camera permission is permanently refused, so asking again shows no prompt.
defineProps<{ kind: 'audio' | 'video' }>();
const open = defineModel<boolean>('open', { required: true });
const { t } = useI18n();
const isNative = canOpenSystemSettings();
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      side="bottom"
      class="marketing-font rounded-t-[1.5rem] border-0 bg-white pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-harbor-ink shadow-harbor-float sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:rounded-[1.5rem]"
      data-permission-sheet
    >
      <SheetHeader class="pr-10">
        <SheetTitle>{{
          t(kind === 'audio' ? 'meeting.permission.microphoneTitle' : 'meeting.permission.cameraTitle')
        }}</SheetTitle>
        <SheetDescription class="text-harbor-muted">
          {{ t(isNative ? 'meeting.permission.nativeHint' : 'meeting.permission.browserHint') }}
        </SheetDescription>
      </SheetHeader>
      <div class="mt-5 flex justify-end gap-2">
        <Button
          variant="ghost"
          class="harbor-ghost-action rounded-full px-5 text-harbor-ink"
          @click="open = false"
        >
          {{ t('meeting.permission.close') }}
        </Button>
        <Button
          v-if="isNative"
          class="harbor-primary-action rounded-full bg-harbor-accent px-5 text-white"
          data-open-settings
          @click="openSystemSettings"
        >
          {{ t('meeting.permission.openSettings') }}
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>
