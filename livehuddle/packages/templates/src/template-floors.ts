// A template's floors (docs/specs/007-editor/templates-by-mode.md "A template with floors"): the tabs that come after
// its first, each with its own name, floor pattern and builder. Only the buildings have floors; the first floor is
// buildTemplate's, named by templateFirstFloorName.

import type { Element, FloorPattern } from '@livehuddle/document';
import type { TemplateKind } from './templates';
import { buildHotelRooftop, buildHotelSuites } from './template-builders-hotel';
import { buildTowerLevel2, buildTowerLevel3 } from './template-builders-tower';

export type TemplateFloor = {
  name: string;
  floor: FloorPattern;
  build: (cx: number, cy: number) => Element[];
};

type Building = { first: string; more: readonly TemplateFloor[] };

const BUILDINGS: Partial<Record<TemplateKind, Building>> = {
  'hotel-and-suites': {
    first: 'Lobby',
    more: [
      { name: 'Suites', floor: 'carpet', build: buildHotelSuites },
      { name: 'Rooftop', floor: 'deck', build: buildHotelRooftop },
    ],
  },
  'coworking-tower': {
    first: 'Ground Floor',
    more: [
      { name: 'Level 2', floor: 'carpet-tiles', build: buildTowerLevel2 },
      { name: 'Level 3', floor: 'parquet', build: buildTowerLevel3 },
    ],
  },
};

/** The floors after a template's first, in order; empty for a template on one tab. */
export function templateFloors(kind: TemplateKind): readonly TemplateFloor[] {
  return BUILDINGS[kind]?.more ?? [];
}

/** The name of a building's first floor ("Lobby"), or null for a template on one tab. */
export function templateFirstFloorName(kind: TemplateKind): string | null {
  return BUILDINGS[kind]?.first ?? null;
}
