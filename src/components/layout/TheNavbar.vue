<script setup lang="ts">
import { useMediaQuery, useTimeoutFn } from '@vueuse/core';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Code2,
  Container,
  Copy,
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import AccountMenuContent from '@/components/layout/AccountMenuContent.vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTitle, HarborDialogContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingRipple } from '@/components/ui/loading';
import { useAuth } from '@/composables/useAuth';
import { useMeetingNavigation } from '@/composables/useMeetingNavigation';
import { useOwnProfile } from '@/composables/useOwnProfile';
import { useBranding } from '@/config/branding.config';
import { USER_STATUS_OPTIONS } from '@/config/user-status.config';
import type { UserStatus } from '@/services/social-api';
import { AuthEventType } from '@/xstate/machines/auth/types';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const branding = useBranding();
const { createMeeting } = useMeetingNavigation();
const { state, isAuthenticating, isRegistering, isCheckingSession, isAuthenticated, hasRegisterError, send } =
  useAuth();

const mobileMenuOpen = ref(false);
const mobileMenuExpanded = ref(false);
const mobileMenuIconOpen = ref(false);
const isClosingMobileMenu = ref(false);
const activeDesktopMenu = ref<DesktopMenu | null>(null);
const isDesktop = useMediaQuery('(min-width: 1280px)');
const isMobile = useMediaQuery('(max-width: 639px)');
const supportsHover = useMediaQuery('(hover: hover) and (pointer: fine)');
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const navCapsuleRef = ref<HTMLElement | null>(null);
const navContentRef = ref<HTMLElement | null>(null);
const mobileMenuShellRef = ref<HTMLElement | null>(null);
const desktopNavWidth = ref<number>();
const mobileMenuHeight = ref<number>();
const mobileScrollAreaRef = ref<HTMLElement | null>(null);
const mobileAccountActionsRef = ref<HTMLElement | null>(null);
const closingMobileMenuIsContentSized = ref(false);
const { avatarUrl, nickname, ownStatus, ownStatusOption, isNicknameCopied, setOwnStatus, copyNickname } =
  useOwnProfile();
const isMobileStatusOpen = ref(false);
const mobileStatusRef = ref<HTMLElement | null>(null);
// The expanded status picker collapses (with its usual animation) on any press outside it.
const closeMobileStatusOnOutsidePress = (event: PointerEvent) => {
  if (!isMobileStatusOpen.value || mobileStatusRef.value?.contains(event.target as Node)) return;
  isMobileStatusOpen.value = false;
};
const isMeetingChatOpen = ref(false);
const isDashboardChatOpen = ref(false);
const isLandingPage = computed(() => route.meta.showMarketingNav === true);
const isMeetingPage = computed(() => route.name === 'meeting');
const isDashboardPage = computed(() => route.name === 'dashboard');
// In a meeting the account button sits 12px above the centered control bar (16px offset + 58px bar on phones).
const mobileNavBottomClass = computed(() =>
  isMeetingPage.value ? 'bottom-[5.375rem]' : isDashboardPage.value ? 'bottom-4' : 'bottom-6',
);
const hasContentSizedMobileMenu = computed(() => isAuthenticated.value);
const activeMobileMenuIsContentSized = computed(() =>
  isClosingMobileMenu.value ? closingMobileMenuIsContentSized.value : hasContentSizedMobileMenu.value,
);
const homePath = computed(() => (isAuthenticated.value ? '/dashboard' : '/'));
const showMarketingNavigation = computed(() => !isAuthenticated.value && (isLandingPage.value || isMeetingPage.value));
const isAuthBusy = computed(
  () => isAuthenticating.value || isRegistering.value || isCheckingSession.value || state.value.value === 'loggingOut',
);
const isLoggingOut = computed(() => state.value.value === 'loggingOut');
const MOBILE_MENU_FIRST_ITEM_DELAY = 0.08;
const MOBILE_MENU_LAST_ITEM_DELAY = 0.74;
const ACCOUNT_MENU_LAST_ITEM_DELAY = 0.32;
const MEETING_ACCOUNT_MENU_LAST_ITEM_DELAY = 0.26;
const MOBILE_MENU_ITEM_ENTER_DURATION = 0.28;
const MOBILE_MENU_ITEM_EXIT_DURATION = 0.22;
const ACCOUNT_MENU_COLLAPSE_DELAY = 400;
// The account sheet shrinks back into its button as soon as it starts closing, and the button
// returns when the sheet's exit animation ends (see `.harbor-mobile-account-sheet` in index.css).
const MOBILE_ACCOUNT_SHEET_CONTENT_EXIT_DURATION = 0;
const MOBILE_ACCOUNT_SHEET_EXIT_DURATION = 260;
const accountMenuLastItemDelay = computed(() =>
  isMeetingPage.value ? MEETING_ACCOUNT_MENU_LAST_ITEM_DELAY : ACCOUNT_MENU_LAST_ITEM_DELAY,
);
// The account drawer has few items, so its height collapse starts early and overlaps the final item fade.
const mobileMenuItemsExitDuration = () =>
  hasContentSizedMobileMenu.value
    ? isMobile.value
      ? MOBILE_ACCOUNT_SHEET_CONTENT_EXIT_DURATION
      : ACCOUNT_MENU_COLLAPSE_DELAY
    : Math.round((MOBILE_MENU_LAST_ITEM_DELAY - MOBILE_MENU_FIRST_ITEM_DELAY + MOBILE_MENU_ITEM_EXIT_DURATION) * 1000);
