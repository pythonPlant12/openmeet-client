<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { computed, onMounted, onUnmounted, ref, useId, watch } from 'vue';

import {
  LIQUID_PAD,
  type LiquidGl,
  addRipple,
  createLiquidState,
  initLiquidGl,
  isLiquidActive,
  liquidFallbackBox,
  renderLiquid,
  setLiquidTarget,
  stepLiquid,
  supportsLiquidRefraction,
} from '@/lib/liquid-glass';

/**
 * A liquid glass surface: a frosted pill with one liquid drop that sits on an item inside it. Items are any
 * descendants marked `data-liquid-key`, so controls that live in other components (menu triggers, buttons)
 * can join without the surface knowing what they are.
 */
const props = withDefaults(
  defineProps<{
    tag?: 'div' | 'nav';
    // The item the drop rests on when the pointer is not over one; null hides the drop.
    targetKey: string | null;
    // With a mouse, the drop follows the hovered item and returns when the pointer leaves the surface.
    followHover?: boolean;
    // Changes when items are added, removed, or resized without the surface's width changing.
    measureKey?: string;
  }>(),
  { tag: 'div', followHover: false, measureKey: '' },
);

defineSlots<{ default: (props: { targetKey: string | null }) => unknown }>();

const filterId = `liquid-refract-${useId()}`;
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const rootRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const dropRef = ref<HTMLElement | null>(null);
const glMode = ref<'on' | 'off'>('on');
const refraction = ref(false);
const hoveredKey = ref<string | null>(null);
// Where the drop sits: the hovered item, else the parent's target.
const effectiveKey = computed(() => hoveredKey.value ?? props.targetKey);
const hasTarget = ref(false);

const state = createLiquidState();
let glc: LiquidGl | null = null;
let raf = 0;
let lastFrame = 0;
let visible = true;
let observedWidth = -1;
let resizeObserver: ResizeObserver | undefined;
let intersectionObserver: IntersectionObserver | undefined;

const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);

function render() {
  if (glc) {
    renderLiquid(state, glc, pixelRatio());
  } else if (dropRef.value) {
    const box = liquidFallbackBox(state);
    dropRef.value.style.width = `${box.width}px`;
    dropRef.value.style.height = `${box.height}px`;
    dropRef.value.style.transform = `translate(${box.left}px, ${box.top}px) scaleY(${box.scaleY})`;
  }
}

// The loop runs only while the drop moves, ripples, or follows the pointer, so an idle surface costs nothing.
function startLoop() {
  if (raf || typeof requestAnimationFrame === 'undefined') return;
  lastFrame = performance.now();
  const tick = (now: number) => {
    const dt = Math.min((now - lastFrame) / 1000, 1 / 30);
    lastFrame = now;
    stepLiquid(state, dt);
    render();
    raf = visible && isLiquidActive(state) ? requestAnimationFrame(tick) : 0;
  };
  raf = requestAnimationFrame(tick);
}

function findItem(key: string | null) {
  if (!key || !rootRef.value) return null;
  return (
    [...rootRef.value.querySelectorAll<HTMLElement>('[data-liquid-key]')].find(
      (element) => element.dataset.liquidKey === key,
    ) ?? null
  );
}

// Item boxes are measured against the surface, whatever wrappers sit between them.
function itemBox(root: HTMLElement, item: HTMLElement) {
  const rootRect = root.getBoundingClientRect();
  const rect = item.getBoundingClientRect();
  const scale = root.offsetWidth ? rootRect.width / root.offsetWidth : 1;
  return {
    left: (rect.left - rootRect.left) / (scale || 1) - root.clientLeft,
    top: (rect.top - rootRect.top) / (scale || 1) - root.clientTop,
    width: item.offsetWidth,
    height: item.offsetHeight,
  };
}

function measure() {
  const root = rootRef.value;
  const item = findItem(effectiveKey.value);
  hasTarget.value = !!item;
  if (!root || !item) {
    state.ready = false;
    return;
  }
  setLiquidTarget(state, { width: root.offsetWidth, height: root.offsetHeight }, itemBox(root, item));
  const canvas = canvasRef.value;
  if (canvas) {
    const dpr = pixelRatio();
    const width = state.w + LIQUID_PAD * 2;
    const height = state.h + LIQUID_PAD * 2;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
  }
  startLoop();
}

function localPoint(clientX: number, clientY: number) {
  const rect = rootRef.value!.getBoundingClientRect();
  return { x: clientX - rect.left + LIQUID_PAD, y: clientY - rect.top + LIQUID_PAD };
}

function handlePointerMove(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return;
  if (props.followHover) {
    const item = (event.target as Element | null)?.closest<HTMLElement>('[data-liquid-key]');
    // Between items the drop stays on the last hovered one instead of jumping back and forth.
    if (item && !item.matches(':disabled, [aria-disabled="true"]')) hoveredKey.value = item.dataset.liquidKey ?? null;
  }
  const point = localPoint(event.clientX, event.clientY);
  state.mouse.x = point.x;
  state.mouse.y = point.y;
  state.mouse.on = true;
  startLoop();
}

