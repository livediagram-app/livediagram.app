// One Gantt model per plan and chart settings for a picture run (docs/specs/026-plan/plan-tabs.md "Export"): a
// Dashboard of many Gantts over the same cards works the model out once per distinct type set, dates and day, not
// once a picture. At a full plan (ITEMS_MAX cards) the model is about 5 ms, so 48 Gantts spent 240 ms on it. Pure.
import {
  ganttModel,
  type GanttModel,
  type StatusPhase,
  type ViewDates,
  type Item,
} from '@liveplanner/items';

type Kept = { phases: ReadonlyMap<string, StatusPhase>; models: Map<string, GanttModel> };

// Keyed weakly by the cards' map, so a plan's models go with its cards; within one map, by the settings that shape the
// model. A different phases map (a board's done columns changed) starts afresh.
const kept = new WeakMap<ReadonlyMap<string, Item>, Kept>();

export function keptGanttModel(
  items: ReadonlyMap<string, Item>,
  phases: ReadonlyMap<string, StatusPhase>,
  now: Date,
  types: readonly string[],
  dates: ViewDates,
): GanttModel {
  let entry = kept.get(items);
  if (!entry || entry.phases !== phases) {
    entry = { phases, models: new Map() };
    kept.set(items, entry);
  }
  const key = JSON.stringify([now.getTime(), types, dates]);
  let model = entry.models.get(key);
  if (!model) {
    model = ganttModel(items.values(), phases, now, types, dates);
    entry.models.set(key, model);
  }
  return model;
}
