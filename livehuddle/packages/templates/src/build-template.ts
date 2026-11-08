// Per-template element builders. Each builder is pure: it takes a
// centre (cx, cy) and returns a fresh array of Element. Sizing
// constants live inline so each template is self-describing. See
// docs/specs/008-canvas/canvas-and-palette.md for the picker UX; the editor applies its theme recolour on
// top (apps/editor/lib/template-builders.ts), and livediagram's MCP worker
// materialises its own copy directly (livediagram/docs/specs/015-api/mcp-server.md §4.5).

import { BLANK_PAD_DROP } from './blank-pad-drop';
import { buildVirtualOffice } from './template-builders-office';
import { buildAllHandsHall, buildCoworkingSpace, buildTeamPod } from './template-builders-spaces';
import { buildFocusLibrary } from './template-builders-office-more';
import { buildTrainingRoom } from './template-builders-events';
import { buildCafe, buildRooftopBar } from './template-builders-recreation';
import { buildCityPark, buildGardenRetreat } from './template-builders-outdoor';
import { buildCompanyCampus } from './template-builders-campus';
import { buildConferenceVenue, buildStartupHq } from './template-builders-campus-more';
import { buildTowerGround } from './template-builders-tower';
import { buildHotelLobby } from './template-builders-hotel';
import { buildExpoHall } from './template-builders-expo';
import { buildBeachOffsite } from './template-builders-beach';
import { buildSchoolQuad } from './template-builders-school';
import { buildArcadeLounge, buildGamesNightDen, buildSportsBar } from './template-builders-games';
import {
  buildCityTownhouse,
  buildCountryCottage,
  buildFamilyHouse,
} from './template-builders-homes';
import { buildMusicHall } from './template-builders-venues';
import {
  AVATAR_PAD_DEFAULT_SIZE,
  createShape,
  isFloorShape,
  type Element,
} from '@livehuddle/document';
import type { TemplateKind } from './templates';

// Build the elements for a given template, centred on the supplied canvas
// point. Each template is intentionally small and editable; users grow them.
export function buildTemplate(kind: TemplateKind, cx: number, cy: number): Element[] {
  return floorsFirst(buildElements(kind, cx, cy));
}

const isFloor = (el: Element) => el.type === 'shape' && isFloorShape(el.shape);

/**
 * Every floor ahead of everything else, each group in its own order: a Space's Avatar Pad is a floor, placed by `arrival`
 * after the plan, and the floors lie first (docs/specs/007-editor/templates-by-mode.md "Testing"). Paint order sorts
 * the floors among themselves (paintOrder), so the pad still lies on a room or the grass.
 */
export function floorsFirst(elements: Element[]): Element[] {
  return [...elements.filter(isFloor), ...elements.filter((el) => !isFloor(el))];
}

export { BLANK_PAD_DROP };

/** Blank Space's one element: an Avatar Pad, centred across `cx` and BLANK_PAD_DROP below `cy`. */
function blankPad(cx: number, cy: number): Element[] {
  const { width, height } = AVATAR_PAD_DEFAULT_SIZE;
  return [createShape('avatar-pad', cx - width / 2, cy + BLANK_PAD_DROP - height / 2)];
}

function buildElements(kind: TemplateKind, cx: number, cy: number): Element[] {
  switch (kind) {
    case 'virtual-office':
      return buildVirtualOffice(cx, cy);
    case 'coworking-space':
      return buildCoworkingSpace(cx, cy);
    case 'team-pod':
      return buildTeamPod(cx, cy);
    case 'all-hands-hall':
      return buildAllHandsHall(cx, cy);
    case 'focus-library':
      return buildFocusLibrary(cx, cy);
    case 'training-room':
      return buildTrainingRoom(cx, cy);
    case 'rooftop-bar':
      return buildRooftopBar(cx, cy);
    case 'cafe':
      return buildCafe(cx, cy);
    case 'garden-retreat':
      return buildGardenRetreat(cx, cy);
    case 'city-park':
      return buildCityPark(cx, cy);
    case 'company-campus':
      return buildCompanyCampus(cx, cy);
    case 'conference-venue':
      return buildConferenceVenue(cx, cy);
    case 'startup-hq':
      return buildStartupHq(cx, cy);
    case 'school-quad':
      return buildSchoolQuad(cx, cy);
    case 'beach-offsite':
      return buildBeachOffsite(cx, cy);
    case 'expo-hall':
      return buildExpoHall(cx, cy);
    case 'hotel-and-suites':
      return buildHotelLobby(cx, cy);
    case 'coworking-tower':
      return buildTowerGround(cx, cy);
    case 'arcade-lounge':
      return buildArcadeLounge(cx, cy);
    case 'games-night-den':
      return buildGamesNightDen(cx, cy);
    case 'sports-bar':
      return buildSportsBar(cx, cy);
    case 'family-house':
      return buildFamilyHouse(cx, cy);
    case 'city-townhouse':
      return buildCityTownhouse(cx, cy);
    case 'country-cottage':
      return buildCountryCottage(cx, cy);
    case 'music-hall':
      return buildMusicHall(cx, cy);
    // The blank holds only its entrance (docs/specs/009-elements/avatar-pad.md "Every Space and blank tab has one"): an
    // Avatar Pad a little below the middle, where people arrive; the user adds the rest from the palette.
    case 'blank-session':
      return blankPad(cx, cy);
  }
}
