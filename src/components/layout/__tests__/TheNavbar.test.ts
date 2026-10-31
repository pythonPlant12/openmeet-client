import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';

import TheNavbar from '@/components/layout/TheNavbar.vue';

const media = vi.hoisted(() => ({ desktop: true, hover: true, mobile: false, reduced: false }));
const auth = vi.hoisted(() => ({ authenticated: false }));
const meetings = vi.hoisted(() => ({ createMeeting: vi.fn() }));
const social = vi.hoisted(() => ({
  getCurrentUserProfile: vi.fn(),
  loadAvatar: vi.fn(),
  updateCurrentUserStatus: vi.fn(),
}));
let resizeObserverCallback: ResizeObserverCallback;

// The drawer fits its content: capsule height minus the stretched scroll area plus the content's natural height.
function mockDrawerLayout(
  wrapper: { get: (selector: string) => { element: Element } },
  sizes: { capsule: number; scrollArea: number; content: number },
) {
  const define = (element: Element, property: string, value: number) =>
    Object.defineProperty(element, property, { configurable: true, value });
  const content = wrapper.get('[data-mobile-account-actions]').element;
  define(wrapper.get('.harbor-nav-capsule').element, 'offsetHeight', sizes.capsule);
  define(content.parentElement!, 'clientHeight', sizes.scrollArea);
  define(content, 'offsetHeight', sizes.content);
}

vi.mock('@vueuse/core', async () => {
  const { ref, toValue } = await import('vue');

  return {
    useMediaQuery: (query: string) =>
      ref(
        query.includes('prefers-reduced-motion')
          ? media.reduced
          : query.includes('max-width')
            ? media.mobile
            : query.includes('min-width')
              ? media.desktop
              : media.hover,
      ),
    useTimeoutFn: (callback: () => void, delay: number | (() => number)) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      return {
        start: () => {
          timer = setTimeout(callback, toValue(delay));
        },
        stop: () => {
          if (timer) clearTimeout(timer);
        },
      };
    },
  };
});

vi.mock('motion-v', async () => {
  const { defineComponent, h } = await import('vue');

  const motionStub = (tag: string) =>
    defineComponent({
      inheritAttrs: false,
      props: {
        animate: { type: [Object, Boolean], default: undefined },
        initial: { type: [Object, Boolean], default: undefined },
        layout: { type: [String, Boolean], default: false },
        layoutRoot: { type: Boolean, default: false },
        transition: { type: Object, default: undefined },
      },
      setup(props, { attrs, slots }) {
        return () =>
          h(
            tag,
            {
              ...attrs,
              'data-animate': JSON.stringify(props.animate),
              'data-layout': String(props.layout),
              'data-layout-root': String(props.layoutRoot),
              'data-motion-tag': tag,
              'data-transition': JSON.stringify(props.transition),
            },
            slots.default?.(),
          );
      },
    });

  return {
    AnimatePresence: defineComponent({
      setup(_, { slots }) {
        return () => slots.default?.();
      },
    }),
    motion: {
      div: motionStub('div'),
      nav: motionStub('nav'),
      span: motionStub('span'),
      section: motionStub('section'),
    },
  };
});

// Animated icons run motion-v's viewport observer, which jsdom lacks; the stub records the press trigger instead.
vi.mock('@respeak/lucide-motion-vue', async () => {
  const { defineComponent, h } = await import('vue');
  const iconStub = (name: string) =>
    defineComponent({
      props: { animate: { type: [Boolean, String], default: false } },
      setup(props) {
        return () => h('svg', { 'data-icon': name, 'data-animate': String(props.animate) });
      },
    });

  return {
    CirclePlusAnimated: iconStub('circle-plus'),
    LogInAnimated: iconStub('log-in'),
    LogOutAnimated: iconStub('log-out'),
    MessageSquareAnimated: iconStub('message-square'),
    PhoneAnimated: iconStub('phone'),
    UsersAnimated: iconStub('users'),
  };
});

vi.mock('@/composables/useAuth', async () => {
  const { ref } = await import('vue');

  return {
    useAuth: () => ({
      state: ref({ value: auth.authenticated ? 'authenticated' : 'idle' }),
      isAuthenticating: ref(false),
      isRegistering: ref(false),
      isCheckingSession: ref(false),
      isAuthenticated: ref(auth.authenticated),
      accessToken: ref(auth.authenticated ? 'token' : null),
      currentUser: ref(auth.authenticated ? { name: 'A deliberately long participant name' } : null),
      hasRegisterError: ref(false),
      send: vi.fn(),
    }),
  };
});

