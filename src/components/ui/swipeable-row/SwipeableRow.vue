<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { animate } from 'motion-v';
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { activeSwipeRowId } from './state';

// Horizontal swipe row: touch, pen, mouse drag, and trackpad horizontal scroll all move the content to
// reveal leading (swipe right) or trailing (swipe left) actions. Vertical movement stays native scrolling.
const props = withDefaults(
  defineProps<{
    id: string;
    leadingWidth?: number;
    trailingWidth?: number;
    fullSwipeLeading?: boolean;
    fullSwipeTrailing?: boolean;
    /** Distance that arms a full swipe; defaults to half the row (at least two action widths). */
    fullSwipeDistance?: number;
    /** One-shot rows never rest open: a release either runs the full-swipe action or springs back. */
    momentary?: boolean;
    disabled?: boolean;
    /** Clip only sideways, so the content's vertical shadows are not cut off. */
    clipHorizontally?: boolean;
  }>(),
  {
    leadingWidth: 0,
    trailingWidth: 0,
    fullSwipeLeading: false,
    fullSwipeTrailing: false,
    fullSwipeDistance: undefined,
    momentary: false,
    disabled: false,
    clipHorizontally: false,
  },
);
const emit = defineEmits<{ (event: 'full-swipe-leading'): void; (event: 'full-swipe-trailing'): void }>();

const AXIS_LOCK_DISTANCE = 8;
const RUBBER_BAND = 0.25;
const WHEEL_SETTLE_DELAY = 160;
// Slightly underdamped, so rows settle with a small, quick bounce.
const SETTLE_SPRING = { type: 'spring', stiffness: 520, damping: 32, mass: 0.9 } as const;
// Bouncier return after a full swipe runs its action, so the row visibly springs back into place.
const FULL_SWIPE_RETURN_SPRING = { type: 'spring', stiffness: 380, damping: 20, mass: 1 } as const;

const root = ref<HTMLElement | null>(null);
const offset = ref(0);
const isDragging = ref(false);
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const restingSide = ref<'leading' | 'trailing' | null>(null);
// The side a settling animation started from. Overshoot past zero must not reveal the opposite actions.
const animationOrigin = ref<'leading' | 'trailing' | null>(null);
let gesture: { pointerId: number; x: number; y: number; offset: number; axis: 'x' | 'y' | null } | null = null;
let suppressClick = false;
let wheelSettleTimer: number | undefined;
let offsetAnimation: { stop: () => void } | null = null;
// Recent horizontal velocity in px/s, handed to the spring so a flick keeps its momentum.
let velocity = 0;
let lastSample: { x: number; time: number } | null = null;

// Read the width on demand: a computed would cache a DOM measurement that changes on resize.
function fullSwipeThreshold(actionWidth: number) {
  return props.fullSwipeDistance ?? Math.max(actionWidth * 2, (root.value?.offsetWidth || actionWidth * 4) * 0.5);
}
const isFullSwipeArmed = computed(
  () => props.fullSwipeLeading && offset.value >= fullSwipeThreshold(props.leadingWidth),
);
const isTrailingFullSwipeArmed = computed(
  () => props.fullSwipeTrailing && offset.value <= -fullSwipeThreshold(props.trailingWidth),
);
// The side a row rests on, not the live offset: spring overshoot past zero must not count as opening the other side.
const openSide = computed(() => (isDragging.value ? null : restingSide.value));
// Panes and content both read the same offset, so they always move together.
const contentStyle = computed(() => ({ transform: `translate3d(${offset.value}px, 0, 0)` }));
const leadingPaneWidth = computed(() => (isPaneVisible('leading') ? Math.max(offset.value, 0) : 0));
const trailingPaneWidth = computed(() => (isPaneVisible('trailing') ? Math.max(-offset.value, 0) : 0));

function isPaneVisible(side: 'leading' | 'trailing') {
  return isDragging.value || restingSide.value === side || animationOrigin.value === side;
}

function stopOffsetAnimation() {
  offsetAnimation?.stop();
  offsetAnimation = null;
  animationOrigin.value = null;
}

function springTo(target: number, spring: typeof SETTLE_SPRING | typeof FULL_SWIPE_RETURN_SPRING = SETTLE_SPRING) {
  stopOffsetAnimation();
  restingSide.value = target > 0 ? 'leading' : target < 0 ? 'trailing' : null;
  animationOrigin.value = offset.value > 0 ? 'leading' : offset.value < 0 ? 'trailing' : null;
  const releaseVelocity = velocity;
  velocity = 0;
  if (prefersReducedMotion.value) {
    offset.value = target;
    animationOrigin.value = null;
    return;
  }
  offsetAnimation = animate(offset.value, target, {
    ...spring,
    velocity: releaseVelocity,
    onUpdate: (value: number) => (offset.value = value),
    onComplete: () => {
      offsetAnimation = null;
      animationOrigin.value = null;
    },
  });
}

function trackVelocity(x: number) {
  const time = performance.now();
  if (lastSample && time > lastSample.time) velocity = ((x - lastSample.x) / (time - lastSample.time)) * 1000;
  lastSample = { x, time };
}

function resist(next: number) {
  const width = root.value?.offsetWidth || Number.POSITIVE_INFINITY;
  if (next > 0) {
    if (!props.leadingWidth) return 0;
    const limit = props.fullSwipeLeading ? width : props.leadingWidth;
    return next <= limit ? next : limit + (next - limit) * RUBBER_BAND;
  }
  if (!props.trailingWidth) return 0;
  const limit = props.fullSwipeTrailing ? -width : -props.trailingWidth;
  return next >= limit ? next : limit + (next - limit) * RUBBER_BAND;
}

