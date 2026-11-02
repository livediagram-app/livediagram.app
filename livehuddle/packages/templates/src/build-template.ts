// Per-template element builders. Each builder is pure: it takes a
// centre (cx, cy) and returns a fresh array of Element. Sizing
// constants live inline so each template is self-describing. See
// docs/specs/008-canvas/canvas-and-palette.md for the picker UX; the editor applies its theme recolour on
// top (apps/editor/lib/template-builders.ts), and the MCP worker
// materialises these directly (docs/specs/015-api/mcp-server.md §4.5).

import { buildVirtualOffice } from './template-builders-office';
import { buildAllHandsHall, buildCoworkingSpace, buildTeamPod } from './template-builders-spaces';
import { settleChips, type Element } from '@livehuddle/document';
import type { TemplateKind } from './templates';
import {
  buildPrioritizationMatrix,
  buildRetrospective,
  buildSwot,
} from './template-builders-boards';
import { buildEventStorming } from './template-builders-eventstorming';
import { buildBusinessModelCanvas, buildEmpathyMap } from './template-builders-canvases';
import { buildAffinityMap, buildUserStoryMap } from './template-builders-workshops';
import { buildLeanCoffee, buildTownHall } from './template-builders-sessions';
import { buildIcebreakerQuestions, buildPubQuiz } from './template-builders-quiz-games';
import {
  buildPeopleBingo,
  buildTwoTruthsAndALie,
  buildWouldYouRather,
} from './template-builders-party-games';
import { buildBrainstorm, buildWorkshopBoard } from './template-builders-workshop-boards';
import { buildRoadmap } from './template-builders-roadmap';
import { buildRaciMatrix } from './template-builders-table';
import { buildJourney } from './template-builders-journey';
import {
  buildStartStopContinue,
  buildMadSadGlad,
  buildFourLs,
  buildSailboat,
} from './template-builders-retro-formats';
import { buildIncidentPostmortem } from './template-builders-postmortem';
import { buildRiskMatrix } from './template-builders-risk';
import { buildOpportunitySolutionTree } from './template-builders-opportunity-tree';
import { buildStakeholderMap } from './template-builders-stakeholders';
import { buildCrazyEights } from './template-builders-crazy-eights';
import { buildUserPersona } from './template-builders-persona';
import { buildMeetingAgenda } from './template-builders-meeting';
import { buildObjectivesPlanner } from './template-builders-objectives';
import { buildValuePropositionCanvas } from './template-builders-value-proposition';
import { buildBoardGrid } from './template-builders-board-grid';

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
    case 'retrospective':
      return buildRetrospective(cx, cy);
    case 'swot':
      return buildSwot(cx, cy);
    case 'journey':
      return buildJourney(cx, cy);
    case 'prioritization-matrix':
      return buildPrioritizationMatrix(cx, cy);
    case 'start-stop-continue':
      return buildStartStopContinue(cx, cy);
    case 'mad-sad-glad':
      return buildMadSadGlad(cx, cy);
    case 'four-ls':
      return buildFourLs(cx, cy);
    case 'sailboat':
      return buildSailboat(cx, cy);
    case 'incident-postmortem':
      return buildIncidentPostmortem(cx, cy);
    case 'risk-matrix':
      return buildRiskMatrix(cx, cy);
    case 'opportunity-solution-tree':
      return buildOpportunitySolutionTree(cx, cy);
    case 'stakeholder-map':
      return buildStakeholderMap(cx, cy);
    case 'crazy-eights':
      return buildCrazyEights(cx, cy);
    case 'user-persona':
      return buildUserPersona(cx, cy);
    case 'meeting-agenda':
      return buildMeetingAgenda(cx, cy);
    case 'objectives-planner':
      return buildObjectivesPlanner(cx, cy);
    case 'value-proposition-canvas':
      return buildValuePropositionCanvas(cx, cy);
    case 'roadmap':
      return buildRoadmap(cx, cy);
    case 'raci-matrix':
      return buildRaciMatrix(cx, cy);
    case 'user-story-map':
      return buildUserStoryMap(cx, cy);
    case 'affinity-map':
      return buildAffinityMap(cx, cy);
    case 'lean-coffee':
      return buildLeanCoffee(cx, cy);
    case 'brainstorm':
      return buildBrainstorm(cx, cy);
    case 'workshop-board':
      return buildWorkshopBoard(cx, cy);
    case 'town-hall':
      return buildTownHall(cx, cy);
    case 'pub-quiz':
      return buildPubQuiz(cx, cy);
    case 'icebreaker-questions':
      return buildIcebreakerQuestions(cx, cy);
    case 'virtual-office':
      return buildVirtualOffice(cx, cy);
    case 'coworking-space':
      return buildCoworkingSpace(cx, cy);
    case 'team-pod':
      return buildTeamPod(cx, cy);
    case 'all-hands-hall':
      return buildAllHandsHall(cx, cy);
    case 'two-truths-and-a-lie':
      return buildTwoTruthsAndALie(cx, cy);
    case 'would-you-rather':
      return buildWouldYouRather(cx, cy);
    case 'people-bingo':
      return buildPeopleBingo(cx, cy);
    case 'business-model-canvas':
      return buildBusinessModelCanvas(cx, cy);
    case 'empathy-map':
      return buildEmpathyMap(cx, cy);
    case 'event-storming':
      return buildEventStorming(cx, cy);
    // Workshop's blank is truly blank: no seeded element. The user starts from an empty tab (with the empty-canvas
    // hint banner, docs/specs/007-editor/new-document-route.md) and adds their first element from the palette.
    case 'blank-session':
      return [];
    // The board grids over data: a PESTLE scan and a class's KWL chart.
    case 'pestle-analysis':
    case 'kwl-chart':
      return buildBoardGrid(kind, cx, cy);
  }
}
