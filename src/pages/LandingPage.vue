<script setup lang="ts">
import { ArrowRight, Check, Code2, HeartHandshake, Lightbulb, LockKeyhole, Sparkles } from 'lucide-vue-next';
import { motion } from 'motion-v';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import CallPreviewSvg from '@/components/landing-page/CallPreviewSvg.vue';
import TheFooter from '@/components/layout/TheFooter.vue';
import SplitText from '@/components/marketing/SplitText.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMeetingNavigation } from '@/composables/useMeetingNavigation';

const { t } = useI18n();
const { createMeeting, joinMeeting: navigateToMeeting } = useMeetingNavigation();
const meetingCode = ref('');
const meetingCodeError = ref('');
const titleWordIndex = ref(0);
const titleWordKeys = ['landing.titleWords.freely', 'landing.titleWords.privately', 'landing.titleWords.openly'];
const titleWord = computed(() => t(titleWordKeys[titleWordIndex.value]!));
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const entranceInitial = prefersReducedMotion ? false : { opacity: 0 };
let titleWordTimer: ReturnType<typeof setInterval> | undefined;

const marketingPages = [
  {
    path: '/technologies',
    titleKey: 'nav.technologies.title',
    descriptionKey: 'nav.technologies.description',
    icon: Code2,
    accent: 'bg-[#E6F4F1] text-[#0B7A75]',
  },
  {
    path: '/idea',
    titleKey: 'nav.idea.title',
    descriptionKey: 'nav.idea.description',
    icon: Lightbulb,
    accent: 'bg-[#FFF0EA] text-[#C65A45]',
  },
  {
    path: '/freedom',
    titleKey: 'nav.freedom.title',
    descriptionKey: 'nav.freedom.description',
    icon: HeartHandshake,
    accent: 'bg-[#EDF3F2] text-[#27595D]',
  },
];

function joinMeeting() {
  meetingCodeError.value = navigateToMeeting(meetingCode.value) ? '' : t('landing.invalidRoom');
}

onMounted(() => {
  if (prefersReducedMotion) return;
  titleWordTimer = setInterval(() => {
    titleWordIndex.value = (titleWordIndex.value + 1) % titleWordKeys.length;
  }, 2400);
});

onUnmounted(() => {
  if (titleWordTimer) clearInterval(titleWordTimer);
});
</script>

