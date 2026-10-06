// Per-template element builders. Each builder is pure: it takes a
// centre (cx, cy) and returns a fresh array of Element. Sizing
// constants live inline so each template is self-describing. See
// docs/specs/008-canvas/canvas-and-palette.md for the picker UX; the editor applies its theme recolour on
// top (apps/live/lib/template-builders.ts), and the MCP worker
// materialises these directly (docs/specs/015-api/mcp-server.md §4.5).

import type { Element } from '@livediagram/document';
import type { TemplateKind } from './templates';
import {
  buildBrowserWireframe,
  buildLaptopWireframe,
  buildMobileWireframe,
} from './template-builders-wireframes';
import { buildSlideDeck } from './template-builders-slides';
import { buildPlanTemplate } from './template-builders-plan';
import {
  buildComicStrip,
  buildDoodleWarmup,
  buildIdeaGarden,
  buildJourneyDoodle,
  buildPaperPrototype,
  buildPreMortem,
  buildRichPicture,
  buildSketchnote,
} from './template-builders-sketch';
import { buildEventPoster } from './template-builders-poster';
import { buildYearInReview } from './template-builders-year-review';
import { buildResume } from './template-builders-resume';
import { buildRecipeCard } from './template-builders-recipe';
import { buildDataStory } from './template-builders-data-story';
import { buildHowItWorks } from './template-builders-how-it-works';
import { buildVersus } from './template-builders-versus';
import { buildSocialCarousel } from './template-builders-social-carousel';
import { buildStoryboard } from './template-builders-storyboard';
import {
  buildPrioritizationMatrix,
  buildRetrospective,
  buildSwot,
} from './template-builders-boards';
import { buildSystemArchitecture } from './template-builders-technical';
import { buildCloudArchitecture } from './template-builders-cloud';
import { buildErDiagram } from './template-builders-er';
import { buildSequenceDiagram } from './template-builders-sequence';
import { buildUmlClass } from './template-builders-uml';
import { buildStateMachine } from './template-builders-state-machine';
import { buildFloorPlan } from './template-builders-floorplan';
import { buildEventStorming } from './template-builders-eventstorming';
import { buildBusinessModelCanvas, buildEmpathyMap } from './template-builders-canvases';
import { buildAffinityMap, buildUserStoryMap } from './template-builders-workshops';
import { buildLeanCoffee, buildTownHall } from './template-builders-sessions';
import { buildOkrTree, buildSitemap } from './template-builders-hierarchies';
import { buildFunnel } from './template-builders-funnel';
import { buildRoadmap } from './template-builders-roadmap';
import { buildLogoDesign } from './template-builders-logo';
import { buildGanttChart } from './template-builders-gantt';
import { buildLiveCard } from './template-builders-livecard';
import { buildComparisonTable, buildRaciMatrix } from './template-builders-table';
import {
  buildFishbone,
  buildFlywheel,
  buildJourney,
  buildPyramid,
  buildVenn,
} from './template-builders-diagrams';
import { buildTimeline } from './template-builders-timelines';
import { buildMilestoneTimeline } from './template-builders-milestones';
import { buildMilestoneTimelineVertical } from './template-builders-milestones-vertical';
import {
  buildApprovalWorkflow,
  buildBlank,
  buildDecisionTree,
  buildSwimlane,
} from './template-builders-flows';
import { buildDataFlow } from './template-builders-dataflow';
import { buildFlowchart, buildOrgChart } from './template-builders-trees';
import { buildBubbleMap, buildMindMap, buildMindMapTree } from './template-builders-mindmaps';
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

