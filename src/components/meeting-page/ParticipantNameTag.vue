<script setup lang="ts">
import { MicOff } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

interface Props {
  name: string;
  isLocal?: boolean;
  muted?: boolean;
  /** While the call controls are hidden the tag shrinks to the mic-off icon. */
  collapsed?: boolean;
  /** Bottom-centre on a phone, bottom-left on desktop. */
  align?: 'start' | 'center';
  compact?: boolean;
  /** Read out to screen readers only. */
  statusLabel?: string;
  /** A phone opens the person's menu from the tag, so it renders as a button. */
  as?: 'div' | 'button';
}

const props = withDefaults(defineProps<Props>(), {
  isLocal: false,
  muted: false,
  collapsed: false,
  align: 'start',
  compact: false,
  statusLabel: '',
  as: 'div',
});
const { t } = useI18n();
</script>

<template>
  <component
    :is="as"
    :type="as === 'button' ? 'button' : undefined"
    data-participant-name-tag
    :data-align="align"
    :data-collapsed="collapsed || undefined"
    :class="[
      'meeting-glass-bubble absolute z-10 flex items-center rounded-lg transition-[padding,opacity] duration-200',
      align === 'center' ? 'left-1/2 -translate-x-1/2' : compact ? 'left-1.5' : 'left-2',
      compact ? 'bottom-1.5 text-[11px]' : 'bottom-2 text-xs',
      collapsed ? 'p-1' : compact ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 px-2 py-0.5',
      compact ? 'max-w-[calc(100%-0.75rem)]' : 'max-w-[calc(100%-3.5rem)]',
      as === 'button'
        ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-faint'
        : 'pointer-events-none',
    ]"
  >
    <MicOff
      v-if="muted"
      data-participant-muted
      :class="compact ? 'size-3' : 'size-3.5'"
      class="shrink-0"
      :aria-label="t('meeting.participant.muted')"
    />
    <template v-if="!props.collapsed">
      <span class="truncate font-medium">{{ name }}</span>
      <span v-if="isLocal" class="shrink-0 text-white/60">{{ t('meeting.you') }}</span>
    </template>
    <span v-if="statusLabel" class="sr-only">{{ t('meeting.participant.status', { status: statusLabel }) }}</span>
  </component>
</template>
