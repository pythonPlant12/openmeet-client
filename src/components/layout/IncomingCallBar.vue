<script setup lang="ts">
import { Phone, PhoneOff } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { LoadingRipple } from '@/components/ui/loading';
import { RoundButton } from '@/components/ui/round-button';

defineProps<{
  /** Who is calling: a person or a group name. */
  name: string;
  /** More calls ringing behind the one shown. */
  more: number;
  isAnswering: boolean;
}>();
const emit = defineEmits<{ (event: 'accept'): void; (event: 'decline'): void }>();
const { t } = useI18n();
</script>

<template>
  <!-- The one place a ringing call shows in the app, on every page, until it is answered, declined, or stops. -->
  <div
    class="marketing-font pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-[1040] flex justify-center px-4 sm:top-[calc(var(--liquid-bar-height-sm)+1.5rem)]"
  >
    <div
      data-incoming-call
      role="alert"
      class="incoming-call-ringing pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[1.75rem] bg-harbor-surface py-2 pl-2 pr-2 text-harbor-ink shadow-harbor-float"
    >
      <span
        class="incoming-call-ringing-icon flex size-11 shrink-0 items-center justify-center rounded-full bg-harbor-accent-soft text-harbor-accent"
      >
        <Phone class="size-5" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-[0.9375rem] font-semibold" data-incoming-caller>{{ name }}</span>
        <span class="block truncate text-xs text-harbor-muted"
          >{{ t('notifications.incomingCallTitle') }}<template v-if="more"> · {{ more }} more</template></span
        >
      </span>
      <LoadingRipple v-if="isAnswering" class="mr-3 size-5 text-harbor-icon" />
      <template v-else>
        <RoundButton
          tone="danger"
          data-incoming-decline
          :aria-label="t('dashboard.decline')"
          :title="t('dashboard.decline')"
          @click="emit('decline')"
        >
          <PhoneOff />
        </RoundButton>
        <RoundButton
          tone="accent"
          data-incoming-accept
          :aria-label="t('dashboard.answer')"
          :title="t('dashboard.answer')"
          @click="emit('accept')"
        >
          <Phone />
        </RoundButton>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* A ringing call buzzes like a phone: a short shake, a pause, and a soft teal pulse. */
.incoming-call-ringing {
  animation:
    incoming-call-ring-buzz 1.6s ease-in-out infinite,
    incoming-call-ring-pulse 1.6s ease-out infinite;
}
.incoming-call-ringing-icon {
  animation: incoming-call-ring-wiggle 1.6s ease-in-out infinite;
}
@keyframes incoming-call-ring-buzz {
  0%,
  40%,
  100% {
    transform: translateX(0);
  }
  5%,
  15%,
  25%,
  35% {
    transform: translateX(-2px);
  }
  10%,
  20%,
  30% {
    transform: translateX(2px);
  }
}
@keyframes incoming-call-ring-wiggle {
  0%,
  40%,
  100% {
    transform: rotate(0);
  }
  8%,
  24% {
    transform: rotate(-16deg);
  }
  16%,
  32% {
    transform: rotate(16deg);
  }
}
@keyframes incoming-call-ring-pulse {
  0% {
    box-shadow:
      var(--harbor-shadow-float),
      0 0 0 0 rgb(var(--harbor-accent) / 0.35);
  }
  70%,
  100% {
    box-shadow:
      var(--harbor-shadow-float),
      0 0 0 10px rgb(var(--harbor-accent) / 0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .incoming-call-ringing,
  .incoming-call-ringing-icon {
    animation: none;
  }
}
</style>
