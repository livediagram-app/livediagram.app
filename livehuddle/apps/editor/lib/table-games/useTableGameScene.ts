'use client';

// The canvas's side of the game pieces (docs/specs/009-elements/social-pieces.md "A game"): publish who sits where on
// this tab, and whether each may play, to the scene every game piece reads (table-game-scene.ts). Your own seat comes
// from your walk, a peer's from their presence (their seat claim, or the seat nearest their feet for an older screen,
// as the chair rings read it), and the right to play from the share role: yours from the session, a peer's from the
// room's stamp. Rebuilt only when presence or your seat changes; a step of your own feet changes nothing here.

import { useCallback, useEffect, useMemo } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { AccessLevel, AvatarPresence } from '@livehuddle/api-schema';
import type { SeatsOf } from '@livehuddle/avatar/chair-sitters';
import { claimOf, type SeatClaim } from '@livehuddle/avatar/seat-claims';
import type { GameSeatSource } from './game-seats';
import { setTableGameScene, type GameSignal } from './table-game-scene';

type Peer = { id: string; name: string; color: string; avatar: AvatarPresence; role?: AccessLevel };

/** Whether a share role plays at a game piece: an Editor or a Participant (a missing stamp reads as a Viewer's). */
export function rolePlays(role: AccessLevel | undefined): boolean {
  return role === 'edit' || role === 'participate';
}

/** A peer's seat on the piece they sit on, as the chair rings read it; null when they sit nowhere. */
export function peerSeat(avatar: AvatarPresence, seatsOf: SeatsOf): number | null {
  if (!avatar.seatedOn) return null;
  const seats = seatsOf(avatar.seatedOn);
  if (!seats || seats.length === 0) return avatar.seat?.index ?? null;
  return claimOf(seats, { x: avatar.x, y: avatar.y, seat: avatar.seat }).index;
}

/** The scene's people: you first, then each peer. Pure, for the tests. */
export function gameSeatSources(
  self: {
    id: string;
    color: string;
    seatedOn: string | null;
    seat: number | null;
    plays: boolean;
  },
  peers: readonly Peer[],
  seatsOf: SeatsOf,
): GameSeatSource[] {
  return [
    { ...self, name: 'You' },
    ...peers.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      seatedOn: p.avatar.seatedOn ?? null,
      seat: peerSeat(p.avatar, seatsOf),
      plays: rolePlays(p.role),
    })),
  ];
}

export function useTableGameScene({
  tabId,
  selfId,
  selfColor,
  seatedOn,
  seatClaim,
  takePart,
  peers,
  seatsOf,
  send,
}: {
  tabId: string;
  selfId: string;
  selfColor: string;
  seatedOn: string | null;
  seatClaim: SeatClaim | null;
  takePart: boolean;
  peers: readonly Peer[];
  seatsOf: SeatsOf;
  send: ((op: GameSignal) => void) | undefined;
}): void {
  const seat = seatedOn ? (seatClaim?.index ?? null) : null;
  const sources = useMemo(
    () =>
      gameSeatSources(
        { id: selfId, color: selfColor, seatedOn, seat, plays: takePart },
        peers,
        seatsOf,
      ),
    [selfId, selfColor, seatedOn, seat, takePart, peers, seatsOf],
  );
  // The editor's sender is a fresh function each render: the scene keeps one stable door to the newest.
  const sendRef = useLatest(send);
  const hasRoom = !!send;
  const sendNow = useCallback((op: GameSignal) => sendRef.current?.(op), [sendRef]);
  useEffect(() => {
    setTableGameScene({ tabId, selfId, sources, send: hasRoom ? sendNow : null });
  }, [tabId, selfId, sources, hasRoom, sendNow]);
  useEffect(() => () => setTableGameScene(null), []);
}
