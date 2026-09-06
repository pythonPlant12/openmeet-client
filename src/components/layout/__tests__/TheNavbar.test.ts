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
}));
let resizeObserverCallback: ResizeObserverCallback;

vi.mock('@vueuse/core', async () => {
  const { ref } = await import('vue');

  return {
    useMediaQuery: (query: string) =>
      ref(
        query.includes('prefers-reduced-motion')
          ? media.reduced
          : query.includes('min-width')
            ? media.desktop
            : media.hover,
      ),
    useTimeoutFn: (callback: () => void, delay: number) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      return {
        start: () => {
          timer = setTimeout(callback, delay);
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
              'data-layout': String(props.layout),
              'data-layout-root': String(props.layoutRoot),
              'data-motion-tag': tag,
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
        DropdownMenuItem: { template: '<div><slot /></div>' },
        DropdownMenuSeparator: { template: '<div />' },
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
    expect(shell.classes()).toContain('h-[60px]');
    expect(shell.classes()).toContain('w-[calc(100vw-1.5rem)]');
    expect(wrapper.get('.harbor-nav-capsule > div').classes()).toContain('flex-col');

    await wrapper.get('button[aria-expanded="true"]').trigger('click');
    expect(shell.classes()).toContain('h-[calc(100svh-1.5rem)]');

    await wrapper.get('button[aria-expanded="true"]').trigger('click');
    expect(shell.classes()).toContain('h-[60px]');

    await vi.advanceTimersByTimeAsync(500);
    expect(shell.classes()).toContain('w-[min(340px,calc(100vw-1.5rem))]');
  });

  it('uses an account dropdown instead of the account name and keeps meeting menus content-sized', async () => {
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

    expect(mobile.wrapper.get('.harbor-nav-layout').classes()).toContain('h-auto');
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

  it('shows Login text for logged-out desktop users', async () => {
    const { wrapper } = await mountNavbar();

    expect(wrapper.text()).toContain('common.logIn');
    expect(wrapper.find('button[aria-label="common.logIn"]').exists()).toBe(false);
  });
});
