import { describe, expect, it, vi } from 'vitest';

const written = vi.hoisted(() => ({
  calls: [] as { since?: number }[],
  ok: true,
}));
vi.mock('./participant-write', async (actual) => ({
  ...(await actual<typeof import('./participant-write')>()),
  writeParticipantAnswers: vi.fn(async (_env: unknown, req: { since?: number }) => {
    written.calls.push({ since: req.since });
    return written.ok ? { ok: true, changed: true } : { ok: false, status: 503 };
  }),
}));

import { RoomParticipantWrites } from './room-participant';

// A Participant's answers are written into the stored tab by the room (docs/specs/013-workspace/share-roles.md
// "Integrity"): each write applies only what the room sequenced since the last one that landed, so a pin refused on a
// full board is never written later, once the board has room.
describe('RoomParticipantWrites.flushAnswers', () => {
  it('writes each answer once: from where the last write that landed went through, in this epoch', async () => {
    written.calls = [];
    written.ok = true;
    let at = { epoch: 'e1', seq: 5 };
    const writes = new RoomParticipantWrites({
      env: {} as never,
      enqueue: (fn) => fn(),
      sequence: () => 1,
      sendTo: vi.fn(),
      position: () => at,
      readLedger: async () => ({ elements: {} }),
    });
    await writes.flushAnswers('d1', 't1');
    at = { epoch: 'e1', seq: 9 };
    await writes.flushAnswers('d1', 't1');
    // A write that fails moves nothing on.
    written.ok = false;
    at = { epoch: 'e1', seq: 12 };
    await writes.flushAnswers('d1', 't1');
    written.ok = true;
    await writes.flushAnswers('d1', 't1');
    // Another tab has its own position; a new epoch starts again from the beginning.
    await writes.flushAnswers('d1', 't2');
    at = { epoch: 'e2', seq: 1 };
    await writes.flushAnswers('d1', 't1');
    expect(written.calls.map((c) => c.since)).toEqual([0, 5, 9, 9, 0, 0]);
  });
});