function close() {
  springTo(0);
  if (activeSwipeRowId.value === props.id) activeSwipeRowId.value = null;
}

function settle() {
  isDragging.value = false;
  if (isFullSwipeArmed.value || isTrailingFullSwipeArmed.value) {
    const side = isFullSwipeArmed.value ? 'full-swipe-leading' : 'full-swipe-trailing';
    springTo(0, FULL_SWIPE_RETURN_SPRING);
    if (activeSwipeRowId.value === props.id) activeSwipeRowId.value = null;
    if (side === 'full-swipe-leading') emit('full-swipe-leading');
    else emit('full-swipe-trailing');
    return;
  }
  if (props.momentary) return close();
  if (offset.value > props.leadingWidth / 2 && props.leadingWidth) springTo(props.leadingWidth);
  else if (offset.value < -props.trailingWidth / 2 && props.trailingWidth) springTo(-props.trailingWidth);
  else close();
}

function onPointerDown(event: PointerEvent) {
  if (props.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
  // Grabbing a settling row continues from where the spring currently has it.
  stopOffsetAnimation();
  velocity = 0;
  lastSample = { x: event.clientX, time: performance.now() };
  gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offset: offset.value, axis: null };
}

function onPointerMove(event: PointerEvent) {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  if (!gesture.axis) {
    if (Math.abs(dx) < AXIS_LOCK_DISTANCE && Math.abs(dy) < AXIS_LOCK_DISTANCE) return;
    gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (gesture.axis === 'y') return;
    isDragging.value = true;
    activeSwipeRowId.value = props.id;
    root.value?.setPointerCapture?.(event.pointerId);
  }
  if (gesture.axis !== 'x') return;
  event.preventDefault();
  trackVelocity(event.clientX);
  offset.value = resist(gesture.offset + dx);
}

function onPointerEnd(event: PointerEvent) {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const wasSwipe = gesture.axis === 'x';
  gesture = null;
  if (root.value?.hasPointerCapture?.(event.pointerId)) root.value.releasePointerCapture(event.pointerId);
  if (!wasSwipe) return;
  // The click that follows a drag must not activate the row underneath.
  suppressClick = true;
  window.setTimeout(() => (suppressClick = false), 0);
  settle();
}

function onClickCapture(event: MouseEvent) {
  // The click a drag produces on release is swallowed but must not close a row the swipe just opened;
  // revealed actions stay until the user taps, or swipes back or further.
  if (suppressClick) {
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
    return;
  }
  const target = event.target as Element | null;
  if (openSide.value && !target?.closest('[data-swipe-action]')) {
    event.preventDefault();
    event.stopPropagation();
    close();
  }
}

function onWheel(event: WheelEvent) {
  if (props.disabled || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
  event.preventDefault();
  stopOffsetAnimation();
  isDragging.value = true;
  activeSwipeRowId.value = props.id;
  offset.value = resist(offset.value - event.deltaX);
  window.clearTimeout(wheelSettleTimer);
  wheelSettleTimer = window.setTimeout(settle, WHEEL_SETTLE_DELAY);
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) close();
}

watch(activeSwipeRowId, (id) => {
  if (id !== props.id && restingSide.value && !isDragging.value) close();
});

watch([isFullSwipeArmed, isTrailingFullSwipeArmed], ([leading, trailing]) => {
  if ((leading || trailing) && isDragging.value) navigator.vibrate?.(10);
});

watch(openSide, (side) => {
  if (side) document.addEventListener('pointerdown', onDocumentPointerDown, true);
  else document.removeEventListener('pointerdown', onDocumentPointerDown, true);
});

onBeforeUnmount(() => {
  stopOffsetAnimation();
  window.clearTimeout(wheelSettleTimer);
  document.removeEventListener('pointerdown', onDocumentPointerDown, true);
  if (activeSwipeRowId.value === props.id) activeSwipeRowId.value = null;
});

defineExpose({ close });
</script>

<template>
  <div
    ref="root"
    data-swipeable-row
    class="relative touch-pan-y"
    :class="[clipHorizontally ? 'harbor-clip-x' : 'overflow-hidden', { 'select-none': isDragging }]"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
    @click.capture="onClickCapture"
    @dragstart.prevent
    @wheel="onWheel"
  >
    <!-- Actions are rounded on every corner with a small gap, so they read as pills beside the moving row.
         The gap is padding, which keeps a box at least that wide, so a closed pane is hidden outright. -->
    <div
      v-if="$slots.leading"
      data-swipe-pane="leading"
      class="absolute inset-y-0 left-0 flex gap-1 overflow-hidden pr-1 [&>*]:rounded-xl"
      :style="{ width: `${leadingPaneWidth}px` }"
      :class="{ invisible: leadingPaneWidth <= 0 }"
      :inert="openSide !== 'leading'"
      :aria-hidden="openSide !== 'leading'"
    >
      <slot name="leading" :armed="isFullSwipeArmed" :close="close" />
    </div>
    <div
      v-if="$slots.trailing"
      data-swipe-pane="trailing"
      class="absolute inset-y-0 right-0 flex gap-1 overflow-hidden pl-1 [&>*]:rounded-xl"
      :style="{ width: `${trailingPaneWidth}px` }"
      :class="{ invisible: trailingPaneWidth <= 0 }"
      :inert="openSide !== 'trailing'"
      :aria-hidden="openSide !== 'trailing'"
    >
      <slot name="trailing" :armed="isTrailingFullSwipeArmed" :close="close" />
    </div>
    <div data-swipe-content class="relative" :style="contentStyle">
      <slot />
    </div>
  </div>
</template>
