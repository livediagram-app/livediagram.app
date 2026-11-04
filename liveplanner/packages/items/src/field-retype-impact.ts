// What stops reading a built-in field for a card type when it becomes a custom field (docs/specs/026-plan/
// item-types.md "Edit Field": Built-in fields, "What stops reading it"): one bounded pass over the plan's boards,
// views and forms (handed in by the editor, which holds the tabs) and the catalogue's own Formula, Rollup and Lookup
// fields, each place said as a line ("Sprint sorts by Priority"). Only places covering the type count. Pure.
import { boardAddTypes, type PlanBoardSetup } from './board';
import { BOARD_WIDGET_INFO } from './board-widget-names';
import { widgetsOf, type BoardWidgetKind } from './board-widgets';
import type { CardSearchFilter } from './card-search';
import { isLookupField, isRollupField } from './calculated-result';
import { linkTypesOf, type CustomFieldDef, type ItemTypeDef } from './item-types';
import { rollupChildTypes } from './rollup-fields';
import {
  PLAN_VISUALISATION_LABELS,
  breakdownGroupingOf,
  planViewMetric,
  viewNeeds,
  type PlanViewId,
} from './plan-views';
import type { SwimlaneBy } from './board';

// The lines the confirm shows before "and N more".
export const IMPACT_ROWS_SHOWN = 6;

// The board widgets that read a built-in field of their own.
const BUILT_IN_WIDGET_READS: Readonly<Partial<Record<BoardWidgetKind, string>>> = {
  mine: 'assignee',
  people: 'assignee',
  unassigned: 'assignee',
  due: 'due',
  points: 'estimate',
  priorities: 'priority',
  'top-voted': 'votes',
};

// A grouping that reads a built-in of its own (Swimlanes, Cards by Field).
const GROUPING_FIELD: Readonly<Partial<Record<SwimlaneBy, string>>> = {
  assignee: 'assignee',
  priority: 'priority',
};

export interface ImpactBoard {
  title: string;
  setup: PlanBoardSetup;
}

export interface ImpactView {
  view: PlanViewId;
  settings: {
    types?: string[];
    swimlaneBy?: SwimlaneBy;
    swimlaneField?: string;
    startField?: string;
    dueField?: string;
    measure?: string;
    filters?: CardSearchFilter[];
    title?: string;
  };
}

export interface ImpactForm {
  title: string;
  // The card type its answers make, and the fields its questions fill.
  typeId: string | undefined;
  fieldIds: readonly string[];
}

export interface RetypeImpactInput {
  // The built-in field, its name as said here, and the type it changes on.
  field: string;
  name: string;
  typeId: string;
  boards: readonly ImpactBoard[];
  views: readonly ImpactView[];
  forms: readonly ImpactForm[];
  // The catalogue as stored (before the change).
  types: readonly ItemTypeDef[];
}

const viewTitle = (v: ImpactView): string => {
  if (v.settings.title) return v.settings.title;
  const metric = planViewMetric(v.view);
  return metric ? BOARD_WIDGET_INFO[metric].label : PLAN_VISUALISATION_LABELS[v.view as never];
};

// Whether a grouping (by, field) reads the field.
const groupsBy = (by: SwimlaneBy | undefined, lane: string | undefined, field: string) =>
  by === 'field' ? lane === field : !!by && GROUPING_FIELD[by] === field;

/** Every place that reads the built-in `field` for cards of `typeId`, said as a line, in tab order. */
export function fieldRetypeImpact(input: RetypeImpactInput): string[] {
  const { field, name, typeId, types } = input;
  const out: string[] = [];
  const covers = (ids: readonly { id: string }[]) => ids.some((t) => t.id === typeId);
  let onBoard = false;
  for (const { title, setup } of input.boards) {
    if (!covers(boardAddTypes(setup, types))) continue;
    onBoard = true;
    if (setup.sortBy?.some((l) => l.field === field)) out.push(`${title} sorts by ${name}`);
    if (groupsBy(setup.swimlaneBy, setup.swimlaneField, field))
      out.push(`${title} lanes by ${name}`);
    for (const w of widgetsOf(setup)) {
      const reads = w.startsWith('field:')
        ? w.endsWith(`:${field}`)
        : BUILT_IN_WIDGET_READS[w as BoardWidgetKind] === field;
      if (reads)
        out.push(
          `${title}’s ${w.startsWith('field:') ? name : BOARD_WIDGET_INFO[w as BoardWidgetKind].label} widget reads ${name}`,
        );
    }
  }
  for (const v of input.views) {
    if (v.settings.types?.length && !v.settings.types.includes(typeId)) continue;
    const grouping = v.view === 'workload' ? breakdownGroupingOf(v.settings) : null;
    if (
      viewNeeds(v.view, v.settings, types).includes(field) ||
      (grouping && groupsBy(grouping.by, grouping.field, field))
    )
      out.push(`${viewTitle(v)} reads ${name}`);
  }
  for (const f of input.forms)
    if (f.typeId === typeId && f.fieldIds.includes(field)) out.push(`${f.title} asks for ${name}`);
  for (const t of types)
    for (const c of t.custom ?? []) {
      const reads =
        (t.id === typeId && c.formula?.includes(`{${field}}`)) ||
        (c.source === field && readsAcross(t, c, typeId, types));
      if (reads) out.push(`${c.label} reads ${name}`);
    }
  if (onBoard) out.push('CSV exports write it as a column of its own');
  return out;
}

// Whether a Rollup (from its children) or a Lookup (from the cards its link names) on type `t` reads cards of
// `typeId`.
function readsAcross(
  t: ItemTypeDef,
  c: CustomFieldDef,
  typeId: string,
  types: readonly ItemTypeDef[],
): boolean {
  if (isRollupField(c))
    return rollupChildTypes(t.id, c.through, types).some((x) => x.id === typeId);
  if (!isLookupField(c)) return false;
  const link = t.custom?.find((l) => l.id === c.through);
  return !!link && linkTypesOf(link).includes(typeId);
}

/** The lines as the confirm shows them: the first IMPACT_ROWS_SHOWN, then "and N more". */
export function impactShown(lines: readonly string[]): string[] {
  if (lines.length <= IMPACT_ROWS_SHOWN) return [...lines];
  return [...lines.slice(0, IMPACT_ROWS_SHOWN), `and ${lines.length - IMPACT_ROWS_SHOWN} more`];
}
