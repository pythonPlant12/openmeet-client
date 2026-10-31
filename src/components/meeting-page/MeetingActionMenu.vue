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
        class="size-12 rounded-xl border-[#D8E7E3] bg-white/95 text-[#27595D] shadow-[0_12px_35px_rgba(16,47,53,0.14)] backdrop-blur hover:bg-[#E6F4F1] hover:text-[#0B7A75]"
        :aria-label="t('meeting.actions.open')"
      >
        <MoreHorizontal class="size-5" />
      </Button>
    </component>

    <component
      :is="MenuContent"
      v-bind="context ? {} : { align: 'end', sideOffset: 10 }"
      class="harbor-action-menu w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-[1.25rem] p-2 text-[#102F35]"
    >
      <component
        :is="MenuItem"
        class="min-h-11 cursor-pointer rounded-xl px-3 py-2.5 focus:bg-[#E6F4F1] focus:text-[#102F35]"
        @select="emit('toggleChat')"
      >
        <LiquidMenuIcon v-if="isChatOpen" :animated="MessageSquareOffAnimated" />
        <LiquidMenuIcon v-else :animated="MessageSquareAnimated" />
        {{ t(isChatOpen ? 'meeting.actions.closeChat' : 'meeting.actions.openChat') }}
      </component>

      <component
        :is="MenuItem"
        :disabled="!audioAvailable"
        class="harbor-context-menu-danger min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-[#C4513D]"
        :class="{ 'bg-[#FFF0EA]': isMuted }"
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
        class="harbor-context-menu-danger min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-[#C4513D]"
        :class="{ 'bg-[#FFF0EA]': isVideoOff }"
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

      <component :is="MenuSeparator" class="mx-1 my-2 bg-[#E5EFEC]" />
      <component :is="MenuLabel" class="px-3 py-1 text-xs uppercase tracking-[0.12em] text-[#61777B]">
        {{ t('meeting.actions.layout') }}
      </component>
      <component
        :is="MenuItem"
        role="menuitemradio"
        :aria-checked="viewMode === 'grid'"
        class="min-h-11 cursor-pointer rounded-xl px-3 py-2.5 focus:bg-[#E6F4F1] focus:text-[#102F35]"
        @select="emit('setViewMode', 'grid')"
      >
        <LiquidMenuIcon :animated="LayoutGridAnimated" />
        <span class="flex-1">{{ t('meeting.actions.grid') }}</span>
        <Check v-if="viewMode === 'grid'" class="size-4 text-[#0B7A75]" aria-hidden="true" />
      </component>
      <component
        :is="MenuItem"
        role="menuitemradio"
        :aria-checked="viewMode === 'speaker'"
        class="min-h-11 cursor-pointer rounded-xl px-3 py-2.5 focus:bg-[#E6F4F1] focus:text-[#102F35]"
        @select="emit('setViewMode', 'speaker')"
      >
        <LiquidMenuIcon :fallback="ScanFace" />
        <span class="flex-1">{{ t('meeting.actions.speaker') }}</span>
        <Check v-if="viewMode === 'speaker'" class="size-4 text-[#0B7A75]" aria-hidden="true" />
      </component>

      <component
        :is="MenuItem"
        role="menuitemcheckbox"
        :aria-checked="fullscreen"
        data-fullscreen-toggle
        class="min-h-11 cursor-pointer rounded-xl px-3 py-2.5 focus:bg-[#E6F4F1] focus:text-[#102F35]"
        @select="emit('toggleFullscreen')"
      >
        <LiquidMenuIcon v-if="fullscreen" :animated="MinimizeAnimated" />
        <LiquidMenuIcon v-else :animated="MaximizeAnimated" />
        <span class="flex-1">{{
          t(fullscreen ? 'meeting.actions.exitFullscreen' : 'meeting.actions.fullscreen')
        }}</span>
        <Check v-if="fullscreen" class="size-4 text-[#0B7A75]" aria-hidden="true" />
      </component>

      <template v-if="viewMode === 'speaker' && participants.length > 1">
        <component :is="MenuLabel" class="mt-1 px-3 py-1 text-xs uppercase tracking-[0.12em] text-[#61777B]">
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
          class="min-h-11 cursor-pointer rounded-xl px-3 py-2.5 focus:bg-[#E6F4F1] focus:text-[#102F35]"
          @select="emit('togglePin', participant.id)"
        >
          <LiquidMenuIcon v-if="pinnedParticipantId === participant.id" :animated="PinOffAnimated" />
          <LiquidMenuIcon v-else :animated="PinAnimated" />
          <span class="min-w-0 flex-1 truncate">{{ participant.name }}</span>
          <Check v-if="pinnedParticipantId === participant.id" class="size-4 text-[#0B7A75]" aria-hidden="true" />
        </component>
      </template>

      <component :is="MenuSeparator" class="mx-1 my-2 bg-[#E5EFEC]" />
      <component
        :is="MenuItem"
        as-child
        class="min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-[#C4513D] focus:bg-[#FFF0EA] focus:text-[#A94332]"
      >
        <a :href="reportUrl" target="_blank" rel="noreferrer">
          <LiquidMenuIcon :fallback="Bug" />
          {{ t('meeting.actions.reportBug') }}
        </a>
      </component>
      <component
        :is="MenuItem"
        class="min-h-11 cursor-pointer rounded-xl px-3 py-2.5 font-semibold text-[#C4513D] focus:bg-[#FFF0EA] focus:text-[#A94332]"
        @select="emit('disconnect')"
      >
        <LiquidMenuIcon :fallback="PhoneOff" />
        {{ t('meeting.actions.disconnect') }}
      </component>
    </component>
  </component>
</template>
