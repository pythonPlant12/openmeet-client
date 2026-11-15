import { describe, expect, it } from 'vitest';

import { leavesActiveCall, showsLiveCallRing } from '@/lib/live-call';

describe('showsLiveCallRing', () => {
  it('rings a group while anyone is in its call, and a friend only while they are in the call with me', () => {
    expect(showsLiveCallRing({ kind: 'group', otherUserId: null, liveCall: { id: 'c', memberIds: ['ada'] } })).toBe(true);
    expect(showsLiveCallRing({ kind: 'group', otherUserId: null, liveCall: { id: 'c', memberIds: [] } })).toBe(false);
    expect(showsLiveCallRing({ kind: 'direct', otherUserId: 'ada', liveCall: { id: 'c', memberIds: ['ada'] } })).toBe(true);
    expect(showsLiveCallRing({ kind: 'direct', otherUserId: 'ada', liveCall: { id: 'c', memberIds: ['me'] } })).toBe(false);
    expect(showsLiveCallRing({ kind: 'direct', otherUserId: 'ada', liveCall: null })).toBe(false);
  });
});

describe('leavesActiveCall', () => {
  it('asks only when a different call would replace a connected one', () => {
    const active = { connected: true, callSessionId: 'call-1', roomId: 'sfu-1' };
    expect(leavesActiveCall(active, 'call-2')).toBe(true);
    expect(leavesActiveCall(active, 'call-1')).toBe(false);
    expect(leavesActiveCall(active, 'sfu-1')).toBe(false);
    expect(leavesActiveCall({ ...active, connected: false }, 'call-2')).toBe(false);
    expect(leavesActiveCall({ connected: true, callSessionId: null, roomId: 'room-9' }, 'room-9')).toBe(false);
  });
});