const MOBILE_MENU_HEIGHT_DURATION = 360;
const MOBILE_MENU_ICON_START_OFFSET = 300;

const mobileMenuItemMotion = (delay: number, lastItemDelay = MOBILE_MENU_LAST_ITEM_DELAY) => ({
  initial: prefersReducedMotion.value ? false : { opacity: 0, y: -8 },
  animate: isClosingMobileMenu.value ? { opacity: 0, y: 8 } : { opacity: 1, y: 0 },
  transition: prefersReducedMotion.value
    ? { duration: 0 }
    : {
        duration: isClosingMobileMenu.value ? MOBILE_MENU_ITEM_EXIT_DURATION : MOBILE_MENU_ITEM_ENTER_DURATION,
        delay: isClosingMobileMenu.value ? Math.round((lastItemDelay - delay) * 100) / 100 : delay,
        ease: 'easeOut' as const,
      },
});

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
  180,
  { immediate: false },
);

const { start: hideMobileMenuContent, stop: cancelMobileMenuContentExit } = useTimeoutFn(
  () => {
    mobileMenuExpanded.value = false;
    scheduleMobileMenuCollapse();
  },
  mobileMenuItemsExitDuration,
  { immediate: false },
);

let mobileMenuCollapseTimer: number | undefined;
let mobileMenuIconCloseTimer: number | undefined;
let mobileMenuCollapseGeneration = 0;

const cancelMobileMenuCollapse = () => {
  mobileMenuCollapseGeneration += 1;
  window.clearTimeout(mobileMenuCollapseTimer);
  window.clearTimeout(mobileMenuIconCloseTimer);
  mobileMenuCollapseTimer = undefined;
  mobileMenuIconCloseTimer = undefined;
};

const parseCssTime = (value: string) =>
  value.endsWith('ms') ? Number.parseFloat(value) : Number.parseFloat(value) * 1000;

const getMobileMenuCollapseDuration = () => {
  if (isAuthenticated.value && isMobile.value) return MOBILE_ACCOUNT_SHEET_EXIT_DURATION;
  if (!navCapsuleRef.value) return MOBILE_MENU_HEIGHT_DURATION;
  const durations = window
    .getComputedStyle(navCapsuleRef.value)
    .transitionDuration.split(',')
    .map((value) => parseCssTime(value.trim()))
    .filter(Number.isFinite);
  return Math.max(...durations, MOBILE_MENU_HEIGHT_DURATION);
};

const scheduleMobileMenuCollapse = () => {
  const generation = mobileMenuCollapseGeneration;
  void nextTick(() => {
    if (generation !== mobileMenuCollapseGeneration || !isClosingMobileMenu.value) return;
    const collapseDuration = getMobileMenuCollapseDuration();
    const iconDelay = Math.max(0, collapseDuration - MOBILE_MENU_ICON_START_OFFSET);
    mobileMenuIconCloseTimer = window.setTimeout(() => {
      mobileMenuIconOpen.value = false;
    }, iconDelay);
    mobileMenuCollapseTimer = window.setTimeout(() => {
      mobileMenuOpen.value = false;
      isClosingMobileMenu.value = false;
    }, collapseDuration);
  });
};
let bodyOverflow = '';
let documentOverflow = '';
let documentScrollbarGutter = '';

const setMobileMenuPageScroll = (locked: boolean) => {
  if (locked) {
    bodyOverflow = document.body.style.overflow;
    documentOverflow = document.documentElement.style.overflow;
    documentScrollbarGutter = document.documentElement.style.scrollbarGutter;
    // WebKit excludes a classic scrollbar from media query widths. Removing it can cross the
    // desktop breakpoint, which resets this menu while it opens, so keep its space reserved.
    if (window.innerWidth > document.documentElement.clientWidth) {
      document.documentElement.style.scrollbarGutter = 'stable';
    }
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return;
  }

  document.body.style.overflow = bodyOverflow;
  document.documentElement.style.overflow = documentOverflow;
  document.documentElement.style.scrollbarGutter = documentScrollbarGutter;
};

const resetMobileMenu = () => {
  isMobileStatusOpen.value = false;
  cancelMobileMenuExpansion();
  cancelMobileMenuContentExit();
  cancelMobileMenuCollapse();
  mobileMenuExpanded.value = false;
  mobileMenuOpen.value = false;
  mobileMenuIconOpen.value = false;
  isClosingMobileMenu.value = false;
  closingMobileMenuIsContentSized.value = false;
};

