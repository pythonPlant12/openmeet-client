import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { createI18n } from 'vue-i18n';

import MiniCall from '@/components/meeting-page/MiniCall.vue';
import en from '@/locales/en.json';
import type { Participant } from '@/xstate/machines/webrtc/types';

const activeSpeakerId = ref<string | null>(null);
vi.mock('@/composables/useActiveSpeaker', () => ({
  useActiveSpeaker: () => ({ activeSpeakerId, resumeAudioAnalysis: vi.fn().mockResolvedValue(undefined) }),
}));

function person(id: string, overrides: Partial<Participant> = {}): Participant {
  return {
    id,
    name: id,
    isLocal: false,
    audioEnabled: true,
    videoEnabled: false,
    stream: null,
    ...overrides,
  } as Participant;
}

function mountMiniCall(participants: Participant[], props: Record<string, unknown> = {}) {
  return mount(MiniCall, {
    props: { participants, localParticipantId: 'me', ...props },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
      stubs: {
        ParticipantTile: {
          props: ['participant', 'speaking'],
          template: '<div data-tile :data-participant-id="participant.id" :data-speaking="String(speaking)" />',
        },
        CallAudio: { props: ['participants'], template: '<div data-call-audio :data-count="participants.length" />' },
      },
    },
  });
}

const shownId = (wrapper: ReturnType<typeof mountMiniCall>) => wrapper.get('[data-tile]').attributes('data-participant-id');

describe('MiniCall', () => {
  beforeEach(() => {
    activeSpeakerId.value = null;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the person speaking among the others, never yourself, and keeps the last speaker through silence', async () => {
    const wrapper = mountMiniCall([person('me', { isLocal: true }), person('ada'), person('bob')]);
    // Nobody has spoken yet: the first other person.
    expect(shownId(wrapper)).toBe('ada');

    activeSpeakerId.value = 'bob';
    await nextTick();
    expect(shownId(wrapper)).toBe('bob');
    expect(wrapper.get('[data-tile]').attributes('data-speaking')).toBe('true');

    // Your own speech never takes the tile, and silence keeps the last speaker.
    activeSpeakerId.value = 'me';
    await nextTick();
    expect(shownId(wrapper)).toBe('bob');
    activeSpeakerId.value = null;
    await nextTick();
    expect(shownId(wrapper)).toBe('bob');
    expect(wrapper.get('[data-tile]').attributes('data-speaking')).toBe('false');
  });

  it('shows a screen share over the speaker', async () => {
    const wrapper = mountMiniCall([
      person('me', { isLocal: true }),
      person('ada'),
      person('ada-screen', { screenShareOf: 'ada' }),
    ]);
    activeSpeakerId.value = 'ada';
    await nextTick();
    expect(shownId(wrapper)).toBe('ada-screen');
  });

  it('shows your own view while you are alone', () => {
    const wrapper = mountMiniCall([person('me', { isLocal: true })]);
    expect(shownId(wrapper)).toBe('me');
  });

  it('keeps everyone audible and expands on a tap', async () => {
    const wrapper = mountMiniCall([person('me', { isLocal: true }), person('ada')]);
    expect(wrapper.get('[data-call-audio]').attributes('data-count')).toBe('2');

    await wrapper.get('[data-mini-call-tile]').trigger('click');
    expect(wrapper.emitted('expand')).toHaveLength(1);
  });

  it('carries mute, leave and expand controls, and never a conversation button', async () => {
    const wrapper = mountMiniCall([person('me', { isLocal: true }), person('ada')], { isMuted: false });

    expect(wrapper.get('[data-mini-call-mute]').attributes('aria-label')).toBe('Mute microphone');
    await wrapper.get('[data-mini-call-mute]').trigger('click');
    expect(wrapper.emitted('mute')).toHaveLength(1);
    expect(wrapper.emitted('expand')).toBeUndefined();

    await wrapper.get('[data-mini-call-leave]').trigger('click');
    expect(wrapper.emitted('leave')).toHaveLength(1);

    await wrapper.get('[data-mini-call-expand]').trigger('click');
    expect(wrapper.emitted('expand')).toHaveLength(1);

    expect(wrapper.find('[data-mini-call-conversation]').exists()).toBe(false);
    expect(mountMiniCall([person('me', { isLocal: true })], { isMuted: true }).get('[data-mini-call-mute]').attributes('aria-label')).toBe(
      'Unmute microphone',
    );
  });

  it('reveals the controls on a touch press without expanding, and hides them again', async () => {
    vi.useFakeTimers();
    try {
      const wrapper = mountMiniCall([person('me', { isLocal: true }), person('ada')]);
      const root = wrapper.get('[data-mini-call]');
      expect(root.attributes('data-controls-shown')).toBe('false');

      const tile = wrapper.get('[data-mini-call-tile]').element;
      tile.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'touch', button: 0 }));
      vi.advanceTimersByTime(400);
      await nextTick();
      expect(root.attributes('data-controls-shown')).toBe('true');
      tile.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'touch', button: 0 }));
      tile.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await nextTick();
      // The press that revealed the controls is not a tap.
      expect(wrapper.emitted('expand')).toBeUndefined();

      vi.advanceTimersByTime(4_500);
      await nextTick();
      expect(root.attributes('data-controls-shown')).toBe('false');
    } finally {
      vi.useRealTimers();
    }
  });

  it('drags to the nearest corner and keeps it for the next mini call', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    const corners = {
      'top-left': { left: 16, top: 16 },
      'top-right': { left: 258, top: 16 },
      'bottom-left': { left: 16, top: 540 },
      'bottom-right': { left: 258, top: 540 },
    } as const;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.miniCall === undefined) {
        return { left: 0, top: 0, width: 390, height: 700, right: 390, bottom: 700, x: 0, y: 0 } as DOMRect;
      }
      const corner = corners[(this.dataset.corner as keyof typeof corners) ?? 'bottom-right'];
      return { left: corner.left, top: corner.top, width: 116, height: 144, right: 0, bottom: 0, x: 0, y: 0 } as DOMRect;
    });
    try {
      const wrapper = mountMiniCall([person('me', { isLocal: true }), person('ada')]);
      const root = wrapper.get('[data-mini-call]');
      expect(root.attributes('data-corner')).toBe('bottom-right');

      root.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, clientX: 300, clientY: 600 }));
      root.element.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, button: 0, clientX: 40, clientY: 60 }));
      root.element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, button: 0, clientX: 40, clientY: 60 }));
      root.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await nextTick();
      await nextTick();
      expect(root.attributes('data-corner')).toBe('top-left');
      // A drag is not a tap.
      expect(wrapper.emitted('expand')).toBeUndefined();
      wrapper.unmount();

      const again = mountMiniCall([person('me', { isLocal: true }), person('ada')]);
      expect(again.get('[data-mini-call]').attributes('data-corner')).toBe('top-left');
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });
});
