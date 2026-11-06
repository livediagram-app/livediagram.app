// Per-template element builders. Each builder is pure: it takes a
// centre (cx, cy) and returns a fresh array of Element. Sizing
// constants live inline so each template is self-describing. See
// docs/specs/008-canvas/canvas-and-palette.md for the picker UX; the editor applies its theme recolour on
// top (apps/editor/lib/template-builders.ts), and the MCP worker
// materialises these directly (livediagram/docs/specs/015-api/mcp-server.md §4.5).

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
import { settleChips, type Element } from '@livehuddle/document';
import type { TemplateKind } from './templates';

// Build the elements for a given template, centred on the supplied canvas
// point. Each template is intentionally small and editable; users grow them.
// The output lands settled (docs/specs/009-elements/blueprints/badge.md "Settling"): a builder sizes a step
// after making it, so its number is set to half the disc here, as a stored board reads back, and a
// preview or an agent's create shows what the editor will.
export function buildTemplate(kind: TemplateKind, cx: number, cy: number): Element[] {
  return settleChips([], buildUnsettled(kind, cx, cy), { attachLoose: false });
}

function buildUnsettled(kind: TemplateKind, cx: number, cy: number): Element[] {
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
    // The blank is truly blank: no seeded element. The user starts from an empty tab (with the empty-canvas hint
    // banner, docs/specs/007-editor/new-document-route.md) and adds their first element from the palette.
    case 'blank-session':
      return [];
  }
}
