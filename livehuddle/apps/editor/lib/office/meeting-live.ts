// The live state of the meeting pieces (docs/specs/009-elements/screen-and-room-sign.md): for each Screen, who is in
// its room (so it can show a share one of them is sending); for each Room Sign, its room's name, how many are inside,
// since when and whether a pod's door is shut. Worked out from presence by the canvas (useMeetingLive) and read by
// the pieces' faces, each of which re-renders only when ITS snapshot changes, never on a step.
//
// A module store, like the calls store (lib/calls/calls-store.ts): the faces sit deep in the element layer, and
// threading per-element props through it would re-render every element on every presence packet.
import { useSyncExternalStore } from 'react';
import type { RoomSignStatus } from '@livehuddle/document';

export type ScreenLive = {
  roomId: string | null;
  // Who stands in the Screen's room, nearest the Screen first: their media id (a presence id, or SELF_MEDIA_ID) and
  // name (null for you).
  inside: readonly { id: string; name: string | null }[];
};

export type SignLive = {
  roomId: string | null;
  name: string;
  status: RoomSignStatus;
  count: number;
  // When this viewer first saw the room in use (epoch ms), or null while it is free.
  since: number | null;
  // You stand inside the sign's room, so it offers you no Knock.
  selfInside: boolean;
  // The room is an Office Pod (its reader says so, and a shut one has no Walk In).
  pod: boolean;
  // Who is inside, you first (the reader's Who's Inside): an id, a name and a colour for their initials.
  people: readonly SignPerson[];
};

export type SignPerson = { id: string; name: string; color: string; self: boolean };

export type MeetingLive = ScreenLive | SignLive;

/** Knock on a room (docs/specs/012-collaboration/knock.md), or null while you cannot (not walking, no room). */
export type Knocker = ((roomId: string) => void) | null;

/** Walk your character into a room (the sign's reader's Walk In), or null while not walking. */
export type RoomWalker = ((roomId: string) => void) | null;

let pieces = new Map<string, MeetingLive>();
let knocker: Knocker = null;
let walker: RoomWalker = null;
// When you last knocked (epoch ms), for the button's ten seconds of Knocked.
let knockedAt = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function samePeople(a: ScreenLive['inside'], b: ScreenLive['inside']): boolean {
  return a.length === b.length && a.every((p, i) => p.id === b[i]?.id && p.name === b[i]?.name);
}

function sameSignPeople(a: SignLive['people'], b: SignLive['people']): boolean {
  return (
    a.length === b.length &&
    a.every((p, i) => {
      const q = b[i];
      return !!q && p.id === q.id && p.name === q.name && p.color === q.color && p.self === q.self;
    })
  );
}

/** Whether two snapshots say the same, so an unchanged piece keeps its object and its face does not re-render. */
export function sameLive(a: MeetingLive | undefined, b: MeetingLive): boolean {
  if (!a || a.roomId !== b.roomId) return false;
  if ('inside' in a || 'inside' in b) {
    return 'inside' in a && 'inside' in b && samePeople(a.inside, b.inside);
  }
  return (
    a.name === b.name &&
    a.status === b.status &&
    a.count === b.count &&
    a.since === b.since &&
    a.selfInside === b.selfInside &&
    a.pod === b.pod &&
    sameSignPeople(a.people, b.people)
  );
}

/** Publish every piece's snapshot: pieces whose state is unchanged keep their object; nothing emits if none changed. */
export function setMeetingLive(next: ReadonlyMap<string, MeetingLive>): void {
  let changed = next.size !== pieces.size;
  const merged = new Map<string, MeetingLive>();
  for (const [id, live] of next) {
    const prev = pieces.get(id);
    if (prev && sameLive(prev, live)) merged.set(id, prev);
    else {
      merged.set(id, live);
      changed = true;
    }
  }
  if (!changed) return;
  pieces = merged;
  emit();
}

export function meetingLive(id: string): MeetingLive | undefined {
  return pieces.get(id);
}

export function useMeetingLive(id: string): MeetingLive | undefined {
  return useSyncExternalStore(
    subscribe,
    () => pieces.get(id),
    () => undefined,
  );
}

export function setKnocker(next: Knocker): void {
  if (next === knocker) return;
  knocker = next;
  emit();
}

export function useKnocker(): Knocker {
  return useSyncExternalStore(
    subscribe,
    () => knocker,
    () => null,
  );
}

export function setRoomWalker(next: RoomWalker): void {
  if (next === walker) return;
  walker = next;
  emit();
}

export function useRoomWalker(): RoomWalker {
  return useSyncExternalStore(
    subscribe,
    () => walker,
    () => null,
  );
}

export function noteKnocked(at: number): void {
  knockedAt = at;
  emit();
}

export function useKnockedAt(): number {
  return useSyncExternalStore(
    subscribe,
    () => knockedAt,
    () => 0,
  );
}

/** For tests: forget everything. */
export function resetMeetingLive(): void {
  pieces = new Map();
  knocker = null;
  walker = null;
  knockedAt = 0;
  emit();
}
