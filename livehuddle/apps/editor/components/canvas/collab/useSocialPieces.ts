'use client';

// Where your character stands among the social pieces (docs/specs/009-elements/social-pieces.md "Jukebox", "Arcade
// Machine"): the jukebox whose area holds you, which the one audio element plays, and the arcade machine you stand at,
// whose Insert Coin bubble shows for you. The pieces are picked out of the board once per change of the elements;
// each move of your feet then checks only those few, and a store changes only when the answer does, so a step
// re-renders nothing.

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import { pieceFacing, roomInterior, type Element } from '@livehuddle/document';
import type { SeatFacing } from '@livehuddle/avatar/facing';
import { setJukeboxArea } from '@/lib/jukebox-listening';

/** How far round a jukebox standing in no room it is heard, from its base. */
export const JUKEBOX_RADIUS = 280;
/** How near an arcade machine's front your feet must be for its bubble. */
export const ARCADE_REACH = 24;

type Box = { id: string; x: number; y: number; width: number; height: number };
type Jukebox = Box & { source?: string };
type Arcade = Box & { chairFacing?: SeatFacing };
type Point = { x: number; y: number };

let nearArcade: string | null = null;
const arcadeListeners = createListeners();

function setNearArcade(id: string | null): void {
  if (nearArcade === id) return;
  nearArcade = id;
  arcadeListeners.notify();
}

/** Whether your character stands at this arcade machine; changes only for the machine it concerns. */
export function useNearArcade(id: string): boolean {
  return useSyncExternalStore(
    arcadeListeners.subscribe,
    () => nearArcade === id,
    () => false,
  );
}

const inside = (p: Point, b: { x: number; y: number; width: number; height: number }) =>
  p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

const baseOf = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height * 0.9 });

// The room each jukebox stands in depends on the board, not on your feet: kept per rooms list (the hook's memoised
// one, so a walk reuses it) and per jukebox, so each step costs one look-up per jukebox, not a scan of every room.
const roomCache = new WeakMap<readonly Box[], WeakMap<Box, Box | null>>();

// The innermost (smallest) room a jukebox's base stands in, or null.
function jukeboxRoom(b: Box, rooms: readonly Box[]): Box | null {
  let byJukebox = roomCache.get(rooms);
  if (!byJukebox) roomCache.set(rooms, (byJukebox = new WeakMap()));
  const cached = byJukebox.get(b);
  if (cached !== undefined) return cached;
  const base = baseOf(b);
  let best: Box | null = null;
  for (const r of rooms) {
    if (!inside(base, roomInterior(r))) continue;
    if (!best || r.width * r.height < best.width * best.height) best = r;
  }
  byJukebox.set(b, best);
  return best;
}

/**
 * The jukebox whose area holds `feet`: the innermost room's jukebox when you stand in a room that has one, else the
 * nearest roomless jukebox within its radius. Null when none.
 */
export function jukeboxAt(
  feet: Point,
  jukeboxes: readonly Jukebox[],
  rooms: readonly Box[],
): Jukebox | null {
  if (jukeboxes.length === 0) return null;
  const roomOf = (b: Box) => jukeboxRoom(b, rooms);
  const feetRooms = rooms
    .filter((r) => inside(feet, roomInterior(r)))
    .sort((a, c) => a.width * a.height - c.width * c.height);
  let best: Jukebox | null = null;
  let bestRank = Infinity;
  let bestDistance = Infinity;
  for (const j of jukeboxes) {
    const room = roomOf(j);
    const base = baseOf(j);
    const distance = Math.hypot(base.x - feet.x, base.y - feet.y);
    let rank: number;
    if (room) {
      rank = feetRooms.findIndex((r) => r.id === room.id);
      if (rank < 0) continue;
    } else {
      if (distance > JUKEBOX_RADIUS) continue;
      rank = feetRooms.length;
    }
    if (rank < bestRank || (rank === bestRank && distance < bestDistance)) {
      best = j;
      bestRank = rank;
      bestDistance = distance;
    }
  }
  return best;
}

// The floor in front of an arcade machine at its facing (docs/specs/009-elements/furniture-facing.md): below it facing
// down, just behind its base facing up, and beside its base on the side its front faces.
function arcadeFront(a: Arcade): Box {
  const facing = pieceFacing({ shape: 'arcade-machine', chairFacing: a.chairFacing });
  const base = { id: a.id, y: a.y + a.height * 0.6, height: a.height * 0.4 + ARCADE_REACH };
  switch (facing) {
    case 'e':
      return { ...base, x: a.x - ARCADE_REACH, width: a.width * 0.3 + ARCADE_REACH };
    case 'w':
      return { ...base, x: a.x + a.width * 0.7, width: a.width * 0.3 + ARCADE_REACH };
    case 's':
      return {
        id: a.id,
        x: a.x - ARCADE_REACH,
        y: a.y + a.height * 0.4,
        width: a.width + 2 * ARCADE_REACH,
        height: a.height * 0.4,
      };
    default:
      return { ...base, x: a.x - ARCADE_REACH, width: a.width + 2 * ARCADE_REACH };
  }
}

/** The arcade machine whose front `feet` stand at, or null. */
export function arcadeAt(feet: Point, arcades: readonly Arcade[]): string | null {
  for (const a of arcades) if (inside(feet, arcadeFront(a))) return a.id;
  return null;
}

export function useSocialPieces({
  active,
  feet,
  elements,
}: {
  // In Avatar mode: out of it, nothing plays and no bubble shows.
  active: boolean;
  feet: Point | null;
  elements: readonly Element[];
}): void {
  const pieces = useMemo(() => {
    const jukeboxes: Jukebox[] = [];
    const arcades: Arcade[] = [];
    const rooms: Box[] = [];
    for (const el of elements) {
      if (el.type !== 'shape') continue;
      if (el.shape === 'jukebox')
        jukeboxes.push(el.jukeboxSource ? { ...el, source: el.jukeboxSource } : el);
      else if (el.shape === 'arcade-machine') arcades.push(el);
      else if (el.shape === 'room') rooms.push(el);
    }
    return { jukeboxes, arcades, rooms: jukeboxes.length > 0 ? rooms : [] };
  }, [elements]);
  const fx = feet?.x;
  const fy = feet?.y;
  useEffect(() => {
    if (!active || fx === undefined || fy === undefined) {
      setJukeboxArea(null, null);
      setNearArcade(null);
      return;
    }
    const at = { x: fx, y: fy };
    const jukebox = jukeboxAt(at, pieces.jukeboxes, pieces.rooms);
    setJukeboxArea(jukebox?.id ?? null, jukebox?.source ?? null);
    setNearArcade(arcadeAt(at, pieces.arcades));
  }, [active, fx, fy, pieces]);
  // Leaving the board (a tab switch, the editor closing) stops the music.
  useEffect(
    () => () => {
      setJukeboxArea(null, null);
      setNearArcade(null);
    },
    [],
  );
}