vi.mock('@/services/social-api', () => ({ socialApi: social }));

vi.mock('@/composables/useMeetingNavigation', () => ({
  useMeetingNavigation: () => meetings,
}));

vi.mock('@/config/branding.config', () => ({
  useBranding: () => ({ appName: 'OpenMeet' }),
}));

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'landing', component: { template: '<div />' }, meta: { showMarketingNav: true } },
      { path: '/dashboard', name: 'dashboard', component: { template: '<div />' } },
      { path: '/account', name: 'account', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
      { path: '/technologies', component: { template: '<div />' }, meta: { showMarketingNav: true } },
      { path: '/room/:id', name: 'meeting', component: { template: '<div />' } },
    ],
  });
}

async function mountNavbar(path = '/') {
  const router = createTestRouter();
  await router.push(path);
  await router.isReady();
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false });
  const wrapper = mount(TheNavbar, {
    global: {
      plugins: [router, i18n],
      stubs: {
        Button: { template: '<button><slot /></button>' },
        Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
        DialogTitle: { template: '<span><slot /></span>' },
        HarborDialogContent: { template: '<section v-bind="$attrs"><slot /></section>' },
        DropdownMenu: { template: '<div><slot /></div>' },
        DropdownMenuContent: { template: '<div v-bind="$attrs"><slot /></div>' },
        DropdownMenuItem: { template: '<div @click="$emit(\'select\', $event)"><slot /></div>' },
        DropdownMenuSeparator: { template: '<div />' },
        DropdownMenuSub: { template: '<div><slot /></div>' },
        DropdownMenuSubContent: { template: '<div v-bind="$attrs"><slot /></div>' },
        DropdownMenuSubTrigger: { template: '<div v-bind="$attrs"><slot /></div>' },
        DropdownMenuTrigger: { template: '<div><slot /></div>' },
        LoadingRipple: { template: '<span />' },
      },
    },
  });

  return { router, wrapper };
}

