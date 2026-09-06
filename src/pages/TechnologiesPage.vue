<script setup lang="ts">
import { ArrowRight, Database, Monitor, Network, RadioTower, ServerCog, Video } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import TheFooter from '@/components/layout/TheFooter.vue';
import SplitText from '@/components/marketing/SplitText.vue';

const { t } = useI18n();

const technologyDefinitions = [
  { id: 'vue', key: 'technologies.vue', icon: Monitor },
  { id: 'signaling', key: 'technologies.signaling', icon: RadioTower },
  { id: 'sfu', key: 'technologies.sfu', icon: ServerCog },
  { id: 'webrtc', key: 'technologies.webrtc', icon: Video },
  { id: 'turn', key: 'technologies.turn', icon: Network },
  { id: 'postgres', key: 'technologies.postgres', icon: Database },
] as const;

const activeTechnologyId = ref('sfu');
const technologies = computed(() =>
  technologyDefinitions.map((technology) => ({
    ...technology,
    label: t(`${technology.key}.label`),
    title: t(`${technology.key}.title`),
    description: t(`${technology.key}.description`),
  })),
);
const primaryTechnologies = computed(() => technologies.value.slice(0, 4));
const supportingTechnologies = computed(() => technologies.value.slice(4));
const activeTechnology = computed(
  () => technologies.value.find((technology) => technology.id === activeTechnologyId.value) ?? technologies.value[0]!,
);
</script>

<template>
  <div class="marketing-font flex min-h-[calc(100svh-60px)] flex-col bg-[#102F35] text-white">
    <main class="flex-1">
      <section class="relative overflow-hidden px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-32">
        <div
          class="pointer-events-none absolute -right-40 -top-44 size-[32rem] rounded-full bg-[#0B7A75]/25 blur-3xl"
        />
        <div class="relative mx-auto max-w-7xl">
          <div v-reveal class="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <SplitText
                as="p"
                :text="t('technologies.eyebrow')"
                class="text-sm font-semibold uppercase tracking-[0.16em] text-[#9BCFC7]"
              />
              <SplitText
                as="h1"
                :text="t('technologies.title')"
                :delay="80"
                class="mt-4 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl"
              />
            </div>
            <SplitText
              as="p"
              :text="t('technologies.description')"
              :delay="140"
              class="max-w-xl text-lg leading-8 text-[#B7CDCF] lg:justify-self-end"
            />
          </div>

          <div v-reveal class="mt-12 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
            <div class="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 sm:p-8">
              <div class="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center">
                <template v-for="(technology, index) in primaryTechnologies" :key="technology.id">
                  <button
                    type="button"
                    :aria-pressed="activeTechnologyId === technology.id"
                    :class="[
                      'group flex min-h-32 flex-col justify-between rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9BCFC7]',
                      activeTechnologyId === technology.id
                        ? 'border-[#9BCFC7] bg-[#E6F4F1] text-[#102F35] shadow-[0_14px_35px_rgba(0,0,0,0.16)]'
                        : 'border-white/10 bg-white/[0.04] text-white hover:border-white/25 hover:bg-white/[0.08]',
                    ]"
                    @click="activeTechnologyId = technology.id"
                  >
                    <component :is="technology.icon" class="size-6" />
                    <span>
                      <span class="block text-xs opacity-65">{{ technology.label }}</span>
                      <strong class="mt-1 block text-sm leading-tight">{{ technology.title }}</strong>
                    </span>
                  </button>
                  <ArrowRight
                    v-if="index < primaryTechnologies.length - 1"
                    class="mx-auto size-4 rotate-90 text-[#9BCFC7] md:rotate-0"
                  />
                </template>
              </div>

              <div class="my-6 flex items-center gap-3" aria-hidden="true">
                <span class="h-px flex-1 bg-white/10" />
                <span class="text-xs uppercase tracking-[0.14em] text-[#8EAAAC]">
                  {{ t('technologies.supportingPaths') }}
                </span>
                <span class="h-px flex-1 bg-white/10" />
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <button
                  v-for="technology in supportingTechnologies"
                  :key="technology.id"
                  type="button"
                  :aria-pressed="activeTechnologyId === technology.id"
                  :class="[
                    'flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9BCFC7]',
                    activeTechnologyId === technology.id
                      ? 'border-[#9BCFC7] bg-[#E6F4F1] text-[#102F35]'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]',
                  ]"
                  @click="activeTechnologyId = technology.id"
                >
                  <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <component :is="technology.icon" class="size-5" />
                  </span>
                  <span>
                    <span class="block text-xs opacity-65">{{ technology.label }}</span>
                    <strong class="block text-sm">{{ technology.title }}</strong>
                  </span>
                </button>
              </div>
            </div>

            <aside
              class="flex min-h-72 flex-col justify-between rounded-[2rem] bg-[#F2765F] p-7 text-[#102F35] sm:p-8"
              aria-live="polite"
            >
              <div class="flex size-12 items-center justify-center rounded-2xl bg-white/70">
                <component :is="activeTechnology.icon" class="size-6" />
              </div>
              <div class="mt-12">
                <SplitText
                  as="p"
                  :text="activeTechnology.label"
                  class="text-sm font-semibold uppercase tracking-[0.13em] opacity-65"
                />
                <SplitText
                  as="h2"
                  :text="activeTechnology.title"
                  :delay="70"
                  class="mt-2 text-3xl font-semibold tracking-[-0.04em]"
                />
                <SplitText
                  as="p"
                  :text="activeTechnology.description"
                  :delay="120"
                  class="mt-4 leading-7 text-[#244B50]"
                />
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>

    <TheFooter />
  </div>
</template>
