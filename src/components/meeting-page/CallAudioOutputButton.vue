<script setup lang="ts">
import { Volume2 } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMeetingMediaSettings } from '@/composables/useMeetingMediaSettings';
import {
  type AudioRoute,
  type AudioRouteMode,
  getAudioRouteMode,
  listAudioRoutes,
  setAudioRoute,
  showSystemAudioRoutePicker,
} from '@/services/audio-route';
import { playHaptic } from '@/services/haptics';

// The phone top bar's audio output: the system route picker in the iOS app, the device's outputs in the Android
// app, a Speaker menu in browsers that can switch outputs, and nothing where none of these exist.
const { t } = useI18n();
const mode = ref<AudioRouteMode | null>(null);
const routes = ref<AudioRoute[]>([]);
const { speakers, speakerId, refresh, changeSpeaker } = useMeetingMediaSettings('audio');

onMounted(async () => {
  mode.value = await getAudioRouteMode();
});

function openPicker() {
  playHaptic('medium');
  void showSystemAudioRoutePicker();
}

async function onMenuOpen(open: boolean) {
  if (!open) return;
  playHaptic('medium');
  if (mode.value === 'list') routes.value = await listAudioRoutes();
  else await refresh();
}

function selectRoute(id: unknown) {
  if (typeof id !== 'string') return;
  routes.value = routes.value.map((route) => ({ ...route, selected: route.id === id }));
  void setAudioRoute(id);
}

function selectSpeaker(deviceId: unknown) {
  if (typeof deviceId === 'string') void changeSpeaker(deviceId);
}
</script>

<template>
  <button
    v-if="mode === 'picker'"
    type="button"
    class="call-button call-chip size-11"
    :aria-label="t('meeting.controls.audioOutput')"
    @click="openPicker"
  >
    <Volume2 />
  </button>
  <DropdownMenu v-else-if="mode" @update:open="onMenuOpen">
    <DropdownMenuTrigger as-child>
      <button type="button" class="call-button call-chip size-11" :aria-label="t('meeting.controls.audioOutput')">
        <Volume2 />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" :side-offset="10" class="meeting-menu marketing-font w-64">
      <DropdownMenuLabel>{{ t('meeting.controls.speaker') }}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        v-if="mode === 'list'"
        :model-value="routes.find((route) => route.selected)?.id"
        @update:model-value="selectRoute"
      >
        <DropdownMenuRadioItem v-for="route in routes" :key="route.id" :value="route.id">
          <span class="truncate">{{ route.name }}</span>
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuRadioGroup v-else :model-value="speakerId" @update:model-value="selectSpeaker">
        <DropdownMenuRadioItem v-for="(speaker, index) in speakers" :key="speaker.deviceId" :value="speaker.deviceId">
          <span class="truncate">{{ speaker.label || `${t('meeting.controls.speaker')} ${index + 1}` }}</span>
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
