'use client';

// The canvas's side of the meeting pieces and knocking (docs/specs/009-elements/screen-and-room-sign.md,
// docs/specs/012-collaboration/knock.md): who stands in each Screen's and Room Sign's room, published to the pieces'
// store (meeting-live.ts); the Knock the signs press; the knocks that reach you; and the toast at a closed pod's door.
//
// Costs nothing on a tab with no Screen or Room Sign beyond one filter per board change. With some, each presence
// change walks the walkers against the rooms once (a handful of each), and the store wakes only the faces whose
// snapshot changed.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { KNOCK_THROTTLE_MS, type AvatarPresence, type KnockAnswer } from '@livehuddle/api-schema';
import {
  meetingPieceRoom,
  roomSignName,
  zoneAt,
  type CallZone,
  type Element,
} from '@livehuddle/document';
import { placePoints, walkThereRoute } from '@/lib/wayfinding';
import { podClosed, podDoorFront } from '@liveworkspace/avatar/pod';
import { useToast } from '@/hooks/ui/useToast';
import type { CallSignal } from '@/lib/calls/call-config';
import { SELF_MEDIA_ID } from '@/lib/calls/calls-media-store';
import { track } from '@/lib/telemetry';
import { onKnock } from './knock-inbox';
import {
  noteKnocked,
  setKnocker,
  setMeetingLive,
  setRoomWalker,
  type MeetingLive,
  type SignPerson,
} from './meeting-live';

type Point = { x: number; y: number };
type Walker = { id: string; name: string; color?: string; avatar: AvatarPresence };

export type MeetingPiecesDeps = {
  elements: readonly Element[];
  zones: readonly CallZone[];
  walkers: readonly Walker[];
  inMode: boolean;
  self: Point | null;
  selfSeatedOn: string | null;
  doNotDisturb: boolean;
  send?: (signal: CallSignal) => void;
  // Stands your character up (Let In at a closed pod, knock.md "Being knocked").
  standUp?: () => void;
  // Your name and colour, for the sign's reader's Who's Inside.
  selfPerson?: { name: string; color: string };
  // Walks your character (the sign's reader's Walk In, screen-and-room-sign.md "The sign's reader").
  walkTo?: (point: Point, onArrive?: () => void) => void;
};

// A colour for someone whose presence carries none: the identity fill's slate.
const NO_COLOUR = '#64748b';

type Piece = { id: string; kind: 'screen' | 'room-sign'; at: Point; roomId: string | null };

// One knock, unless you knocked in the last 10 seconds (knock.md "Knocking"); the room drops a second one too.
function sendKnock(
  last: { current: number },
  send: ((signal: CallSignal) => void) | undefined,
  roomId: string,
): void {
  const now = Date.now();
  if (!send || now - last.current < KNOCK_THROTTLE_MS) return;
  last.current = now;
  noteKnocked(now);
  track('Canvas', 'Used', 'Knock');
  send({ kind: 'avatar-knock', roomId });
}

const distance2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Who stands in which room: each walker's innermost zone (null on the open floor). Pure, for the tests. */
export function zonesOfWalkers<W extends { id: string; at: Point }>(
  walkers: readonly W[],
  zones: readonly CallZone[],
): Map<string, W[]> {
  const byZone = new Map<string, W[]>();
  if (zones.length === 0) return byZone;
  for (const w of walkers) {
    const z = zoneAt(w.at, zones);
    if (!z) continue;
    const list = byZone.get(z);
    if (list) list.push(w);
    else byZone.set(z, [w]);
  }
  return byZone;
}

