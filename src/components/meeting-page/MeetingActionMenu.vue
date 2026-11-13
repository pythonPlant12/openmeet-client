<script setup lang="ts">
import { LayoutGridAnimated, PinAnimated, PinOffAnimated, UserRoundPlusAnimated } from '@respeak/lucide-motion-vue';
import { Bug, Check, Code, Crop, MicOff, MonitorOff, MonitorUp, MoreVertical, ScanFace, Users } from 'lucide-vue-next';
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import LiquidMenuIcon from '@/components/ui/liquid-menu/LiquidMenuIcon.vue';
import { buildGitHubIssueUrl } from '@/lib/github-issue';
import { playHaptic } from '@/services/haptics';
import type { Participant } from '@/xstate/machines/webrtc/types';

import CallInviteMenuItems from './CallInviteMenuItems.vue';

// The desktop controls bar's ⋮ menu, home of the rarer call actions: screen share, invite, layout, pin
// participant, participants, dev tools and report bug. With `context` it is instead the tile area's layout menu.
const props = withDefaults(
  defineProps<{
    participants: Participant[];
    pinnedParticipantId: string | null;
    viewMode: 'grid' | 'speaker';
    /** Wraps the tile area: a right-click or long-press there opens the layout menu (Grid and Speaker). */
    context?: boolean;
    meetingId?: string;
    inviteMode?: 'enabled' | 'signedOut' | 'hidden';
    /** Browsers without screen capture get no screen share items. */
    canPresent?: boolean;
    canSelectArea?: boolean;
    isPresenting?: boolean;
    showConnectionStatus?: boolean;
  }>(),
  {
    context: false,
    meetingId: '',
    inviteMode: 'hidden',
    canPresent: false,
    canSelectArea: false,
    isPresenting: false,
    showConnectionStatus: false,
  },
);

const emit = defineEmits<{
  setViewMode: [mode: 'grid' | 'speaker'];
  togglePin: [participantId: string];
  invite: [];
  startScreenShare: [options?: { selectArea: boolean }];
  stopScreenShare: [];
  toggleStats: [];
  openChange: [open: boolean];
}>();

const { t } = useI18n();
const MenuRoot = computed(() => (props.context ? ContextMenu : DropdownMenu));
const MenuTrigger = computed(() => (props.context ? ContextMenuTrigger : DropdownMenuTrigger));
const MenuContent = computed(() => (props.context ? ContextMenuContent : DropdownMenuContent));
const MenuItem = computed(() => (props.context ? ContextMenuItem : DropdownMenuItem));
const MenuLabel = computed(() => (props.context ? ContextMenuLabel : DropdownMenuLabel));
const MenuSeparator = computed(() => (props.context ? ContextMenuSeparator : DropdownMenuSeparator));
const reportUrl = buildGitHubIssueUrl('meeting');
// Screen shares are pinnable tiles, but only people are listed as participants.
const people = computed(() => props.participants.filter((participant) => !participant.screenShareOf));

function handleOpenChange(open: boolean) {
  emit('openChange', open);
  if (open && props.context) playHaptic('medium');
}
</script>

<template>
  <component :is="MenuRoot" :modal="context ? undefined : false" @update:open="handleOpenChange">
    <component :is="MenuTrigger" as-child>
      <slot v-if="context" />
      <Button
        v-else
        variant="secondary"
        size="icon"
        class="meeting-control size-[var(--meeting-control-size)] rounded-full border-0 bg-transparent text-harbor-ink shadow-none [&_svg]:size-[var(--meeting-control-icon)]"
        :aria-label="t('meeting.actions.open')"
      >
        <MoreVertical class="size-5" />
      </Button>
    </component>

    <component
      :is="MenuContent"
      v-bind="context ? {} : { align: 'end', side: 'top', sideOffset: 10 }"
      class="w-72 max-w-[calc(100vw-1.5rem)]"
    >
      <template v-if="!context">
        <DropdownMenuSub v-if="canPresent">
          <DropdownMenuSubTrigger data-menu-screen-share>
            <LiquidMenuIcon :fallback="MonitorUp" />{{ t('meeting.actions.screenShare') }}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent class="meeting-menu marketing-font w-72">
            <DropdownMenuItem v-if="isPresenting" variant="danger" @select="emit('stopScreenShare')">
              <LiquidMenuIcon :fallback="MonitorOff" />{{ t('meeting.controls.stopPresenting') }}
            </DropdownMenuItem>
            <template v-else>
              <DropdownMenuItem @select="emit('startScreenShare')">
                <LiquidMenuIcon :fallback="MonitorUp" />{{ t('meeting.controls.startPresenting') }}
              </DropdownMenuItem>
              <DropdownMenuItem v-if="canSelectArea" @select="emit('startScreenShare', { selectArea: true })">
                <LiquidMenuIcon :fallback="Crop" />{{ t('meeting.controls.presentArea') }}
              </DropdownMenuItem>
            </template>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-menu-invite>
            <LiquidMenuIcon :animated="UserRoundPlusAnimated" />{{ t('meeting.actions.invite') }}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent class="meeting-menu marketing-font w-60">
            <CallInviteMenuItems :meeting-id="meetingId" :invite-mode="inviteMode" @invite="emit('invite')" />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <component :is="MenuSeparator" />
      </template>

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

      <template v-if="!context">
        <DropdownMenuSub v-if="participants.length > 1">
          <DropdownMenuSubTrigger data-menu-pin>
            <LiquidMenuIcon :animated="PinAnimated" />{{ t('meeting.actions.pinParticipant') }}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent class="meeting-menu marketing-font w-64">
            <DropdownMenuItem
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
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-menu-participants>
            <LiquidMenuIcon :fallback="Users" />{{ t('meeting.actions.participantsCount', { count: people.length }) }}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent class="meeting-menu marketing-font w-64">
            <DropdownMenuLabel
              v-for="participant in people"
              :key="participant.id"
              class="flex items-center gap-2 font-normal"
              data-participant-entry
            >
              <span class="min-w-0 flex-1 truncate">
                {{ participant.name }}
                <span v-if="participant.isLocal" class="text-harbor-muted">{{ t('meeting.you') }}</span>
              </span>
              <MicOff v-if="!participant.audioEnabled" class="size-4 shrink-0 text-harbor-danger" />
            </DropdownMenuLabel>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          role="menuitemcheckbox"
          :aria-checked="showConnectionStatus"
          data-menu-dev-tools
          @select="emit('toggleStats')"
        >
          <LiquidMenuIcon :fallback="Code" />
          <span class="flex-1">{{ t('meeting.actions.devTools') }}</span>
          <Check v-if="showConnectionStatus" class="size-4 text-harbor-ink" aria-hidden="true" />
        </DropdownMenuItem>
        <DropdownMenuItem as-child>
          <a :href="reportUrl" target="_blank" rel="noreferrer">
            <LiquidMenuIcon :fallback="Bug" />
            {{ t('meeting.actions.reportBug') }}
          </a>
        </DropdownMenuItem>
      </template>
    </component>
  </component>
</template>
