<script setup lang="ts">
import { LockKeyhole, ShieldCheck, Video } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import SplitText from '@/components/marketing/SplitText.vue';

const { t } = useI18n();

defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <aside aria-hidden="true" class="relative hidden min-h-svh overflow-hidden bg-[#102F35] lg:block">
    <img
      src="/images/auth-friends.webp"
      :alt="t('auth.visualAlt')"
      class="absolute inset-0 h-full w-full object-cover"
    />
    <div class="absolute inset-0 bg-[#102F35]/45" />
    <div class="absolute inset-y-0 right-0 w-56 bg-gradient-to-r from-transparent via-[#FBFCF8]/45 to-[#FBFCF8]" />
    <div class="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#FBFCF8]/90 via-[#FBFCF8]/25 to-transparent" />
    <div class="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#102F35]/90 via-[#102F35]/25 to-transparent" />

    <div
      class="absolute left-10 top-10 flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-md xl:left-16 xl:top-14"
    >
      <ShieldCheck class="size-4" />
      {{ t('auth.visualPrivate') }}
    </div>

    <div class="absolute bottom-12 left-10 max-w-lg text-white xl:bottom-16 xl:left-16">
      <div class="mb-6 flex items-center gap-3">
        <span class="flex size-11 items-center justify-center rounded-2xl bg-white text-[#0B7A75]">
          <Video class="size-5" />
        </span>
        <span class="flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-sm backdrop-blur-md">
          <LockKeyhole class="size-4" />
          {{ t('auth.visualNoAccount') }}
        </span>
      </div>
      <SplitText
        as="h2"
        :text="title"
        class="max-w-md text-4xl font-semibold leading-tight tracking-[-0.04em] xl:text-5xl"
      />
      <SplitText as="p" :text="description" :delay="100" class="mt-4 max-w-md text-lg leading-8 text-white/80" />
    </div>
  </aside>
</template>
