// A plan view's settings and their changes (docs/specs/026-plan/plan-views.md "Card types", "Swimlanes", "Row
// order", "Statuses"), shared by its element menu's View flyout and a Gantt chart's cog (GanttSettingsPanel): what it
// can show, what it shows, and one element edit per change through PlanContext, each tracked.
import { withArticle } from '@liveplanner/ui';
import {
  breakdownGroupingOf,
  readPlanViewSettings,
  viewChosenTypes,
  viewEligibleTypes,
  viewNeeds,
  viewShownTypes,
  viewStatusOptions,
  viewTakesStatuses,
  type ItemTypeDef,
  type SwimlaneBy,
} from '@liveplanner/items';
import type { PlanViewRef } from '@liveplanner/document';
import type { PlanContextValue } from '../PlanContext';
import { track } from '@/lib/telemetry';

export function planViewSettingsModel(
  plan: PlanContextValue,
  elementId: string,
  stored: PlanViewRef,
) {
  // The old Parent grouping reads as the Parent field (legacy-parent).
  const settings = readPlanViewSettings(stored);
  const view = settings.view;
  const gantt = view === 'gantt';
  const eligible: ItemTypeDef[] = viewEligibleTypes(view, plan.types);
  const eligibleIds = new Set(eligible.map((t) => t.id));
  const chosen = viewChosenTypes(view, settings, plan.types);
  const shownIds = viewShownTypes(view, settings, plan.types);
  const shown = plan.types.filter((t) => shownIds.includes(t.id));
  const grouping = view === 'workload' ? breakdownGroupingOf(settings) : null;
  // The statuses the shown card types' cards hold (docs/specs/026-plan/plan-views.md "Statuses"), for the charts
  // that count by status; all of them when the view names none.
  const takesStatuses = viewTakesStatuses(view);
  const shownTypeIds = new Set(shownIds);
  const statusOptions = takesStatuses
    ? viewStatusOptions(
        [...plan.items.values()].filter((it) => shownTypeIds.has(it.type)),
        plan.statusNames,
      )
    : [];
  const optionIds = new Set(statusOptions.map((o) => o.id));
  const storedStatuses = settings.statuses;
  return {
    settings,
    view,
    gantt,
    needs: viewNeeds(view),
    eligible,
    selected: chosen.filter((id) => eligibleIds.has(id)),
    shown,
    grouping,
    takesStatuses,
    statusOptions,
    selectedStatuses: storedStatuses
      ? storedStatuses.filter((id) => optionIds.has(id))
      : statusOptions.map((o) => o.id),
    setStatuses: (picked: string[]) => {
      const { statuses: _statuses, ...rest } = settings;
      // A named status no card holds just now is not listed, but stays named while a board's column still names it
      // (it comes back with its cards); one no column names any more is gone, and dropped.
      const kept = (storedStatuses ?? []).filter(
        (id) => !optionIds.has(id) && plan.statusNames.has(id),
      );
      const next = [...picked, ...kept];
      // Every status listed ticked is the default, dropped rather than stored, so a status that arrives later is
      // counted too.
      const isDefault = statusOptions.every((o) => next.includes(o.id));
      plan.updateView(
        elementId,
        isDefault || next.length === 0 ? rest : { ...rest, statuses: next },
      );
      track('Plan', 'Changed', 'ViewStatuses');
    },
    setTypes: (picked: string[]) => {
      const { types: _types, ...rest } = settings;
      // A named type that has lost a field the view needs is not listed, but the view keeps naming it (it comes back
      // when the type has it again): the toggle keeps it alongside what was picked.
      const kept = chosen.filter((id) => !eligibleIds.has(id));
      const next = [...picked, ...kept];
      // The default is dropped rather than stored: every type the view can show (for a Gantt chart, every type with
      // a start and a due date).
      const isDefault = eligible.every((t) => next.includes(t.id)) && kept.length === 0;
      plan.updateView(elementId, isDefault ? rest : { ...rest, types: next });
      track('Plan', 'Changed', gantt ? 'GanttTypes' : 'ViewTypes');
    },
    setGrouping: (by: SwimlaneBy, field: string | undefined) => {
      const { swimlaneBy: _by, swimlaneField: _field, ...rest } = settings;
      plan.updateView(
        elementId,
        by === 'assignee'
          ? rest
          : { ...rest, swimlaneBy: by, ...(field ? { swimlaneField: field } : {}) },
      );
      track('Plan', 'Changed', 'ViewGrouping');
    },
    setSwimlanes: (by: SwimlaneBy, field: string | undefined) => {
      const { swimlaneBy: _by, swimlaneField: _field, ...rest } = settings;
      plan.updateView(
        elementId,
        by === 'none'
          ? rest
          : { ...rest, swimlaneBy: by, ...(field ? { swimlaneField: field } : {}) },
      );
      track('Plan', 'Changed', 'GanttSwimlanes');
    },
    sortByDate: () => {
      const { rowOrder: _order, ...rest } = settings;
      plan.updateView(elementId, rest);
      track('Plan', 'Changed', 'GanttRowOrder');
    },
  };
}

const NEED_LABELS: Record<string, string> = {
  start: 'Start',
  due: 'Due',
  priority: 'Priority',
  assignee: 'Assignee',
  estimate: 'Estimate',
  votes: 'Votes',
};

// Why some card types are missing from Card Types: the view reads fields a type must offer.
export function viewTypesNote(needs: readonly string[]): string {
  if (needs.length === 0) return 'The card types this view charts.';
  const names = needs.map((f) => NEED_LABELS[f] ?? f);
  const list =
    names.length === 1 ? `${withArticle(names[0]!)} field` : `${names.join(' and ')} fields`;
  return `The card types this view charts; only those with ${list} are listed.`;
}
