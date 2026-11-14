<script setup lang="ts">
import { GaugeAnimated } from '@respeak/lucide-motion-vue';
import { ChevronDown, ChevronUp, Mic, MicOff, ScanFace, TriangleAlert, Video, VideoOff } from 'lucide-vue-next';
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import LiquidMenuIcon from '@/components/ui/liquid-menu/LiquidMenuIcon.vue';
import { type MediaKind, useMeetingMediaSettings } from '@/composables/useMeetingMediaSettings';
import { VIDEO_QUALITY_OPTIONS } from '@/lib/video-quality';
import { playHaptic } from '@/services/haptics';

import CallPanelChoice from './CallPanelChoice.vue';
import MeetingInputVolume from './MeetingInputVolume.vue';
import MeetingQualityOptions from './MeetingQualityOptions.vue';

// Split button for one local medium, shared by every controls bar: the main part turns the microphone or
// camera on and off, and the chevron after a small separator opens its device menu.
const props = defineProps<{
  kind: MediaKind;
  /** Muted microphone or camera turned off. */
  off: boolean;
  available: boolean;
  /** The call could not get this medium, such as a refused permission; tapping asks again. */
  warning?: boolean;
  /**
   * `split` (default): the toggle and the chevron that opens the device menu. `toggle`: the toggle alone, for the
   * phone bar. `row`: a row in the phone controls panel that expands in place, since phones get no context menus,
   * to the source and the other settings, each its own expanding choice. Its `extra` slot adds rows to the end.
   */
  variant?: 'split' | 'toggle' | 'row';
}>();
const emit = defineEmits<{
  (event: 'toggle'): void;
  (event: 'media-changed'): void;
  /** The device menu opened or closed; the controls bar holds its liquid drop on an open menu. */
  (event: 'open-change', open: boolean): void;
  /** Preview camera was chosen in the camera menu. */
  (event: 'preview-camera'): void;
  /** The warning was tapped: ask for the microphone or camera again. */
  (event: 'request-access'): void;
}>();
const { t } = useI18n();
const {
  devices,
  activeId,
  quality,
  sentHeight,
  busy,
  canChooseSpeaker,
  speakers,
  speakerId,
  inputVolume,
  inputLevel,
  refresh,
  changeDevice,
  changeQuality,
  changeSpeaker,
  changeInputVolume,
  startLevelMeter,
  stopLevelMeter,
} = useMeetingMediaSettings(props.kind);

const isAudio = computed(() => props.kind === 'audio');
const toggleLabel = computed(() => {
  if (props.warning) return t(isAudio.value ? 'meeting.controls.allowMicrophone' : 'meeting.controls.allowCamera');
  if (!props.available)
    return t(isAudio.value ? 'meeting.actions.audioUnavailable' : 'meeting.actions.videoUnavailable');
  if (isAudio.value) return t(props.off ? 'meeting.controls.unmute' : 'meeting.controls.mute');
  return t(props.off ? 'meeting.controls.turnCameraOn' : 'meeting.controls.turnCameraOff');
});
const menuLabel = computed(() =>
  t(isAudio.value ? 'meeting.controls.microphoneOptions' : 'meeting.controls.cameraOptions'),
);
const qualityLabel = computed(() =>
  quality.value === 'auto' ? `Auto${sentHeight.value ? ` · ${sentHeight.value}p` : ''}` : quality.value,
);
const volumePercent = computed(() => Math.round(inputVolume.value * 100));
const levelPercent = computed(() => Math.round(inputLevel.value * 100));

function deviceLabel(device: MediaDeviceInfo, index: number) {
  return device.label || `${t(isAudio.value ? 'meeting.controls.microphone' : 'meeting.controls.camera')} ${index + 1}`;
}

function onToggle() {
  playHaptic('light');
  if (props.warning) emit('request-access');
  else emit('toggle');
}

function onMenuOpen(open: boolean) {
  emit('open-change', open);
  if (!open) {
    stopLevelMeter();
    return;
  }
  playHaptic('medium');
  void refresh();
  if (isAudio.value) void startLevelMeter();
}

async function selectDevice(deviceId: unknown) {
  if (typeof deviceId === 'string' && (await changeDevice(deviceId))) emit('media-changed');
}

function selectSpeaker(deviceId: unknown) {
  if (typeof deviceId === 'string') void changeSpeaker(deviceId);
}

function onVolumeChange(percent: number) {
  void changeInputVolume(percent / 100);
}

const isExpanded = ref(false);
const deviceOptions = computed(() =>
  devices.value.map((device, index) => ({ value: device.deviceId, label: deviceLabel(device, index) })),
);
const speakerOptions = computed(() =>
  speakers.value.map((speaker, index) => ({
    value: speaker.deviceId,
    label: speaker.label || `${t('meeting.controls.speaker')} ${index + 1}`,
  })),
);
const qualityOptions = computed(() =>
  VIDEO_QUALITY_OPTIONS.map((option) => ({
    value: option.value,
    label: option.value === 'auto' ? qualityLabel.value : option.label,
    description: option.description,
  })),
);

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
  onMenuOpen(isExpanded.value);
}

onBeforeUnmount(stopLevelMeter);
</script>

