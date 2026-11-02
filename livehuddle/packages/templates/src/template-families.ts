// The template family each template belongs to (docs/specs/013-workspace/default-folders.md
// "Creation intent"): the one map that routes a new retrospective to its default
// folder. A family is a set of ordinary diagram templates, never a tab kind: the event-storming
// template makes a tab of its own kind, read from the tab, so it has no family here. A Record over
// TemplateKind, so a new template kind does not compile until it is mapped.

import type { TemplateFamily } from '@livehuddle/api-schema';
import type { TemplateKind } from './templates';

const TEMPLATE_FAMILY: Record<TemplateKind, TemplateFamily | null> = {
  retrospective: 'retrospective',
  'blank-session': null,
  swot: null,
  journey: null,
  'prioritization-matrix': null,
  roadmap: null,
  'raci-matrix': null,
  'user-story-map': null,
  'affinity-map': null,
  'lean-coffee': null,
  brainstorm: null,
  'workshop-board': null,
  'town-hall': null,
  'pub-quiz': null,
  'icebreaker-questions': null,
  'virtual-office': null,
  'coworking-space': null,
  'team-pod': null,
  'all-hands-hall': null,
  'two-truths-and-a-lie': null,
  'would-you-rather': null,
  'people-bingo': null,
  'business-model-canvas': null,
  'empathy-map': null,
  'event-storming': null,
  'start-stop-continue': 'retrospective',
  'mad-sad-glad': 'retrospective',
  'four-ls': 'retrospective',
  sailboat: 'retrospective',
  'incident-postmortem': null,
  'opportunity-solution-tree': null,
  'crazy-eights': null,
  'stakeholder-map': null,
  'value-proposition-canvas': null,
  'risk-matrix': null,
  'user-persona': null,
  'meeting-agenda': null,
  'objectives-planner': null,
  'pestle-analysis': null,
  'kwl-chart': null,
};

/** The family a document made from this template belongs to; null for no template or no family. */
export function templateFamilyOf(kind: TemplateKind | null): TemplateFamily | null {
  return kind === null ? null : TEMPLATE_FAMILY[kind];
}
