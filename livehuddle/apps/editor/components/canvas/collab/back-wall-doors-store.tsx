'use client';

// The Doors on each rectangular Room's back wall, for the canvas (docs/specs/009-elements/room-builder.md "On a back
// wall"; back-wall-doors.ts in @livehuddle/document): the room breaks its tall back band at an open one and draws a
// shut one in its face, and the Door draws only what moves. Worked out once per board, in a store each room and door
// reads its own slice of, so a board change re-renders only the rooms and doors whose back-wall doors changed.

import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import {
  backWallDoors,
  NO_BACK_WALL_DOORS,
  type BackWallDoor,
  type BackWallDoors,
  type Element,
} from '@livehuddle/document';
import { useStoreSlice } from '@liveworkspace/workbench/hooks/ui/useStoreSlice';
import { createStateStore, type ReadableStore } from '@liveworkspace/workbench/lib/state-store';

const BackWallDoorsContext = createContext<ReadableStore<BackWallDoors> | null>(null);

// Outside a canvas (a placement preview) there is no board: no back-wall doors.
const NONE = createStateStore(NO_BACK_WALL_DOORS);
const NO_DOORS: readonly BackWallDoor[] = [];

/** Works out the board's back-wall doors and hands them to the rooms and doors drawn inside it. */
export function BackWallDoorsProvider({
  elements,
  children,
}: {
  elements: readonly Element[];
  children: ReactNode;
}) {
  const next = backWallDoors(elements);
  const [store] = useState(() => createStateStore(next));
  // Before paint, so a room and its door never draw a frame apart.
  useLayoutEffect(() => store.set(next), [store, next]);
  return <BackWallDoorsContext.Provider value={store}>{children}</BackWallDoorsContext.Provider>;
}

function sameDoors(a: readonly BackWallDoor[], b: readonly BackWallDoor[]): boolean {
  return (
    a === b ||
    (a.length === b.length &&
      a.every((d, i) => d.from === b[i]!.from && d.to === b[i]!.to && d.closed === b[i]!.closed))
  );
}

/** The Doors on this room's back wall, left to right (none for any other room, or outside a canvas). */
export function useRoomBackDoors(roomId: string): readonly BackWallDoor[] {
  const store = useContext(BackWallDoorsContext) ?? NONE;
  return useStoreSlice(store, (s) => s.rooms.get(roomId) ?? NO_DOORS, sameDoors);
}

/** Whether this Door stands on a room's back wall. */
export function useDoorOnBackWall(doorId: string): boolean {
  const store = useContext(BackWallDoorsContext) ?? NONE;
  return useStoreSlice(store, (s) => s.doors.has(doorId));
}
