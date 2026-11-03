<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

// Attributes and listeners go to the row's button, so a context menu trigger can wrap the whole row.
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    as?: string;
    selected?: boolean;
    /** Keeps the hover actions shown, for example while the row's menu is open. */
    actionsVisible?: boolean;
    /** `replace` swaps the time for the actions; `beside` keeps the time and shows a small action next to it. */
    actionsPlacement?: 'replace' | 'beside';
    class?: HTMLAttributes['class'];
  }>(),
  { as: 'button', actionsPlacement: 'replace' },
);
</script>

<template>
  <!-- One list entry: avatar, title with a time or detail on the right, and a gray second line. A line under the
       text separates rows; it starts after the avatar. Pointer devices reveal the `actions` slot on hover. -->
  <div class="group/row relative" :data-actions-visible="actionsVisible || undefined">
    <component
      :is="as"
      v-bind="$attrs"
      :type="as === 'button' ? 'button' : undefined"
      :aria-current="selected ? 'page' : undefined"
      :class="
        cn(
          'flex w-full items-center gap-3 rounded-xl px-3 text-left text-harbor-ink transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harbor-subtle disabled:cursor-default [@media(hover:hover)]:hover:bg-harbor-hover/60',
          selected && '!bg-harbor-hover',
          props.class,
        )
      "
    >
      <span v-if="$slots.avatar" class="shrink-0 py-2.5"><slot name="avatar" /></span
      ><span class="min-w-0 flex-1 self-stretch border-b border-harbor-line py-2.5"
        ><span class="flex items-baseline gap-2"
          ><span class="min-w-0 flex-1 truncate text-base font-semibold leading-6"><slot /></span
          ><span
            v-if="$slots.meta"
            class="shrink-0 text-xs tabular-nums text-harbor-muted transition-[opacity,margin] duration-150"
            :class="
              $slots.actions &&
              (actionsPlacement === 'replace'
                ? [
                    '[@media(hover:hover)_and_(pointer:fine)]:group-hover/row:opacity-0',
                    { '[@media(hover:hover)_and_(pointer:fine)]:opacity-0': actionsVisible },
                  ]
                : [
                    '[@media(hover:hover)_and_(pointer:fine)]:group-hover/row:mr-7',
                    { '[@media(hover:hover)_and_(pointer:fine)]:mr-7': actionsVisible },
                  ])
            "
            ><slot name="meta" /></span></span
        ><span v-if="$slots.subtitle || $slots.trailing" class="mt-0.5 flex min-h-5 items-center gap-2"
          ><span class="flex min-w-0 flex-1 items-center gap-1 truncate text-sm leading-5 text-harbor-muted"
            ><slot name="subtitle" /></span
          ><slot name="trailing" /></span></span
      ><slot name="end" />
    </component>
    <!-- Hover actions sit beside the button, not inside it, so they stay separate controls. -->
    <div
      v-if="$slots.actions"
      data-list-row-actions
      class="absolute hidden items-center gap-1 [@media(hover:hover)_and_(pointer:fine)]:group-hover/row:flex"
      :class="[
        actionsPlacement === 'replace' ? 'right-3 top-1/2 -translate-y-1/2' : 'right-2 top-3',
        { '[@media(hover:hover)_and_(pointer:fine)]:flex': actionsVisible },
      ]"
    >
      <slot name="actions" />
    </div>
  </div>
</template>