<template>
  <div
    class="group relative flex"
    :class="variant === 'row' ? 'w-full flex-col' : 'call-media items-center'"
    :data-off="variant === 'row' ? undefined : off"
    :data-media-control="kind"
    :data-variant="variant ?? 'split'"
  >
    <template v-if="variant === 'row'">
      <button
        type="button"
        class="call-panel-row"
        :aria-label="menuLabel"
        :aria-expanded="isExpanded"
        data-media-menu-trigger
        @click="toggleExpanded"
      >
        <component :is="isAudio ? Mic : Video" class="call-panel-row-icon" />
        <span class="flex-1 text-left">{{
          t(isAudio ? 'meeting.controls.microphone' : 'meeting.controls.camera')
        }}</span>
        <ChevronDown
          class="size-4 shrink-0 text-harbor-icon transition-transform duration-200"
          :class="{ 'rotate-180': isExpanded }"
          aria-hidden="true"
        />
      </button>
      <div v-if="isExpanded" class="px-3 pb-3" data-media-options>
        <div class="call-choice-list">
          <CallPanelChoice
            :label="t('meeting.controls.source')"
            :options="deviceOptions"
            :value="activeId"
            :disabled="busy"
            :empty-text="t(isAudio ? 'meeting.controls.noMicrophones' : 'meeting.controls.noCameras')"
            option-attribute="data-device-option"
            data-media-source
            @select="selectDevice"
          />
          <template v-if="isAudio">
            <CallPanelChoice
              v-if="canChooseSpeaker && speakers.length"
              :label="t('meeting.controls.speaker')"
              :options="speakerOptions"
              :value="speakerId"
              option-attribute="data-speaker-option"
              data-media-speaker
              @select="selectSpeaker"
            />
            <MeetingInputVolume
              class="!px-3.5 !py-3"
              :volume-percent="volumePercent"
              :level-percent="levelPercent"
              @change="onVolumeChange"
            />
          </template>
          <template v-else>
            <CallPanelChoice
              :label="t('meeting.controls.quality')"
              :options="qualityOptions"
              :value="quality"
              :disabled="busy"
              option-attribute="data-quality-option"
              data-media-quality
              @select="changeQuality"
            />
            <button type="button" class="call-choice" data-preview-camera @click="emit('preview-camera')">
              <ScanFace class="size-4 shrink-0 text-harbor-icon" aria-hidden="true" />
              <span class="flex-1 text-left">{{ t('meeting.controls.previewCamera') }}</span>
            </button>
          </template>
          <slot name="extra" />
        </div>
      </div>
    </template>

    <template v-else>
      <button
        type="button"
        class="call-button relative"
        :disabled="!available && !warning"
        :aria-label="toggleLabel"
        :data-off="off"
        :data-media-off="off"
        data-media-toggle
        @click="onToggle"
      >
        <template v-if="isAudio"><MicOff v-if="off" /><Mic v-else /></template>
        <template v-else><VideoOff v-if="off" /><Video v-else /></template>
        <span
          v-if="warning"
          aria-hidden="true"
          class="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-harbor-danger text-white [&_svg]:!size-2.5"
          data-media-warning
        >
          <TriangleAlert />
        </span>
      </button>
      <DropdownMenu v-if="variant !== 'toggle'" @update:open="onMenuOpen">
        <DropdownMenuTrigger as-child>
          <button type="button" class="call-button call-button-chevron" :aria-label="menuLabel" data-media-menu-trigger>
            <ChevronUp />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          side="top"
          :side-offset="10"
          class="meeting-menu marketing-font w-72"
          data-media-options
        >
          <DropdownMenuLabel>{{
            t(isAudio ? 'meeting.controls.microphone' : 'meeting.controls.camera')
          }}</DropdownMenuLabel>
          <p v-if="!devices.length" class="px-2 py-1.5 text-sm text-harbor-muted">
            {{ t(isAudio ? 'meeting.controls.noMicrophones' : 'meeting.controls.noCameras') }}
          </p>
          <DropdownMenuRadioGroup :model-value="activeId" @update:model-value="selectDevice">
            <DropdownMenuRadioItem
              v-for="(device, index) in devices"
              :key="device.deviceId"
              :value="device.deviceId"
              :disabled="busy"
              :data-device-option="device.deviceId"
            >
              <span class="truncate">{{ deviceLabel(device, index) }}</span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <template v-if="isAudio">
            <template v-if="canChooseSpeaker && speakers.length">
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{{ t('meeting.controls.speaker') }}</DropdownMenuLabel>
              <DropdownMenuRadioGroup :model-value="speakerId" @update:model-value="selectSpeaker">
                <DropdownMenuRadioItem
                  v-for="(speaker, index) in speakers"
                  :key="speaker.deviceId"
                  :value="speaker.deviceId"
                  :data-speaker-option="speaker.deviceId"
                >
                  <span class="truncate">{{ speaker.label || `${t('meeting.controls.speaker')} ${index + 1}` }}</span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </template>

            <DropdownMenuSeparator />
            <MeetingInputVolume
              :volume-percent="volumePercent"
              :level-percent="levelPercent"
              @change="onVolumeChange"
            />
          </template>

          <template v-else>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-preview-camera @select="emit('preview-camera')">
              <LiquidMenuIcon class="text-harbor-ink" :fallback="ScanFace" />{{ t('meeting.controls.previewCamera') }}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-media-quality-menu>
                <LiquidMenuIcon class="text-harbor-ink" :animated="GaugeAnimated" />{{ t('meeting.controls.quality') }}
                <span class="ml-auto truncate pl-2 text-xs font-normal text-harbor-muted">{{ qualityLabel }}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent class="meeting-menu marketing-font w-64">
                <MeetingQualityOptions
                  :quality="quality"
                  :disabled="busy"
                  :sent-height="sentHeight"
                  @select="changeQuality"
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
      <span class="meeting-tooltip">{{ toggleLabel }}</span>
    </template>
  </div>
</template>
