import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import CallsSidebar from '@/components/dashboard-page/calls/CallsSidebar.vue';
import type { MeetingSession } from '@/services/social-api';

const NOW = Date.parse('2026-10-07T12:00:00Z');

const meetings: MeetingSession[] = [
  {
    id: 'meeting-1',
    roomId: 'room-1',
    callSessionId: null,
    conversationId: null,
    accessPolicy: 'open',
    startedAt: '2026-10-07T10:00:00Z',
    endedAt: '2026-10-07T10:20:00Z',
    participantCount: 2,
    missed: false,
    unread: false,
    participants: [
      {
        userId: 'bob',
        name: 'Bob Chen',
        nickname: 'bob',
        avatarUrl: null,
        joinedAt: '2026-10-07T10:00:00Z',
        leftAt: '2026-10-07T10:20:00Z',
        isYou: false,
      },
    ],
  },
];

enableAutoUnmount(afterEach);

function mountSidebar(props: Partial<InstanceType<typeof CallsSidebar>['$props']> = {}) {
  return mount(CallsSidebar, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false })],
    },
    props: {
      panel: 'collapsed',
      badge: 0,
      meetings,
      isLoading: false,
      error: '',
      hasMore: false,
      isLoadingMore: false,
      now: NOW,
      avatarFor: () => undefined,
      ringingName: null,
      ringingMore: 0,
      isAnswering: false,
      callingId: null,
      ...props,
    },
  });
}

const missedCall: MeetingSession = { ...meetings[0]!, id: 'meeting-2', missed: true, unread: true };

describe('CallsSidebar', () => {
  it('shows only its header while collapsed and toggles from it', async () => {
    const wrapper = mountSidebar();
    expect(wrapper.get('[data-calls-list]').attributes('aria-hidden')).toBe('true');
    expect(wrapper.get('#calls-heading').attributes('aria-expanded')).toBe('false');

    await wrapper.get('#calls-heading').trigger('click');
    expect(wrapper.emitted('toggle')).toHaveLength(1);
  });

  it('shows missed calls beside the title while collapsed', () => {
    expect(mountSidebar().find('[data-section-badge]').exists()).toBe(false);

    const badge = mountSidebar({ badge: 3 }).get('#calls-heading [data-section-badge]');
    expect(badge.text()).toBe('3');
    expect(badge.attributes('aria-label')).toBe('3 missed calls');
    expect(mountSidebar({ badge: 150 }).get('[data-section-badge]').text()).toBe('99+');
  });

  it('lists calls when expanded and opens one on press', async () => {
    const wrapper = mountSidebar({ panel: 'middle' });
    expect(wrapper.get('[data-calls-list]').attributes('aria-hidden')).toBe('false');
    expect(wrapper.text()).toContain('Today');
    expect(wrapper.text()).toContain('Bob Chen');

    await wrapper.get('[data-call-item]').trigger('click');
    expect(wrapper.emitted('open')?.[0]).toEqual([meetings[0]]);
  });

  it('marks unread missed calls with a dot and a missed label', () => {
    const wrapper = mountSidebar({ panel: 'middle', meetings: [missedCall, meetings[0]!] });
    const [missed, answered] = wrapper.findAll('[data-call-item]');

    expect(missed!.find('[data-call-unread]').exists()).toBe(true);
    expect(missed!.get('[data-call-missed]').text()).toContain('Missed');
    expect(answered!.find('[data-call-unread]').exists()).toBe(false);
    expect(answered!.find('[data-call-missed]').exists()).toBe(false);
  });

  it('drops the dot once a missed call is read', () => {
    const wrapper = mountSidebar({ panel: 'middle', meetings: [{ ...missedCall, unread: false }] });
    expect(wrapper.find('[data-call-unread]').exists()).toBe(false);
    expect(wrapper.find('[data-call-missed]').exists()).toBe(true);
  });

  it('toggles a missed call read state without exposing call again', async () => {
    const wrapper = mountSidebar({ panel: 'middle', meetings: [missedCall, meetings[0]!] });

    await wrapper.get('[data-call-read-action]').trigger('click');
    expect(wrapper.emitted('toggle-read')?.[0]).toEqual([missedCall]);
    expect(wrapper.findAll('[data-call-read-action]')).toHaveLength(1);
    expect(wrapper.find('[aria-label="Call details"]').exists()).toBe(true);
  });

  it('marks a read missed call unread from the right swipe action', async () => {
    const wrapper = mountSidebar({ panel: 'top', meetings: [{ ...missedCall, unread: false }] });
    await wrapper.get('[aria-label="Mark call unread"]').trigger('click');
    expect(wrapper.emitted('toggle-read')?.[0]).toEqual([{ ...missedCall, unread: false }]);
  });

  it('rings with the caller name and answer or decline buttons, even while collapsed', async () => {
    const wrapper = mountSidebar({ ringingName: 'OpenMeet testers', ringingMore: 1 });
    expect(wrapper.get('[data-incoming-caller]').text()).toBe('OpenMeet testers');
    expect(wrapper.get('[data-incoming-call]').text()).toContain('1 more');

    await wrapper.get('[data-incoming-accept]').trigger('click');
    await wrapper.get('[data-incoming-decline]').trigger('click');
    expect(wrapper.emitted('accept')).toHaveLength(1);
    expect(wrapper.emitted('decline')).toHaveLength(1);

    await wrapper.get('[data-incoming-toggle]').trigger('click');
    expect(wrapper.emitted('toggle')).toHaveLength(1);
  });

  it('hides the answer buttons while a response is in flight', () => {
    const wrapper = mountSidebar({ ringingName: 'Bob Chen', isAnswering: true });
    expect(wrapper.find('[data-incoming-accept]').exists()).toBe(false);
    expect(wrapper.find('[data-incoming-decline]').exists()).toBe(false);
  });
});
