<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { type Component, computed, nextTick, onUnmounted, ref } from 'vue';
import { type RouteLocationRaw, RouterLink } from 'vue-router';

import LiquidGlassSurface from '@/components/layout/LiquidGlassSurface.vue';

export interface LiquidTab {
  key: string;
  label: string;
  // An animated icon from @respeak/lucide-motion-vue; custom items render their own content.
  icon?: Component;
  to?: RouteLocationRaw;
  // Primary items are actions, set apart by a green glass rim.
  variant?: 'primary';
  disabled?: boolean;
  // Custom items render through the `item-<key>` slot, which receives `attrs` to bind on the control.
  custom?: boolean;
}

const props = withDefaults(
  defineProps<{
    items: LiquidTab[];
    activeKey: string | null;
    label: string;
    // Compact bars show icons only; labels stay available to assistive technology.
    compact?: boolean;
    // Small bars suit pointer layouts; phones keep the 44px touch targets of the medium size.
    size?: 'sm' | 'md';
    // An item the drop shows instead of the active page, such as one whose menu is open.
    highlightKey?: string | null;
    // With a mouse, the drop follows the hovered item and returns when the pointer leaves the bar.
    followHover?: boolean;
  }>(),
  { compact: false, size: 'md', highlightKey: null, followHover: false },
);

const emit = defineEmits<{ select: [key: string] }>();

defineSlots<
  Record<`item-${string}`, (props: { item: LiquidTab; attrs: Record<string, unknown>; pressed: boolean }) => unknown>
>();

// One icon press animation runs for roughly this long before the icon returns to rest.
const ICON_PRESS_DURATION = 900;

const supportsHover = useMediaQuery('(hover: hover) and (pointer: fine)');
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const barRef = ref<{ $el: HTMLElement } | null>(null);
const pressedKey = ref<string | null>(null);
let pressTimer: number | undefined;
// Re-measures the drop when items change, or when labels appear or hide.
const measureKey = computed(() => `${props.items.map((item) => item.key).join()}|${props.compact}|${props.size}`);

function playIconPress(key: string) {
  if (prefersReducedMotion.value) return;
  window.clearTimeout(pressTimer);
  // Resetting first lets a second press on the same tab replay the animation.
  pressedKey.value = null;
  void nextTick(() => {
    pressedKey.value = key;
    pressTimer = window.setTimeout(() => (pressedKey.value = null), ICON_PRESS_DURATION);
  });
}

function handleSelect(item: LiquidTab) {
  if (item.disabled) return;
  playIconPress(item.key);
  emit('select', item.key);
}

function itemAttrs(item: LiquidTab, targetKey: string | null) {
  return {
    class: 'liquid-tab',
    'data-tab': item.key,
    'data-liquid-key': item.key,
    'data-variant': item.variant,
    'data-targeted': item.key === targetKey ? 'true' : undefined,
    'data-pressed': pressedKey.value === item.key ? 'true' : undefined,
    'aria-current': item.key === props.activeKey ? 'page' : undefined,
    'aria-label': props.compact ? item.label : undefined,
    title: props.compact ? item.label : undefined,
    onClick: () => handleSelect(item),
  };
}

// Arrow keys move focus between items; Enter or Space activates the focused one.
function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  const elements = [...(barRef.value?.$el.querySelectorAll<HTMLElement>('[data-tab]') ?? [])];
  const current = elements.findIndex((element) => element === document.activeElement);
  if (current < 0) return;
  event.preventDefault();
  elements[(current + (event.key === 'ArrowRight' ? 1 : -1) + elements.length) % elements.length]?.focus();
}

onUnmounted(() => window.clearTimeout(pressTimer));
</script>

<template>
  <LiquidGlassSurface
    ref="barRef"
    v-slot="{ targetKey }"
    tag="nav"
    class="liquid-tab-bar"
    :target-key="highlightKey ?? activeKey"
    :follow-hover="followHover"
    :measure-key="measureKey"
    :data-compact="compact ? 'true' : 'false'"
    :data-size="size"
    :aria-label="label"
    @keydown="handleKeydown"
  >
    <template v-for="item in items" :key="item.key">
      <slot
        v-if="item.custom"
        :name="`item-${item.key}`"
        :item="item"
        :attrs="itemAttrs(item, targetKey)"
        :pressed="pressedKey === item.key"
      />
      <component
        :is="item.to ? RouterLink : 'button'"
        v-else
        v-bind="{
          ...itemAttrs(item, targetKey),
          ...(item.to ? { to: item.to } : { type: 'button', disabled: item.disabled }),
        }"
      >
        <span class="liquid-tab-icon">
          <component
            :is="item.icon"
            v-if="item.icon"
            :size="size === 'sm' ? 18 : 20"
            :stroke-width="1.9"
            :animate="pressedKey === item.key"
            :animate-on-hover="supportsHover && !prefersReducedMotion"
            trigger-target="closest:.liquid-tab"
            aria-hidden="true"
          />
        </span>
        <span class="liquid-tab-label">{{ item.label }}</span>
      </component>
    </template>
  </LiquidGlassSurface>
