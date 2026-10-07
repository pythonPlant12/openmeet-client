import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const api = vi.hoisted(() => ({ hasStoredSession: vi.fn(), createMeetingRoom: vi.fn() }));

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/services/social-api', () => ({
  hasStoredSession: api.hasStoredSession,
  socialApi: { createMeetingRoom: api.createMeetingRoom },
}));

const { useMeetingNavigation } = await import('@/composables/useMeetingNavigation');

describe('createMeeting', () => {
  beforeEach(() => {
    push.mockReset();
    api.hasStoredSession.mockReset();
    api.createMeetingRoom.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('creates a hosted, open room for signed-in users', async () => {
    api.hasStoredSession.mockReturnValue(true);
    api.createMeetingRoom.mockResolvedValue({ roomId: 'hosted-room' });

    await useMeetingNavigation().createMeeting();

    expect(api.createMeetingRoom).toHaveBeenCalledWith(expect.any(String), { accessPolicy: 'open' });
    expect(push).toHaveBeenCalledWith({ name: 'meeting', params: { id: 'hosted-room' } });
  });

  it('gives guests a local open room', async () => {
    api.hasStoredSession.mockReturnValue(false);

    await useMeetingNavigation().createMeeting();

    expect(api.createMeetingRoom).not.toHaveBeenCalled();
    expect(push.mock.calls[0]![0].params.id).toMatch(/^[\w-]+$/);
  });

  it('still starts a meeting when the server cannot create the room', async () => {
    api.hasStoredSession.mockReturnValue(true);
    api.createMeetingRoom.mockRejectedValue(new Error('offline'));

    await useMeetingNavigation().createMeeting();

    expect(push).toHaveBeenCalledTimes(1);
  });
});
