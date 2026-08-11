<script setup lang="ts">
import { ArrowUpRight, Github, Video } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import SplitText from '@/components/marketing/SplitText.vue';
import { useTheme } from '@/composables/useTheme';

const { theme } = useTheme();
const { t } = useI18n();

const footerLinks = [
  { path: '/technologies', key: 'nav.technologies.title' },
  { path: '/idea', key: 'nav.idea.title' },
  { path: '/freedom', key: 'nav.freedom.title' },
];
</script>

<template>
  <footer class="marketing-font border-t border-[#D8E7E3] bg-white px-5 text-[#102F35] sm:px-8">
    <div class="mx-auto grid max-w-7xl gap-10 py-12 md:grid-cols-[1.4fr_0.8fr_0.8fr] md:py-14">
      <div class="max-w-md">
        <div class="flex items-center gap-2.5">
          <span
            class="relative flex size-9 items-center justify-center rounded-xl bg-[#0B7A75] text-white"
            aria-hidden="true"
          >
            <Video class="size-5" :stroke-width="2.25" />
            <span class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-[#5AC878]" />
          </span>
          <SplitText as="span" :text="theme.branding.companyName" class="text-lg font-semibold" />
        </div>
        <SplitText as="p" :text="t('footer.description')" :delay="80" class="mt-5 text-base leading-7 text-[#61777B]" />
        <SplitText as="p" :text="t('footer.builtIn')" :delay="140" class="mt-3 text-sm font-semibold text-[#0B7A75]" />
      </div>

      <div>
        <SplitText
          as="p"
          :text="t('footer.explore')"
          class="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B7A75]"
        />
        <nav class="mt-4 flex flex-col items-start gap-3">
          <RouterLink
            v-for="link in footerLinks"
            :key="link.path"
            :to="link.path"
            class="font-semibold text-[#27595D] underline-offset-4 transition-colors hover:text-[#0B7A75] hover:underline"
          >
            {{ t(link.key) }}
          </RouterLink>
        </nav>
      </div>

      <div>
        <SplitText
          as="p"
          :text="t('nav.openSource')"
          class="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B7A75]"
        />
        <a
          href="https://github.com/pythonPlant12/openmeet"
          target="_blank"
          rel="noreferrer"
          class="mt-4 inline-flex items-center gap-3 rounded-2xl border border-[#D8E7E3] bg-[#FBFCF8] px-4 py-3 font-semibold text-[#27595D] transition-all hover:border-[#9BCFC7] hover:text-[#0B7A75] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
          :aria-label="t('footer.githubLabel')"
        >
          <Github class="size-5" />
          {{ t('footer.github') }}
          <ArrowUpRight class="size-4 text-[#82989A]" />
        </a>
      </div>
    </div>

    <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 border-t border-[#D8E7E3] py-5">
      <SplitText as="p" :text="t('footer.tagline')" class="text-sm text-[#61777B]" />
      <span class="size-2 rounded-full bg-[#5AC878]" aria-hidden="true" />
    </div>
  </footer>
</template>
