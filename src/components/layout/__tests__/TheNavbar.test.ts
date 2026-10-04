import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';

import TheNavbar from '@/components/layout/TheNavbar.vue';

const media = vi.hoisted(() => ({ desktop: true, hover: true, reduced: false }));
const auth = vi.hoisted(() => ({ authenticated: false }));
const social = vi.hoisted(() => ({
  getCurrentUserProfile: vi.fn(),
  loadAvatar: vi.fn(),
  updateCurrentUserStatus: vi.fn(),
}));
let resizeObserverCallback: ResizeObserverCallback;

vi.mock('@vueuse/core', async () => {
  const { ref, toValue } = await import('vue');

  return {
    useMediaQuery: (query: string) =>
      ref(
        query.includes('prefers-reduced-motion')
          ? media.reduced
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
    },
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
  useMeetingNavigation: () => ({ createMeeting: vi.fn() }),
}));

vi.mock('@/config/branding.config', () => ({
  useBranding: () => ({ appName: 'OpenMeet' }),
}));

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' }, meta: { showMarketingNav: true } },
      { path: '/dashboard', component: { template: '<div />' } },
      { path: '/account', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } },
      { path: '/technologies', component: { template: '<div />' } },
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
        DropdownMenu: { template: '<div><slot /></div>' },
        DropdownMenuContent: { template: '<div><slot /></div>' },
        DropdownMenuItem: { template: '<div @click="$emit(\'select\', $event)"><slot /></div>' },
        DropdownMenuSeparator: { template: '<div />' },
        DropdownMenuSub: { template: '<div><slot /></div>' },
        DropdownMenuSubContent: { template: '<div><slot /></div>' },
        DropdownMenuSubTrigger: { template: '<div><slot /></div>' },
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
  media.reduced = false;
  auth.authenticated = false;
  social.getCurrentUserProfile.mockResolvedValue({ avatarUrl: null });
  social.loadAvatar.mockResolvedValue(new Blob(['avatar']));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }

      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('TheNavbar', () => {
  it('animates measured desktop width without transform-based layout', async () => {
    const { router, wrapper } = await mountNavbar();
    const content = wrapper.get('.harbor-nav-capsule > div');
    Object.defineProperty(content.element, 'offsetWidth', { configurable: true, value: 783 });
    resizeObserverCallback([], {} as ResizeObserver);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('nav').attributes('data-layout-root')).toBe('true');
    expect(wrapper.get('.harbor-nav-layout').attributes('data-layout')).toBeUndefined();
    expect(wrapper.get('.harbor-nav-layout').classes()).toContain('xl:w-fit');
    expect(wrapper.get('.harbor-nav-layout').classes()).toContain('xl:left-1/2');
    expect(wrapper.get('.harbor-nav-layout').classes()).toContain('xl:-translate-x-1/2');
    expect(wrapper.get('.harbor-nav-layout').classes()).toContain('xl:transition-none');
    expect(wrapper.get('.harbor-nav-capsule').classes()).toContain('xl:transition-[width]');
    expect(wrapper.get('.harbor-nav-capsule').attributes('style')).toContain('width: 783px');

    await router.push('/dashboard');
    await flushPromises();

    expect(wrapper.get('.harbor-nav-layout').attributes('data-layout')).toBeUndefined();
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

  it('stages every authenticated mobile action through Start Meeting', async () => {
    vi.useFakeTimers();
    media.desktop = false;
    media.hover = false;
    auth.authenticated = true;
    const { wrapper } = await mountNavbar('/dashboard');

    await wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);

    const accountActions = wrapper.findAll('[data-mobile-account-actions] > [data-motion-tag="div"]');
    const startMeeting = wrapper
      .findAll('[data-motion-tag="div"]')
      .find((item) => item.text().trim() === 'common.startMeeting');
    const logout = wrapper.findAll('[data-motion-tag="div"]').find((item) => item.text().trim() === 'common.logOut');

    expect(accountActions).toHaveLength(3);
    expect(JSON.parse(accountActions[0].attributes('data-transition'))).toMatchObject({ delay: 0.08 });
    expect(JSON.parse(accountActions[2].attributes('data-transition'))).toMatchObject({ delay: 0.2 });
    expect(JSON.parse(logout!.attributes('data-transition'))).toMatchObject({ delay: 0.26 });
    expect(JSON.parse(startMeeting!.attributes('data-transition'))).toMatchObject({ delay: 0.32 });
  });

  it('starts collapsing the authenticated mobile drawer after 400ms', async () => {
    vi.useFakeTimers();
    media.desktop = false;
    media.hover = false;
    auth.authenticated = true;
    const { wrapper } = await mountNavbar('/dashboard');
    const shell = wrapper.get('.harbor-nav-layout');
    const icon = wrapper.get('[data-motion-tag="span"]');

    await wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    await wrapper.get('button[aria-expanded="true"]').trigger('click');
    expect(JSON.parse(icon.attributes('data-animate'))).toMatchObject({ rotate: 0 });

    await vi.advanceTimersByTimeAsync(399);
    expect(wrapper.find('[data-mobile-account-actions]').exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(1);
    expect(wrapper.find('[data-mobile-account-actions]').exists()).toBe(false);

    await vi.advanceTimersByTimeAsync(360);
    expect(shell.classes()).toContain('w-[min(340px,calc(100vw-1.5rem))]');
    expect(wrapper.get('button[aria-expanded="false"]')).toBeDefined();
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

  it('uses an account dropdown instead of the account name and keeps meeting and dashboard menus content-sized', async () => {
    vi.useFakeTimers();
    auth.authenticated = true;
    const { wrapper } = await mountNavbar('/room/meeting-id');

    expect(wrapper.get('button[aria-label="nav.accountInformation"]')).toBeDefined();
    expect(wrapper.text()).toContain('nav.accountInformation');
    expect(wrapper.text()).toContain('common.dashboard');
    expect(wrapper.text()).toContain('nav.friends');
    expect(wrapper.text()).not.toContain('A deliberately long participant name');

    media.desktop = false;
    const mobile = await mountNavbar('/room/meeting-id');
    await mobile.wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    Object.defineProperty(mobile.wrapper.get('.harbor-nav-capsule').element, 'scrollHeight', {
      configurable: true,
      value: 264,
    });
    resizeObserverCallback([], {} as ResizeObserver);
    await vi.advanceTimersByTimeAsync(16);

    expect(mobile.wrapper.get('.harbor-nav-layout').attributes('style')).toContain('height: 450px');
    expect(mobile.wrapper.get('[data-mobile-account-actions]').text()).toContain('nav.accountInformation');
    expect(mobile.wrapper.get('[data-mobile-account-actions]').text()).toContain('common.dashboard');
    expect(mobile.wrapper.get('[data-mobile-account-actions]').text()).toContain('nav.friends');
    expect(mobile.wrapper.get('[data-mobile-account-actions]').text()).not.toContain('common.logOut');
    expect(mobile.wrapper.text()).toContain('common.logOut');
    expect(mobile.wrapper.find('[data-mobile-public-navigation]').exists()).toBe(false);

    const dashboard = await mountNavbar('/dashboard');
    await dashboard.wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    Object.defineProperty(dashboard.wrapper.get('.harbor-nav-capsule').element, 'scrollHeight', {
      configurable: true,
      value: 308,
    });
    resizeObserverCallback([], {} as ResizeObserver);
    await vi.advanceTimersByTimeAsync(16);

    expect(dashboard.wrapper.get('.harbor-nav-layout').attributes('style')).toContain('height: 450px');

    await dashboard.wrapper
      .get('[data-mobile-account-actions] button[aria-label="nav.accountInformation"]')
      .trigger('click');
    await flushPromises();

    expect(dashboard.router.currentRoute.value.path).toBe('/account');
    expect(dashboard.wrapper.get('.harbor-nav-layout').attributes('style')).toContain('height: 450px');
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
    Object.defineProperty(wrapper.get('.harbor-nav-capsule').element, 'scrollHeight', {
      configurable: true,
      value: 600,
    });
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

    expect(wrapper.get('button[aria-label="nav.accountInformation"] img').attributes('src')).toBe('blob:avatar');
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
    const { router, wrapper } = await mountNavbar('/dashboard');

    await wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    const copyButton = wrapper.get('[data-mobile-account-card] [data-copy-nickname]');
    expect(copyButton.text()).toContain('@ada_l');

    await copyButton.trigger('click');
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith('ada_l');
    expect(copyButton.attributes('aria-label')).toBe('nav.nicknameCopied');
    expect(router.currentRoute.value.path).toBe('/dashboard');

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
    const { wrapper } = await mountNavbar('/dashboard');
    await flushPromises();
    await wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);

    const toggle = wrapper.get('[data-mobile-status-toggle]');
    expect(toggle.text()).toContain('Online');
    expect(toggle.attributes('aria-expanded')).toBe('false');

    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('true');

    await wrapper.get('[data-mobile-status-options] [data-status-option="away"]').trigger('click');
    await flushPromises();
    expect(social.updateCurrentUserStatus).toHaveBeenCalledWith('token', 'away');
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

  it('sends authenticated users to the dashboard and hides marketing navigation', async () => {
    vi.useFakeTimers();
    auth.authenticated = true;
    const { wrapper } = await mountNavbar();

    expect(wrapper.get('a[href="/dashboard"]').text()).toContain('OpenMeet');
    expect(wrapper.text()).not.toContain('nav.why');
    expect(wrapper.text()).not.toContain('nav.howToDeploy');

    media.desktop = false;
    media.hover = false;
    const mobile = await mountNavbar();
    await mobile.wrapper.get('button[aria-expanded="false"]').trigger('click');
    await vi.advanceTimersByTimeAsync(300);

    expect(mobile.wrapper.text()).not.toContain('nav.why');
    expect(mobile.wrapper.text()).not.toContain('nav.howToDeploy');
  });
});
