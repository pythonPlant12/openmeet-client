import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import VideoGrid from '@/components/meeting-page/VideoGrid.vue';
import type { Participant } from '@/xstate/machines/webrtc/types';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      meeting: {
        actions: { fullscreen: 'Full screen', exitFullscreen: 'Exit full screen' },
        participant: { pin: 'Pin {name}', unpin: 'Unpin {name}', options: 'Options for {name}' },
      },
    },
  },
  missingWarn: false,
  fallbackWarn: false,
});

const person = (id: string, extra: Partial<Participant> = {}): Participant => ({
  id,
  name: id,
  isLocal: false,
  stream: null,
  audioEnabled: true,
  videoEnabled: false,
  ...extra,
});
const me = person('me', { isLocal: true });
const people = (count: number) => [
  me,
  ...['ada', 'bob', 'cy', 'dee', 'eve'].slice(0, count - 1).map((id) => person(id)),
];

enableAutoUnmount(afterEach);

function setWindowSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

beforeEach(() => {
  for (const name of ['ResizeObserver', 'IntersectionObserver']) {
    vi.stubGlobal(
      name,
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  }
  HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  setWindowSize(1024, 768);
});

const phone = () => setWindowSize(390, 844);
const desktop = () => setWindowSize(1440, 900);

function mountGrid(props: Partial<InstanceType<typeof VideoGrid>['$props']> = {}) {
  return mount(VideoGrid, {
    attachTo: document.body,
    props: {
      activeSpeakerId: null,
      participants: people(2),
      pinnedParticipantId: null,
      viewMode: null,
      ...props,
    },
    global: { plugins: [i18n] },
  });
}

const canvas = (wrapper: ReturnType<typeof mountGrid>) => wrapper.get('[data-testid="meeting-video-canvas"]');
const tileIds = (wrapper: ReturnType<typeof mountGrid>, selector: string) =>
  wrapper.findAll(`${selector} [data-testid="participant-tile"]`).map((tile) => tile.attributes('data-participant-id'));

function pointer(type: string, init: { clientX?: number; clientY?: number; pointerType?: string } = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'touch' });
  return event;
}

describe('VideoGrid layout', () => {
  it('shows a phone 1:1 call as the other person with your own view in a corner', () => {
    phone();
    const wrapper = mountGrid();
    expect(canvas(wrapper).attributes('data-layout')).toBe('self-view');
    expect(tileIds(wrapper, '[data-testid="self-view"]')).toEqual(['me']);
    expect(
      wrapper.findAll('[data-testid="participant-tile"]').map((tile) => tile.attributes('data-participant-id')),
    ).toEqual(['ada', 'me']);
  });

  it('shows 3 or 4 people on a phone in a 2-column grid', () => {
    phone();
    const wrapper = mountGrid({ participants: people(4) });
    expect(canvas(wrapper).attributes('data-layout')).toBe('grid');
    expect(wrapper.get('[data-testid="participant-grid"]').attributes('data-columns')).toBe('2');
    expect(tileIds(wrapper, '[data-testid="participant-grid"]')).toEqual(['me', 'ada', 'bob', 'cy']);
  });

  it('shows 5 or more people on a phone in the speaker layout with a strip', () => {
    phone();
    const wrapper = mountGrid({ participants: people(5), activeSpeakerId: 'cy' });
    expect(canvas(wrapper).attributes('data-view-mode')).toBe('speaker');
    expect(tileIds(wrapper, '[data-testid="speaker-stage"]')).toEqual(['cy']);
    expect(tileIds(wrapper, '[data-testid="participant-strip"]')).toEqual(['me', 'ada', 'bob', 'dee']);
  });

  it('shows a grid that fits the window on desktop', () => {
    desktop();
    const wrapper = mountGrid({ participants: people(2) });
    expect(canvas(wrapper).attributes('data-layout')).toBe('grid');
    expect(tileIds(wrapper, '[data-testid="participant-grid"]')).toEqual(['me', 'ada']);
  });

  it('puts the pinned person on stage', () => {
    desktop();
    const wrapper = mountGrid({ participants: people(3), pinnedParticipantId: 'bob', viewMode: 'speaker' });
    expect(tileIds(wrapper, '[data-testid="speaker-stage"]')).toEqual(['bob']);
    expect(tileIds(wrapper, '[data-testid="participant-strip"]')).toEqual(['me', 'ada']);
  });

  it('lets a screen share take the stage with the people in a strip', () => {
    phone();
    const screen = person('ada-screen', { screenShareOf: 'ada' });
    const wrapper = mountGrid({ participants: [...people(2), screen] });
    expect(tileIds(wrapper, '[data-testid="speaker-stage"]')).toEqual(['ada-screen']);
    expect(tileIds(wrapper, '[data-testid="participant-strip"]')).toEqual(['me', 'ada']);
  });
});

describe('VideoGrid own camera', () => {
  it('leaves your own tile out when you hide your own camera, but keeps your screen share', () => {
    desktop();
    const myScreen = person('me-screen', { isLocal: true, screenShareOf: 'me' });
    const wrapper = mountGrid({ participants: [...people(3), myScreen], hideOwnCamera: true, viewMode: 'grid' });
    expect(tileIds(wrapper, '[data-testid="participant-grid"]')).toEqual(['ada', 'bob', 'me-screen']);
  });
});

