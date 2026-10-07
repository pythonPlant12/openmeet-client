<script setup lang="ts">
import { Mic, MicOff, Video, VideoOff } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type MediaKind, useMeetingMediaSettings } from '@/composables/useMeetingMediaSettings';

import MeetingQualityOptions from './MeetingQualityOptions.vue';

// One button per local medium. It opens a menu that turns it on and off and picks its source, plus the
// quality the camera sends.
const props = defineProps<{
  kind: MediaKind;
  /** Muted microphone or camera turned off. */
  off: boolean;
  available: boolean;
}>();
const emit = defineEmits<{ (event: 'toggle'): void; (event: 'media-changed'): void }>();
const { t } = useI18n();
const { devices, activeId, quality, sentHeight, busy, refresh, changeDevice, changeQuality } = useMeetingMediaSettings(
  props.kind,
);

const isAudio = computed(() => props.kind === 'audio');
const toggleLabel = computed(() => {
  if (!props.available)
    return t(isAudio.value ? 'meeting.actions.audioUnavailable' : 'meeting.actions.videoUnavailable');
  if (isAudio.value) return t(props.off ? 'meeting.controls.unmute' : 'meeting.controls.mute');
  return t(props.off ? 'meeting.controls.turnCameraOn' : 'meeting.controls.turnCameraOff');
});
const tooltip = computed(() =>
  t(isAudio.value ? 'meeting.controls.microphoneOptions' : 'meeting.controls.cameraOptions'),
);

function deviceLabel(device: MediaDeviceInfo, index: number) {
  return device.label || `${isAudio.value ? 'Microphone' : 'Camera'} ${index + 1}`;
}

function onMenuOpen(open: boolean) {
  if (open) void refresh();
}

async function selectDevice(deviceId: unknown) {
  if (typeof deviceId === 'string' && (await changeDevice(deviceId))) emit('media-changed');
}
</script>

<template>
  <div class="group relative" :data-media-control="kind">
    <DropdownMenu @update:open="onMenuOpen">
      <DropdownMenuTrigger as-child>
        <Button
          :variant="off ? 'destructive' : 'secondary'"
          size="icon"
          class="meeting-control size-10 rounded-full border border-[#D8E7E3] bg-[#E6F4F1] text-[#102F35] shadow-none data-[state=open]:border-[#0B7A75] sm:size-11"
          :class="{ '!border-[#F2765F] !bg-[#F2765F] !text-white': off, 'meeting-control-muted': off }"
          :aria-label="tooltip"
          :data-media-off="off"
          data-media-button
        >
          <template v-if="isAudio"><MicOff v-if="off" class="h-5 w-5" /><Mic v-else class="h-5 w-5" /></template>
          <template v-else><VideoOff v-if="off" class="h-5 w-5" /><Video v-else class="h-5 w-5" /></template>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        side="top"
        :side-offset="10"
        class="marketing-font w-72 rounded-2xl border-[#D8E7E3] bg-white p-2 text-[#102F35] shadow-[0_18px_45px_rgba(16,47,53,0.18)]"
      >
        <DropdownMenuItem
          :disabled="!available"
          class="meeting-share-item cursor-pointer rounded-xl py-2.5 font-semibold focus:bg-[#E6F4F1] focus:text-[#102F35]"
          :class="off ? 'text-[#0B7A75]' : 'text-[#9D4636]'"
          data-media-toggle-item
          @select="emit('toggle')"
        >
          <template v-if="isAudio">
            <Mic v-if="off" class="mr-2 size-4" /><MicOff v-else class="mr-2 size-4" />
          </template>
          <template v-else> <Video v-if="off" class="mr-2 size-4" /><VideoOff v-else class="mr-2 size-4" /> </template>
          {{ toggleLabel }}
        </DropdownMenuItem>
        <DropdownMenuSeparator class="bg-[#D8E7E3]" />

        <DropdownMenuLabel class="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A9C9E]">
          {{ isAudio ? 'Microphone' : 'Camera' }}
        </DropdownMenuLabel>
        <p v-if="!devices.length" class="px-2 py-1.5 text-sm text-[#61777B]">
          {{ isAudio ? 'No microphones found' : 'No cameras found' }}
        </p>
        <DropdownMenuRadioGroup :model-value="activeId" @update:model-value="selectDevice">
          <DropdownMenuRadioItem
            v-for="(device, index) in devices"
            :key="device.deviceId"
            :value="device.deviceId"
            :disabled="busy"
            class="cursor-pointer rounded-xl py-2 text-[#27595D]"
            :data-device-option="device.deviceId"
          >
            <span class="truncate">{{ deviceLabel(device, index) }}</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <template v-if="!isAudio">
          <DropdownMenuSeparator class="bg-[#D8E7E3]" />
          <MeetingQualityOptions
            label="Video quality you send"
            :quality="quality"
            :disabled="busy"
            :sent-height="sentHeight"
            @select="changeQuality"
          />
        </template>
      </DropdownMenuContent>
    </DropdownMenu>
    <span class="meeting-tooltip">{{ tooltip }}</span>
  </div>
</template>