function handlePointerLeave() {
  hoveredKey.value = null;
  state.mouse.on = false;
  startLoop();
}

function handlePointerDown(event: PointerEvent) {
  const point = localPoint(event.clientX, event.clientY);
  addRipple(state, point.x, point.y, 0.8);
  startLoop();
}

function handleContextLost(event: Event) {
  event.preventDefault();
  glc = null;
  glMode.value = 'off';
}

function handleVisibilityChange() {
  visible = document.visibilityState === 'visible';
  if (visible) startLoop();
}

watch([effectiveKey, () => props.measureKey], () => measure(), { flush: 'post' });
watch(prefersReducedMotion, (reduce) => (state.reduce = reduce), { immediate: true });

onMounted(() => {
  refraction.value =
    supportsLiquidRefraction() && !window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches;
  const canvas = canvasRef.value;
  glc = canvas ? initLiquidGl(canvas) : null;
  if (!glc) glMode.value = 'off';
  canvas?.addEventListener('webglcontextlost', handleContextLost);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  if ('IntersectionObserver' in window && rootRef.value) {
    intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) startLoop();
    });
    intersectionObserver.observe(rootRef.value);
  }
  if ('ResizeObserver' in window && rootRef.value) {
    // A new width moves every item, so the drop jumps to its new place instead of sliding there.
    resizeObserver = new ResizeObserver(() => {
      const width = rootRef.value?.offsetWidth ?? 0;
      if (width === observedWidth) return;
      observedWidth = width;
      state.ready = false;
      measure();
    });
    resizeObserver.observe(rootRef.value);
  }
  measure();
});

onUnmounted(() => {
  canvasRef.value?.removeEventListener('webglcontextlost', handleContextLost);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  intersectionObserver?.disconnect();
  resizeObserver?.disconnect();
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  // Browsers cap live WebGL contexts, and surfaces remount when layouts switch breakpoints.
  glc?.gl.getExtension('WEBGL_lose_context')?.loseContext();
  glc = null;
});
</script>

<template>
  <component
    :is="tag"
    ref="rootRef"
    class="liquid-surface"
    :data-gl="glMode"
    :data-refract="refraction ? 'on' : 'off'"
    :data-idle="hasTarget ? undefined : 'true'"
    @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave"
    @pointerdown="handlePointerDown"
  >
    <svg width="0" height="0" class="absolute" aria-hidden="true">
      <filter :id="filterId" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" base-frequency="0.006 0.02" num-octaves="2" seed="7" result="noise" />
        <feGaussianBlur in="noise" std-deviation="2" result="soft" />
        <feDisplacementMap in="SourceGraphic" in2="soft" scale="60" x-channel-selector="R" y-channel-selector="G" />
      </filter>
    </svg>
    <span
      class="liquid-surface-glass liquid-glass-surface"
      :style="
        refraction
          ? {
              backdropFilter: `url(#${filterId}) blur(2px) saturate(1.2) brightness(1.04)`,
              WebkitBackdropFilter: `url(#${filterId}) blur(2px) saturate(1.2) brightness(1.04)`,
            }
          : undefined
      "
      aria-hidden="true"
    />
    <canvas ref="canvasRef" class="liquid-surface-water" aria-hidden="true" />
    <span ref="dropRef" class="liquid-surface-drop" aria-hidden="true" />
    <slot :target-key="hasTarget ? effectiveKey : null" />
  </component>
</template>

<!-- Not scoped: items come from the parent's slot and other components. -->
<style>
.liquid-surface {
  position: relative;
  isolation: isolate;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.liquid-surface-glass {
  position: absolute;
  inset: 0;
  z-index: -2;
  overflow: hidden;
  border-radius: inherit;
}

.liquid-surface-water {
  position: absolute;
  top: -14px;
  left: -14px;
  z-index: -1;
  pointer-events: none;
}

.liquid-surface-drop {
  display: none;
  position: absolute;
  top: 0;
  left: 0;
  z-index: -1;
  border-radius: 999px;
  pointer-events: none;
  will-change: transform, width, height;
  background:
    radial-gradient(120% 140% at 30% 0%, rgb(255 255 255 / 0.85), rgb(255 255 255 / 0) 55%), rgb(230 244 241 / 0.75);
  box-shadow:
    inset 0 1px 1px rgb(255 255 255 / 0.95),
    inset 0 -2px 6px rgb(11 122 117 / 0.18),
    inset 0 0 0 1px rgb(216 231 227 / 0.9),
    0 6px 16px -6px rgb(16 47 53 / 0.35);
}

.liquid-surface[data-gl='off'] .liquid-surface-water {
  display: none;
}

.liquid-surface[data-gl='off'] .liquid-surface-drop {
  display: block;
}

.liquid-surface[data-idle='true'] .liquid-surface-water,
.liquid-surface[data-idle='true'] .liquid-surface-drop {
  visibility: hidden;
}

/* Items sit above the glass and the drop. */
.liquid-surface [data-liquid-key] {
  position: relative;
  z-index: 1;
}
</style>
