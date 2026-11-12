<script setup lang="ts">
import type { RoundButtonSize, RoundButtonTone } from '.';
import type { PrimitiveProps } from 'reka-ui';
import { Primitive } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = withDefaults(
  defineProps<PrimitiveProps & { tone?: RoundButtonTone; size?: RoundButtonSize; class?: HTMLAttributes['class'] }>(),
  { as: 'button', tone: 'default', size: 'md' },
);

const SIZES: Record<RoundButtonSize, string> = {
  sm: 'size-9 [&_svg]:size-[1.125rem]',
  md: 'size-11 [&_svg]:size-5',
  lg: 'size-12 [&_svg]:size-6',
};

// Filled tones are glass drops, shared with the filled `Button` variants.
const GLASS: Partial<Record<RoundButtonTone, string>> = {
  accent: 'liquid-glass-primary',
  danger: 'liquid-glass-danger',
};
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :type="as === 'button' && !asChild ? 'button' : undefined"
    :data-tone="tone === 'default' ? undefined : tone"
    :class="cn('harbor-round-button shrink-0 [&_svg]:shrink-0', GLASS[tone], SIZES[size], props.class)"
  >
    <slot />
  </Primitive>
</template>