describe('VideoGrid tile interactions', () => {
  it('pins a tapped tile after the double-tap window', async () => {
    desktop();
    vi.useFakeTimers();
    const wrapper = mountGrid({ participants: people(3) });
    const tile = wrapper.get('[data-participant-id="ada"] [data-participant-surface]');
    // Vue ignores events older than its listeners, so the frozen fake clock moves on past the mount.
    vi.advanceTimersByTime(10);

    tile.element.dispatchEvent(pointer('pointerdown', { pointerType: 'mouse' }));
    tile.element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(wrapper.emitted('togglePin')).toBeUndefined();
    vi.advanceTimersByTime(300);
    expect(wrapper.emitted('togglePin')).toEqual([['ada']]);
  });

  it('pins or unpins at once from the keyboard', async () => {
    desktop();
    const wrapper = mountGrid({ participants: people(3), pinnedParticipantId: 'ada', viewMode: 'speaker' });
    await wrapper.get('[data-participant-id="ada"] [data-participant-surface]').trigger('click');
    expect(wrapper.emitted('togglePin')).toEqual([['ada']]);
  });

  it('reports a long-press on a tile to toggle the call controls, without pinning', () => {
    phone();
    vi.useFakeTimers();
    const wrapper = mountGrid({ participants: people(3) });
    const tile = wrapper.get('[data-participant-id="ada"] [data-participant-surface]');
    vi.advanceTimersByTime(10);

    tile.element.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(499);
    expect(wrapper.emitted('longPress')).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(wrapper.emitted('longPress')).toHaveLength(1);
    tile.element.dispatchEvent(pointer('pointerup'));
    tile.element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    vi.advanceTimersByTime(300);
    expect(wrapper.emitted('togglePin')).toBeUndefined();
  });

  it('reports a long-press on the empty space around the tiles too', () => {
    phone();
    vi.useFakeTimers();
    const wrapper = mountGrid({ participants: people(3) });
    vi.advanceTimersByTime(10);
    canvas(wrapper).element.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(500);
    expect(wrapper.emitted('longPress')).toHaveLength(1);
  });

  it('does nothing on a tap on the empty space around the tiles', () => {
    phone();
    vi.useFakeTimers();
    const wrapper = mountGrid({ participants: people(3) });
    vi.advanceTimersByTime(10);
    canvas(wrapper).element.dispatchEvent(pointer('pointerdown'));
    canvas(wrapper).element.dispatchEvent(pointer('pointerup'));
    canvas(wrapper).element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    vi.advanceTimersByTime(300);
    expect(wrapper.emitted('togglePin')).toBeUndefined();
    expect(wrapper.emitted('longPress')).toBeUndefined();
  });

  it('cancels a long-press when the finger moves', () => {
    phone();
    vi.useFakeTimers();
    const wrapper = mountGrid({ participants: people(3) });
    vi.advanceTimersByTime(10);
    canvas(wrapper).element.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    canvas(wrapper).element.dispatchEvent(pointer('pointermove', { clientX: 0, clientY: 40 }));
    vi.advanceTimersByTime(600);
    expect(wrapper.emitted('longPress')).toBeUndefined();
  });

  it('collapses the name tags while the call controls are hidden', () => {
    phone();
    const wrapper = mountGrid({ participants: people(3), controlsHidden: true });
    const tags = wrapper.findAll('[data-participant-name-tag]');
    expect(tags.every((tag) => !tag.isVisible())).toBe(true);
  });

  it('shows a tile in full screen from its ⋯ menu by pinning it and entering full screen', async () => {
    desktop();
    const wrapper = mountGrid({ participants: people(3) });
    await wrapper.get('button[aria-label="Options for bob"]').trigger('click');
    await flushPromises();
    Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item) => item.textContent?.includes('Full screen'))!
      .click();
    await flushPromises();

    expect(wrapper.emitted('togglePin')).toEqual([['bob']]);
    expect(wrapper.emitted('toggleFullscreen')).toHaveLength(1);
  });

  it('pins from the ⋯ menu without waiting for a double tap', async () => {
    desktop();
    const wrapper = mountGrid({ participants: people(3) });
    await wrapper.get('button[aria-label="Options for ada"]').trigger('click');
    await flushPromises();
    document.body.querySelector<HTMLElement>('[role="menuitem"]')!.click();
    await flushPromises();
    expect(wrapper.emitted('togglePin')).toEqual([['ada']]);
  });

  it('snaps a dragged self view to the nearest corner without pinning', async () => {
    phone();
    vi.useFakeTimers();
    const wrapper = mountGrid();
    const selfView = wrapper.get('[data-testid="self-view"]');
    vi.advanceTimersByTime(10);
    expect(selfView.attributes('data-corner')).toBe('bottom-right');

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return (
        this.dataset.testid === 'self-view'
          ? { left: 270, top: 550, width: 108, height: 144, right: 378, bottom: 694, x: 270, y: 550 }
          : { left: 0, top: 0, width: 390, height: 700, right: 390, bottom: 700, x: 0, y: 0 }
      ) as DOMRect;
    });
    selfView.element.dispatchEvent(pointer('pointerdown', { clientX: 320, clientY: 620 }));
    selfView.element.dispatchEvent(pointer('pointermove', { clientX: 40, clientY: 60 }));
    selfView.element.dispatchEvent(pointer('pointerup', { clientX: 40, clientY: 60 }));
    selfView.element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    await flushPromises();
    vi.advanceTimersByTime(300);

    expect(selfView.attributes('data-corner')).toBe('top-left');
    expect(wrapper.emitted('togglePin')).toBeUndefined();
  });
});
