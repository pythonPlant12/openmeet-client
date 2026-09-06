<script setup lang="ts">
import { useMediaQuery, useTimeoutFn } from '@vueuse/core';
import {
  ArrowRight,
  ChevronDown,
  CircleUserRound,
  Code2,
  Container,
  Github,
  HeartHandshake,
  Lightbulb,
  LogIn,
  LogOut,
  Menu,
  ServerCog,
  ShieldCheck,
  Video,
  X,
} from 'lucide-vue-next';
import { AnimatePresence, motion } from 'motion-v';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingRipple } from '@/components/ui/loading';
import { useAuth } from '@/composables/useAuth';
import { useMeetingNavigation } from '@/composables/useMeetingNavigation';
import { useBranding } from '@/config/branding.config';
import { socialApi } from '@/services/social-api';
import { AuthEventType } from '@/xstate/machines/auth/types';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const branding = useBranding();
const { createMeeting } = useMeetingNavigation();
const {
  state,
  accessToken,
  isAuthenticating,
  isRegistering,
  isCheckingSession,
  isAuthenticated,
  hasRegisterError,
  send,
} = useAuth();

const mobileMenuOpen = ref(false);
const mobileMenuExpanded = ref(false);
const isClosingMobileMenu = ref(false);
const activeDesktopMenu = ref<DesktopMenu | null>(null);
const isDesktop = useMediaQuery('(min-width: 1280px)');
const supportsHover = useMediaQuery('(hover: hover) and (pointer: fine)');
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const navCapsuleRef = ref<HTMLElement | null>(null);
const navContentRef = ref<HTMLElement | null>(null);
const desktopNavWidth = ref<number>();
const avatarUrl = ref<string | null>(null);
let avatarObjectUrl: string | null = null;
let avatarRequest = 0;
const isLandingPage = computed(() => route.meta.showMarketingNav === true);
const isMeetingPage = computed(() => route.name === 'meeting');
const isAuthBusy = computed(
  () => isAuthenticating.value || isRegistering.value || isCheckingSession.value || state.value.value === 'loggingOut',
);
const isLoggingOut = computed(() => state.value.value === 'loggingOut');

const whyOpenMeetItems = computed(() => [
  {
    title: t('nav.technologies.title'),
    description: t('nav.technologies.description'),
    path: '/technologies',
    icon: Code2,
  },
  {
    title: t('nav.idea.title'),
    description: t('nav.idea.description'),
    path: '/idea',
    icon: Lightbulb,
  },
  {
    title: t('nav.freedom.title'),
    description: t('nav.freedom.description'),
    path: '/freedom',
    icon: HeartHandshake,
  },
]);

const deploymentItems = computed(() => [
  {
    title: t('nav.deploy.composeTitle'),
    description: t('nav.deploy.composeDescription'),
    icon: Container,
  },
  {
    title: t('nav.deploy.vpsTitle'),
    description: t('nav.deploy.vpsDescription'),
    icon: ServerCog,
  },
  {
    title: t('nav.deploy.securityTitle'),
    description: t('nav.deploy.securityDescription'),
    icon: ShieldCheck,
  },
]);

type DesktopMenu = 'why' | 'deploy';

const whyMenuOpen = computed({
  get: () => activeDesktopMenu.value === 'why',
  set: (open) => {
    if (open) activeDesktopMenu.value = 'why';
    else if (activeDesktopMenu.value === 'why') activeDesktopMenu.value = null;
  },
});

const deployMenuOpen = computed({
  get: () => activeDesktopMenu.value === 'deploy',
  set: (open) => {
    if (open) activeDesktopMenu.value = 'deploy';
    else if (activeDesktopMenu.value === 'deploy') activeDesktopMenu.value = null;
  },
});

const { start: scheduleDesktopMenuClose, stop: cancelDesktopMenuClose } = useTimeoutFn(
  () => {
    activeDesktopMenu.value = null;
  },
  320,
  { immediate: false },
);

const { start: expandMobileMenu, stop: cancelMobileMenuExpansion } = useTimeoutFn(
  () => {
    mobileMenuExpanded.value = true;
  },
  300,
  { immediate: false },
);

