<script setup lang="ts">
import { Phone, PhoneOff } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { LoadingRipple } from '@/components/ui/loading';

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
    class="marketing-font pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-[1040] flex justify-center px-4 sm:top-[4.5rem]"
  >
    <div
      data-incoming-call
      role="alert"
      class="incoming-call-ringing pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-2xl bg-gradient-to-r from-[#0B7A75] to-[#2DA58F] py-2 pl-3 pr-2 text-white shadow-[0_12px_32px_-12px_rgba(16,47,53,0.55)]"
    >
      <span
        class="incoming-call-ringing-icon flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20"
      >
        <Phone class="size-4" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-semibold" data-incoming-caller>{{ name }}</span>
        <span class="block truncate text-[11px] text-white/80"
          >{{ t('notifications.incomingCallTitle') }}<template v-if="more"> · {{ more }} more</template></span
        >
      </span>
      <LoadingRipple v-if="isAnswering" class="size-5 text-white" />
      <template v-else>
        <button
          type="button"
          data-incoming-decline
          class="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#C4513D] text-white transition-colors [@media(hover:hover)]:hover:bg-[#A9412F]"
          :aria-label="t('dashboard.decline')"
          :title="t('dashboard.decline')"
          @click="emit('decline')"
        >
          <PhoneOff class="size-4" />
        </button>
        <button
          type="button"
          data-incoming-accept
          class="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0B7A75] transition-colors [@media(hover:hover)]:hover:bg-[#E6F4F1] [@media(hover:hover)]:hover:text-[#102F35]"
          :aria-label="t('dashboard.answer')"
          :title="t('dashboard.answer')"
          @click="emit('accept')"
        >
          <Phone class="size-4" />
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* A ringing call buzzes like a phone: a short shake, a pause, and a soft green pulse. */
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
    box-shadow: 0 0 0 0 rgb(45 165 143 / 0.55);
  }
  70%,
  100% {
    box-shadow: 0 0 0 10px rgb(45 165 143 / 0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .incoming-call-ringing,
  .incoming-call-ringing-icon {
    animation: none;
  }
}
</style>
