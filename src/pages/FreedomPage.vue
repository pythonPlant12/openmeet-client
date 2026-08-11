<script setup lang="ts">
import { Check, Github, LockKeyhole, ShieldCheck } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import TheFooter from '@/components/layout/TheFooter.vue';
import SplitText from '@/components/marketing/SplitText.vue';

const { t } = useI18n();
</script>

<template>
  <div class="marketing-font flex min-h-[calc(100svh-60px)] flex-col bg-[#FBFCF8] text-[#102F35]">
    <main class="flex-1 px-5 py-12 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
      <section v-reveal class="mx-auto grid max-w-7xl overflow-hidden rounded-[2.5rem] bg-[#E6F4F1] lg:grid-cols-2">
        <div class="flex flex-col justify-center p-8 sm:p-12 lg:p-16">
          <span class="flex size-12 items-center justify-center rounded-2xl bg-white text-[#0B7A75] shadow-sm">
            <LockKeyhole class="size-6" />
          </span>
          <SplitText
            as="p"
            :text="t('freedom.eyebrow')"
            class="mt-7 text-sm font-semibold uppercase tracking-[0.16em] text-[#0B7A75]"
          />
          <SplitText
            as="h1"
            :text="t('freedom.title')"
            :delay="80"
            class="mt-3 text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl"
          />
          <SplitText
            as="p"
            :text="t('freedom.description')"
            :delay="140"
            class="mt-5 max-w-lg text-lg leading-8 text-[#416B6D]"
          />
          <div class="mt-7 space-y-3 text-[#27595D]">
            <p class="flex items-center gap-3">
              <Check class="size-5 shrink-0 text-[#0B7A75]" />
              <SplitText as="span" :text="t('freedom.identity')" />
            </p>
            <p class="flex items-center gap-3">
              <Check class="size-5 shrink-0 text-[#0B7A75]" />
              <SplitText as="span" :text="t('freedom.selfHosted')" :delay="70" />
            </p>
            <p class="flex items-center gap-3">
              <Check class="size-5 shrink-0 text-[#0B7A75]" />
              <SplitText as="span" :text="t('freedom.noProfiling')" :delay="140" />
            </p>
          </div>
          <a
            href="https://github.com/pythonPlant12/openmeet"
            target="_blank"
            rel="noreferrer"
            class="mt-8 inline-flex w-fit items-center gap-2 font-semibold text-[#08635F] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
          >
            <Github class="size-4" />
            {{ t('freedom.inspectSource') }}
          </a>
        </div>
        <div class="relative min-h-[24rem] overflow-hidden sm:min-h-[34rem]">
          <img
            src="/images/privacy-team.webp"
            :alt="t('freedom.imageAlt')"
            class="absolute inset-0 h-full w-full object-cover"
          />
          <div class="absolute inset-0 bg-gradient-to-r from-[#E6F4F1] via-transparent to-transparent lg:block" />
          <div
            class="absolute bottom-6 left-6 right-6 flex items-center gap-3 rounded-2xl bg-white/90 p-4 text-[#173E42] backdrop-blur-md sm:left-auto sm:right-6 sm:w-72"
          >
            <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E6F4F1] text-[#0B7A75]">
              <ShieldCheck class="size-5" />
            </span>
            <SplitText as="p" :text="t('freedom.infrastructure')" class="text-sm font-semibold" />
          </div>
        </div>
      </section>
    </main>

    <TheFooter />
  </div>
</template>