</template>

<!-- Not scoped: custom items come from the parent's slot and still need the tab styles. -->
<style>
.liquid-tab-bar {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 6px;
  border-radius: 999px;
}

.liquid-tab {
  position: relative;
  z-index: 1;
  display: inline-flex;
  height: 44px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  color: #27595d;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.01em;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 0.25s,
    background-color 0.25s;
}

.liquid-tab[aria-current='page'],
.liquid-tab[data-state='open'] {
  color: #102f35;
}

/* Primary actions read like the other items, set apart by a green glass rim. The rim is strongest at rest and
   fades while the drop sits on the item, so the drop takes over as its highlight. */
.liquid-tab[data-variant='primary'] {
  margin-left: 4px;
  color: #0b7a75;
  background: rgb(230 244 241 / 0.35);
  box-shadow:
    inset 0 0 0 1.5px rgb(11 122 117 / 0.55),
    inset 0 1px 1px rgb(255 255 255 / 0.85);
  transition:
    color 0.25s,
    background-color 0.25s,
    box-shadow 0.25s;
}

.liquid-tab[data-variant='primary'][data-targeted='true'] {
  color: #08635f;
  background: transparent;
  box-shadow: inset 0 0 0 1px rgb(11 122 117 / 0.22);
}

.liquid-tab:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (hover: hover) and (pointer: fine) {
  .liquid-tab:hover {
    color: #102f35;
  }

  .liquid-tab:hover .liquid-tab-avatar {
    transform: scale(1.08);
  }
}

.liquid-tab:focus-visible {
  outline: 2px solid #0b7a75;
  outline-offset: 2px;
}

.liquid-tab-icon {
  display: inline-flex;
  flex: none;
  transition: transform 0.45s cubic-bezier(0.3, 1.6, 0.5, 1);
}

.liquid-tab[aria-current='page'] .liquid-tab-icon {
  transform: translateY(-1px) scale(1.08);
}

/* A rounded picture used as a tab icon, such as the account avatar, shown as a small glass bubble. */
.liquid-tab-avatar {
  position: relative;
  display: inline-flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgb(230 244 241 / 0.75);
  box-shadow:
    0 0 0 2px rgb(255 255 255 / 0.65),
    0 0 0 3px rgb(216 231 227 / 0.8),
    0 4px 10px -4px rgb(16 47 53 / 0.4);
  transition: transform 0.35s cubic-bezier(0.3, 1.6, 0.5, 1);
}

.liquid-tab-avatar::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(120% 90% at 30% 0%, rgb(255 255 255 / 0.5), rgb(255 255 255 / 0) 55%);
  box-shadow:
    inset 0 1px 1px rgb(255 255 255 / 0.8),
    inset 0 -2px 4px rgb(16 47 53 / 0.18);
  pointer-events: none;
}

/* The status dot sits on top of the glass sheen. */
.liquid-tab-avatar > span {
  z-index: 1;
}

.liquid-tab-bar[data-size='sm'] {
  padding: 4px;
}

.liquid-tab-bar[data-size='sm'] .liquid-tab {
  height: 36px;
  padding: 0 14px;
}

.liquid-tab-bar[data-size='sm'] .liquid-tab-avatar {
  width: 22px;
  height: 22px;
}

.liquid-tab-avatar img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.liquid-tab[data-pressed='true'] .liquid-tab-avatar {
  animation: liquid-tab-pop 0.5s cubic-bezier(0.3, 1.6, 0.5, 1);
}

@keyframes liquid-tab-pop {
  0% {
    transform: scale(0.78);
  }
  60% {
    transform: scale(1.16);
  }
  100% {
    transform: scale(1);
  }
}

.liquid-tab-bar[data-compact='true'] .liquid-tab {
  min-width: 56px;
  padding: 0 14px;
}

.liquid-tab-bar[data-compact='true'] .liquid-tab-label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .liquid-tab,
  .liquid-tab-icon,
  .liquid-tab-avatar {
    transition: none;
    animation: none;
  }
}
</style>
