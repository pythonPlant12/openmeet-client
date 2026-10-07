<script setup lang="ts">
import { MonitorOff, MonitorUp } from 'lucide-vue-next';
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
import { LoadingRipple } from '@/components/ui/loading';
import { useScreenShare } from '@/composables/useScreenShare';

import MeetingQualityOptions from './MeetingQualityOptions.vue';

defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ (event: 'start'): void; (event: 'stop'): void }>();
const { t } = useI18n();
const { session, isStarting, quality, sentHeight, setQuality } = useScreenShare();
const qualityLabel = computed(() =>
  quality.value === 'auto' ? `Auto${sentHeight.value ? ` · ${sentHeight.value}p` : ''}` : quality.value,
);
</script>

<template>
  <div class="group relative" data-screen-share-control>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="secondary"
          size="icon"
          :disabled="disabled"
          class="meeting-control size-10 rounded-full border border-[#D8E7E3] bg-[#E6F4F1] text-[#102F35] shadow-none data-[state=open]:border-[#0B7A75] sm:size-11"
          :class="{ '!border-[#0B7A75] !bg-[#0B7A75] !text-white': session }"
          :aria-label="t(session ? 'meeting.controls.presenting' : 'meeting.controls.presentScreen')"
          :data-sharing="!!session"
          data-screen-share-button
        >
          <LoadingRipple v-if="isStarting" size="sm" />
          <MonitorUp v-else class="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        side="top"
        :side-offset="10"
        class="marketing-font w-72 rounded-2xl border-[#D8E7E3] bg-white p-2 text-[#102F35] shadow-[0_18px_45px_rgba(16,47,53,0.18)]"
      >
        <DropdownMenuItem
          v-if="session"
          class="meeting-share-item cursor-pointer rounded-xl py-2.5 font-semibold text-[#9D4636] focus:bg-[#FFF0EA] focus:text-[#9D4636]"
          data-stop-presenting
          @select="emit('stop')"
        >
          <MonitorOff class="mr-2 size-4" />{{ t('meeting.controls.stopPresenting') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          v-else
          :disabled="isStarting"
          class="meeting-share-item cursor-pointer rounded-xl py-2.5 font-semibold text-[#0B7A75] focus:bg-[#E6F4F1] focus:text-[#102F35]"
          data-start-presenting
          @select="emit('start')"
        >
          <MonitorUp class="mr-2 size-4" />
          <span class="min-w-0">
            <span class="block">{{ t('meeting.controls.startPresenting') }}</span>
            <span class="block text-xs font-normal text-[#61777B]">{{ t('meeting.controls.presentHint') }}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator class="bg-[#D8E7E3]" />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger class="meeting-share-item cursor-pointer gap-2 rounded-xl py-2.5 font-semibold">
            Screen quality
            <span class="ml-auto truncate pl-2 text-xs font-normal text-[#61777B]">{{ qualityLabel }}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            class="marketing-font w-64 rounded-2xl border-[#D8E7E3] bg-white p-2 text-[#102F35] shadow-[0_18px_45px_rgba(16,47,53,0.18)]"
          >
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