const closeMobileMenu = (afterClose?: () => void) => {
  if (isClosingMobileMenu.value) return;

  if (!mobileMenuOpen.value || !mobileMenuExpanded.value || prefersReducedMotion.value) {
    resetMobileMenu();
    afterClose?.();
    return;
  }

  cancelMobileMenuExpansion();
  cancelMobileMenuContentExit();
  cancelMobileMenuCollapse();
  closingMobileMenuIsContentSized.value = hasContentSizedMobileMenu.value;
  isClosingMobileMenu.value = true;
  if (closingMobileMenuIsContentSized.value) mobileMenuIconOpen.value = false;
  // Navigate now; page transitions run alongside the drawer's independent exit sequence.
  afterClose?.();
  hideMobileMenuContent();
};

const handleMobileAccountSheetOpen = (open: boolean) => {
  if (!open) closeMobileMenu();
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
    // Preserve the active drawer while its exit animation finishes on the destination page.
    if (!isClosingMobileMenu.value) resetMobileMenu();
    activeDesktopMenu.value = null;
  },
);

watch(mobileMenuExpanded, setMobileMenuPageScroll);

const handleToggleMobileMenu = () => {
  if (prefersReducedMotion.value) {
    const open = !mobileMenuOpen.value;
    resetMobileMenu();
    mobileMenuOpen.value = open;
    mobileMenuExpanded.value = open;
    mobileMenuIconOpen.value = open;
    return;
  }

  if (isClosingMobileMenu.value) {
    return;
  }

  if (mobileMenuOpen.value) {
    closeMobileMenu();
    return;
  }

  cancelMobileMenuCollapse();
  cancelMobileMenuContentExit();
  isClosingMobileMenu.value = false;
  mobileMenuOpen.value = true;
  mobileMenuIconOpen.value = true;
  if (isAuthenticated.value && isMobile.value) {
    mobileMenuExpanded.value = true;
    return;
  }
  expandMobileMenu();
};

const handleGoToPage = (path: string) => {
  closeMobileMenu(() => router.push(path));
};

const handleBrandNavigation = (event: MouseEvent) => {
  if (isMeetingPage.value && isMobile.value && isMeetingChatOpen.value) {
    event.preventDefault();
    window.dispatchEvent(new Event('openmeet:close-meeting-chat'));
    closeMobileMenu(() => router.push('/dashboard'));
    return;
  }

  if (mobileMenuOpen.value) {
    event.preventDefault();
    closeMobileMenu(() => router.push(homePath.value));
  }
};

function handleMeetingChatState(event: Event) {
  isMeetingChatOpen.value = (event as CustomEvent<boolean>).detail;
  if (isMeetingChatOpen.value) closeMobileMenu();
}

function handleDashboardChatState(event: Event) {
  isDashboardChatOpen.value = (event as CustomEvent<boolean>).detail;
  if (isDashboardChatOpen.value) closeMobileMenu();
}

const handleGoToLogin = () => {
  if (isAuthBusy.value) return;
  if (hasRegisterError.value) {
    closeMobileMenu(() => send({ type: AuthEventType.GO_TO_LOGIN }));
  } else {
    closeMobileMenu(() => router.push('/login'));
  }
};

const handleStartMeeting = () => {
  if (isAuthBusy.value || isMeetingPage.value) return;
  closeMobileMenu(createMeeting);
};

const handleQuitMeeting = () => {
  if (!isMeetingPage.value) return;
  closeMobileMenu(() => router.push('/'));
};

const handleLogout = () => {
  closeMobileMenu(() => send({ type: AuthEventType.LOGOUT }));
};

const handleGoToFriends = () => {
  closeMobileMenu(() => router.push({ path: '/dashboard', query: { panel: 'friends' } }));
};

