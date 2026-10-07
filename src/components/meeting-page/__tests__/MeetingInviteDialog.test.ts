import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

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

function mountDialog(access: MeetingRoomAccess = hostAccess) {
  return mount(MeetingInviteDialog, {
    props: { open: false, roomId: 'room-1', access },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false })],
      stubs: {
        Dialog: passthrough,
        HarborDialogContent: passthrough,
        DialogHeader: passthrough,
        DialogTitle: passthrough,
        DialogDescription: passthrough,
      },
    },
  });
}

describe('MeetingInviteDialog', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listMeetingInvitationCandidates.mockResolvedValue([
      { id: 'bob', name: 'Bob', nickname: 'bob', avatarUrl: null, isFriend: true, invited: false },
    ]);
    api.inviteToMeetingRoom.mockResolvedValue(undefined);
  });

  it('lists people on open and invites them', async () => {
    const wrapper = mountDialog();
    await wrapper.setProps({ open: true });
    await flushPromises();

    expect(api.listMeetingInvitationCandidates).toHaveBeenCalledWith(expect.any(String), 'room-1', '');
    await wrapper.get('[data-invite="bob"]').trigger('click');
    await flushPromises();

    expect(api.inviteToMeetingRoom).toHaveBeenCalledWith(expect.any(String), 'room-1', 'bob');
    expect(wrapper.get('[data-invite-candidates]').text()).toContain('Invited');
  });

  it('describes the access policy and lets only the host change it', async () => {
    const host = mountDialog();
    expect(host.get('[data-meeting-access-summary]').text()).toContain('Only your friends can join');
    expect(host.find('[data-host-access]').exists()).toBe(true);

    const guest = mountDialog({ ...hostAccess, isOwner: false });
    expect(guest.find('[data-host-access]').exists()).toBe(false);
  });

  it('saves a new password policy for the host', async () => {
    api.updateMeetingRoom.mockResolvedValue({ ...hostAccess, accessPolicy: 'password' });
    const wrapper = mountDialog();
    await wrapper.setProps({ open: true });
    await flushPromises();

    await wrapper.get('[data-access-select]').setValue('password');
    await wrapper.get('#meeting-access-password').setValue('secret');
    await wrapper.get('[data-host-access] button').trigger('click');
    await flushPromises();

    expect(api.updateMeetingRoom).toHaveBeenCalledWith(expect.any(String), 'room-1', {
      accessPolicy: 'password',
      password: 'secret',
    });
    expect(wrapper.emitted('access-updated')?.[0]?.[0]).toMatchObject({ accessPolicy: 'password' });
  });
});
