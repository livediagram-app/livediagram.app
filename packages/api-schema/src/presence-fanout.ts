// How a busy room keeps its presence fan-out affordable (each product's docs/specs/015-api/api.md "A busy room
// bounds its presence fan-out"). Every walker and every cursor is a stream of samples, and the room sends each sample
// to every other socket, so its sends grow with the square of the people in it: 100 walkers at 30 Hz is about
// 300,000 sends a second, which one Durable Object cannot keep up with. Both ends of the wire read the one table
// below: an editor to pace its character, the room to pace the frames it coalesces.

// Up to this many connections a room behaves exactly as it always did: samples at about 30 Hz, each sent at once.
export const PRESENCE_QUIET_ROOM = 10;

// The steps: the most connections each one covers, and the interval (ms) a sample stream runs at there.
export const PRESENCE_STEPS: readonly { upTo: number; everyMs: number }[] = [
  { upTo: PRESENCE_QUIET_ROOM, everyMs: 33 },
  { upTo: 32, everyMs: 50 },
  { upTo: Number.POSITIVE_INFINITY, everyMs: 66 },
];

/** The interval (ms) a sample stream runs at in a room holding `connections` sockets. */
export function presenceStepMs(connections: number): number {
  const last = PRESENCE_STEPS.length - 1;
  for (let i = 0; i < last; i++) {
    if (connections <= PRESENCE_STEPS[i]!.upTo) return PRESENCE_STEPS[i]!.everyMs;
  }
  return PRESENCE_STEPS[last]!.everyMs;
}

/** Whether a room holding `connections` sockets coalesces each socket's samples into one frame per step. */
export function presenceBatches(connections: number): boolean {
  return connections > PRESENCE_QUIET_ROOM;
}

// The frame a socket is sent when the room coalesced its samples: each held frame as it would have gone alone, in
// the order they were held. Only an editor that said `batches: true` in its `hello` is ever sent one.
export type PresenceBatchMessage<F> = { kind: 'batch'; frames: F[] };
