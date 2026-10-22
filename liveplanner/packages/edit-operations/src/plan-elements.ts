// The elements a Plan tab holds (docs/specs/024-agents/edit-operations.md "What a changeset changes"): a Board tab's
// board, a Sheet tab's Sheet with the charts drawn from it, and a Dashboard tab's views and charts. Edit operations
// add, set and test these and nothing else, so an agent can make only what liveplanner draws.

import type { Element } from '@liveplanner/project';

export const PLAN_ELEMENT_KINDS = [
  'plan-board',
  'plan-sheet',
  'plan-view',
  'bar-chart',
  'line-chart',
  'pie-chart',
] as const;
export type PlanElementKind = (typeof PLAN_ELEMENT_KINDS)[number];

// What each kind is, as the schema lists it.
export const PLAN_ELEMENT_ABOUT: Readonly<Record<PlanElementKind, string>> = {
  'plan-board': "a Board tab's board: its columns and the card types it shows; its cards are items",
  'plan-sheet': "a Sheet tab's spreadsheet; its cells change through the sheet commands",
  'plan-view': "a Dashboard's metric or chart of the cards (a Gantt, a calendar, workload, …)",
  'bar-chart': "a bar or column chart of a Sheet's cells, in the Sheet or on a Dashboard",
  'line-chart': "a line, area or scatter chart of a Sheet's cells, in the Sheet or on a Dashboard",
  'pie-chart': "a pie or doughnut chart of a Sheet's cells, in the Sheet or on a Dashboard",
};

// The fields every Plan element takes: where it sits, its name and its lock.
export const PLAN_COMMON_FIELDS = ['x', 'y', 'width', 'height', 'label', 'locked'] as const;

const CHART_FIELDS = [
  'chartSource',
  'sheetAnchor',
  'chartVariant',
  'chartLegend',
  'chartValues',
  'chartPalette',
] as const;

// Each kind's own fields: what it shows and how.
export const PLAN_KIND_FIELDS: Readonly<Record<PlanElementKind, readonly string[]>> = {
  // docs/specs/026-plan/plan-board.md: the board's set-up; its cards change through the item commands.
  'plan-board': ['planBoard'],
  // docs/specs/029-sheets/sheet.md: the sheet it frames; its cells change through the sheet commands.
  'plan-sheet': ['planSheet'],
  // docs/specs/026-plan/plan-views.md: which view of the cards it shows, at what text size.
  'plan-view': ['planView', 'textSize'],
  // docs/specs/029-sheets/sheet.md "Charts": the cells it reads and how it draws them.
  'bar-chart': [...CHART_FIELDS, 'chartAxis'],
  'line-chart': [...CHART_FIELDS, 'chartAxis'],
  'pie-chart': [...CHART_FIELDS],
};

export function isPlanElementKind(kind: unknown): kind is PlanElementKind {
  return PLAN_ELEMENT_KINDS.some((k) => k === kind);
}

// The Plan kind of an element, or null for any other element.
export function planKindOf(el: { type?: unknown; shape?: unknown }): PlanElementKind | null {
  return el.type === 'shape' && isPlanElementKind(el.shape) ? el.shape : null;
}

const CHARTS: ReadonlySet<string> = new Set(['bar-chart', 'line-chart', 'pie-chart']);

// The fields an element takes by name: a Plan element's own, else only the common ones.
export function planFieldsOf(el: Element): readonly string[] {
  const kind = planKindOf(el);
  return [...PLAN_COMMON_FIELDS, ...(kind ? PLAN_KIND_FIELDS[kind] : [])];
}

// Why a raw element is not one a Plan tab holds, or null when it is.
export function planElementIssue(raw: Readonly<Record<string, unknown>>): string | null {
  const kind = planKindOf(raw);
  if (!kind) {
    const named =
      raw.type === 'shape' && typeof raw.shape === 'string'
        ? `shape "${raw.shape}"`
        : typeof raw.type === 'string'
          ? `type "${raw.type}"`
          : 'an element with no type';
    return `${named} is not an element a liveplanner tab holds`;
  }
  // A chart draws a Sheet's cells: one with none drew nothing on a Dashboard.
  if (CHARTS.has(kind) && (typeof raw.chartSource !== 'object' || raw.chartSource === null))
    return `a ${kind} reads a Sheet's cells: it needs "chartSource" { "sheetId", "range" }`;
  return null;
}

// The hint a refused kind carries: the kinds there are.
export const PLAN_KINDS_HINT = `a tab holds { "type": "shape", "shape": ${PLAN_ELEMENT_KINDS.join(' | ')} }; liveplanner schema <kind> shows its fields`;
