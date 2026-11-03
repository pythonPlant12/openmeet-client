<script setup lang="ts">
import {
  LayoutGridAnimated,
  MaximizeAnimated,
  MessageSquareAnimated,
  MessageSquareOffAnimated,
  MicAnimated,
  MicOffAnimated,
  MinimizeAnimated,
  PinAnimated,
  PinOffAnimated,
} from '@respeak/lucide-motion-vue';
import { Bug, Check, MoreHorizontal, PhoneOff, ScanFace, Video, VideoOff } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import LiquidMenuIcon from '@/components/ui/liquid-menu/LiquidMenuIcon.vue';
import { buildGitHubIssueUrl } from '@/lib/github-issue';
import type { Participant } from '@/xstate/machines/webrtc/types';

const props = withDefaults(
  defineProps<{
    audioAvailable: boolean;
    context?: boolean;
    isChatOpen: boolean;
    isMuted: boolean;
    isVideoOff: boolean;
    participants: Participant[];
    pinnedParticipantId: string | null;
    videoAvailable: boolean;
    viewMode: 'grid' | 'speaker';
    /** Full screen hides everything but the media; it works in both grid and speaker view. */
    fullscreen?: boolean;
  }>(),
  { context: false, fullscreen: false },
);

const emit = defineEmits<{
  disconnect: [];
  setViewMode: [mode: 'grid' | 'speaker'];
  toggleChat: [];
  toggleMute: [];
  togglePin: [participantId: string];
  toggleVideo: [];
  toggleFullscreen: [];
}>();

const { t } = useI18n();
const MenuRoot = computed(() => (props.context ? ContextMenu : DropdownMenu));
const MenuTrigger = computed(() => (props.context ? ContextMenuTrigger : DropdownMenuTrigger));
const MenuContent = computed(() => (props.context ? ContextMenuContent : DropdownMenuContent));
const MenuItem = computed(() => (props.context ? ContextMenuItem : DropdownMenuItem));
const MenuLabel = computed(() => (props.context ? ContextMenuLabel : DropdownMenuLabel));
const MenuSeparator = computed(() => (props.context ? ContextMenuSeparator : DropdownMenuSeparator));
const reportUrl = buildGitHubIssueUrl('meeting');
</script>

