'use client';

// Where your character stands among the social pieces (docs/specs/009-elements/social-pieces.md "Jukebox", "Arcade
// Machine"): the jukebox whose area holds you, which the one audio element plays, and the arcade machine you stand at,
// whose Insert Coin bubble shows for you. The pieces are picked out of the board once per change of the elements;
// each move of your feet then checks only those few, and a store changes only when the answer does, so a step
// re-renders nothing.

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import { roomInterior, type Element } from '@livehuddle/document';
import { setJukeboxArea } from '@/lib/jukebox-listening';

/** How far round a jukebox standing in no room it is heard, from its base. */
export const JUKEBOX_RADIUS = 280;
/** How near an arcade machine's front your feet must be for its bubble. */
export const ARCADE_REACH = 24;

type Box = { id: string; x: number; y: number; width: number; height: number };
type Jukebox = Box & { source?: string };
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
  // The rooms each jukebox stands in, innermost (smallest) first.
  const roomOf = (b: Box) =>
    rooms
      .filter((r) => inside(baseOf(b), roomInterior(r)))
      .sort((a, c) => a.width * a.height - c.width * c.height)[0] ?? null;
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

/** The arcade machine whose front `feet` stand at, or null. */
export function arcadeAt(feet: Point, arcades: readonly Box[]): string | null {
  for (const a of arcades) {
    const front = {
      x: a.x - ARCADE_REACH,
      y: a.y + a.height * 0.6,
      width: a.width + 2 * ARCADE_REACH,
      height: a.height * 0.4 + ARCADE_REACH,
    };
    if (inside(feet, front)) return a.id;
  }
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
    const arcades: Box[] = [];
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
