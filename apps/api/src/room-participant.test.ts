import { describe, expect, it, vi } from 'vitest';
import { PARTICIPANT_PENDING_MAX, RoomParticipantWrites } from './room-participant';

// A Participant's write queue (docs/specs/013-workspace/share-roles.md, blueprint SR12): one socket cannot queue
// writes without end.
describe('RoomParticipantWrites', () => {
  it('refuses a flood past PARTICIPANT_PENDING_MAX with a resync, queueing nothing more', async () => {
    const sendTo = vi.fn();
    const enqueue = vi.fn(() => new Promise<never>(() => {}));
    const writes = new RoomParticipantWrites({
      env: {} as never,
      enqueue: enqueue as never,
      sequence: () => 1,
      sendTo,
      position: () => ({ epoch: 'e', seq: 0 }),
      readLedger: async () => ({ elements: {} }),
    });
    const ws = {} as WebSocket;
    const sender = { ws, presenceId: 'P', documentId: 'd1', adderKey: 'k' };
    const frame = { kind: 'el', tabId: 't1', op: { kind: 'remove', id: 'x' } };
    for (let i = 0; i < PARTICIPANT_PENDING_MAX; i++) void writes.applyContentOp(sender, frame);
    expect(sendTo).not.toHaveBeenCalled();
    await writes.applyContentOp(sender, frame);
    expect(enqueue).toHaveBeenCalledTimes(PARTICIPANT_PENDING_MAX);
    expect(sendTo).toHaveBeenCalledWith(
      ws,
      expect.objectContaining({ kind: 'catchup', resync: true }),
    );
  });

  it('re-hydrates a sender whose session names no document', async () => {
    const sendTo = vi.fn();
    const writes = new RoomParticipantWrites({
      env: {} as never,
      enqueue: vi.fn() as never,
      sequence: () => 1,
      sendTo,
      position: () => ({ epoch: 'e', seq: 0 }),
      readLedger: async () => ({ elements: {} }),
    });
    const ws = {} as WebSocket;
    await writes.applyContentOp(
      { ws, presenceId: 'P', documentId: null, adderKey: 'k' },
      { kind: 'el', tabId: 't1', op: { kind: 'remove', id: 'x' } },
    );
    expect(sendTo).toHaveBeenCalledWith(ws, expect.objectContaining({ resync: true }));
  });
});