<template>
  <div class="marketing-font -mt-[84px] overflow-hidden bg-[#FBFCF8] text-[#102F35]">
    <main>
      <section class="relative bg-[#FBFCF8] px-5 pb-20 pt-24 sm:px-8 sm:pb-28 sm:pt-28 lg:px-12 lg:pb-32">
        <div
          class="pointer-events-none absolute left-[-12rem] top-20 h-96 w-96 rounded-full bg-[#CDE9E4]/70 blur-3xl"
        />
        <div
          class="pointer-events-none absolute right-[-8rem] top-[-5rem] h-80 w-80 rounded-full bg-[#F8D8CC]/60 blur-3xl"
        />

        <div class="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.88fr_1.12fr] lg:gap-12">
          <div class="max-w-2xl lg:pb-8">
            <motion.div
              :initial="entranceInitial"
              :animate="{ opacity: 1 }"
              :transition="{ duration: 0.5, delay: 0.05 }"
              class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-[#0B7A75] shadow-[0_8px_28px_rgba(11,122,117,0.09)]"
            >
              <Sparkles class="size-4" />
              {{ t('landing.eyebrow') }}
            </motion.div>

            <motion.h1
              :initial="entranceInitial"
              :animate="{ opacity: 1 }"
              :transition="{ duration: 0.55, delay: 0.14 }"
              class="mt-7 max-w-xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl"
            >
              <span class="sr-only">{{ t('landing.title') }}</span>
              <span aria-hidden="true">
                {{ t('landing.titleLead') }}
                <span class="inline-flex min-w-[3.7em] text-[#0B7A75]">
                  <Transition name="word-swap" mode="out-in">
                    <span :key="titleWord">{{ titleWord }}.</span>
                  </Transition>
                </span>
                <br />
                {{ t('landing.titleTail') }}
              </span>
            </motion.h1>
            <SplitText
              as="p"
              :text="t('landing.description')"
              :delay="230"
              class="mt-6 max-w-lg text-pretty text-lg leading-8 text-[#61777B] sm:text-xl"
            />

            <motion.div
              :initial="entranceInitial"
              :animate="{ opacity: 1 }"
              :transition="{ duration: 0.5, delay: 0.32 }"
              class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Button
                size="lg"
                class="h-12 rounded-full bg-[#0B7A75] px-6 text-base text-white shadow-[0_12px_28px_rgba(11,122,117,0.25)] hover:bg-[#08635F]"
                @click="createMeeting"
              >
                {{ t('common.startMeeting') }}
                <ArrowRight class="size-4" />
              </Button>
              <a
                href="#join"
                class="inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold text-[#27595D] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
              >
                {{ t('landing.joinWithCode') }}
              </a>
            </motion.div>

            <motion.div
              :initial="entranceInitial"
              :animate="{ opacity: 1 }"
              :transition="{ duration: 0.5, delay: 0.41 }"
              class="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#61777B]"
            >
              <span class="inline-flex items-center gap-1.5">
                <Check class="size-4 text-[#0B7A75]" />
                {{ t('landing.freeToUse') }}
              </span>
              <span class="inline-flex items-center gap-1.5">
                <Check class="size-4 text-[#0B7A75]" />
                {{ t('landing.openSource') }}
              </span>
              <span class="inline-flex items-center gap-1.5">
                <Check class="size-4 text-[#0B7A75]" />
                {{ t('landing.worksInBrowser') }}
              </span>
            </motion.div>
          </div>

          <motion.div
            :initial="entranceInitial"
            :animate="{ opacity: 1 }"
            :transition="{ duration: 0.65, delay: 0.2 }"
            class="relative mx-auto w-full max-w-2xl"
          >
            <div
              class="call-window relative overflow-hidden rounded-[2rem] bg-[#102F35] p-3 shadow-[0_30px_80px_rgba(16,47,53,0.25)] sm:p-4"
            >
              <CallPreviewSvg :label="t('landing.participantAlt', { name: t('meeting.fallbackUser') })" />
            </div>

            <div
              class="float-note absolute -bottom-7 -left-3 hidden items-center gap-3 rounded-2xl bg-white p-3 pr-5 shadow-[0_18px_50px_rgba(16,47,53,0.16)] sm:flex"
            >
              <span class="flex size-10 items-center justify-center rounded-xl bg-[#E6F4F1] text-[#0B7A75]">
                <LockKeyhole class="size-5" />
              </span>
              <span>
                <strong class="block text-sm">{{ t('landing.roomReady') }}</strong>
                <span class="text-xs text-[#61777B]">{{ t('landing.shareSecureLink') }}</span>
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      <motion.section
        id="join"
        :initial="entranceInitial"
        :whileInView="{ opacity: 1 }"
        :inViewOptions="{ once: true, amount: 0.25 }"
        :transition="{ duration: 0.55 }"
        class="scroll-mt-24 px-5 py-14 sm:px-8 sm:py-16 lg:px-12"
      >
        <div
          class="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 rounded-[2rem] bg-[#102F35] px-6 py-7 text-white sm:px-9 md:flex-row"
        >
          <div>
            <SplitText as="p" :text="t('landing.joinEyebrow')" class="text-sm font-semibold text-[#9BCFC7]" />
            <SplitText
              as="h2"
              :text="t('landing.joinTitle')"
              :delay="80"
              class="mt-1 text-2xl font-semibold tracking-[-0.03em]"
            />
          </div>
          <form class="relative flex w-full max-w-xl flex-col gap-2 sm:flex-row" @submit.prevent="joinMeeting">
            <Input
              v-model="meetingCode"
              :aria-label="t('landing.roomInputLabel')"
              :aria-invalid="!!meetingCodeError"
              :aria-describedby="meetingCodeError ? 'meeting-code-error' : undefined"
              :placeholder="t('landing.roomPlaceholder')"
              class="h-12 rounded-full border-white/15 bg-white/10 px-5 text-white shadow-none placeholder:text-white/50 focus-visible:ring-[#9BCFC7]"
              @input="meetingCodeError = ''"
            />
            <Button
              type="submit"
              size="lg"
              :disabled="!meetingCode.trim()"
              class="h-12 shrink-0 rounded-full bg-white px-6 text-[#102F35] hover:bg-[#E6F4F1]"
            >
              {{ t('landing.joinRoom') }}
            </Button>
            <p
              v-if="meetingCodeError"
              id="meeting-code-error"
              role="alert"
              class="px-3 text-sm text-[#FFC7BD] sm:absolute sm:mt-14"
            >
              {{ meetingCodeError }}
            </p>
          </form>
        </div>
      </motion.section>

      <motion.section
        :initial="entranceInitial"
        :whileInView="{ opacity: 1 }"
        :inViewOptions="{ once: true, amount: 0.12 }"
        :transition="{ duration: 0.6 }"
        class="px-5 py-20 sm:px-8 sm:py-28 lg:px-12"
      >
        <div class="mx-auto max-w-7xl">
          <div class="max-w-3xl">
            <SplitText
              as="p"
              :text="t('landing.exploreEyebrow')"
              class="text-sm font-semibold uppercase tracking-[0.16em] text-[#0B7A75]"
            />
            <SplitText
              as="h2"
              :text="t('landing.exploreTitle')"
              :delay="80"
              class="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl"
            />
            <SplitText
              as="p"
              :text="t('landing.exploreDescription')"
              :delay="140"
              class="mt-5 text-lg leading-8 text-[#61777B]"
            />
          </div>

          <div class="mt-10 grid gap-4 md:grid-cols-3">
            <motion.div
              v-for="(page, index) in marketingPages"
              :key="page.path"
              :initial="entranceInitial"
              :whileInView="{ opacity: 1 }"
              :inViewOptions="{ once: true, amount: 0.25 }"
              :transition="{ duration: 0.45, delay: index * 0.1 }"
              :whileHover="prefersReducedMotion ? undefined : { scale: 1.015 }"
            >
              <RouterLink
                :to="page.path"
                class="group flex min-h-64 flex-col justify-between rounded-[2rem] border border-[#D8E7E3] bg-white p-6 transition-[border-color,box-shadow] hover:border-[#9BCFC7] hover:shadow-[0_18px_45px_rgba(16,47,53,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
              >
                <span :class="['flex size-12 items-center justify-center rounded-2xl', page.accent]">
                  <component :is="page.icon" class="size-6" />
                </span>
                <span class="mt-12">
                  <SplitText as="strong" :text="t(page.titleKey)" class="text-2xl font-semibold tracking-[-0.035em]" />
                  <SplitText
                    as="span"
                    :text="t(page.descriptionKey)"
                    :delay="80"
                    class="mt-3 block leading-7 text-[#61777B]"
                  />
                  <span class="mt-5 flex items-center gap-2 font-semibold text-[#0B7A75]">
                    {{ t(page.titleKey) }}
                    <ArrowRight class="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </span>
              </RouterLink>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section
        :initial="entranceInitial"
        :whileInView="{ opacity: 1 }"
        :inViewOptions="{ once: true, amount: 0.3 }"
        :transition="{ duration: 0.6 }"
        class="px-5 py-20 text-center sm:px-8 sm:py-28"
      >
        <div class="mx-auto max-w-3xl">
          <SplitText
            as="p"
            :text="t('landing.readyEyebrow')"
            class="text-sm font-semibold uppercase tracking-[0.16em] text-[#0B7A75]"
          />
          <SplitText
            as="h2"
            :text="t('landing.readyTitle')"
            :delay="80"
            class="mt-4 text-balance text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-6xl"
          />
          <Button
            size="lg"
            class="mt-8 h-12 rounded-full bg-[#0B7A75] px-7 text-base text-white shadow-[0_12px_28px_rgba(11,122,117,0.22)] hover:bg-[#08635F]"
            @click="createMeeting"
          >
            {{ t('landing.startWithoutAccount') }}
            <ArrowRight class="size-4" />
          </Button>
        </div>
      </motion.section>
    </main>

    <TheFooter />
  </div>
</template>
