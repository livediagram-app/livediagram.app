// The tab's rooms and stages as the call and the coarse copy read them (docs/specs/012-collaboration/
// meeting-rooms-and-stage.md "Rooms are calls", "The stage"; blueprint: peer-motion-store.md "The coarse copy"):
// worked out once per board, shared by the characters layer, the call hook and the facts the coarse copy watches.
import type { Element } from '@livehuddle/document';
import { callStages, stageAt, type CallStage } from './stage';
import { roomZones, zoneAt, type CallZone } from './zones';

export type CallPlaces = {
  readonly zones: readonly CallZone[];
  readonly stages: readonly CallStage[];
};

const cache = new WeakMap<readonly Element[], CallPlaces>();

/** The rooms and stages among `elements` (the visible ones), the same object for the same board. */
export function callPlacesOf(elements: readonly Element[]): CallPlaces {
  const hit = cache.get(elements);
  if (hit) return hit;
  const zones = roomZones(elements);
  const places = { zones, stages: callStages(elements, zones) };
  cache.set(elements, places);
  return places;
}

/** Where `at` stands as one string: its room and the stage it is on, `/` for the open floor. */
export function placeOf(at: { x: number; y: number }, places: CallPlaces): string {
  const room = places.zones.length > 0 ? (zoneAt(at, places.zones) ?? '') : '';
  const stage = places.stages.length > 0 ? (stageAt(at, places.stages)?.id ?? '') : '';
  return `${room}/${stage}`;
}