<template>
  <component :is="MenuRoot" :modal="context ? undefined : false">
    <component :is="MenuTrigger" as-child>
      <slot v-if="context" />
      <Button
        v-else
        variant="outline"
        size="icon"
        class="harbor-round-button size-[var(--meeting-control-size)] border-0 [&_svg]:size-[var(--meeting-control-icon)]"
        :aria-label="t('meeting.actions.open')"
      >
        <MoreHorizontal class="size-5" />
      </Button>
    </component>

    <component
      :is="MenuContent"
      v-bind="context ? {} : { align: 'end', sideOffset: 10 }"
      class="w-72 max-w-[calc(100vw-1.5rem)]"
    >
      <component :is="MenuItem" @select="emit('toggleChat')">
        <LiquidMenuIcon v-if="isChatOpen" :animated="MessageSquareOffAnimated" />
        <LiquidMenuIcon v-else :animated="MessageSquareAnimated" />
        {{ t(isChatOpen ? 'meeting.actions.closeChat' : 'meeting.actions.openChat') }}
      </component>

      <component
        :is="MenuItem"
        :disabled="!audioAvailable"
        :variant="isMuted && audioAvailable ? 'default' : 'danger'"
        @select="emit('toggleMute')"
      >
        <LiquidMenuIcon v-if="isMuted && audioAvailable" :animated="MicAnimated" />
        <LiquidMenuIcon v-else :animated="MicOffAnimated" />
        {{
          t(
            !audioAvailable
              ? 'meeting.actions.audioUnavailable'
              : isMuted
                ? 'meeting.actions.unmute'
                : 'meeting.actions.mute',
          )
        }}
      </component>

      <component
        :is="MenuItem"
        :disabled="!videoAvailable"
        :variant="isVideoOff && videoAvailable ? 'default' : 'danger'"
        @select="emit('toggleVideo')"
      >
        <LiquidMenuIcon v-if="isVideoOff && videoAvailable" :fallback="Video" />
        <LiquidMenuIcon v-else :fallback="VideoOff" />
        {{
          t(
            !videoAvailable
              ? 'meeting.actions.videoUnavailable'
              : isVideoOff
                ? 'meeting.actions.startVideo'
                : 'meeting.actions.stopVideo',
          )
        }}
      </component>

      <component :is="MenuSeparator" />
      <component :is="MenuLabel">
        {{ t('meeting.actions.layout') }}
      </component>
      <component
        :is="MenuItem"
        role="menuitemradio"
        :aria-checked="viewMode === 'grid'"
        @select="emit('setViewMode', 'grid')"
      >
        <LiquidMenuIcon :animated="LayoutGridAnimated" />
        <span class="flex-1">{{ t('meeting.actions.grid') }}</span>
        <Check v-if="viewMode === 'grid'" class="size-4 text-harbor-ink" aria-hidden="true" />
      </component>
      <component
        :is="MenuItem"
        role="menuitemradio"
        :aria-checked="viewMode === 'speaker'"
        @select="emit('setViewMode', 'speaker')"
      >
        <LiquidMenuIcon :fallback="ScanFace" />
        <span class="flex-1">{{ t('meeting.actions.speaker') }}</span>
        <Check v-if="viewMode === 'speaker'" class="size-4 text-harbor-ink" aria-hidden="true" />
      </component>

      <component
        :is="MenuItem"
        role="menuitemcheckbox"
        :aria-checked="fullscreen"
        data-fullscreen-toggle
        @select="emit('toggleFullscreen')"
      >
        <LiquidMenuIcon v-if="fullscreen" :animated="MinimizeAnimated" />
        <LiquidMenuIcon v-else :animated="MaximizeAnimated" />
        <span class="flex-1">{{
          t(fullscreen ? 'meeting.actions.exitFullscreen' : 'meeting.actions.fullscreen')
        }}</span>
        <Check v-if="fullscreen" class="size-4 text-harbor-ink" aria-hidden="true" />
      </component>

      <template v-if="viewMode === 'speaker' && participants.length > 1">
        <component :is="MenuLabel" class="mt-1">
          {{ t('meeting.actions.pinParticipant') }}
        </component>
        <component
          :is="MenuItem"
          v-for="participant in participants"
          :key="participant.id"
          role="menuitemcheckbox"
          :aria-checked="pinnedParticipantId === participant.id"
          :aria-label="
            t(pinnedParticipantId === participant.id ? 'meeting.participant.unpin' : 'meeting.participant.pin', {
              name: participant.name,
            })
          "
          @select="emit('togglePin', participant.id)"
        >
          <LiquidMenuIcon v-if="pinnedParticipantId === participant.id" :animated="PinOffAnimated" />
          <LiquidMenuIcon v-else :animated="PinAnimated" />
          <span class="min-w-0 flex-1 truncate">{{ participant.name }}</span>
          <Check v-if="pinnedParticipantId === participant.id" class="size-4 text-harbor-ink" aria-hidden="true" />
        </component>
      </template>

      <component :is="MenuSeparator" />
      <component :is="MenuItem" as-child>
        <a :href="reportUrl" target="_blank" rel="noreferrer">
          <LiquidMenuIcon :fallback="Bug" />
          {{ t('meeting.actions.reportBug') }}
        </a>
      </component>
      <component :is="MenuItem" variant="danger" @select="emit('disconnect')">
        <LiquidMenuIcon :fallback="PhoneOff" />
        {{ t('meeting.actions.disconnect') }}
      </component>
    </component>
  </component>
</template>
