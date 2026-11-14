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
      meetings,
      isLoading: false,
      error: '',
      hasMore: false,
      isLoadingMore: false,
      now: NOW,
      avatarFor: () => undefined,
      callingId: null,
      ...props,
    },
  });
}

const missedCall: MeetingSession = { ...meetings[0]!, id: 'meeting-2', missed: true, unread: true };

describe('CallsSidebar', () => {
  it('hides the list while collapsed and keeps the heading static', async () => {
    const wrapper = mountSidebar();
    expect(wrapper.get('[data-calls-list]').attributes('aria-hidden')).toBe('true');
    expect(wrapper.get('#calls-heading').attributes('role')).toBeUndefined();

    await wrapper.get('#calls-heading').trigger('click');
    expect(wrapper.emitted('toggle')).toBeUndefined();
  });

  it('shows no missed-call count beside the title', () => {
    const wrapper = mountSidebar({ meetings: [missedCall] });
    expect(wrapper.find('[data-section-badge]').exists()).toBe(false);
  });

  it('lists calls when expanded and opens one on press', async () => {
    const wrapper = mountSidebar({ panel: 'top' });
    expect(wrapper.get('[data-calls-list]').attributes('aria-hidden')).toBe('false');
    expect(wrapper.text()).toContain('Recent');
    expect(wrapper.text()).toContain('Bob Chen');

    await wrapper.get('[data-call-item]').trigger('click');
    expect(wrapper.emitted('open')?.[0]).toEqual([meetings[0]]);
  });

  it('marks a missed call in red with a missed label, and no unread dot', () => {
    const wrapper = mountSidebar({ panel: 'top', meetings: [missedCall, meetings[0]!] });
    const [missed, answered] = wrapper.findAll('[data-call-item]');

    expect(missed!.get('[data-call-missed]').text()).toContain('Missed');
    expect(missed!.find('.text-harbor-danger').exists()).toBe(true);
    expect(wrapper.find('[data-call-unread]').exists()).toBe(false);
    expect(answered!.find('[data-call-missed]').exists()).toBe(false);
  });

  it('offers only call details on a swipe, with no read or unread action', async () => {
    const wrapper = mountSidebar({ panel: 'top', meetings: [missedCall] });
    expect(wrapper.find('[data-call-read-action]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Mark call unread"]').exists()).toBe(false);

    await wrapper.get('[aria-label="Call details"]').trigger('click');
    expect(wrapper.emitted('open')?.[0]).toEqual([missedCall]);
  });

  it('searches from the round button beside the title', () => {
    const wrapper = mountSidebar();
    expect(wrapper.find('[data-pane-search]').exists()).toBe(true);
    expect(wrapper.get('input').attributes('placeholder')).toBe('Search calls');
  });

  describe('call pictures', () => {
    const bob = meetings[0]!.participants[0]!;
    const person = (name: string) => ({ ...bob, userId: name, name });
    const row = (meeting: MeetingSession, props: Record<string, unknown> = {}) =>
      mountSidebar({ panel: 'top', meetings: [meeting], ...props }).get('[data-call-item]');

    it('shows your own picture and Me when nobody else joined', () => {
      const item = row({ ...meetings[0]!, participants: [], participantCount: 1 }, { selfAvatarUrl: '/me.jpg' });
      expect(item.get('img').attributes('src')).toBe('/me.jpg');
      expect(item.text()).toContain('Me');
    });

    it("shows the other person's picture in a direct call", () => {
      const item = row(meetings[0]!, { avatarFor: () => '/bob.jpg' });
      expect(item.get('img').attributes('src')).toBe('/bob.jpg');
      expect(item.find('[data-mosaic-tile]').exists()).toBe(false);
    });

    it('puts up to four people in one circle', () => {
      const participants = ['Ada', 'Cy', 'Dee', 'Eve', 'Fay'].map(person);
      const item = row({ ...meetings[0]!, participants, participantCount: 6 });
      expect(item.findAll('[data-mosaic-tile]')).toHaveLength(4);
    });

    it('shows the group picture for a group call', () => {
      const participants = ['Ada', 'Cy'].map(person);
      const item = row(
        { ...meetings[0]!, conversationId: 'group-1', participants, participantCount: 3 },
        {
          callGroup: (meeting: MeetingSession) =>
            meeting.conversationId === 'group-1' ? { avatarUrl: '/group.jpg' } : null,
        },
      );
      expect(item.get('img').attributes('src')).toBe('/group.jpg');
      expect(item.find('[data-mosaic-tile]').exists()).toBe(false);
    });
  });
});
