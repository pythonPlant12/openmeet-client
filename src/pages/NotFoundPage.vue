<script setup lang="ts">
import { ArrowLeft, Home, Radio, VideoOff } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import TheFooter from '@/components/layout/TheFooter.vue';
import SplitText from '@/components/marketing/SplitText.vue';
import { Button } from '@/components/ui/button';
import { useBranding } from '@/config/branding.config';

const router = useRouter();
const branding = useBranding();
const { t } = useI18n();

const handleGoBack = () => {
  if (window.history.state.back) {
    router.back();
  } else {
    router.push('/');
  }
};
</script>

<template>
  <div class="marketing-font flex min-h-[calc(100svh-60px)] flex-col bg-[#FBFCF8] text-[#102F35]">
    <main class="relative flex flex-1 items-center overflow-hidden px-5 py-16 sm:px-8 lg:px-12">
      <div class="pointer-events-none absolute -left-32 top-10 size-96 rounded-full bg-[#CDE9E4]/60 blur-3xl" />
      <div class="pointer-events-none absolute -right-24 bottom-0 size-80 rounded-full bg-[#F8D8CC]/55 blur-3xl" />

      <div v-reveal class="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div class="relative mx-auto flex aspect-square w-full max-w-md items-center justify-center">
          <div class="absolute inset-0 rounded-full border border-dashed border-[#9BCFC7]" />
          <div
            class="absolute inset-12 rounded-full border border-[#D8E7E3] bg-white shadow-[0_24px_70px_rgba(16,47,53,0.1)]"
          />
          <span class="absolute left-4 top-1/2 size-3 rounded-full bg-[#9BCFC7]" />
          <span class="absolute right-12 top-12 size-3 rounded-full bg-[#F2765F]" />
          <span class="absolute bottom-9 right-1/3 size-3 rounded-full bg-[#5AC878]" />
          <div class="relative flex flex-col items-center">
            <span class="flex size-20 items-center justify-center rounded-[1.7rem] bg-[#102F35] text-white">
              <VideoOff class="size-9" />
            </span>
            <strong class="mt-5 text-7xl font-semibold tracking-[-0.07em] text-[#0B7A75] sm:text-8xl">404</strong>
          </div>
        </div>

        <div class="max-w-xl">
          <p class="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#0B7A75]">
            <Radio class="size-4" />
            <SplitText as="span" :text="t('notFound.eyebrow')" />
          </p>
          <SplitText
            as="h1"
            :text="t('notFound.title')"
            :delay="80"
            class="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-6xl"
          />
          <SplitText
            as="p"
            :text="t('notFound.description')"
            :delay="140"
            class="mt-5 text-lg leading-8 text-[#61777B]"
          />
          <SplitText as="p" :text="t('notFound.hint')" :delay="200" class="mt-3 text-sm text-[#82989A]" />

          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              class="harbor-soft-action h-11 rounded-full border-transparent bg-[#E6F4F1] px-5 text-[#27595D]"
              @click="handleGoBack"
            >
              <ArrowLeft class="size-4" />
              {{ t('notFound.goBack') }}
            </Button>
            <Button
              class="harbor-primary-action h-11 rounded-full bg-[#0B7A75] px-5 text-white"
              @click="router.push('/')"
            >
              <Home class="size-4" />
              {{ t('notFound.home', { appName: branding.appName }) }}
            </Button>
          </div>
        </div>
      </div>
    </main>

    <TheFooter />
  </div>
</template>
