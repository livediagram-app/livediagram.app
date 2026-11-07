'use client';

// Where your character stands among the workday pieces (docs/specs/009-elements/workday-pieces.md "Reception Desk"):
// the Reception Desk you stand at, whose Welcome bubble (and its Ring Bell) shows for you. The desks are picked out of
// the board once per change of the elements; each move of your feet then checks only those few, and the store changes
// only when the answer does, so a step re-renders nothing (as the arcade's Insert Coin, useSocialPieces). And where each
// Pet Bed's dog may wander ("Pet Bed and its dog"): its room's floor or a circle round it, less the pieces standing
// there, worked out per board change whether or not you walk, each dog woken only when its own area changes.

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import { PET_FLOOR_KINDS, petArea, type Element, type PetArea } from '@livehuddle/document';
import { officeFootprint } from '@liveworkspace/avatar/office-geometry';
import type { SeatFacing } from '@liveworkspace/avatar/facing';

/** How far in front of a reception desk's counter your feet may be for its Welcome. */
export const RECEPTION_REACH = 32;
/** Where the desk's front strip starts, down its box: the counter's front, which the footprint ends at. */
const RECEPTION_FRONT = 0.62;

type Box = { id: string; x: number; y: number; width: number; height: number };
type Desk = Box & { chairFacing?: SeatFacing };
/** How far a turned desk's front strip reaches back over its counter, as a share of the counter's depth. */
const TURNED_FRONT_DEPTH = 0.3;
type Point = { x: number; y: number };

let atDesk: string | null = null;
const listeners = createListeners();

function setAtReception(id: string | null): void {
  if (atDesk === id) return;
  atDesk = id;
  listeners.notify();
}

/** Whether your character stands at this reception desk; changes only for the desk it concerns. */
export function useAtReception(id: string): boolean {
  return useSyncExternalStore(
    listeners.subscribe,
    () => atDesk === id,
    () => false,
  );
}

/**
 * The reception desk whose front `feet` stand at, or null: across its width, up to RECEPTION_REACH below it; a turned
 * desk's front is the side its counter faces (docs/specs/009-elements/furniture-facing.md), so the strip is along
 * that side of its counter, up to RECEPTION_REACH out from it.
 */
export function receptionAt(feet: Point, desks: readonly Desk[]): string | null {
  for (const d of desks) if (atFront(feet, d)) return d.id;
  return null;
}

function atFront(feet: Point, d: Desk): boolean {
  const facing = d.chairFacing ?? 'n';
  if (facing === 'n') {
    const top = d.y + d.height * RECEPTION_FRONT;
    return (
      feet.x >= d.x &&
      feet.x <= d.x + d.width &&
      feet.y >= top &&
      feet.y <= d.y + d.height + RECEPTION_REACH
    );
  }
  const c = officeFootprint({ ...d, shape: 'reception-desk', chairFacing: facing });
  if (!c) return false;
  const inX = feet.x >= c.x && feet.x <= c.x + c.width;
  const inY = feet.y >= c.y && feet.y <= c.y + c.height;
  switch (facing) {
    case 's':
      return (
        inX && feet.y >= c.y - RECEPTION_REACH && feet.y <= c.y + c.height * TURNED_FRONT_DEPTH
      );
    case 'e':
      return inY && feet.x >= c.x - RECEPTION_REACH && feet.x <= c.x + c.width * TURNED_FRONT_DEPTH;
    default:
      return (
        inY &&
        feet.x >= c.x + c.width * (1 - TURNED_FRONT_DEPTH) &&
        feet.x <= c.x + c.width + RECEPTION_REACH
      );
  }
}

let petAreas = new Map<string, PetArea>();
const petListeners = createListeners();

/** Where this bed's dog may wander, or null before the board has been read (it then stays in its bed). */
export function usePetArea(id: string): PetArea | null {
  return useSyncExternalStore(
    petListeners.subscribe,
    () => petAreas.get(id) ?? null,
    () => null,
  );
}

const sameArea = (a: PetArea | undefined, b: PetArea) =>
  !!a && JSON.stringify(a) === JSON.stringify(b);

/** Publish the beds' areas, keeping each unchanged one's object so its dog does not re-render. */
export function setPetAreas(next: ReadonlyMap<string, PetArea>): void {
  let changed = next.size !== petAreas.size;
  const merged = new Map<string, PetArea>();
  for (const [id, area] of next) {
    const before = petAreas.get(id);
    if (sameArea(before, area)) merged.set(id, before!);
    else {
      merged.set(id, area);
      changed = true;
    }
  }
  if (!changed) return;
  petAreas = merged;
  petListeners.notify();
}

/** Each Pet Bed's area on this board, by id (pure, for the tests). */
export function petAreasOf(elements: readonly Element[]): Map<string, PetArea> {
  const beds: Box[] = [];
  const rooms: Box[] = [];
  // The pieces the dog keeps clear of, so it never ends up behind the coffee machine or under a desk.
  const pieces: Box[] = [];
  for (const el of elements) {
    if (el.type !== 'shape') continue;
    if (el.shape === 'pet-bed') beds.push(el);
    else if (el.shape === 'room') rooms.push(el);
    else if (!PET_FLOOR_KINDS.has(el.shape)) pieces.push(el);
  }
  if (beds.length === 0) return new Map();
  return new Map(beds.map((b) => [b.id, petArea(b, rooms, pieces)]));
}

export function useWorkdayPieces({
  active,
  feet,
  elements,
}: {
  // In Avatar mode: out of it, no bubble shows.
  active: boolean;
  feet: Point | null;
  elements: readonly Element[];
}): void {
  const desks = useMemo(() => {
    const found: Desk[] = [];
    for (const el of elements)
      if (el.type === 'shape' && el.shape === 'reception-desk') found.push(el);
    return found;
  }, [elements]);
  const areas = useMemo(() => petAreasOf(elements), [elements]);
  useEffect(() => setPetAreas(areas), [areas]);
  const fx = feet?.x;
  const fy = feet?.y;
  useEffect(() => {
    if (!active || fx === undefined || fy === undefined || desks.length === 0) {
      setAtReception(null);
      return;
    }
    setAtReception(receptionAt({ x: fx, y: fy }, desks));
  }, [active, fx, fy, desks]);
  // Leaving the board (a tab switch, the editor closing) takes the bubble away.
  useEffect(
    () => () => {
      setAtReception(null);
      setPetAreas(new Map());
    },
    [],
  );
}
