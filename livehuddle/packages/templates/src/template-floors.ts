// A template's floors (docs/specs/007-editor/templates-by-mode.md "A template with floors"): the tabs that come after
// its first, each with its own name, floor pattern and builder. Only the buildings and the Homes have floors; the first
// floor is buildTemplate's, named by templateFirstFloorName (template-floor-names.ts).

import type { Element, FloorPattern } from '@livehuddle/document';
import type { TemplateKind } from './templates';
import { buildHotelRooftop, buildHotelSuites } from './template-builders-hotel';
import { buildTowerLevel2, buildTowerLevel3 } from './template-builders-tower';
import {
  buildCottageUpstairs,
  buildFamilyUpstairs,
  buildTownhouseRoof,
  buildTownhouseUpstairs,
} from './template-builders-homes';

export type TemplateFloor = {
  name: string;
  floor: FloorPattern;
  build: (cx: number, cy: number) => Element[];
};

const BUILDINGS: Partial<Record<TemplateKind, readonly TemplateFloor[]>> = {
  'hotel-and-suites': [
    { name: 'Suites', floor: 'carpet', build: buildHotelSuites },
    { name: 'Rooftop', floor: 'deck', build: buildHotelRooftop },
  ],
  'coworking-tower': [
    { name: 'Level 2', floor: 'carpet-tiles', build: buildTowerLevel2 },
    { name: 'Level 3', floor: 'parquet', build: buildTowerLevel3 },
  ],
  // The Homes (docs/specs/012-collaboration/virtual-office-template.md "Homes"), joined by Stairs.
  'family-house': [{ name: 'Upstairs', floor: 'carpet', build: buildFamilyUpstairs }],
  'city-townhouse': [
    { name: 'Upstairs', floor: 'carpet', build: buildTownhouseUpstairs },
    { name: 'Roof Terrace', floor: 'deck', build: buildTownhouseRoof },
  ],
  'country-cottage': [{ name: 'Upstairs', floor: 'carpet', build: buildCottageUpstairs }],
};

/** The floors after a template's first, in order; empty for a template on one tab. */
export function templateFloors(kind: TemplateKind): readonly TemplateFloor[] {
  return BUILDINGS[kind] ?? [];
}

export { templateFirstFloorName } from './template-floor-names';