function selectMobileStatus(status: UserStatus) {
  isMobileStatusOpen.value = false;
  void setOwnStatus(status);
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

const syncMobileMenuHeight = () => {
  if (!mobileMenuExpanded.value || !activeMobileMenuIsContentSized.value || !navCapsuleRef.value) {
    mobileMenuHeight.value = undefined;
    return;
  }

  void nextTick(() => {
    const capsule = navCapsuleRef.value;
    const scrollArea = mobileScrollAreaRef.value;
    const content = mobileAccountActionsRef.value;
    if (!capsule || !scrollArea || !content) return;
    // The scroll area is stretched to the drawer, so swap its box height for the content's natural
    // height: the drawer then fits its content exactly, both when it grows and when it shrinks.
    const scrollStyle = window.getComputedStyle(scrollArea);
    const scrollPadding = (parseFloat(scrollStyle.paddingTop) || 0) + (parseFloat(scrollStyle.paddingBottom) || 0);
    const naturalHeight = capsule.offsetHeight - scrollArea.clientHeight + content.offsetHeight + scrollPadding;
    // Same cap as the shell's max height: the viewport minus the navbar's top and bottom margins.
    if (naturalHeight > 0) mobileMenuHeight.value = Math.min(naturalHeight, window.innerHeight - 24);
  });
};

const updateNavLayout = () => {
  updateDesktopNavWidth();
  syncMobileMenuHeight();
};

onMounted(() => {
  window.addEventListener('openmeet:meeting-chat-state', handleMeetingChatState);
  window.addEventListener('openmeet:dashboard-chat-state', handleDashboardChatState);
  document.addEventListener('pointerdown', closeMobileStatusOnOutsidePress, true);
  if (!navContentRef.value) return;
  if (!('ResizeObserver' in window)) {
    updateNavLayout();
    return;
  }
  navResizeObserver = new ResizeObserver(updateNavLayout);
  navResizeObserver.observe(navContentRef.value);
  updateNavLayout();
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', closeMobileStatusOnOutsidePress, true);
  cancelMobileMenuExpansion();
  cancelMobileMenuContentExit();
  cancelMobileMenuCollapse();
  setMobileMenuPageScroll(false);
  navResizeObserver?.disconnect();
  window.removeEventListener('openmeet:meeting-chat-state', handleMeetingChatState);
  window.removeEventListener('openmeet:dashboard-chat-state', handleDashboardChatState);
});

watch([isDesktop, mobileMenuExpanded, activeMobileMenuIsContentSized], () => requestAnimationFrame(updateNavLayout));
// The account content changes size when the status picker expands, so the drawer follows it.
watch(mobileAccountActionsRef, (element, previous) => {
  if (previous) navResizeObserver?.unobserve(previous);
  if (element) navResizeObserver?.observe(element);
});
</script>

<template>
  <template v-if="isAuthenticated && !isCheckingSession && isMobile && !isMeetingChatOpen && !isDashboardChatOpen">
    <motion.nav
      class="marketing-font pointer-events-none fixed right-4 z-[1030] w-12 text-[#102F35]"
      :class="mobileNavBottomClass"
    >
      <!-- The sheet grows out of this button and shrinks back into it, so the button stays hidden for the whole open and close sequence. -->
      <div v-if="!mobileMenuOpen" class="pointer-events-auto flex">
        <button
          type="button"
          class="relative flex size-12 shrink-0 items-center justify-center rounded-xl border-2 bg-[#FBFCF8] p-1 shadow-[0_4px_12px_rgba(16,47,53,0.12)] transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
          :class="ownStatusOption.borderClass"
          :aria-label="t('nav.accountInformation')"
          :aria-expanded="mobileMenuOpen"
          @click="handleToggleMobileMenu"
        >
          <span class="flex size-full items-center justify-center overflow-hidden rounded-[0.55rem] bg-[#FBFCF8]">
            <img v-if="avatarUrl" :src="avatarUrl" alt="" class="size-full object-cover" />
            <CircleUserRound v-else class="size-5" />
          </span>
          <span
            v-if="ownStatus"
            role="img"
            :aria-label="ownStatusOption.label"
            class="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-[3px] border-[#FBFCF8]"
            :class="ownStatusOption.dotClass"
          />
        </button>
      </div>
      <Dialog :open="mobileMenuExpanded" @update:open="handleMobileAccountSheetOpen">
        <HarborDialogContent
          hide-close
          overlay-class="harbor-mobile-account-overlay bg-[#102F35]/20 backdrop-blur-[2px]"
          :class="[
            'harbor-mobile-account-sheet fixed right-4 left-auto top-auto flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-[1.75rem] border border-[#D8E7E3] bg-[#FBFCF8] p-4 shadow-[0_-16px_42px_rgba(16,47,53,0.16)]',
            mobileNavBottomClass,
            { 'harbor-mobile-account-sheet-closing': isClosingMobileMenu },
          ]"
          aria-label="Account navigation"
        >
          <DialogTitle class="sr-only">Account navigation</DialogTitle>
          <div
            data-mobile-account-sheet-handle
            class="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-[#BBDDD6]"
            aria-hidden="true"
          />
          <div data-mobile-account-sheet-header class="flex items-center gap-3 border-b border-[#D8E7E3] pb-4">
            <button
              type="button"
              class="harbor-ghost-action relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 p-0"
              :class="[ownStatusOption.chipClass, ownStatusOption.borderClass]"
              :aria-label="t('nav.accountInformation')"
              @click="handleGoToPage('/account')"
            >
              <img v-if="avatarUrl" :src="avatarUrl" alt="" class="size-full rounded-[0.55rem] object-cover" />
              <CircleUserRound v-else class="size-5" />
              <span
                v-if="ownStatus"
                class="absolute bottom-1 right-1 size-3 rounded-full border-2 border-[#FBFCF8]"
                :class="ownStatusOption.dotClass"
              />
            </button>
            <div class="min-w-0 flex-1">
              <button
                type="button"
                class="harbor-ghost-action w-full rounded-xl px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                @click="handleGoToPage('/account')"
              >
                <span class="block font-semibold text-[#102F35]">{{ t('nav.accountInformation') }}</span>
              </button>
              <button
                v-if="nickname"
                type="button"
                data-copy-nickname
                class="harbor-ghost-action ml-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-[#61777B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                :aria-label="
                  isNicknameCopied ? t('nav.nicknameCopied') : t('nav.copyNickname', { nickname: `@${nickname}` })
                "
                @click="copyNickname"
              >
                <span class="truncate">@{{ nickname }}</span>
                <Check v-if="isNicknameCopied" class="size-3 shrink-0" /><Copy v-else class="size-3 shrink-0" />
              </button>
            </div>
            <button
              type="button"
              class="harbor-ghost-action flex size-10 shrink-0 items-center justify-center rounded-full text-[#27595D]"
              :aria-label="t('common.close')"
              @click="closeMobileMenu()"
            >
              <X class="size-5" />
            </button>
          </div>
          <div data-mobile-account-sheet-body class="min-h-0 flex-1 overflow-y-auto py-4">
            <div class="space-y-1">
              <button
                type="button"
                class="harbor-ghost-action flex min-h-11 w-full items-center rounded-xl px-3 text-left font-semibold text-[#27595D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                @click="handleGoToPage('/dashboard')"
              >
                {{ t('common.dashboard') }}
              </button>
              <button
                type="button"
                class="harbor-ghost-action flex min-h-11 w-full items-center rounded-xl px-3 text-left font-semibold text-[#27595D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                @click="handleGoToFriends"
              >
                {{ t('nav.friends') }}
              </button>
            </div>
            <div v-if="ownStatus" ref="mobileStatusRef" class="mt-4 border-t border-[#D8E7E3] pt-4">
              <button
                type="button"
                data-mobile-status-toggle
                class="harbor-ghost-action flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-[#102F35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                :aria-expanded="isMobileStatusOpen"
                aria-controls="mobile-status-options"
                @click="isMobileStatusOpen = !isMobileStatusOpen"
              >
                <span class="size-2.5 shrink-0 rounded-full" :class="ownStatusOption.dotClass" />
                <span class="min-w-0 flex-1">{{ t('nav.status') }}</span>
                <ChevronDown
                  class="size-4 shrink-0 text-[#61777B] transition-transform duration-200"
                  :class="{ 'rotate-180': isMobileStatusOpen }"
                />
              </button>
              <div
                id="mobile-status-options"
                class="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                :class="isMobileStatusOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
              >
                <div class="min-h-0 overflow-hidden" :inert="!isMobileStatusOpen">
                  <div
                    data-mobile-status-options
                    role="radiogroup"
                    :aria-label="t('nav.status')"
                    class="mt-2 space-y-1"
                  >
                    <button
                      v-for="option in USER_STATUS_OPTIONS"
                      :key="option.value"
                      type="button"
                      role="radio"
                      :aria-checked="option.value === ownStatus"
                      :data-status-option="option.value"
                      class="harbor-ghost-action flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left"
                      :class="option.value === ownStatus ? 'bg-[#E6F4F1]' : ''"
                      @click="selectMobileStatus(option.value)"
                    >
                      <span class="size-2.5 shrink-0 rounded-full" :class="option.dotClass" />
                      <span class="min-w-0 flex-1 text-sm font-semibold text-[#102F35]">{{ option.label }}</span>
                      <Check v-if="option.value === ownStatus" class="size-4 shrink-0 text-[#0B7A75]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div data-mobile-account-sheet-footer class="space-y-2 border-t border-[#D8E7E3] pt-4">
            <Button
              type="button"
              class="harbor-primary-action min-h-11 w-full rounded-full bg-[#0B7A75] text-white"
              :disabled="isAuthBusy"
              @click="isMeetingPage ? handleQuitMeeting() : handleStartMeeting()"
            >
              <LogOut v-if="isMeetingPage" class="size-4" /><Video v-else class="size-4" />
              {{ isMeetingPage ? t('common.quitMeeting') : t('common.startMeeting') }}
            </Button>
            <button
              type="button"
              class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#9D4636] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
              :disabled="isAuthBusy"
              @click="handleLogout"
            >
              <LoadingRipple v-if="isLoggingOut" size="sm" /><LogOut v-else class="size-4" />
              {{ t('common.logOut') }}
            </button>
          </div>
        </HarborDialogContent>
      </Dialog>
    </motion.nav>
  </template>
  <button
    v-if="mobileMenuExpanded && !isClosingMobileMenu && (!isAuthenticated || !isMobile)"
    type="button"
    class="fixed inset-0 z-[1020] cursor-default bg-transparent"
    aria-label="Close navigation"
    @pointerdown.stop
    @click.stop="closeMobileMenu()"
  />
  <motion.nav
    v-if="!isAuthenticated || !isMobile"
    layout-root
    class="marketing-font pointer-events-none fixed inset-x-0 top-3 z-[1030] text-[#102F35]"
    :aria-label="t('nav.navigationTitle')"
  >
    <div
      ref="mobileMenuShellRef"
      :style="mobileMenuHeight ? { height: `${mobileMenuHeight}px` } : undefined"
      class="harbor-nav-layout pointer-events-auto mx-auto min-w-[min(340px,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] max-w-[calc(100vw-1.5rem)] transition-[height,width] ease-[cubic-bezier(0.22,1,0.36,1)] xl:relative xl:left-1/2 xl:mx-0 xl:-translate-x-1/2 xl:h-[60px] xl:w-fit xl:transition-none"
      :class="[
        mobileMenuExpanded
          ? activeMobileMenuIsContentSized
            ? `${mobileMenuHeight ? '' : 'h-[60px] '}w-[calc(100vw-1.5rem)] duration-[360ms]`
            : 'h-[calc(100svh-1.5rem)] w-[calc(100vw-1.5rem)] duration-500'
          : mobileMenuOpen
            ? `h-[60px] w-[calc(100vw-1.5rem)] ${isClosingMobileMenu ? 'duration-[360ms]' : 'duration-300'}`
            : 'h-[60px] w-[min(340px,calc(100vw-1.5rem))] duration-300',
      ]"
    >
      <div
        ref="navCapsuleRef"
        class="harbor-nav-capsule flex size-full flex-col overflow-hidden rounded-[1.875rem] border border-[#D8E7E3] bg-[#FBFCF8] p-3 shadow-[0_16px_42px_rgba(16,47,53,0.1),0_2px_8px_rgba(16,47,53,0.05)] xl:h-full xl:w-max xl:flex-none xl:rounded-full xl:px-5 xl:py-0 xl:transition-[width] xl:duration-[360ms] xl:ease-[cubic-bezier(0.22,1,0.36,1)]"
        :class="{ 'harbor-nav-capsule-active': activeDesktopMenu }"
        :style="isDesktop && desktopNavWidth ? { width: `${desktopNavWidth}px` } : undefined"
      >
        <div
          ref="navContentRef"
          class="flex w-full xl:h-full xl:w-max xl:flex-row xl:items-center xl:gap-12"
          :class="[
            mobileMenuExpanded || isClosingMobileMenu
              ? 'min-h-0 flex-1 flex-col items-stretch'
              : 'h-full flex-row items-center',
            { 'pointer-events-none': isClosingMobileMenu },
          ]"
        >
          <div class="flex w-full shrink-0 items-center justify-between xl:w-auto">
            <RouterLink
              :to="homePath"
              class="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
              @click="handleBrandNavigation"
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
                  prefersReducedMotion ? { rotate: 0, scale: 1 } : { rotate: mobileMenuIconOpen ? 180 : 0, scale: 1 }
                "
                :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }"
              >
                <X v-if="mobileMenuIconOpen" class="size-5" />
                <Menu v-else class="size-5" />
              </motion.span>
            </button>
          </div>

          <div v-if="showMarketingNavigation" class="hidden items-center gap-1 xl:flex">
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
                    class="harbor-ghost-action relative inline-flex size-[2.625rem] items-center justify-center rounded-xl border-2 p-1 transition-[background-color,border-color,border-width,color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75] data-[state=open]:border-2 data-[state=open]:border-[#0B7A75]"
                    :class="[ownStatusOption.chipClass, ownStatusOption.borderClass]"
                    :aria-label="t('nav.accountInformation')"
                    :title="t('nav.accountInformation')"
                  >
                    <img v-if="avatarUrl" :src="avatarUrl" alt="" class="size-full rounded-[0.55rem] object-cover" />
                    <CircleUserRound v-else class="size-5" />
                    <span
                      v-if="ownStatus"
                      data-own-status-dot
                      role="img"
                      :aria-label="ownStatusOption.label"
                      class="pointer-events-none absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-[3px] border-[#FBFCF8]"
                      :class="ownStatusOption.dotClass"
                    />
                  </button>
                </DropdownMenuTrigger>
                <AccountMenuContent
                  :nickname="nickname"
                  :own-status="ownStatus"
                  :is-nickname-copied="isNicknameCopied"
                  @copy-nickname="copyNickname"
                  @set-status="setOwnStatus"
                />
              </DropdownMenu>
              <!-- The meeting action sits right of the avatar, like Quit meeting does inside a meeting. -->
              <Button
                v-if="!isMeetingPage"
                class="harbor-primary-action rounded-full bg-[#0B7A75] px-5 text-white"
                :disabled="isAuthBusy"
                @click="handleStartMeeting"
              >
                <Video class="size-4" />
                {{ t('common.startMeeting') }}
              </Button>
            </template>
            <a
              v-if="!isAuthenticated"
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
              v-if="isMeetingPage"
              class="harbor-primary-action rounded-full bg-[#0B7A75] px-5 text-white"
              :disabled="isAuthBusy"
              @click="handleQuitMeeting"
            >
              <LogOut class="size-4" />
              {{ t('common.quitMeeting') }}
            </Button>
            <Button
              v-if="!isAuthenticated && !isMeetingPage"
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
              :exit="prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -14, scale: 0.985 }"
              :transition="prefersReducedMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }"
              class="flex min-h-0 flex-1 flex-col pt-7 xl:hidden"
            >
              <div ref="mobileScrollAreaRef" class="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-1 pb-5">
                <div
                  v-if="isAuthenticated && !isCheckingSession"
                  ref="mobileAccountActionsRef"
                  data-mobile-account-actions
                  class="space-y-2"
                >
                  <motion.div v-bind="mobileMenuItemMotion(0.08, accountMenuLastItemDelay)">
                    <div
                      data-mobile-account-card
                      class="harbor-ghost-action relative flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left"
                    >
                      <button
                        type="button"
                        class="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                        :aria-label="t('nav.accountInformation')"
                        @click="handleGoToPage('/account')"
                      />
                      <span
                        class="pointer-events-none relative flex size-11 shrink-0 items-center justify-center rounded-xl border-2 p-1"
                        :class="[ownStatusOption.chipClass, ownStatusOption.borderClass]"
                      >
                        <img
                          v-if="avatarUrl"
                          :src="avatarUrl"
                          alt=""
                          class="size-full rounded-[0.55rem] object-cover"
                        />
                        <CircleUserRound v-else class="size-5" />
                        <span
                          v-if="ownStatus"
                          class="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-[3px] border-[#FBFCF8]"
                          :class="ownStatusOption.dotClass"
                        />
                      </span>
                      <span class="pointer-events-none min-w-0 flex-1">
                        <span class="block font-semibold text-[#102F35]">{{ t('nav.accountInformation') }}</span>
                        <button
                          v-if="nickname"
                          type="button"
                          data-copy-nickname
                          class="pointer-events-auto relative mt-0.5 inline-flex max-w-full items-center gap-1 rounded-md text-xs font-medium text-[#27595D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                          :aria-label="
                            isNicknameCopied
                              ? t('nav.nicknameCopied')
                              : t('nav.copyNickname', { nickname: `@${nickname}` })
                          "
                          @click="copyNickname"
                        >
                          <span class="truncate">@{{ nickname }}</span>
                          <Check v-if="isNicknameCopied" class="size-3 shrink-0" />
                          <Copy v-else class="size-3 shrink-0" />
                        </button>
                      </span>
                      <ChevronRight class="pointer-events-none size-4 text-[#61777B]" />
                    </div>
                    <div v-if="ownStatus" ref="mobileStatusRef" data-mobile-status class="mt-2 px-1">
                      <button
                        type="button"
                        data-mobile-status-toggle
                        class="flex min-h-11 w-full items-center gap-2 rounded-xl border border-[#D8E7E3] bg-white px-3 text-left text-sm font-semibold text-[#102F35]"
                        :aria-expanded="isMobileStatusOpen"
                        aria-controls="mobile-status-options"
                        @click="isMobileStatusOpen = !isMobileStatusOpen"
                      >
                        <span class="size-2.5 shrink-0 rounded-full" :class="ownStatusOption.dotClass" />
                        <span class="min-w-0 flex-1 truncate">{{ t('nav.status') }}</span>
                        <ChevronDown
                          class="size-4 shrink-0 text-[#61777B] transition-transform duration-200"
                          :class="{ 'rotate-180': isMobileStatusOpen }"
                        />
                      </button>
                      <div
                        id="mobile-status-options"
                        class="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                        :class="isMobileStatusOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
                      >
                        <div class="min-h-0 overflow-hidden" :inert="!isMobileStatusOpen">
                          <div
                            data-mobile-status-options
                            role="radiogroup"
                            :aria-label="t('nav.status')"
                            class="mt-1 space-y-0.5 rounded-xl border border-[#D8E7E3] bg-white p-1"
                          >
                            <button
                              v-for="option in USER_STATUS_OPTIONS"
                              :key="option.value"
                              type="button"
                              role="radio"
                              :aria-checked="option.value === ownStatus"
                              :data-status-option="option.value"
                              class="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left"
                              :class="option.value === ownStatus ? 'bg-[#E6F4F1]' : ''"
                              @click="selectMobileStatus(option.value)"
                            >
                              <span class="size-2.5 shrink-0 rounded-full" :class="option.dotClass" />
                              <span class="min-w-0 flex-1 text-sm font-semibold text-[#102F35]">{{
                                option.label
                              }}</span>
                              <Check v-if="option.value === ownStatus" class="size-4 shrink-0 text-[#0B7A75]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  <motion.div v-bind="mobileMenuItemMotion(0.14, accountMenuLastItemDelay)">
                    <button
                      type="button"
                      class="harbor-ghost-action flex min-h-11 w-full items-center rounded-xl px-3 text-left font-semibold text-[#27595D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                      @click="handleGoToPage('/dashboard')"
                    >
                      {{ t('common.dashboard') }}
                    </button>
                  </motion.div>
                  <motion.div v-bind="mobileMenuItemMotion(0.2, accountMenuLastItemDelay)">
                    <button
                      type="button"
                      class="harbor-ghost-action flex min-h-11 w-full items-center rounded-xl px-3 text-left font-semibold text-[#27595D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                      @click="handleGoToFriends"
                    >
                      {{ t('nav.friends') }}
                    </button>
                  </motion.div>
                </div>
                <template v-if="showMarketingNavigation || (isClosingMobileMenu && !isAuthenticated)">
                  <div data-mobile-public-navigation class="flex min-h-full flex-col justify-center gap-7 px-2 py-6">
                    <div>
                      <motion.div v-bind="mobileMenuItemMotion(0.08)">
                        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B7A75]">
                          {{ t('nav.why', { appName: branding.appName }) }}
                        </p>
                      </motion.div>
                      <div class="mt-3 space-y-1">
                        <motion.div
                          v-for="(item, index) in whyOpenMeetItems"
                          :key="item.title"
                          v-bind="mobileMenuItemMotion(0.14 + index * 0.06)"
                        >
                          <button
                            type="button"
                            class="harbor-ghost-action flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-lg font-semibold text-[#102F35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                            @click="handleGoToPage(item.path)"
                          >
                            {{ item.title }}
                          </button>
                        </motion.div>
                      </div>
                    </div>

                    <div>
                      <motion.div v-bind="mobileMenuItemMotion(0.38)">
                        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B7A75]">
                          {{ t('nav.howToDeploy') }}
                        </p>
                      </motion.div>
                      <div class="mt-3 space-y-1">
                        <motion.div
                          v-for="(item, index) in deploymentItems"
                          :key="item.title"
                          v-bind="mobileMenuItemMotion(0.44 + index * 0.06)"
                        >
                          <button
                            type="button"
                            disabled
                            class="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-lg font-semibold text-[#61777B]"
                          >
                            {{ item.title }}
                            <span class="text-xs font-medium uppercase tracking-[0.12em] text-[#9BB4B5]">{{
                              t('common.soon')
                            }}</span>
                          </button>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>

              <div class="shrink-0 space-y-3 border-t border-[#D8E7E3] pt-5">
                <div v-if="isAuthenticated && !isCheckingSession" class="space-y-2">
                  <motion.div v-bind="mobileMenuItemMotion(0.26, accountMenuLastItemDelay)">
                    <button
                      type="button"
                      class="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left font-semibold text-[#9D4636] transition-colors hover:bg-[#FFF0EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                      :disabled="isAuthBusy"
                      @click="handleLogout"
                    >
                      <LoadingRipple v-if="isLoggingOut" size="sm" />
                      <LogOut v-else class="size-4" />
                      {{ t('common.logOut') }}
                    </button>
                  </motion.div>
                </div>
                <div class="flex items-center justify-end gap-3">
                  <motion.div v-if="!isAuthenticated" v-bind="mobileMenuItemMotion(0.62)" class="flex-1">
                    <Button
                      data-mobile-login
                      class="harbor-ghost-action min-h-11 w-full rounded-full border border-[#D8E7E3] bg-white text-[#27595D]"
                      :disabled="isAuthBusy"
                      @click="handleGoToLogin"
                    >
                      <LoadingRipple v-if="isAuthenticating" size="sm" />
                      <template v-else>
                        <LogIn class="size-4" />
                        {{ t('common.logIn') }}
                      </template>
                    </Button>
                  </motion.div>
                  <motion.div v-if="!isAuthenticated" v-bind="mobileMenuItemMotion(0.68)">
                    <a
                      href="https://github.com/pythonPlant12/openmeet"
                      target="_blank"
                      rel="noreferrer"
                      class="inline-flex size-11 items-center justify-center rounded-full bg-[#E6F4F1] text-[#0B7A75] transition-colors hover:bg-[#D8E7E3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A75]"
                      :aria-label="t('nav.openSource')"
                    >
                      <Github class="size-5" />
                    </a>
                  </motion.div>
                </div>
                <motion.div
                  v-if="isMeetingPage"
                  v-bind="mobileMenuItemMotion(isAuthenticated ? 0.32 : 0.74, isAuthenticated ? 0.32 : 0.74)"
                >
                  <Button
                    type="button"
                    class="harbor-primary-action min-h-11 w-full rounded-full bg-[#0B7A75] text-white"
                    :disabled="isAuthBusy"
                    @click="handleQuitMeeting"
                  >
                    <LogOut class="size-4" />
                    {{ t('common.quitMeeting') }}
                  </Button>
                </motion.div>
                <motion.div
                  v-else
                  v-bind="mobileMenuItemMotion(isAuthenticated ? 0.32 : 0.74, isAuthenticated ? 0.32 : 0.74)"
                >
                  <Button
                    type="button"
                    class="harbor-primary-action min-h-11 w-full rounded-full bg-[#0B7A75] text-white"
                    :disabled="isAuthBusy"
                    @click="handleStartMeeting"
                  >
                    <Video class="size-4" />
                    {{ t('common.startMeeting') }}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  </motion.nav>
</template>
