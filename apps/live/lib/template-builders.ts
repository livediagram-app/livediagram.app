// Per-template element builders. Lifted out of templates.ts so the
// editor's initial bundle doesn't ship ~1700 lines of element-
// construction code for templates the user rarely picks (returning
// users opening an existing diagram never trigger any of these).
// editor-page dynamic-imports this module inside the
// onChooseTemplate callback; /live/new still imports it statically
// since it's the template-creation page by definition.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a
// fresh array of Element. Sizing constants live inline so each
// template is self-describing. See spec/09 for the picker UX.

import { type Element, type Tab } from '@livediagram/diagram';
import { getTheme, recolourElementsForTheme } from './themes';
import { templateCanvasOverrides, type TemplateKind } from './templates';
import {
  buildBrowserWireframe,
  buildLaptopWireframe,
  buildMobileWireframe,
} from './template-builders-wireframes';
import { buildSlideDeck, buildStoryboard } from './template-builders-slides';
import {
  buildKanban,
  buildPrioritizationMatrix,
  buildRetrospective,
  buildSwot,
} from './template-builders-boards';
import {
  buildCloudArchitecture,
  buildErDiagram,
  buildSequenceDiagram,
  buildSystemArchitecture,
} from './template-builders-technical';
import { buildStateMachine, buildUmlClass } from './template-builders-uml';
import { buildBusinessModelCanvas, buildEmpathyMap } from './template-builders-canvases';
import { buildAffinityMap, buildUserStoryMap } from './template-builders-workshops';
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
  buildTimeline,
  buildVenn,
} from './template-builders-diagrams';
import {
  buildApprovalWorkflow,
  buildBlank,
  buildBubbleMap,
  buildDataFlow,
  buildDecisionTree,
  buildMindMapTree,
  buildSwimlane,
} from './template-builders-flows';
import { buildFlowchart, buildMindMap, buildOrgChart } from './template-builders-trees';

export function buildTemplatedTab(
  kind: TemplateKind,
  // string, not ThemeId: may be a custom `custom:<uuid>` id (spec/44),
  // which getTheme resolves via the custom-theme registry.
  themeId: string,
  tabId: string,
  tabName: string,
): Tab {
  const theme = getTheme(themeId);
  const rawElements = buildTemplate(kind, 0, 0);
  // Graph-aware recolour so multi-colour themes (spec/29) can tint each
  // branch of the scaffold a distinct hue; single-colour themes fall
  // straight through to the per-element transform.
  const elements = recolourElementsForTheme(rawElements, theme);
  return {
    id: tabId,
    name: tabName,
    elements,
    theme: themeId,
    backgroundColor: theme.backgroundColor,
    backgroundPattern: theme.backgroundPattern,
    patternColor: theme.patternColor,
    ...(theme.backgroundOpacity != null ? { backgroundOpacity: theme.backgroundOpacity } : {}),
    templateChosen: true,
    ...templateCanvasOverrides(kind),
  };
}

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
    case 'kanban':
      return buildKanban(cx, cy);
    case 'swot':
      return buildSwot(cx, cy);
    case 'timeline':
      return buildTimeline(cx, cy);
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
    case 'roadmap':
      return buildRoadmap(cx, cy);
    case 'raci-matrix':
      return buildRaciMatrix(cx, cy);
    case 'user-story-map':
      return buildUserStoryMap(cx, cy);
    case 'affinity-map':
      return buildAffinityMap(cx, cy);
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
  }
}

// The "Blank diagram" template is truly blank — no seeded element. The user
// starts from an empty canvas (with the empty-canvas hint banner, spec/14) and
// adds their first element from the palette / Quick Start.
