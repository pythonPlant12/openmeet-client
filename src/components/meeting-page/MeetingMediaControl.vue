<script setup lang="ts">
import { Gauge, Mic, MicOff, Video, VideoOff, Webcam } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type MediaKind, useMeetingMediaSettings } from '@/composables/useMeetingMediaSettings';

import MeetingQualityOptions from './MeetingQualityOptions.vue';

// One button per local medium. Its menu has the camera's quality and the source as submenus, then the
// action that turns the medium off (or back on).
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

const qualityLabel = computed(() =>
  quality.value === 'auto' ? `Auto${sentHeight.value ? ` · ${sentHeight.value}p` : ''}` : quality.value,
);
const activeDeviceLabel = computed(() => {
  const index = devices.value.findIndex((device) => device.deviceId === activeId.value);
  return index >= 0 ? deviceLabel(devices.value[index]!, index) : '';
});

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
          class="meeting-control size-11 rounded-xl border-2 border-[#D8E7E3] bg-[#FBFCF8] text-[#102F35] shadow-[0_4px_12px_rgba(16,47,53,0.08)] data-[state=open]:border-[#0B7A75] sm:size-12"
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
        class="marketing-font w-64 rounded-2xl border-[#D8E7E3] bg-white p-2 text-[#102F35] shadow-[0_18px_45px_rgba(16,47,53,0.18)]"
      >
        <DropdownMenuSub v-if="!isAudio">
          <DropdownMenuSubTrigger
            class="meeting-share-item cursor-pointer gap-2 rounded-xl py-2.5 font-semibold"
            data-media-quality-menu
          >
            <Gauge class="size-4 text-[#0B7A75]" />Quality
            <span class="ml-auto truncate pl-2 text-xs font-normal text-[#61777B]">{{ qualityLabel }}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            class="marketing-font w-64 rounded-2xl border-[#D8E7E3] bg-white p-2 text-[#102F35] shadow-[0_18px_45px_rgba(16,47,53,0.18)]"
          >
            <MeetingQualityOptions
              :quality="quality"
              :disabled="busy"
              :sent-height="sentHeight"
              @select="changeQuality"
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            class="meeting-share-item cursor-pointer gap-2 rounded-xl py-2.5 font-semibold"
            data-media-source-menu
          >
            <Mic v-if="isAudio" class="size-4 text-[#0B7A75]" /><Webcam v-else class="size-4 text-[#0B7A75]" />Source
            <span class="ml-auto max-w-28 truncate pl-2 text-xs font-normal text-[#61777B]">{{
              activeDeviceLabel
            }}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            class="marketing-font w-64 rounded-2xl border-[#D8E7E3] bg-white p-2 text-[#102F35] shadow-[0_18px_45px_rgba(16,47,53,0.18)]"
          >
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
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator class="bg-[#D8E7E3]" />
        <!-- Turning a medium off is the destructive choice, so it highlights red; turning it on stays teal. -->
        <DropdownMenuItem
          :disabled="!available"
          class="cursor-pointer gap-2 rounded-xl py-2.5 font-semibold"
          :class="off ? 'meeting-share-item text-[#0B7A75]' : 'harbor-context-menu-danger text-[#C4513D]'"
          data-media-toggle-item
          @select="emit('toggle')"
        >
          <template v-if="isAudio"> <Mic v-if="off" class="size-4" /><MicOff v-else class="size-4" /> </template>
          <template v-else> <Video v-if="off" class="size-4" /><VideoOff v-else class="size-4" /> </template>
          {{ toggleLabel }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <span class="meeting-tooltip">{{ tooltip }}</span>
  </div>
</template>