const { start: collapseMobileMenuWidth, stop: cancelMobileMenuCollapse } = useTimeoutFn(
  () => {
    mobileMenuOpen.value = false;
    isClosingMobileMenu.value = false;
  },
  500,
  { immediate: false },
);

const resetMobileMenu = () => {
  cancelMobileMenuExpansion();
  cancelMobileMenuCollapse();
  mobileMenuExpanded.value = false;
  mobileMenuOpen.value = false;
  isClosingMobileMenu.value = false;
};

const handleMenuEnter = (menu: DesktopMenu) => {
  if (!supportsHover.value) return;

  cancelDesktopMenuClose();
  activeDesktopMenu.value = menu;
};

const handleMenuLeave = () => {
  if (!supportsHover.value) return;
  scheduleDesktopMenuClose();
};

watch(isDesktop, (desktop) => {
  if (desktop) {
    resetMobileMenu();
  } else {
    cancelDesktopMenuClose();
    activeDesktopMenu.value = null;
  }
});

watch(
  () => route.fullPath,
  () => {
    resetMobileMenu();
    activeDesktopMenu.value = null;
  },
);

const handleToggleMobileMenu = () => {
  if (prefersReducedMotion.value) {
    const open = !mobileMenuOpen.value;
    resetMobileMenu();
    mobileMenuOpen.value = open;
    mobileMenuExpanded.value = open;
    return;
  }

  if (isClosingMobileMenu.value) {
    cancelMobileMenuCollapse();
    isClosingMobileMenu.value = false;
    mobileMenuExpanded.value = true;
    return;
  }

  if (mobileMenuOpen.value) {
    cancelMobileMenuExpansion();
    isClosingMobileMenu.value = true;
    mobileMenuExpanded.value = false;
    collapseMobileMenuWidth();
    return;
  }

  cancelMobileMenuCollapse();
  isClosingMobileMenu.value = false;
  mobileMenuOpen.value = true;
  expandMobileMenu();
};

const handleGoToPage = (path: string) => {
  resetMobileMenu();
  router.push(path);
};

const handleGoToLogin = () => {
  if (isAuthBusy.value) return;
  resetMobileMenu();

  if (hasRegisterError.value) {
    send({ type: AuthEventType.GO_TO_LOGIN });
  } else {
    router.push('/login');
  }
};

const handleStartMeeting = () => {
  if (isAuthBusy.value || isMeetingPage.value) return;
  resetMobileMenu();
  createMeeting();
};

const handleLogout = () => {
  resetMobileMenu();
  send({ type: AuthEventType.LOGOUT });
};

const handleGoToFriends = () => {
  resetMobileMenu();
  router.push({ path: '/dashboard', query: { panel: 'friends' } });
};

async function loadAvatar() {
  const token = accessToken.value;
  const request = ++avatarRequest;
  if (!token || !isAuthenticated.value) {
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    avatarObjectUrl = null;
    avatarUrl.value = null;
    return;
  }

  try {
    const profile = await socialApi.getCurrentUserProfile(token);
    if (request !== avatarRequest || !profile.avatarUrl) return;
    const objectUrl = URL.createObjectURL(await socialApi.loadAvatar(token, profile.avatarUrl));
    if (request !== avatarRequest) {
      URL.revokeObjectURL(objectUrl);
      return;
    }
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    avatarObjectUrl = objectUrl;
    avatarUrl.value = objectUrl;
  } catch (error) {
    console.error('[Navbar] Failed to load avatar:', error);
  }
}

function handleProfileUpdated() {
  void loadAvatar();
}

let navResizeObserver: ResizeObserver | undefined;

const updateDesktopNavWidth = () => {
  if (!isDesktop.value || !navCapsuleRef.value || !navContentRef.value) {
    desktopNavWidth.value = undefined;
    return;
  }

  const style = window.getComputedStyle(navCapsuleRef.value);
  const toPixels = (value: string) => parseFloat(value) || 0;
  const horizontalChrome =
    toPixels(style.paddingLeft) +
    toPixels(style.paddingRight) +
    toPixels(style.borderLeftWidth) +
    toPixels(style.borderRightWidth);
  desktopNavWidth.value = navContentRef.value.offsetWidth + horizontalChrome;
};

