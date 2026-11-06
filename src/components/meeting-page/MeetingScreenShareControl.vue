<script setup lang="ts">
import { Crop, MonitorOff, MonitorUp } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import LiquidMenuIcon from '@/components/ui/liquid-menu/LiquidMenuIcon.vue';
import { LoadingRipple } from '@/components/ui/loading';
import { useScreenShare } from '@/composables/useScreenShare';

import MeetingQualityOptions from './MeetingQualityOptions.vue';

defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{
  (event: 'start'): void;
  (event: 'start-area'): void;
  (event: 'stop'): void;
  (event: 'open-change', open: boolean): void;
}>();
const { t } = useI18n();
const { session, isStarting, canSelectArea, quality, sentHeight, setQuality } = useScreenShare();
const qualityLabel = computed(() =>
  quality.value === 'auto' ? `Auto${sentHeight.value ? ` · ${sentHeight.value}p` : ''}` : quality.value,
);
</script>

<template>
  <div class="group relative" data-screen-share-control>
    <DropdownMenu @update:open="emit('open-change', $event)">
      <DropdownMenuTrigger as-child>
        <Button
          variant="secondary"
          size="icon"
          :disabled="disabled"
          class="meeting-control size-[var(--meeting-control-size)] rounded-full border-0 bg-transparent text-harbor-ink shadow-none [&_svg]:size-[var(--meeting-control-icon)]"
          :class="{ '!text-harbor-ink': session }"
          :aria-label="t(session ? 'meeting.controls.presenting' : 'meeting.controls.presentScreen')"
          :data-sharing="!!session"
          data-screen-share-button
        >
          <LoadingRipple v-if="isStarting" size="sm" />
          <MonitorUp v-else class="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" :side-offset="10" class="meeting-menu marketing-font w-72">
        <DropdownMenuItem v-if="session" variant="danger" data-stop-presenting @select="emit('stop')">
          <LiquidMenuIcon class="mr-2" :fallback="MonitorOff" />{{ t('meeting.controls.stopPresenting') }}
        </DropdownMenuItem>
        <DropdownMenuItem v-else :disabled="isStarting" data-start-presenting @select="emit('start')">
          <LiquidMenuIcon class="mr-2" :fallback="MonitorUp" />
          <span class="min-w-0">
            <span class="block">{{ t('meeting.controls.startPresenting') }}</span>
            <span class="block text-xs font-normal text-harbor-muted">{{ t('meeting.controls.presentHint') }}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="!session && canSelectArea"
          :disabled="isStarting"
          data-start-presenting-area
          @select="emit('start-area')"
        >
          <LiquidMenuIcon class="mr-2" :fallback="Crop" />
          <span class="min-w-0">
            <span class="block">{{ t('meeting.controls.presentArea') }}</span>
            <span class="block text-xs font-normal text-harbor-muted">{{ t('meeting.controls.presentAreaHint') }}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Screen quality
            <span class="ml-auto truncate pl-2 text-xs font-normal text-harbor-muted">{{ qualityLabel }}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent class="meeting-menu marketing-font w-64">
            <MeetingQualityOptions :quality="quality" :sent-height="session ? sentHeight : null" @select="setQuality" />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
    <span class="meeting-tooltip">{{
      t(session ? 'meeting.controls.presenting' : 'meeting.controls.presentScreen')
    }}</span>
  </div>
</template>
