import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MUTATION_OP_KINDS,
  PRESENCE_OP_KINDS,
  ROOM_OP_KINDS,
  SYSTEM_OP_KINDS,
} from '@livediagram/api-schema';

// The editor's room-op vocabulary must match the schema's classification.
//
// Every op the editor sends is classified by the room worker into presence
// (ephemeral: unordered, no seq, allowed from a view-role sender) or mutation
// (sequenced, logged for reconnect catch-up, edit-role only). The mutation
// branch is the FALL-THROUGH, so an op kind nobody classified is silently
// treated as a mutation — and that is not a hypothetical: `viewport` shipped
// missing from the presence list, and because the editor publishes it on every
// pan at 10 Hz, about 26 seconds of one person scrolling filled all 256 slots of
// the catch-up log with camera positions and pushed the replay floor past every
// real mutation, so the next peer whose socket blipped was told to re-hydrate
// every tab from D1. It also meant a view-only visitor could not be followed at
// all, since the role gate drops non-presence ops.
//
// The room's own suite can only check the dangerous direction (no mutation kind
// sitting in the presence set) because both lists are its own. This checks the
// direction that let `viewport` through, which needs the third list: the kinds
// the EDITOR actually speaks. Reading them off the source is deliberate — the
// alternative is another hand-kept list, and a copy can only prove it agrees
// with itself.

const HANDLER = join(__dirname, 'useRoomConnection.ts');

// Every `op.kind === '…'` branch in the incoming-op chain. That chain is the
// receiving half of the vocabulary: an op the editor sends but never handles is
// dead, and one it handles but the schema doesn't classify is unclassified.
function handledKinds(): string[] {
  const source = readFileSync(HANDLER, 'utf8');
  return [...new Set([...source.matchAll(/op\.kind === '([a-z-]+)'/g)].map((m) => m[1]!))];
}

describe('room op vocabulary', () => {
  it('found the handler chain at all', () => {
    // A rename or a refactor of the chain must fail loudly here rather than
    // quietly reducing this whole file to a no-op.
    expect(handledKinds().length).toBeGreaterThan(10);
  });

  it('classifies every op kind the editor handles', () => {
    const unclassified = handledKinds().filter(
      (kind) => !(ROOM_OP_KINDS as readonly string[]).includes(kind),
    );
    expect(unclassified).toEqual([]);
  });

  it('handles every op kind a peer or the worker can send', () => {
    // The reverse: a classified kind with no branch here is one the editor
    // ignores on arrival, which looks exactly like a feature that does not work
    // rather than one that was never wired up.
    const handled = new Set(handledKinds());
    const unhandled = [...PRESENCE_OP_KINDS, ...MUTATION_OP_KINDS, ...SYSTEM_OP_KINDS].filter(
      (kind) => !handled.has(kind),
    );
    expect(unhandled).toEqual([]);
  });

  it('handles the system op the worker originates, and never sends it', () => {
    // `share-revoked` arrives from the worker's /broadcast and the room refuses
    // it from a client socket (a peer could otherwise force-redirect everyone
    // out of the session). So the editor must listen for it and must not emit
    // it — an emit would be a dropped frame at best and a forgery attempt at
    // worst.
    const source = readFileSync(HANDLER, 'utf8');
    for (const kind of SYSTEM_OP_KINDS) {
      expect(handledKinds()).toContain(kind);
      expect(source).not.toContain(`op: { kind: '${kind}'`);
    }
  });
});
