import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import en from '@/locales/en.json';
import type { MeetingRoomAccess } from '@/services/social-api';

const api = vi.hoisted(() => ({
  listMeetingInvitationCandidates: vi.fn(),
  inviteToMeetingRoom: vi.fn(),
  updateMeetingRoom: vi.fn(),
  loadAvatar: vi.fn(),
}));
vi.mock('@/services/social-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/social-api')>()),
  socialApi: api,
}));
vi.mock('@/components/ui/toast', () => ({ toast: vi.fn() }));

const { default: MeetingInviteContent } = await import('@/components/meeting-page/MeetingInviteContent.vue');
const { default: MeetingInviteDialog } = await import('@/components/meeting-page/MeetingInviteDialog.vue');

enableAutoUnmount(afterEach);

const passthrough = { template: '<div><slot /></div>' };
const hostAccess: MeetingRoomAccess = {
  roomId: 'room-1',
  managed: true,
  accessPolicy: 'friendsOnly',
  isOwner: true,
  canJoin: true,
  requiresPassword: false,
  ownerName: 'Ada',
  deniedReason: null,
};

const i18n = () => createI18n({ legacy: false, locale: 'en', messages: { en }, missingWarn: false });

function mountContent(access: MeetingRoomAccess = hostAccess) {
  return mount(MeetingInviteContent, {
    props: { active: false, roomId: 'room-1', access },
    global: { plugins: [i18n()] },
  });
}

function mountSheet() {
  return mount(MeetingInviteDialog, {
    props: { open: true, roomId: 'room-1', access: hostAccess, phone: true },
    global: {
      plugins: [i18n()],
      stubs: {
        Sheet: passthrough,
        SheetContent: { template: '<div v-bind="$attrs"><slot /></div>' },
        SheetTitle: passthrough,
        SheetDescription: passthrough,
        MeetingInviteContent: true,
      },
    },
  });
}

describe('MeetingInviteContent', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listMeetingInvitationCandidates.mockResolvedValue([
      { id: 'bob', name: 'Bob', nickname: 'bob', avatarUrl: null, isFriend: true, invited: false },
    ]);
    api.inviteToMeetingRoom.mockResolvedValue(undefined);
  });

  it('lists people on open and invites them', async () => {
    const wrapper = mountContent();
    await wrapper.setProps({ active: true });
    await flushPromises();

    expect(api.listMeetingInvitationCandidates).toHaveBeenCalledWith(expect.any(String), 'room-1', '');
    const row = wrapper.get('[data-invite-candidates] li');
    expect(row.text()).toContain('Bob');
    expect(row.text()).toContain('@bob');
    expect(row.text()).not.toContain('Friend');
    await wrapper.get('[data-invite="bob"]').trigger('click');
    await flushPromises();

    expect(api.inviteToMeetingRoom).toHaveBeenCalledWith(expect.any(String), 'room-1', 'bob');
    expect(wrapper.get('[data-invite-candidates]').text()).toContain('Invited');
  });

  it('describes the access policy under the search, with Edit access only for the host', async () => {
    const host = mountContent();
    expect(host.get('[data-meeting-access-summary]').text()).toContain('Only your friends can join');
    expect(host.find('[data-host-access]').exists()).toBe(false);
    await host.get('[data-edit-access]').trigger('click');
    expect(host.find('[data-host-access]').exists()).toBe(true);

    const guest = mountContent({ ...hostAccess, isOwner: false });
    expect(guest.find('[data-edit-access]').exists()).toBe(false);
  });

  it('shows guests the share targets and the access line, but no people to invite', async () => {
    const wrapper = mount(MeetingInviteContent, {
      props: { active: true, roomId: 'room-1', access: null, guest: true },
      global: { plugins: [i18n()] },
    });
    await flushPromises();
    expect(wrapper.find('[data-share-row]').exists()).toBe(true);
    expect(wrapper.find('[data-meeting-access-line]').exists()).toBe(true);
    expect(wrapper.find('[data-invite-candidates]').exists()).toBe(false);
    expect(api.listMeetingInvitationCandidates).not.toHaveBeenCalled();
  });

  it('saves a new password policy for the host', async () => {
    api.updateMeetingRoom.mockResolvedValue({ ...hostAccess, accessPolicy: 'password' });
    const wrapper = mountContent();
    await wrapper.setProps({ active: true });
    await flushPromises();

    await wrapper.get('[data-edit-access]').trigger('click');
    await wrapper.get('[data-access-select]').setValue('password');
    await wrapper.get('#meeting-access-password').setValue('secret');
    await wrapper.get('[data-host-access] button').trigger('click');
    await flushPromises();

    expect(api.updateMeetingRoom).toHaveBeenCalledWith(expect.any(String), 'room-1', {
      accessPolicy: 'password',
      password: 'secret',
    });
    expect(wrapper.emitted('access-updated')?.[0]?.[0]).toMatchObject({ accessPolicy: 'password' });
    expect(wrapper.find('[data-host-access]').exists()).toBe(false);
  });
});

function press(type: string, clientY: number) {
  return new MouseEvent(type, { bubbles: true, clientY });
}

describe('MeetingInviteDialog on a phone', () => {
  it('opens as a sheet titled Invite people that the handle makes taller and shorter', async () => {
    const wrapper = mountSheet();
    const sheet = () => wrapper.get('[data-meeting-invite]');
    expect(sheet().text()).toContain('Invite people');
    expect(sheet().attributes('data-expanded')).toBe('false');

    const handle = wrapper.get('[data-invite-handle]');
    handle.element.dispatchEvent(press('pointerdown', 400));
    await flushPromises();
    handle.element.dispatchEvent(press('pointerup', 300));
    await flushPromises();
    expect(sheet().attributes('data-expanded')).toBe('true');

    handle.element.dispatchEvent(press('pointerdown', 300));
    await flushPromises();
    handle.element.dispatchEvent(press('pointerup', 400));
    await flushPromises();
    expect(sheet().attributes('data-expanded')).toBe('false');
  });

  it('closes when the short sheet is dragged down', async () => {
    const wrapper = mountSheet();
    const handle = wrapper.get('[data-invite-handle]');
    handle.element.dispatchEvent(press('pointerdown', 300));
    await flushPromises();
    handle.element.dispatchEvent(press('pointerup', 400));
    await flushPromises();
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });
});