// Build the elements for a given template, centred on the supplied canvas
// point. Each template is intentionally small and editable; users grow them.
export function buildTemplate(kind: TemplateKind, cx: number, cy: number): Element[] {
  switch (kind) {
    case 'blank':
      return buildBlank();
    case 'mindmap':
      return buildMindMap(cx, cy);
    case 'mindmap-tree':
      return buildMindMapTree(cx, cy);
    case 'mindmap-bubble':
      return buildBubbleMap(cx, cy);
    case 'orgchart':
      return buildOrgChart(cx, cy);
    case 'retrospective':
      return buildRetrospective(cx, cy);
    case 'flowchart':
      return buildFlowchart(cx, cy);
    case 'swimlane':
      return buildSwimlane(cx, cy);
    case 'decision-tree':
      return buildDecisionTree(cx, cy);
    case 'approval-workflow':
      return buildApprovalWorkflow(cx, cy);
    case 'data-flow':
      return buildDataFlow(cx, cy);
    // Plan templates (docs/specs/026-plan/plan-mode.md "Templates").
    case 'kanban':
    case 'blank-plan':
    case 'sprint-board':
    case 'bug-triage':
    case 'team-retro':
    case 'roadmap-board':
    case 'weekly-planner':
    case 'project-overview':
    case 'daily-standup':
    case 'content-calendar':
    case 'hiring-pipeline':
      return buildPlanTemplate(kind, cx, cy);
    case 'swot':
      return buildSwot(cx, cy);
    case 'timeline':
      return buildTimeline(cx, cy);
    case 'milestone-timeline':
      return buildMilestoneTimeline(cx, cy);
    case 'milestone-timeline-vertical':
      return buildMilestoneTimelineVertical(cx, cy);
    case 'venn':
      return buildVenn(cx, cy);
    case 'journey':
      return buildJourney(cx, cy);
    case 'fishbone':
      return buildFishbone(cx, cy);
    case 'pyramid':
      return buildPyramid(cx, cy);
    case 'mobile-wireframe':
      return buildMobileWireframe(cx, cy);
    case 'laptop-wireframe':
      return buildLaptopWireframe(cx, cy);
    case 'slide-deck':
      return buildSlideDeck(cx, cy);
    case 'flywheel':
      return buildFlywheel(cx, cy);
    case 'logo-design':
      return buildLogoDesign(cx, cy);
    case 'gantt':
      return buildGanttChart(cx, cy);
    case 'live-card':
      return buildLiveCard(cx, cy);
    case 'comparison-table':
      return buildComparisonTable(cx, cy);
    case 'system-architecture':
      return buildSystemArchitecture(cx, cy);
    case 'er-diagram':
      return buildErDiagram(cx, cy);
    case 'sequence-diagram':
      return buildSequenceDiagram(cx, cy);
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
    case 'town-hall':
      return buildTownHall(cx, cy);
    case 'business-model-canvas':
      return buildBusinessModelCanvas(cx, cy);
    case 'empathy-map':
      return buildEmpathyMap(cx, cy);
    case 'funnel':
      return buildFunnel(cx, cy);
    case 'okr-tree':
      return buildOkrTree(cx, cy);
    case 'sitemap':
      return buildSitemap(cx, cy);
    case 'browser-wireframe':
      return buildBrowserWireframe(cx, cy);
    case 'storyboard':
      return buildStoryboard(cx, cy);
    case 'cloud-architecture':
      return buildCloudArchitecture(cx, cy);
    case 'uml-class':
      return buildUmlClass(cx, cy);
    case 'state-machine':
      return buildStateMachine(cx, cy);
    case 'floor-plan':
      return buildFloorPlan(cx, cy);
    case 'event-storming':
      return buildEventStorming(cx, cy);
    // A whiteboard is a clean board (docs/specs/023-draw-mode/draw-mode.md): what makes it one is its
    // kind, which templateCanvasOverrides sets, not any seeded element.
    case 'whiteboard':
      return [];
    // An article's writing and page are tab data (templateCanvasOverrides), not elements; a blank
    // illustration is its one empty page, which asks what it is for.
    case 'article':
    case 'blank-illustration':
      return [];
    case 'sketchnote':
      return buildSketchnote(cx, cy);
    case 'rich-picture':
      return buildRichPicture(cx, cy);
    case 'comic-strip':
      return buildComicStrip(cx, cy);
    case 'doodle-warmup':
      return buildDoodleWarmup(cx, cy);
    case 'paper-prototype':
      return buildPaperPrototype(cx, cy);
    case 'journey-doodle':
      return buildJourneyDoodle(cx, cy);
    case 'pre-mortem':
      return buildPreMortem(cx, cy);
    case 'idea-garden':
      return buildIdeaGarden(cx, cy);
    // Built on their own pages (template-pages.ts), whatever the centre.
    case 'event-poster':
      return buildEventPoster();
    case 'year-in-review':
      return buildYearInReview();
    case 'resume':
      return buildResume();
    case 'recipe-card':
      return buildRecipeCard();
    case 'data-story':
      return buildDataStory();
    case 'how-it-works':
      return buildHowItWorks();
    case 'versus':
      return buildVersus();
    case 'social-carousel':
      return buildSocialCarousel();
  }
}

// The "Blank Diagram" template is truly blank: no seeded element. The user
// starts from an empty canvas (with the empty-canvas hint banner, docs/specs/007-editor/new-document-route.md) and
// adds their first element from the palette / Quick Start.