export function useMeetingPieces(deps: MeetingPiecesDeps): void {
  const { elements, zones, walkers, inMode, self, selfSeatedOn, send, selfPerson } = deps;
  const selfName = selfPerson?.name ?? 'You';
  const selfColour = selfPerson?.color ?? NO_COLOUR;
  const toast = useToast();

  // The pieces and the room each belongs to: only when the board changes.
  const { pieces, rooms } = useMemo(() => {
    const found: Piece[] = [];
    const roomEls = new Map<string, { shape?: string; label?: string }>();
    for (const el of elements) {
      if (el.type !== 'shape') continue;
      if (el.shape === 'room' || el.shape === 'office-pod') roomEls.set(el.id, el);
      if (el.shape !== 'screen' && el.shape !== 'room-sign') continue;
      found.push({
        id: el.id,
        kind: el.shape,
        at: { x: el.x + el.width / 2, y: el.y + el.height / 2 },
        roomId: meetingPieceRoom(el, zones),
      });
    }
    return { pieces: found, rooms: roomEls };
  }, [elements, zones]);

  // When this viewer first saw each room in use (screen-and-room-sign.md "How long"): never stored, never sent.
  const sinceRef = useRef(new Map<string, number>());

  useEffect(() => {
    if (pieces.length === 0) {
      setMeetingLive(new Map());
      return;
    }
    const people: { id: string; at: Point; name: string | null; color: string }[] = walkers.map(
      (w) => ({
        id: w.id,
        at: { x: w.avatar.x, y: w.avatar.y },
        name: w.name,
        color: w.color ?? NO_COLOUR,
      }),
    );
    if (inMode && self) people.push({ id: SELF_MEDIA_ID, at: self, name: null, color: selfColour });
    const byZone = zonesOfWalkers(people, zones);
    // A pod's door is shut while both seats are held (office.md "Office Pod"), by everyone's presence.
    const seated = new Map<string, number>();
    for (const w of walkers) {
      const on = w.avatar.seatedOn;
      if (on) seated.set(on, (seated.get(on) ?? 0) + 1);
    }
    if (inMode && selfSeatedOn) seated.set(selfSeatedOn, (seated.get(selfSeatedOn) ?? 0) + 1);
    const now = Date.now();
    const since = sinceRef.current;
    for (const id of [...since.keys()]) if (!byZone.has(id)) since.delete(id);
    for (const id of byZone.keys()) if (!since.has(id)) since.set(id, now);

    const next = new Map<string, MeetingLive>();
    for (const p of pieces) {
      const inside = p.roomId ? (byZone.get(p.roomId) ?? []) : [];
      if (p.kind === 'screen') {
        const near = [...inside]
          .sort((a, b) => distance2(a.at, p.at) - distance2(b.at, p.at) || (a.id < b.id ? -1 : 1))
          .map((w) => ({ id: w.id, name: w.name }));
        next.set(p.id, { roomId: p.roomId, inside: near });
        continue;
      }
      const room = p.roomId ? (rooms.get(p.roomId) ?? null) : null;
      const pod = room?.shape === 'office-pod';
      const shut = !!p.roomId && pod && podClosed(seated.get(p.roomId) ?? 0);
      // You first, then everyone else in presence order (the reader's Who's Inside).
      const listed: SignPerson[] = inside.map((w) => ({
        id: w.id,
        name: w.name ?? selfName,
        color: w.color,
        self: w.id === SELF_MEDIA_ID,
      }));
      listed.sort((a, b) => Number(b.self) - Number(a.self));
      next.set(p.id, {
        roomId: p.roomId,
        name: roomSignName(room),
        status: shut ? 'dnd' : inside.length > 0 ? 'in-use' : 'free',
        count: inside.length,
        since: inside.length > 0 && p.roomId ? (since.get(p.roomId) ?? now) : null,
        selfInside: inside.some((w) => w.id === SELF_MEDIA_ID),
        pod,
        people: listed,
      });
    }
    setMeetingLive(next);
  }, [pieces, rooms, walkers, zones, inMode, self, selfSeatedOn, selfName, selfColour]);

  // The latest of what the knock handlers read, so they subscribe once.
  const live = useRef(deps);
  const selfZone = inMode && self ? zoneAt(self, zones) : null;
  const selfZoneRef = useRef(selfZone);
  useLayoutEffect(() => {
    live.current = deps;
    selfZoneRef.current = selfZone;
  });

  // Knocking (knock.md "Knocking"): while walking with a room to send to; one per 10 seconds.
  const lastKnock = useRef(0);
  useEffect(() => {
    if (!inMode || !send) {
      setKnocker(null);
      return;
    }
    setKnocker((roomId: string) => sendKnock(lastKnock, send, roomId));
    return () => setKnocker(null);
  }, [inMode, send]);

  // Walk In (screen-and-room-sign.md "The sign's reader"): the Directory's Walk There route, leg by leg, to just inside
  // the room's doorway. Published only while walking with a walk to drive.
  const canWalk = inMode && !!deps.walkTo;
  useEffect(() => {
    if (!canWalk) {
      setRoomWalker(null);
      return;
    }
    setRoomWalker((roomId: string) => {
      const d = live.current;
      const room = d.elements.find(
        (el) =>
          el.id === roomId &&
          el.type === 'shape' &&
          (el.shape === 'room' || el.shape === 'office-pod'),
      );
      if (!room || room.type !== 'shape' || !d.walkTo) return;
      const walkTo = d.walkTo;
      const { approach, arrival } = placePoints(room, d.elements);
      const bounds = { x: room.x, y: room.y, width: room.width, height: room.height };
      const route = walkThereRoute(d.self ?? arrival, { approach, arrival, bounds });
      const leg = (i: number) =>
        walkTo(route[i]!, i + 1 < route.length ? () => leg(i + 1) : undefined);
      leg(0);
    });
    return () => setRoomWalker(null);
  }, [canWalk]);

  // Knocks and answers that reach you (knock.md "Being knocked").
  useEffect(() => {
    return onKnock((event) => {
      const d = live.current;
      if (!d.inMode) return;
      const nameOf = (id: string) => d.walkers.find((w) => w.id === id)?.name ?? 'Someone';
      if (event.type === 'answer') {
        const name = nameOf(event.from);
        toast.info(event.op.answer === 'in' ? `${name} let you in` : `${name} says Not Now`);
        return;
      }
      const { roomId } = event.op;
      if (d.doNotDisturb || selfZoneRef.current !== roomId) return;
      const name = nameOf(event.from);
      const key = `knock:${event.from}`;
      const answer = (value: KnockAnswer) => {
        toast.dismissAction(key);
        track('Canvas', 'Used', value === 'in' ? 'KnockLetIn' : 'KnockNotNow');
        // At a closed pod, Let In stands you up: with a seat free its door opens by its own rule.
        if (value === 'in' && d.selfSeatedOn === roomId) live.current.standUp?.();
        live.current.send?.({
          kind: 'avatar-knock-answer',
          targetId: event.from,
          roomId,
          answer: value,
        });
      };
      toast.action({
        key,
        message: `${name} is knocking`,
        important: true,
        actions: [
          { label: 'Let In', onSelect: () => answer('in') },
          { label: 'Not Now', onSelect: () => answer('later') },
        ],
      });
    });
  }, [toast]);

  // At a closed pod's door (knock.md "Knocking"): offer a Knock once each time you walk up.
  const atDoor = useMemo(() => {
    if (!inMode || !self || selfSeatedOn) return null;
    for (const el of elements) {
      if (el.type !== 'shape' || el.shape !== 'office-pod') continue;
      const r = podDoorFront(el);
      if (self.x < r.x || self.x > r.x + r.width || self.y < r.y || self.y > r.y + r.height)
        continue;
      let sitters = 0;
      for (const w of walkers) if (w.avatar.seatedOn === el.id) sitters++;
      if (podClosed(sitters)) return el.id;
    }
    return null;
  }, [inMode, self, selfSeatedOn, elements, walkers]);
  useEffect(() => {
    if (!atDoor) return;
    const key = `knock-door:${atDoor}`;
    toast.action({
      key,
      message: 'This Office Pod is closed',
      actions: [
        {
          label: 'Knock',
          onSelect: () => {
            toast.dismissAction(key);
            sendKnock(lastKnock, live.current.send, atDoor);
          },
        },
      ],
    });
  }, [atDoor, toast]);
}
