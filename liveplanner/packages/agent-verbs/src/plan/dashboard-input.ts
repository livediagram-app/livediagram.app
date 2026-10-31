// A Dashboard as an agent names it (docs/specs/026-plan/plan-agents.md "Making a dashboard") resolved to what the
// builder takes: tabs by name to their ids and what each holds, a chart's card types by name to ids, its grouping by
// name. A name the project lacks is refused naming those there are.
import {
  resolveType,
  statusKey,
  viewDateOptions,
  viewMeasureOptions,
  type ViewFieldOption,
  type ItemTypeDef,
  type MetricKind,
  type PlanVisualisation,
} from '@liveplanner/items';
import { readSlotName } from '@liveplanner/project';
import type { DashboardSpec } from '@liveplanner/templates';
import { swimlanesNamed } from './change-board';

export type DashboardInput = {
  tabs?: readonly string[] | 'every';
  metrics?: readonly MetricKind[];
  charts?: readonly {
    view: PlanVisualisation;
    groupBy?: string;
    types?: readonly string[];
    // Fields by role, each by name (plan-views.md "Dates", "Cards by Field"): the Date fields a Gantt chart or a
    // calendar reads, and what Cards by Field adds up (Cards, Estimate or a Number field).
    startField?: string;
    dueField?: string;
    measure?: string;
    // The slot's own name (plan-tabs.md "A slot's name").
    name?: string;
  }[];
  notes?: readonly { title: string; text: string }[];
};

// A tab a Dashboard could show: its name, and what it holds (null for any other tab).
export type DashboardTabRef = { id: string; name: string; of: 'board' | 'sheet' | null };

export function resolveDashboardInput(
  input: DashboardInput,
  tabs: readonly DashboardTabRef[],
  types: readonly ItemTypeDef[],
): { ok: true; spec: DashboardSpec } | { ok: false; message: string } {
  const shown = tabs.filter((t): t is DashboardTabRef & { of: 'board' | 'sheet' } => t.of !== null);
  let picked: { tabId: string; of: 'board' | 'sheet' }[] = [];
  if (input.tabs === 'every') picked = shown.map((t) => ({ tabId: t.id, of: t.of }));
  else
    for (const name of input.tabs ?? []) {
      const tab = shown.find((t) => statusKey(t.name) === statusKey(name));
      if (!tab)
        return {
          ok: false,
          message:
            `No Board or Sheet tab "${name}". ` +
            (shown.length
              ? `Tabs it can show: ${shown.map((t) => t.name).join(', ')}.`
              : 'The plan has none.'),
        };
      picked.push({ tabId: tab.id, of: tab.of });
    }
  const charts: NonNullable<DashboardSpec['charts']>[number][] = [];
  for (const c of input.charts ?? []) {
    const settings: {
      types?: string[];
      swimlaneBy?: string;
      swimlaneField?: string;
      startField?: string;
      dueField?: string;
      measure?: string;
    } = {};
    if (c.types?.length) {
      settings.types = [];
      for (const name of c.types) {
        const t = resolveType(name, types);
        if (!t.ok) return { ok: false, message: t.message };
        settings.types.push(t.type.id);
      }
    }
    if (c.groupBy !== undefined) {
      const lanes = swimlanesNamed(c.groupBy, types);
      if (!lanes.ok) return { ok: false, message: lanes.message };
      settings.swimlaneBy = lanes.value.by;
      if (lanes.value.field) settings.swimlaneField = lanes.value.field;
    }
    for (const [key, role] of [
      ['startField', 'start'],
      ['dueField', 'due'],
    ] as const) {
      const named = c[key];
      if (named === undefined) continue;
      const field = fieldNamed(named, viewDateOptions(types, role), 'Date field');
      if (!field.ok) return field;
      // The built-in is the default, never stored (plan-views.md "Dates").
      if (field.id !== role) settings[key] = field.id;
    }
    if (c.measure !== undefined && statusKey(c.measure) !== 'cards') {
      const field = fieldNamed(c.measure, viewMeasureOptions(types), 'Number field');
      if (!field.ok) return field;
      settings.measure = field.id;
    }
    const name = readSlotName(c.name);
    charts.push({
      view: c.view,
      ...(Object.keys(settings).length ? { settings: settings as never } : {}),
      ...(name ? { name } : {}),
    });
  }
  return {
    ok: true,
    spec: {
      ...(picked.length ? { tabs: picked } : {}),
      ...(input.metrics?.length ? { metrics: [...input.metrics] } : {}),
      ...(charts.length ? { charts } : {}),
      ...(input.notes?.length ? { notes: input.notes.map((n) => ({ ...n })) } : {}),
    },
  };
}

// A field named by an agent among a role's options, by its name or id (case and spacing aside); refused naming them.
function fieldNamed(
  name: string,
  options: readonly ViewFieldOption[],
  what: string,
): { ok: true; id: string } | { ok: false; message: string } {
  const key = statusKey(name);
  const hit = options.find((o) => statusKey(o.label) === key || o.id === name);
  if (hit) return { ok: true, id: hit.id };
  return {
    ok: false,
    message:
      `No ${what} "${name}". ` +
      (options.length
        ? `Fields it can read: ${options.map((o) => o.label).join(', ')}.`
        : 'The card types have none.'),
  };
}