onMounted(() => {
  window.addEventListener('openmeet:profile-updated', handleProfileUpdated);
  void loadAvatar();
  if (!navContentRef.value) return;
  if (!('ResizeObserver' in window)) {
    updateDesktopNavWidth();
    return;
  }
  navResizeObserver = new ResizeObserver(updateDesktopNavWidth);
  navResizeObserver.observe(navContentRef.value);
  updateDesktopNavWidth();
});

onUnmounted(() => {
  navResizeObserver?.disconnect();
  window.removeEventListener('openmeet:profile-updated', handleProfileUpdated);
  if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
});

watch(isDesktop, () => requestAnimationFrame(updateDesktopNavWidth));
watch(accessToken, () => void loadAvatar());
</script>

<template>
  <motion.nav
    layout-root
    class="marketing-font pointer-events-none fixed inset-x-0 top-3 z-[1030] text-[#102F35]"
    :aria-label="t('nav.navigationTitle')"
  >
    <div
      class="harbor-nav-layout pointer-events-auto mx-auto min-w-[min(340px,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] transition-[height,width] ease-[cubic-bezier(0.22,1,0.36,1)] xl:h-[60px] xl:w-fit xl:transition-none"
      :class="[
        mobileMenuExpanded
          ? isMeetingPage
            ? 'h-auto w-[calc(100vw-1.5rem)] duration-500'
            : 'h-[calc(100svh-1.5rem)] w-[calc(100vw-1.5rem)] duration-500'
          : mobileMenuOpen
            ? `h-[60px] w-[calc(100vw-1.5rem)] ${isClosingMobileMenu ? 'duration-500' : 'duration-300'}`
            : 'h-[60px] w-[min(340px,calc(100vw-1.5rem))] duration-300',
      ]"
    >
      <div
        ref="navCapsuleRef"
        class="harbor-nav-capsule size-full overflow-hidden rounded-[1.875rem] border border-[#D8E7E3] bg-[#FBFCF8] p-3 shadow-[0_16px_42px_rgba(16,47,53,0.1),0_2px_8px_rgba(16,47,53,0.05)] xl:h-full xl:w-max xl:rounded-full xl:px-5 xl:py-0 xl:transition-[width] xl:duration-[360ms] xl:ease-[cubic-bezier(0.22,1,0.36,1)]"
        :class="{ 'harbor-nav-capsule-active': activeDesktopMenu }"
        :style="isDesktop && desktopNavWidth ? { width: `${desktopNavWidth}px` } : undefined"
      >
        <div
          ref="navContentRef"
          class="flex size-full xl:h-full xl:w-max xl:flex-row xl:items-center xl:gap-12"
          :class="mobileMenuExpanded || isClosingMobileMenu ? 'flex-col items-stretch' : 'flex-row items-center'"
        >
          <div class="flex w-full shrink-0 items-center justify-between xl:w-auto">
            <RouterLink
              to="/"
              class="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
            >
              <span
                class="relative flex size-9 items-center justify-center rounded-xl bg-[#0B7A75] text-white shadow-sm"
                aria-hidden="true"
              >
                <Video class="size-5" :stroke-width="2.25" />
                <span class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-[#5AC878]" />
              </span>
              <span class="text-lg font-semibold tracking-[-0.03em]">{{ branding.appName }}</span>
            </RouterLink>

            <button
              type="button"
              class="inline-flex size-10 items-center justify-center rounded-full bg-transparent text-[#173E42] transition-colors hover:bg-[#E6F4F1] hover:text-[#102F35] active:bg-[#D8E7E3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75] xl:hidden"
              :aria-label="mobileMenuOpen ? t('common.close') : t('nav.openNavigation')"
              :aria-expanded="mobileMenuOpen"
              @click="handleToggleMobileMenu"
            >
              <motion.span
                class="flex items-center justify-center"
                :initial="false"
                :animate="
                  prefersReducedMotion
                    ? { rotate: 0, scale: 1 }
                    : { rotate: mobileMenuOpen ? 180 : 0, scale: mobileMenuOpen ? 1.05 : 1 }
                "
                :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }"
              >
                <X v-if="mobileMenuOpen" class="size-5" />
                <Menu v-else class="size-5" />
              </motion.span>
            </button>
          </div>

          <div v-if="isLandingPage" class="hidden items-center gap-1 xl:flex">
            <DropdownMenu v-model:open="whyMenuOpen" :modal="false">
              <DropdownMenuTrigger as-child>
                <button
                  type="button"
                  class="group relative inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-[#27595D] transition-[color,background-color] duration-300 ease-out hover:bg-[#E6F4F1] hover:text-[#0B7A75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75] data-[state=open]:bg-[#E6F4F1] data-[state=open]:text-[#0B7A75]"
                  @mouseenter="handleMenuEnter('why')"
                  @mouseleave="handleMenuLeave"
                >
                  {{ t('nav.why', { appName: branding.appName }) }}
                  <ChevronDown class="size-3.5 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                  <span class="absolute inset-x-0 top-full h-8" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                :side-offset="28"
                class="harbor-floating-menu w-max min-w-80 max-w-[min(25rem,calc(100vw-2rem))] rounded-[1.5rem] border-white/80 bg-white/95 p-2.5 text-[#102F35] shadow-[0_16px_42px_rgba(16,47,53,0.14),0_2px_8px_rgba(16,47,53,0.07)] backdrop-blur-xl"
              >
                <div @mouseenter="handleMenuEnter('why')" @mouseleave="handleMenuLeave">
                  <DropdownMenuItem
                    v-for="item in whyOpenMeetItems"
                    :key="item.title"
                    class="harbor-floating-menu-item cursor-pointer gap-4 rounded-2xl p-3 focus:bg-[#E6F4F1] focus:text-[#102F35]"
                    @select="handleGoToPage(item.path)"
                  >
                    <span
                      class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#E6F4F1] text-[#0B7A75]"
                    >
                      <component :is="item.icon" class="size-5" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <strong class="block text-sm">{{ item.title }}</strong>
                      <span class="mt-0.5 block text-xs leading-5 text-[#61777B]">{{ item.description }}</span>
                    </span>
                    <ArrowRight class="size-4 text-[#9BB4B5]" />
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu v-model:open="deployMenuOpen" :modal="false">
              <DropdownMenuTrigger as-child>
                <button
                  type="button"
                  class="group relative inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-[#27595D] transition-[color,background-color] duration-300 ease-out hover:bg-[#E6F4F1] hover:text-[#0B7A75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75] data-[state=open]:bg-[#E6F4F1] data-[state=open]:text-[#0B7A75]"
                  @mouseenter="handleMenuEnter('deploy')"
                  @mouseleave="handleMenuLeave"
                >
                  {{ t('nav.howToDeploy') }}
                  <ChevronDown class="size-3.5 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                  <span class="absolute inset-x-0 top-full h-8" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                :side-offset="28"
                class="harbor-floating-menu w-max min-w-80 max-w-[min(24rem,calc(100vw-2rem))] rounded-[1.5rem] border-white/80 bg-white/95 p-2.5 text-[#102F35] shadow-[0_16px_42px_rgba(16,47,53,0.14),0_2px_8px_rgba(16,47,53,0.07)] backdrop-blur-xl"
              >
                <div @mouseenter="handleMenuEnter('deploy')" @mouseleave="handleMenuLeave">
                  <div class="px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-[0.13em] text-[#0B7A75]">
                    {{ t('nav.guidesComingNext') }}
                  </div>
                  <DropdownMenuItem
                    v-for="item in deploymentItems"
                    :key="item.title"
                    disabled
                    class="harbor-floating-menu-item gap-4 rounded-2xl p-3 opacity-100 data-[disabled]:opacity-100"
                  >
                    <span
                      class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF3F2] text-[#61777B]"
                    >
                      <component :is="item.icon" class="size-5" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="flex items-center gap-2">
                        <strong class="text-sm">{{ item.title }}</strong>
                        <span
                          class="rounded-full bg-[#FFF0EA] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#A94D3B]"
                        >
                          {{ t('common.soon') }}
                        </span>
                      </span>
                      <span class="mt-0.5 block text-xs leading-5 text-[#61777B]">{{ item.description }}</span>
                    </span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div class="hidden items-center gap-2 xl:flex">
            <template v-if="!isAuthenticated">
              <button
                type="button"
                class="harbor-ghost-action inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold text-[#27595D] transition-[color,background-color] duration-300 hover:bg-[#E6F4F1] hover:text-[#08635F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75] disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="isAuthBusy"
                @click="handleGoToLogin"
              >
                <LoadingRipple v-if="isAuthenticating" size="sm" />
                <template v-else>{{ t('common.logIn') }}</template>
              </button>
            </template>
            <template v-else-if="isAuthenticated && !isCheckingSession">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <button
                    type="button"
                    class="harbor-ghost-action inline-flex size-10 items-center justify-center rounded-full text-[#0B7A75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                    :aria-label="t('nav.accountInformation')"
                    :title="t('nav.accountInformation')"
                  >
                    <img v-if="avatarUrl" :src="avatarUrl" alt="" class="size-full object-cover" />
                    <CircleUserRound v-else class="size-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  :side-offset="12"
                  class="harbor-action-menu min-w-52 rounded-[1.25rem] border-[#D8E7E3] bg-white p-2 text-[#102F35] shadow-[0_20px_55px_rgba(16,47,53,0.16)]"
                >
                  <DropdownMenuItem
                    class="harbor-floating-menu-item cursor-pointer rounded-xl px-3 py-2.5"
                    @select="handleGoToPage('/account')"
                  >
                    {{ t('nav.accountInformation') }}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="harbor-floating-menu-item cursor-pointer rounded-xl px-3 py-2.5"
                    @select="handleGoToPage('/dashboard')"
                  >
                    {{ t('common.dashboard') }}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="harbor-floating-menu-item cursor-pointer rounded-xl px-3 py-2.5"
                    @select="handleGoToFriends"
                  >
                    {{ t('nav.friends') }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator class="my-1 bg-[#E5EFEC]" />
                  <DropdownMenuItem
                    class="cursor-pointer rounded-xl px-3 py-2.5 text-[#9D4636] focus:bg-[#FFF0EA] focus:text-[#9D4636]"
                    :disabled="isAuthBusy"
                    @select="handleLogout"
                  >
                    <LoadingRipple v-if="isLoggingOut" size="sm" />
                    <LogOut v-else class="size-4" />
                    {{ t('common.logOut') }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </template>
            <a
              href="https://github.com/pythonPlant12/openmeet"
              target="_blank"
              rel="noreferrer"
              class="inline-flex size-10 items-center justify-center rounded-full text-[#27595D] transition-[color,background-color] duration-300 hover:bg-[#E6F4F1] hover:text-[#0B7A75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
              :aria-label="t('nav.openSource')"
              :title="t('nav.openSource')"
            >
              <Github class="size-[1.15rem]" />
            </a>
            <Button
              v-if="!isMeetingPage"
              class="harbor-primary-action rounded-full bg-[#0B7A75] px-5 text-white"
              :disabled="isAuthBusy"
              @click="handleStartMeeting"
            >
              <Video class="size-4" />
              {{ t('common.startMeeting') }}
            </Button>
          </div>

          <AnimatePresence>
            <motion.div
              v-if="mobileMenuExpanded"
              key="mobile-navigation"
              :initial="prefersReducedMotion ? false : { opacity: 0, y: -14, scale: 0.985 }"
              :animate="{ opacity: 1, y: 0, scale: 1 }"
              :exit="prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10, scale: 0.99 }"
              :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }"
              class="flex min-h-0 flex-1 flex-col pt-7 xl:hidden"
            >
              <div class="min-h-0 flex-1 overflow-y-auto px-1 pb-5">
                <template v-if="isLandingPage">
                  <p class="px-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0B7A75]">
                    {{ t('nav.why', { appName: branding.appName }) }}
                  </p>
                  <div class="mt-4 grid gap-3 sm:grid-cols-3">
                    <button
                      v-for="item in whyOpenMeetItems"
                      :key="item.title"
                      type="button"
                      class="flex items-center gap-4 rounded-2xl bg-[#E6F4F1] p-4 text-left transition-colors hover:bg-[#D8ECE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75] sm:flex-col sm:items-start"
                      @click="handleGoToPage(item.path)"
                    >
                      <span
                        class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#0B7A75]"
                      >
                        <component :is="item.icon" class="size-5" />
                      </span>
                      <span>
                        <strong class="block">{{ item.title }}</strong>
                        <span class="mt-1 block text-sm leading-6 text-[#61777B]">{{ item.description }}</span>
                      </span>
                    </button>
                  </div>

                  <div class="my-8 h-px bg-[#D8E7E3]" />

                  <div class="flex items-center justify-between gap-4 px-2">
                    <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B7A75]">
                      {{ t('nav.howToDeploy') }}
                    </p>
                    <span class="text-xs text-[#61777B]">{{ t('nav.guidesComingSoon') }}</span>
                  </div>
                  <div class="mt-4 divide-y divide-[#D8E7E3] rounded-2xl border border-[#D8E7E3] bg-white px-4">
                    <div v-for="item in deploymentItems" :key="item.title" class="flex items-center gap-4 py-4">
                      <span
                        class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF3F2] text-[#61777B]"
                      >
                        <component :is="item.icon" class="size-5" />
                      </span>
                      <span class="min-w-0 flex-1">
                        <strong class="block text-sm">{{ item.title }}</strong>
                        <span class="mt-0.5 block text-xs text-[#61777B]">{{ item.description }}</span>
                      </span>
                      <span
                        class="rounded-full bg-[#FFF0EA] px-2 py-1 text-[10px] font-semibold uppercase text-[#A94D3B]"
                      >
                        {{ t('common.soon') }}
                      </span>
                    </div>
                  </div>
                </template>
              </div>

              <div class="mt-5 shrink-0 space-y-3 border-t border-[#D8E7E3] pt-5">
                <div class="flex items-center justify-end gap-3">
                  <Button
                    v-if="isAuthenticated && !isCheckingSession"
                    variant="outline"
                    class="harbor-soft-action mr-auto min-h-11 rounded-full border-transparent bg-[#E6F4F1] px-5 text-[#27595D]"
                    @click="handleGoToPage('/dashboard')"
                  >
                    {{ t('common.dashboard') }}
                  </Button>
                  <button
                    v-if="!isAuthenticated"
                    type="button"
                    class="inline-flex size-11 items-center justify-center rounded-full bg-[#E6F4F1] text-[#0B7A75] transition-colors hover:bg-[#D8E7E3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75] disabled:opacity-50"
                    :disabled="isAuthBusy"
                    :aria-label="t('common.logIn')"
                    @click="handleGoToLogin"
                  >
                    <LoadingRipple v-if="isAuthenticating" size="sm" />
                    <LogIn v-else class="size-5" />
                  </button>
                  <button
                    v-else
                    type="button"
                    class="inline-flex size-11 items-center justify-center rounded-full bg-[#FDE9E4] text-[#D95E49] transition-colors hover:bg-[#F8D8CC] hover:text-[#B94C39] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2765F] disabled:opacity-50"
                    :disabled="isAuthBusy"
                    :aria-label="t('common.logOut')"
                    @click="handleLogout"
                  >
                    <LoadingRipple v-if="isLoggingOut" size="sm" />
                    <LogOut v-else class="size-5" />
                  </button>
                  <a
                    href="https://github.com/pythonPlant12/openmeet"
                    target="_blank"
                    rel="noreferrer"
                    class="inline-flex size-11 items-center justify-center rounded-full bg-[#E6F4F1] text-[#0B7A75] transition-colors hover:bg-[#D8E7E3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                    :aria-label="t('nav.openSource')"
                  >
                    <Github class="size-5" />
                  </a>
                </div>
                <Button
                  v-if="!isMeetingPage"
                  class="harbor-primary-action min-h-11 w-full rounded-full bg-[#0B7A75] text-white"
                  :disabled="isAuthBusy"
                  @click="handleStartMeeting"
                >
                  <Video class="size-4" />
                  {{ t('common.startMeeting') }}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  </motion.nav>
</template>
