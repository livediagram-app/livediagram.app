// The Plan templates (docs/specs/025-plan/plan-mode.md "Templates"): each is a Plan board with the
// set-up its use wants, opening in Plan mode. The board holds only the set-up; the cards it shows are
// the template's seed items (template-plan-items.ts), made in the new document's item store.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createShape, createSticky, type Element } from '@livediagram/document';
import { presetSetup, type PlanBoardPresetId, type PlanBoardSetup } from '@livediagram/items';

export const PLAN_TEMPLATE_KINDS = [
  'blank-plan',
  'kanban',
  'sprint-board',
  'bug-triage',
  'team-retro',
  'roadmap-board',
  'weekly-planner',
] as const;
export type PlanTemplateKind = (typeof PLAN_TEMPLATE_KINDS)[number];

type BoardSpec = { preset: PlanBoardPresetId; width: number; height: number; title: string };

const BOARDS: Record<PlanTemplateKind, BoardSpec> = {
  'blank-plan': { preset: 'blank', width: 900, height: 560, title: 'Our board' },
  kanban: { preset: 'kanban', width: 1400, height: 720, title: 'Checkout team' },
  'sprint-board': {
    preset: 'sprint',
    width: 1320,
    height: 860,
    title: 'Sprint 14: Faster checkout',
  },
  'bug-triage': { preset: 'bug-triage', width: 1400, height: 800, title: 'Bug triage' },
  'team-retro': { preset: 'retro', width: 1200, height: 720, title: 'Sprint 14 retro' },
  'roadmap-board': { preset: 'roadmap', width: 1100, height: 640, title: 'Product roadmap' },
  'weekly-planner': { preset: 'weekly', width: 1400, height: 600, title: 'This week' },
};

function board(spec: BoardSpec, cx: number, cy: number): Element {
  const setup: PlanBoardSetup = { ...presetSetup(spec.preset), title: spec.title };
  return {
    ...createShape('plan-board', cx - spec.width / 2, cy - spec.height / 2),
    width: spec.width,
    height: spec.height,
    planBoard: setup,
  };
}

// The retro's steps, beside the board: a retro is run, not just filled in.
function retroSteps(cx: number, cy: number, spec: BoardSpec): Element {
  const note = createSticky(cx + spec.width / 2 + 40, cy - spec.height / 2);
  return {
    ...note,
    width: 240,
    height: 240,
    label:
      'How we run it\n1. Write notes: they stay hidden\n2. Reveal together\n3. Vote: 5 each\n4. Turn the top votes into Actions',
    textSize: 'sm',
  };
}

export function buildPlanTemplate(kind: PlanTemplateKind, cx: number, cy: number): Element[] {
  const spec = BOARDS[kind];
  const elements: Element[] = [board(spec, cx, cy)];
  if (kind === 'team-retro') elements.push(retroSteps(cx, cy, spec));
  return elements;
}

export function isPlanTemplateKind(kind: string): kind is PlanTemplateKind {
  return (PLAN_TEMPLATE_KINDS as readonly string[]).includes(kind);
}
