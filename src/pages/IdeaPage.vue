<script setup lang="ts">
import { Globe2, MapPin, ShieldCheck, Video } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import TheFooter from '@/components/layout/TheFooter.vue';
import SplitText from '@/components/marketing/SplitText.vue';

const { t } = useI18n();
</script>

<template>
  <div class="marketing-font flex min-h-[calc(100svh-60px)] flex-col bg-[#FBFCF8] text-[#102F35]">
    <main class="flex-1">
      <section class="relative overflow-hidden px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-32">
        <div class="pointer-events-none absolute -left-52 top-20 size-[30rem] rounded-full bg-[#CDE9E4]/60 blur-3xl" />
        <div class="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div v-reveal class="relative min-h-[28rem] overflow-hidden rounded-[2.5rem] sm:min-h-[36rem]">
            <img
              src="/images/zurich-origin.webp"
              :alt="t('idea.imageAlt')"
              class="absolute inset-0 h-full w-full object-cover"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-[#102F35]/75 via-transparent to-transparent" />
            <div
              class="absolute bottom-6 left-6 right-6 flex items-center justify-between gap-4 rounded-2xl bg-white/90 p-4 text-[#102F35] backdrop-blur-md sm:left-8 sm:right-auto sm:w-80"
            >
              <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#E6F4F1] text-[#0B7A75]">
                <MapPin class="size-5" />
              </span>
              <span class="flex-1">
                <SplitText as="strong" :text="t('idea.location')" class="block" />
                <SplitText as="span" :text="t('idea.coordinates')" :delay="80" class="text-sm text-[#61777B]" />
              </span>
            </div>
          </div>

          <div v-reveal>
            <SplitText
              as="p"
              :text="t('idea.eyebrow')"
              class="text-sm font-semibold uppercase tracking-[0.16em] text-[#0B7A75]"
            />
            <SplitText
              as="h1"
              :text="t('idea.title')"
              :delay="80"
              class="mt-4 text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl"
            />
            <SplitText as="p" :text="t('idea.question')" :delay="140" class="mt-6 text-xl leading-8 text-[#27595D]" />
            <SplitText
              as="p"
              :text="t('idea.description')"
              :delay="200"
              class="mt-5 max-w-xl text-lg leading-8 text-[#61777B]"
            />
            <div class="mt-8 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
              <div class="rounded-2xl bg-[#E6F4F1] p-4">
                <Globe2 class="size-5 text-[#0B7A75]" />
                <SplitText as="strong" :text="t('idea.browserFirst')" class="mt-5 block text-sm" />
              </div>
              <div class="rounded-2xl bg-[#FFF0EA] p-4">
                <Video class="size-5 text-[#C65A45]" />
                <SplitText as="strong" :text="t('idea.oneClickRooms')" :delay="70" class="mt-5 block text-sm" />
              </div>
              <div class="rounded-2xl bg-[#EDF3F2] p-4">
                <ShieldCheck class="size-5 text-[#27595D]" />
                <SplitText as="strong" :text="t('idea.privacyFirst')" :delay="140" class="mt-5 block text-sm" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <TheFooter />
  </div>
</template>
