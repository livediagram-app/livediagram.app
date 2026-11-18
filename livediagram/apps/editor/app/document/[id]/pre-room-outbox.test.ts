import { describe, expect, it, vi } from 'vitest';
import type { RoomOutgoing } from '@livediagram/api-schema';
import {
  PRE_ROOM_OUTBOX_MAX,
  clearPreRoomOutbox,
  createPreRoomOutbox,
  flushPreRoomOutbox,
  sendOrHold,
} from './pre-room-outbox';

// docs/specs/012-collaboration/session-tools.md "A dot cast before the room opens".
const dot = (n: number): RoomOutgoing => ({
  kind: 'op',
  op: { kind: 'vote', tabId: 't', elementId: `e${n}`, voter: 'k', delta: 1 },
});

describe('the pre-room outbox', () => {
  it('sends straight to a room that exists, holding nothing', () => {
    const box = createPreRoomOutbox();
    const room = { send: vi.fn<(msg: RoomOutgoing) => void>() };
    sendOrHold(box, room, 'doc', dot(1));
    expect(room.send).toHaveBeenCalledWith(dot(1));
    expect(box.held).toEqual([]);
  });

  it('holds for the document until its room is made, then sends each once, in order', () => {
    const box = createPreRoomOutbox();
    sendOrHold(box, null, 'doc', dot(1));
    sendOrHold(box, null, 'doc', dot(2));
    const room = { send: vi.fn<(msg: RoomOutgoing) => void>() };
    flushPreRoomOutbox(box, room, 'doc');
    expect(room.send.mock.calls.map(([m]) => m)).toEqual([dot(1), dot(2)]);
    flushPreRoomOutbox(box, room, 'doc');
    expect(room.send).toHaveBeenCalledTimes(2);
  });

  it('holds nothing without a document, and drops what another document held', () => {
    const box = createPreRoomOutbox();
    sendOrHold(box, null, null, dot(1));
    expect(box.held).toEqual([]);
    sendOrHold(box, null, 'a', dot(1));
    sendOrHold(box, null, 'b', dot(2));
    expect(box.held).toEqual([dot(2)]);
    const room = { send: vi.fn<(msg: RoomOutgoing) => void>() };
    flushPreRoomOutbox(box, room, 'a');
    expect(room.send).not.toHaveBeenCalled();
    expect(box.held).toEqual([]);
  });

  it('is bounded, and cleared when the document is left', () => {
    const box = createPreRoomOutbox();
    for (let n = 0; n < PRE_ROOM_OUTBOX_MAX + 10; n++) sendOrHold(box, null, 'doc', dot(n));
    expect(box.held).toHaveLength(PRE_ROOM_OUTBOX_MAX);
    expect(box.held.at(-1)).toEqual(dot(PRE_ROOM_OUTBOX_MAX - 1));
    clearPreRoomOutbox(box);
    expect(box).toEqual({ documentId: null, held: [] });
  });
});
