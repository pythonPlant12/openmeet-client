import { describe, expect, it } from 'vitest';
import { createActor, fromCallback, fromPromise, waitFor } from 'xstate';

import { webrtcMachine } from '../index';

describe('WebRTC Machine', () => {
  const createTestActor = () => {
    const machine = webrtcMachine.provide({
      actors: {
        initMedia: fromPromise(async () => ({ getTracks: () => [] }) as unknown as MediaStream),
        joinRoom: fromCallback(({ sendBack }) => {
          sendBack({ type: 'JOINED', participantId: 'participant-1', participantName: 'Alice' });
          sendBack({ type: 'CONNECTION_STATE_CHANGED', state: 'connected' });
        }),
      },
    });

    return createActor(machine);
  };

  it('keeps an active call alive through a transient disconnected connection state', async () => {
    const actor = createTestActor();
    actor.start();

    actor.send({ type: 'INIT_MEDIA', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches('mediaReady'));

    actor.send({ type: 'JOIN_ROOM', roomId: 'room-1', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches({ connected: 'inCall' }));

    actor.send({ type: 'CONNECTION_STATE_CHANGED', state: 'disconnected' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches({ connected: 'inCall' })).toBe(true);
    expect(snapshot.context.connectionState).toBe('disconnected');
    expect(snapshot.context.connectionQuality).toBe('poor');
    expect(snapshot.context.error).toBeNull();

    actor.stop();
  });

  it('moves to error when a peer connection fails', async () => {
    const actor = createTestActor();
    actor.start();

    actor.send({ type: 'INIT_MEDIA', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches('mediaReady'));

    actor.send({ type: 'JOIN_ROOM', roomId: 'room-1', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches({ connected: 'inCall' }));

    actor.send({ type: 'CONNECTION_STATE_CHANGED', state: 'failed' });

    await waitFor(actor, (state) => state.matches('error'));
    expect(actor.getSnapshot().context.error).toBe('Connection failed');

    actor.stop();
  });

  it('enters the call when ICE connects before the peer connection reports connected', async () => {
    const machine = webrtcMachine.provide({
      actors: {
        initMedia: fromPromise(async () => ({ getTracks: () => [] }) as unknown as MediaStream),
        joinRoom: fromCallback(({ sendBack }) => {
          sendBack({ type: 'JOINED', participantId: 'participant-1', participantName: 'Alice' });
          sendBack({ type: 'CONNECTION_STATE_CHANGED', state: 'connecting' });
          sendBack({ type: 'ICE_CONNECTION_STATE_CHANGED', state: 'connected' });
        }),
      },
    });
    const actor = createActor(machine);
    actor.start();

    actor.send({ type: 'INIT_MEDIA', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches('mediaReady'));

    actor.send({ type: 'JOIN_ROOM', roomId: 'room-1', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches({ connected: 'inCall' }));

    expect(actor.getSnapshot().context.connectionState).toBe('connecting');
    expect(actor.getSnapshot().context.iceConnectionState).toBe('connected');

    actor.stop();
  });

  it('moves to error when ICE fails while joining', async () => {
    const machine = webrtcMachine.provide({
      actors: {
        initMedia: fromPromise(async () => ({ getTracks: () => [] }) as unknown as MediaStream),
        joinRoom: fromCallback(({ sendBack }) => {
          sendBack({ type: 'JOINED', participantId: 'participant-1', participantName: 'Alice' });
          sendBack({ type: 'CONNECTION_STATE_CHANGED', state: 'connecting' });
        }),
      },
    });
    const actor = createActor(machine);
    actor.start();

    actor.send({ type: 'INIT_MEDIA', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches('mediaReady'));

    actor.send({ type: 'JOIN_ROOM', roomId: 'room-1', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches({ connected: 'joiningRoom' }));
    actor.send({ type: 'ICE_CONNECTION_STATE_CHANGED', state: 'failed' });

    await waitFor(actor, (state) => state.matches('error'));
    expect(actor.getSnapshot().context.iceConnectionState).toBe('failed');
    expect(actor.getSnapshot().context.error).toBe('ICE connection failed');

    actor.stop();
  });

  it('marks connection quality poor without leaving the call', async () => {
    const actor = createTestActor();
    actor.start();

    actor.send({ type: 'INIT_MEDIA', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches('mediaReady'));

    actor.send({ type: 'JOIN_ROOM', roomId: 'room-1', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches({ connected: 'inCall' }));

    actor.send({
      type: 'CONNECTION_QUALITY_CHANGED',
      stats: {
        quality: 'poor',
        packetLossRatio: 0.12,
        roundTripTime: 0.2,
        jitter: 0.01,
        reason: 'Packet loss is 12%',
        hasRecentMediaActivity: true,
        remoteVideoFrozen: false,
      },
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches({ connected: 'inCall' })).toBe(true);
    expect(snapshot.context.connectionQuality).toBe('poor');
    expect(snapshot.context.connectionQualityReason).toBe('Packet loss is 12%');
    expect(snapshot.context.packetLossRatio).toBe(0.12);

    actor.stop();
  });

  it('clears poor connection quality when ICE reconnects', async () => {
    const actor = createTestActor();
    actor.start();

    actor.send({ type: 'INIT_MEDIA', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches('mediaReady'));

    actor.send({ type: 'JOIN_ROOM', roomId: 'room-1', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches({ connected: 'inCall' }));

    actor.send({ type: 'ICE_CONNECTION_STATE_CHANGED', state: 'disconnected' });
    expect(actor.getSnapshot().context.connectionQuality).toBe('poor');

    actor.send({
      type: 'CONNECTION_QUALITY_CHANGED',
      stats: {
        quality: 'good',
        packetLossRatio: 0,
        roundTripTime: 0.1,
        jitter: 0.01,
        reason: null,
        hasRecentMediaActivity: true,
        remoteVideoFrozen: false,
      },
    });
    expect(actor.getSnapshot().context.connectionQuality).toBe('poor');

    actor.send({ type: 'ICE_CONNECTION_STATE_CHANGED', state: 'connected' });

    expect(actor.getSnapshot().context.connectionQuality).toBe('good');
    expect(actor.getSnapshot().context.connectionQualityReason).toBeNull();

    actor.stop();
  });

  it('moves to error when disconnected ICE times out', async () => {
    const actor = createTestActor();
    actor.start();

    actor.send({ type: 'INIT_MEDIA', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches('mediaReady'));

    actor.send({ type: 'JOIN_ROOM', roomId: 'room-1', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches({ connected: 'inCall' }));

    actor.send({ type: 'ICE_CONNECTION_STATE_CHANGED', state: 'disconnected' });
    actor.send({ type: 'CONNECTION_TIMEOUT' });

    await waitFor(actor, (state) => state.matches('error'));
    expect(actor.getSnapshot().context.error).toBe('Connection lost');

    actor.stop();
  });

  it('removes a participant when the server reports they left', async () => {
    const actor = createTestActor();
    actor.start();

    actor.send({ type: 'INIT_MEDIA', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches('mediaReady'));

    actor.send({ type: 'JOIN_ROOM', roomId: 'room-1', participantName: 'Alice' });
    await waitFor(actor, (state) => state.matches({ connected: 'inCall' }));

    actor.send({ type: 'PARTICIPANT_JOINED', participantId: 'participant-2', participantName: 'Bob' });
    expect(actor.getSnapshot().context.participants.has('participant-2')).toBe(true);

    actor.send({ type: 'PARTICIPANT_LEFT', participantId: 'participant-2' });
    expect(actor.getSnapshot().context.participants.has('participant-2')).toBe(false);

    actor.stop();
  });
});