beforeEach(() => {
  media.desktop = true;
  media.hover = true;
  media.mobile = false;
  media.reduced = false;
  auth.authenticated = false;
  social.getCurrentUserProfile.mockResolvedValue({ avatarUrl: null });
  social.loadAvatar.mockResolvedValue(new Blob(['avatar']));
  // jsdom has no WebGL, so the tab bar takes its CSS drop fallback.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TheNavbar', () => {
  it('uses the liquid bar for guests on desktop and follows the page', async () => {
    const { router, wrapper } = await mountNavbar();

    expect(wrapper.find('.harbor-nav-capsule').exists()).toBe(false);
    const bar = wrapper.get('nav[aria-label="nav.navigationTitle"]');
    expect(bar.findAll('[data-tab]').map((tab) => tab.attributes('data-tab'))).toEqual([
      'home',
      'why',
      'deploy',
      'login',
      'github',
      'start',
    ]);
    expect(bar.get('[aria-current="page"]').attributes('data-tab')).toBe('home');
    expect(bar.get('[data-tab="start"]').attributes('data-variant')).toBe('primary');

    // An open menu holds the drop on its item.
    await bar.get('[data-tab="why"]').trigger('mouseenter');
    expect(bar.get('[data-tab="why"]').attributes('data-targeted')).toBe('true');

    await router.push('/technologies');
    await flushPromises();
    expect(bar.get('[aria-current="page"]').attributes('data-tab')).toBe('why');
    wrapper.unmount();
  });

  it('keeps the glass capsule below desktop width', async () => {
    media.desktop = false;
    const { wrapper } = await mountNavbar();

    expect(wrapper.get('.harbor-nav-capsule').classes()).toContain('liquid-glass-surface');
    expect(wrapper.find('nav[aria-label="nav.navigationTitle"] .liquid-tab-bar').exists()).toBe(false);
  });

  it('skips staged mobile animation for reduced motion', async () => {
    media.desktop = false;
    media.hover = false;
    media.reduced = true;
    const { wrapper } = await mountNavbar();
    const shell = wrapper.get('.harbor-nav-layout');

    await wrapper.get('button[aria-expanded="false"]').trigger('click');
    expect(shell.classes()).toContain('h-[calc(100svh-1.5rem)]');

    await wrapper.get('button[aria-expanded="true"]').trigger('click');
    expect(shell.classes()).toContain('w-[min(340px,calc(100vw-1.5rem))]');

    expect(wrapper.get('.harbor-nav-layout').attributes('data-layout')).toBeUndefined();
  });

  it('uses a persistent profile trigger and bottom sheet for authenticated phones', async () => {
    vi.useFakeTimers();
    media.desktop = false;
    media.hover = false;
    media.mobile = true;
    auth.authenticated = true;
    social.getCurrentUserProfile.mockResolvedValue({ avatarUrl: null, nickname: 'ada_l', status: 'available' });
    const { wrapper } = await mountNavbar('/room/meeting-id');
    await flushPromises();

    expect(wrapper.find('.harbor-nav-layout').exists()).toBe(false);
    const trigger = wrapper.get('button[aria-expanded="false"]');
    expect(trigger.classes()).toContain('liquid-glass-surface');

    await trigger.trigger('click');
    // The sheet grows out of the button, so the nav keeps the button's size and hides it while open.
    expect(wrapper.get('nav').classes()).toContain('w-12');
    expect(wrapper.find('nav button[aria-label="nav.accountInformation"][aria-expanded]').exists()).toBe(false);
    await vi.advanceTimersByTimeAsync(300);

    const accountNavigation = wrapper.get('section[aria-label="Account navigation"]');
    expect(accountNavigation.classes()).toContain('bottom-[5.375rem]');
    expect(accountNavigation.text()).toContain('common.quitMeeting');
    expect(accountNavigation.text()).toContain('common.logOut');
    await wrapper.get('[data-mobile-status-toggle]').trigger('click');
    expect(wrapper.find('[data-mobile-status-options]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('preserves staged mobile width and height expansion', async () => {
    vi.useFakeTimers();
    media.desktop = false;
    media.hover = false;
    const { wrapper } = await mountNavbar();
    const shell = wrapper.get('.harbor-nav-layout');

    expect(shell.classes()).toContain('w-[min(340px,calc(100vw-1.5rem))]');
    await wrapper.get('button[aria-expanded="false"]').trigger('click');
    expect(shell.classes()).toContain('w-[calc(100vw-1.5rem)]');
    expect(shell.classes()).toContain('h-[60px]');

    await vi.advanceTimersByTimeAsync(300);
    expect(shell.classes()).toContain('h-[calc(100svh-1.5rem)]');

    await wrapper.get('button[aria-expanded="true"]').trigger('click');
    expect(shell.classes()).toContain('h-[calc(100svh-1.5rem)]');
    expect(shell.classes()).toContain('w-[calc(100vw-1.5rem)]');
    expect(wrapper.get('.harbor-nav-capsule > div').classes()).toContain('flex-col');
    const mobileMotionItems = wrapper.findAll('[data-motion-tag="div"]');
    const publicNavigationMotionItems = wrapper.findAll('[data-mobile-public-navigation] [data-motion-tag="div"]');
    const startMeeting = mobileMotionItems.find((item) => item.text().trim() === 'common.startMeeting');
    const productionSecurity = publicNavigationMotionItems.find((item) => item.text().includes('nav.deploy.security'));
    const whyOpenMeet = publicNavigationMotionItems.find((item) => item.text().trim() === 'nav.why');

    expect(JSON.parse(startMeeting!.attributes('data-transition'))).toMatchObject({ delay: 0 });
    expect(JSON.parse(productionSecurity!.attributes('data-transition'))).toMatchObject({ delay: 0.18 });
    expect(JSON.parse(whyOpenMeet!.attributes('data-transition'))).toMatchObject({ delay: 0.66 });

    await wrapper.get('button[aria-expanded="true"]').trigger('click');
    expect(shell.classes()).toContain('h-[calc(100svh-1.5rem)]');

    await wrapper.get('button[aria-expanded="true"]').trigger('click');
    expect(shell.classes()).toContain('h-[calc(100svh-1.5rem)]');

    await vi.advanceTimersByTimeAsync(880);
    expect(shell.classes()).toContain('h-[60px]');

    await vi.advanceTimersByTimeAsync(360);
    expect(shell.classes()).toContain('w-[min(340px,calc(100vw-1.5rem))]');
  });

  it('starts the hamburger reversal just before the drawer finishes collapsing', async () => {
    vi.useFakeTimers();
    media.desktop = false;
    media.hover = false;
    const { wrapper } = await mountNavbar();
    const icon = wrapper.get('[data-motion-tag="span"]');

    await wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    expect(JSON.parse(icon.attributes('data-animate'))).toMatchObject({ rotate: 180 });

    await wrapper.get('button[aria-expanded="true"]').trigger('click');
    await vi.advanceTimersByTimeAsync(880);
    expect(JSON.parse(icon.attributes('data-animate'))).toMatchObject({ rotate: 180 });

    await vi.advanceTimersByTimeAsync(59);
    expect(JSON.parse(icon.attributes('data-animate'))).toMatchObject({ rotate: 180 });

    await vi.advanceTimersByTimeAsync(1);
    expect(JSON.parse(icon.attributes('data-animate'))).toMatchObject({ rotate: 0 });
  });

  it('uses the inner capsule transition duration when closing the mobile drawer', async () => {
    vi.useFakeTimers();
    media.desktop = false;
    media.hover = false;
    const { wrapper } = await mountNavbar();
    const icon = wrapper.get('[data-motion-tag="span"]');
    const shell = wrapper.get('.harbor-nav-layout').element;
    const capsule = wrapper.get('.harbor-nav-capsule').element;
    const getComputedStyle = vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (element) =>
        ({
          transitionDuration: element === capsule ? '500ms' : element === shell ? '20ms' : '0ms',
        }) as CSSStyleDeclaration,
    );

    await wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    await wrapper.get('button[aria-expanded="true"]').trigger('click');
    await vi.advanceTimersByTimeAsync(880);
    await vi.advanceTimersByTimeAsync(199);
    expect(JSON.parse(icon.attributes('data-animate'))).toMatchObject({ rotate: 180 });

    await vi.advanceTimersByTimeAsync(1);
    expect(JSON.parse(icon.attributes('data-animate'))).toMatchObject({ rotate: 0 });
    expect(getComputedStyle).toHaveBeenCalledWith(capsule);
  });

  it('locks page scroll while the mobile drawer is expanded', async () => {
    media.desktop = false;
    media.hover = false;
    media.reduced = true;
    const { wrapper } = await mountNavbar();

    await wrapper.get('button[aria-expanded="false"]').trigger('click');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    wrapper.unmount();
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('navigates before the mobile drawer finishes closing', async () => {
    vi.useFakeTimers();
    media.desktop = false;
    media.hover = false;
    const { router, wrapper } = await mountNavbar();
    const shell = wrapper.get('.harbor-nav-layout');

    await wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    await wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'nav.technologies.title')!
      .trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/technologies');
    expect(shell.classes()).toContain('h-[calc(100svh-1.5rem)]');
    expect(wrapper.find('[data-mobile-public-navigation]').exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(200);
    expect(shell.classes()).toContain('h-[calc(100svh-1.5rem)]');

    await vi.advanceTimersByTimeAsync(680);
    expect(shell.classes()).toContain('h-[60px]');
    expect(shell.classes()).toContain('duration-[360ms]');
  });

  it('starts collapsing the authenticated meeting drawer after 400ms', async () => {
    vi.useFakeTimers();
    media.desktop = false;
    media.hover = false;
    auth.authenticated = true;
    const { wrapper } = await mountNavbar('/room/meeting-id');

    await wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    await wrapper.get('button[aria-expanded="true"]').trigger('click');

    await vi.advanceTimersByTimeAsync(399);
    expect(wrapper.find('[data-mobile-account-actions]').exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(1);
    expect(wrapper.find('[data-mobile-account-actions]').exists()).toBe(false);
  });

  it('leads the account dropdown with the account name and keeps meeting and dashboard menus content-sized', async () => {
    vi.useFakeTimers();
    auth.authenticated = true;
    const { wrapper } = await mountNavbar('/room/meeting-id');

    expect(wrapper.get('[data-tab="account"] .liquid-tab-avatar')).toBeDefined();
    expect(wrapper.text()).toContain('A deliberately long participant name');
    expect(wrapper.text()).toContain('common.dashboard');
    expect(wrapper.text()).toContain('nav.friends');

    media.desktop = false;
    const mobile = await mountNavbar('/room/meeting-id');
    await mobile.wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    mockDrawerLayout(mobile.wrapper, { capsule: 450, scrollArea: 300, content: 180 });
    resizeObserverCallback([], {} as ResizeObserver);
    await vi.advanceTimersByTimeAsync(16);

    // No minimum height: the drawer shrinks to its content.
    expect(mobile.wrapper.get('.harbor-nav-layout').attributes('style')).toContain('height: 330px');
    expect(mobile.wrapper.get('[data-mobile-account-actions]').text()).toContain(
      'A deliberately long participant name',
    );
    expect(mobile.wrapper.get('[data-mobile-account-actions]').text()).toContain('common.dashboard');
    expect(mobile.wrapper.get('[data-mobile-account-actions]').text()).toContain('nav.friends');
    expect(mobile.wrapper.get('[data-mobile-account-actions]').text()).not.toContain('common.logOut');
    expect(mobile.wrapper.text()).toContain('common.logOut');
    expect(mobile.wrapper.find('[data-mobile-public-navigation]').exists()).toBe(false);
  });

  it('expands the anonymous meeting drawer to the mobile viewport', async () => {
    vi.useFakeTimers();
    media.desktop = false;
    media.hover = false;
    const { wrapper } = await mountNavbar('/room/meeting-id');
    const shell = wrapper.get('.harbor-nav-layout');

    await wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);

    expect(shell.classes()).toContain('h-[calc(100svh-1.5rem)]');
    expect(wrapper.find('[data-mobile-public-navigation]').exists()).toBe(true);
  });

  it('caps content-sized drawers to the visible mobile viewport', async () => {
    vi.useFakeTimers();
    media.desktop = false;
    media.hover = false;
    auth.authenticated = true;
    const initialInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });
    const { wrapper } = await mountNavbar('/room/meeting-id');

    await wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    mockDrawerLayout(wrapper, { capsule: 300, scrollArea: 150, content: 450 });
    resizeObserverCallback([], {} as ResizeObserver);
    await vi.advanceTimersByTimeAsync(16);

    expect(wrapper.get('.harbor-nav-layout').attributes('style')).toContain('height: 376px');
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: initialInnerHeight });
  });

  it('uses landing navigation and a quit action in meeting rooms', async () => {
    vi.useFakeTimers();
    auth.authenticated = false;
    const desktop = await mountNavbar('/room/meeting-id');

    expect(desktop.wrapper.text()).toContain('nav.why');
    expect(desktop.wrapper.text()).toContain('nav.howToDeploy');
    expect(desktop.wrapper.text()).toContain('common.quitMeeting');
    expect(desktop.wrapper.text()).not.toContain('common.startMeeting');

    await desktop.wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'common.quitMeeting')!
      .trigger('click');
    await flushPromises();

    expect(desktop.router.currentRoute.value.path).toBe('/');

    media.desktop = false;
    media.hover = false;
    const mobile = await mountNavbar('/room/meeting-id');
    await mobile.wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);

    expect(mobile.wrapper.find('[data-mobile-public-navigation]').exists()).toBe(true);
    expect(mobile.wrapper.text()).toContain('common.quitMeeting');
    expect(mobile.wrapper.text()).not.toContain('common.startMeeting');
  });

  it('shows the selected profile image in the account menu trigger', async () => {
    auth.authenticated = true;
    social.getCurrentUserProfile.mockResolvedValue({ avatarUrl: '/social/users/user-id/avatar' });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:avatar'), revokeObjectURL: vi.fn() });

    const { wrapper } = await mountNavbar();
    await flushPromises();

    // Signed-in workspaces show the avatar as the Account tab's icon.
    expect(wrapper.get('[data-tab="account"] .liquid-tab-avatar img').attributes('src')).toBe('blob:avatar');
    expect(social.loadAvatar).toHaveBeenCalledWith('token', '/social/users/user-id/avatar');
  });

  it('copies the nickname from the mobile account card without navigating', async () => {
    vi.useFakeTimers();
    media.desktop = false;
    media.hover = false;
    auth.authenticated = true;
    social.getCurrentUserProfile.mockResolvedValue({ avatarUrl: null, nickname: 'ada_l' });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const { router, wrapper } = await mountNavbar('/room/meeting-id');

    await wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    const copyButton = wrapper.get('[data-mobile-account-card] [data-copy-nickname]');
    expect(copyButton.text()).toContain('@ada_l');

    await copyButton.trigger('click');
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith('ada_l');
    expect(copyButton.attributes('aria-label')).toBe('nav.nicknameCopied');
    expect(router.currentRoute.value.path).toBe('/room/meeting-id');

    await wrapper.get('[data-mobile-account-card] > button[aria-label="nav.accountInformation"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/account');
  });

  it('shows the nickname inside the desktop account item', async () => {
    auth.authenticated = true;
    social.getCurrentUserProfile.mockResolvedValue({ avatarUrl: null, nickname: 'ada_l' });
    const { wrapper } = await mountNavbar('/dashboard');
    await flushPromises();

    expect(wrapper.get('[data-copy-nickname]').text()).toContain('@ada_l');
  });

  it('changes the status from the desktop account menu and shows it on the avatar', async () => {
    auth.authenticated = true;
    social.getCurrentUserProfile
      .mockResolvedValueOnce({ avatarUrl: null, nickname: 'ada_l', status: 'available' })
      .mockResolvedValue({ avatarUrl: null, nickname: 'ada_l', status: 'doNotDisturb' });
    social.updateCurrentUserStatus.mockResolvedValue({ status: 'doNotDisturb' });
    const { wrapper } = await mountNavbar('/dashboard');
    await flushPromises();

    expect(wrapper.get('[data-own-status-dot]').attributes('aria-label')).toBe('Online');
    expect(wrapper.get('[data-status-submenu]').classes()).toContain('font-semibold');
    expect(wrapper.findAll('.harbor-action-menu').every((menu) => menu.classes().includes('marketing-font'))).toBe(
      true,
    );

    await wrapper.get('[data-status-option="doNotDisturb"]').trigger('click');
    await flushPromises();

    expect(social.updateCurrentUserStatus).toHaveBeenCalledWith('token', 'doNotDisturb');
    expect(wrapper.get('[data-own-status-dot]').attributes('aria-label')).toBe('Do not disturb');
  });

  it('expands the mobile status picker on tap and collapses it after choosing', async () => {
    vi.useFakeTimers();
    media.desktop = false;
    media.hover = false;
    auth.authenticated = true;
    social.getCurrentUserProfile.mockResolvedValue({ avatarUrl: null, nickname: 'ada_l', status: 'available' });
    social.updateCurrentUserStatus.mockResolvedValue({ status: 'away' });
    const { wrapper } = await mountNavbar('/room/meeting-id');
    await flushPromises();
    await wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);

    const toggle = wrapper.get('[data-mobile-status-toggle]');
    expect(toggle.text()).toBe('nav.status: Online');
    const options = wrapper.get('[data-mobile-status-options]');
    expect(options.findAll('[data-status-option]').map((option) => option.text())).toEqual([
      'Online',
      'Away',
      'Do not disturb',
      'Sleeping',
      'Appear offline',
    ]);
    expect(toggle.attributes('aria-expanded')).toBe('false');

    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('true');

    await wrapper.get('[data-mobile-status-options] [data-status-option="away"]').trigger('click');
    await flushPromises();
    expect(social.updateCurrentUserStatus).toHaveBeenCalledWith('token', 'away');
    expect(toggle.attributes('aria-expanded')).toBe('false');

    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    // A press inside the picker keeps it open; a press anywhere else collapses it.
    toggle.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(toggle.attributes('aria-expanded')).toBe('true');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(toggle.attributes('aria-expanded')).toBe('false');
  });

  it('rolls the status back when saving fails', async () => {
    auth.authenticated = true;
    social.getCurrentUserProfile.mockResolvedValue({ avatarUrl: null, nickname: 'ada_l', status: 'away' });
    social.updateCurrentUserStatus.mockRejectedValue(new Error('offline'));
    const { wrapper } = await mountNavbar('/dashboard');
    await flushPromises();

    await wrapper.get('[data-status-option="sleeping"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-own-status-dot]').attributes('aria-label')).toBe('Away');
  });

  it('shows Login text for logged-out desktop users', async () => {
    const { wrapper } = await mountNavbar();

    expect(wrapper.text()).toContain('common.logIn');
    expect(wrapper.find('button[aria-label="common.logIn"]').exists()).toBe(false);
  });

  it('uses compact public navigation and a text Login action in the expanded mobile drawer', async () => {
    media.desktop = false;
    media.hover = false;
    media.reduced = true;
    const { wrapper } = await mountNavbar();

    await wrapper.get('button[aria-expanded="false"]').trigger('click');

    const publicNavigation = wrapper.get('[data-mobile-public-navigation]');
    expect(publicNavigation.classes()).toContain('justify-center');
    expect(publicNavigation.text()).toContain('nav.why');
    expect(publicNavigation.text()).toContain('nav.howToDeploy');
    expect(publicNavigation.findAll('[data-motion-tag="div"]')).toHaveLength(8);
    expect(wrapper.findAll('[data-mobile-public-navigation] svg')).toHaveLength(0);
    expect(wrapper.get('[data-mobile-login]').text()).toContain('common.logIn');
    expect(wrapper.get('[data-mobile-login]').classes()).toContain('harbor-ghost-action');
    expect(wrapper.get('[data-mobile-login] svg')).toBeDefined();
  });

  it('replaces the branded capsule and marketing navigation with workspace tabs for signed-in users', async () => {
    auth.authenticated = true;
    const { wrapper } = await mountNavbar();

    expect(wrapper.find('nav[aria-label="nav.workspaceNavigation"]').exists()).toBe(true);
    expect(wrapper.find('.harbor-nav-capsule').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('OpenMeet');
    expect(wrapper.text()).not.toContain('nav.why');
    expect(wrapper.text()).not.toContain('nav.howToDeploy');
  });
  it('shows workspace tabs as the desktop navigation and follows the dashboard panel', async () => {
    auth.authenticated = true;
    const { wrapper } = await mountNavbar('/dashboard');
    await flushPromises();

    const tabs = wrapper.get('nav[aria-label="nav.workspaceNavigation"]');
    expect(tabs.findAll('.liquid-tab').map((tab) => tab.attributes('data-tab'))).toEqual([
      'messages',
      'friends',
      'calls',
      'account',
      'start',
    ]);
    expect(tabs.get('[data-tab="friends"]').attributes('href')).toBe('/dashboard?panel=friends');
    // Account opens the account menu from the avatar instead of navigating.
    expect(tabs.get('[data-tab="account"]').element.tagName).toBe('BUTTON');
    expect(wrapper.text()).toContain('A deliberately long participant name');
    expect(tabs.find('[aria-current="page"]').exists()).toBe(false);

    window.dispatchEvent(new CustomEvent('openmeet:dashboard-panel-state', { detail: 'calls' }));
    await flushPromises();
    expect(tabs.get('[aria-current="page"]').attributes('data-tab')).toBe('calls');
    wrapper.unmount();
  });

  it('plays the icon animation when a workspace tab is pressed', async () => {
    auth.authenticated = true;
    const { wrapper } = await mountNavbar('/dashboard');
    await flushPromises();

    await wrapper.get('[data-tab="messages"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-tab="messages"] svg').attributes('data-animate')).toBe('true');
    expect(wrapper.get('[data-tab="friends"] svg').attributes('data-animate')).toBe('false');
    wrapper.unmount();
  });

  it('replaces the phone account button with bottom workspace tabs outside meetings', async () => {
    media.desktop = false;
    media.hover = false;
    media.mobile = true;
    auth.authenticated = true;
    const { wrapper } = await mountNavbar('/dashboard');
    await flushPromises();

    const tabs = wrapper.get('nav[aria-label="nav.workspaceNavigation"]');
    expect(tabs.attributes('data-compact')).toBe('true');
    expect(tabs.find('[data-tab="start"]').exists()).toBe(false);
    expect(wrapper.find('nav.w-12 button').exists()).toBe(false);

    const account = tabs.get('[data-tab="account"]');
    expect(account.element.tagName).toBe('BUTTON');
    await account.trigger('click');
    await flushPromises();
    expect(wrapper.get('section[aria-label="Account navigation"]').text()).toContain('common.logOut');
    expect(tabs.get('[aria-current="page"]').attributes('data-tab')).toBe('account');
    wrapper.unmount();
  });

  it('starts a meeting from the primary item inside the workspace tabs', async () => {
    auth.authenticated = true;
    meetings.createMeeting.mockClear();
    const { wrapper } = await mountNavbar('/dashboard');
    await flushPromises();

    const start = wrapper.get('[data-tab="start"]');
    expect(start.attributes('data-variant')).toBe('primary');
    await start.trigger('click');
    await flushPromises();

    expect(meetings.createMeeting).toHaveBeenCalledTimes(1);
    expect(start.get('svg').attributes('data-animate')).toBe('true');
    wrapper.unmount();
  });

  it('hides workspace tabs inside meetings', async () => {
    auth.authenticated = true;
    const { wrapper } = await mountNavbar('/room/meeting-id');
    await flushPromises();

    expect(wrapper.find('nav[aria-label="nav.workspaceNavigation"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
