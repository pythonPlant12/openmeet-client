import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import MeetingInputVolume from '@/components/meeting-page/MeetingInputVolume.vue';

function mountVolume(volumePercent = 50) {
  return mount(MeetingInputVolume, {
    attachTo: document.body,
    props: { volumePercent, levelPercent: 0 },
    global: { plugins: [createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false })] },
  });
}

// jsdom has no layout, so the slider gets a 200 px box starting at 0; its 18 px thumb centres at 100 px for 50%.
function layOut(wrapper: ReturnType<typeof mountVolume>) {
  const slider = wrapper.get<HTMLInputElement>('[data-input-volume]').element;
  slider.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 20 }) as DOMRect;
  document.documentElement.style.fontSize = '16px';
  return slider;
}

function pointer(target: EventTarget, type: string, init: { clientX?: number; pointerType?: string } = {}) {
  const event = new MouseEvent(type, { bubbles: true, clientX: init.clientX ?? 0 });
  Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'mouse' });
  target.dispatchEvent(event);
}

const label = (wrapper: ReturnType<typeof mountVolume>) => wrapper.get('[data-input-volume-value]');

describe('MeetingInputVolume', () => {
  it('shows the volume as a percentage', () => {
    expect(label(mountVolume(73)).text()).toBe('73%');
  });

  it('shows the percentage while a mouse rests on the thumb, not elsewhere on the track', async () => {
    const wrapper = mountVolume();
    const slider = layOut(wrapper);

    pointer(slider, 'pointermove', { clientX: 40 });
    await wrapper.vm.$nextTick();
    expect(label(wrapper).attributes('data-shown')).toBeUndefined();

    pointer(slider, 'pointermove', { clientX: 104 });
    await wrapper.vm.$nextTick();
    expect(label(wrapper).attributes('data-shown')).toBeDefined();

    pointer(slider, 'pointerleave');
    await wrapper.vm.$nextTick();
    expect(label(wrapper).attributes('data-shown')).toBeUndefined();
  });

  it('shows the percentage on a phone only while the finger adjusts the slider', async () => {
    const wrapper = mountVolume();
    const slider = layOut(wrapper);

    pointer(slider, 'pointermove', { clientX: 100, pointerType: 'touch' });
    await wrapper.vm.$nextTick();
    expect(label(wrapper).attributes('data-shown')).toBeUndefined();

    pointer(slider, 'pointerdown', { clientX: 100, pointerType: 'touch' });
    await wrapper.vm.$nextTick();
    expect(label(wrapper).attributes('data-shown')).toBeDefined();

    pointer(window, 'pointerup', { pointerType: 'touch' });
    await wrapper.vm.$nextTick();
    expect(label(wrapper).attributes('data-shown')).toBeUndefined();
  });
});
