import { describe, expect, it, vi } from 'vitest';
import {
  aimPreRoomOutbox,
  clearPreRoomOutbox,
  createPreRoomOutbox,
  flushPreRoomOutbox,
  holdsOpKinds,
  PRE_ROOM_HOLD_MS,
  PRE_ROOM_OUTBOX_MAX,
  sendOrHold,
} from './pre-room-outbox';

// Sends made before the room client exists (each product's collab-race-hardening.md "Sent before the room client
// exists", Work Tracker 1263): held for the item, handed to its room once, bounded, and only what means something late.

type Msg = { kind: 'op'; op: { kind: string; n?: number } } | { kind: 'hello' };
const op = (kind: string, n?: number): Msg => ({ kind: 'op', op: { kind, n } });
const T0 = 1_800_000_000_000;
const box = () => {
  const b = createPreRoomOutbox<Msg>(holdsOpKinds((k) => k === 'el-delta' || k === 'vote'));
  aimPreRoomOutbox(b, 'doc');
  return b;
};
const room = () => ({ send: vi.fn<(msg: Msg) => void>() });

describe('the pre-room outbox', () => {
  it('sends straight to a room that exists, holding nothing', () => {
    const b = box();
    const r = room();
    sendOrHold(b, r, op('cursor'));
    sendOrHold(b, r, op('el-delta'));
    expect(r.send.mock.calls).toEqual([[op('cursor')], [op('el-delta')]]);
    expect(b.held).toEqual([]);
  });

  it('holds for the item until its room is made, then sends each once, in order', () => {
    const b = box();
    sendOrHold(b, null, op('el-delta', 1), T0);
    sendOrHold(b, null, op('vote', 2), T0);
    const r = room();
    flushPreRoomOutbox(b, r, 'doc', T0 + 1_000);
    expect(r.send.mock.calls).toEqual([[op('el-delta', 1)], [op('vote', 2)]]);
    // A second room for the same item (a team change reopens it) replays nothing.
    const again = room();
    flushPreRoomOutbox(b, again, 'doc', T0 + 2_000);
    expect(again.send).not.toHaveBeenCalled();
  });

  it('drops what means nothing late: presence ops and frames that are no op', () => {
    const b = box();
    for (const kind of ['cursor', 'laser', 'viewport', 'reaction', 'select'])
      sendOrHold(b, null, op(kind));
    sendOrHold(b, null, { kind: 'hello' });
    expect(b.held).toEqual([]);
    expect(holdsOpKinds(() => true)({ kind: 'op' })).toBe(true);
  });

  it('holds nothing with no item to hold it for', () => {
    const b = createPreRoomOutbox<Msg>(() => true);
    sendOrHold(b, null, op('el-delta'));
    expect(b.held).toEqual([]);
  });

  it(`holds at most ${PRE_ROOM_OUTBOX_MAX}, dropping the newest past it`, () => {
    const b = box();
    for (let n = 0; n < PRE_ROOM_OUTBOX_MAX + 20; n++) sendOrHold(b, null, op('el-delta', n), T0);
    expect(b.held).toHaveLength(PRE_ROOM_OUTBOX_MAX);
    const r = room();
    flushPreRoomOutbox(b, r, 'doc', T0);
    expect(r.send).toHaveBeenCalledTimes(PRE_ROOM_OUTBOX_MAX);
    expect(r.send.mock.calls.at(-1)).toEqual([op('el-delta', PRE_ROOM_OUTBOX_MAX - 1)]);
  });

  it(`drops a held send older than ${PRE_ROOM_HOLD_MS / 1_000} s when the room is made`, () => {
    const b = box();
    sendOrHold(b, null, op('vote', 1), T0);
    sendOrHold(b, null, op('vote', 2), T0 + 10_000);
    const r = room();
    flushPreRoomOutbox(b, r, 'doc', T0 + PRE_ROOM_HOLD_MS + 1);
    expect(r.send.mock.calls).toEqual([[op('vote', 2)]]);
  });

  it('never hands what was held for one item to another, and drops it on moving', () => {
    const b = box();
    sendOrHold(b, null, op('el-delta'));
    const other = room();
    flushPreRoomOutbox(b, other, 'elsewhere');
    expect(other.send).not.toHaveBeenCalled();
    expect(b.held).toEqual([]);

    sendOrHold(b, null, op('el-delta'));
    // Aiming at the same item keeps it; another drops it.
    aimPreRoomOutbox(b, 'doc');
    expect(b.held).toHaveLength(1);
    aimPreRoomOutbox(b, 'next');
    expect(b.held).toEqual([]);
    expect(b.itemId).toBe('next');
  });

  it('clears what is held when the room closes, keeping the item', () => {
    const b = box();
    sendOrHold(b, null, op('el-delta'));
    clearPreRoomOutbox(b);
    expect(b.held).toEqual([]);
    expect(b.itemId).toBe('doc');
  });
});
