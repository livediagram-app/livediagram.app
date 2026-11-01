// The widget gallery's For You (docs/specs/026-plan/board-widgets.md "The widget gallery"): up to six widgets the
// board does not hold yet, most useful first, each with why. A field filled on more than half its cards outranks every
// built-in suggestion; the rest interleave by score. Pure.
import {
  doneColumnsOf,
  fieldWidgetKey,
  itemAssignee,
  viewsOfField,
  withArticle,
  type BoardField,
  type BoardWidgetId,
  type CalculatedRead,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { fieldFills, typeNamesText } from './field-widget-stats';
import { boardPeople, boardPoints, boardTime, staleCount, topVoted } from './widget-stats';

export const SUGGESTIONS_MAX = 6;
// The cards a board holds before a Filter is worth suggesting.
export const FILTER_SUGGEST_CARDS = 20;

export type WidgetSuggestion = { id: BoardWidgetId; score: number; reason: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The built-in widgets this board's cards would make read true, each scored below 1 (a well-filled field's floor).
function builtInSuggestions(
  setup: PlanBoardSetup,
  items: readonly Item[],
  types: readonly ItemTypeDef[],
  now: Date,
): WidgetSuggestion[] {
  const out: WidgetSuggestion[] = [];
  const n = items.length;
  if (n === 0) {
    // Only what reads true before any card: WIP limits are the columns'.
    if (setup.columns.some((c) => c.wipLimit))
      out.push({ id: 'wip', score: 0.85, reason: 'Columns here have WIP limits' });
    return out;
  }
  if (doneColumnsOf(setup).length > 0)
    out.push({ id: 'progress', score: 0.9, reason: 'This board has a done column' });
  if (setup.columns.some((c) => c.wipLimit))
    out.push({ id: 'wip', score: 0.85, reason: 'Columns here have WIP limits' });
  if (boardPoints(setup, items).estimated > 0)
    out.push({ id: 'points', score: 0.75, reason: 'Cards here carry estimates' });
  const people = boardPeople(items).length;
  if (people >= 2)
    out.push({ id: 'people', score: 0.7, reason: `${people} people have cards here` });
  if (topVoted(items)) out.push({ id: 'top-voted', score: 0.7, reason: 'Cards here have votes' });
  const time = boardTime(items, types);
  if (time.counted > 0 || time.running > 0)
    out.push({ id: 'time', score: 0.65, reason: 'Cards here track time' });
  const due = items.filter((it) => typeof it.fields['due'] === 'string').length;
  if (due > 0)
    out.push({
      id: 'due',
      score: 0.5 + 0.4 * (due / n),
      reason: `${plural(due, 'card has a due date', 'cards have due dates')}`,
    });
  if (n >= FILTER_SUGGEST_CARDS)
    out.push({ id: 'filter', score: 0.6, reason: `${n} cards to search through` });
  const stale = staleCount(setup, items, now);
  if (stale > 0)
    out.push({
      id: 'stale',
      score: 0.55,
      reason: `${plural(stale, 'card has', 'cards have')} gone quiet`,
    });
  const nobody = items.filter((it) => !itemAssignee(it)).length;
  if (nobody > 0 && nobody < n)
    out.push({
      id: 'unassigned',
      score: 0.5,
      reason: `${plural(nobody, 'card has', 'cards have')} nobody`,
    });
  return out;
}

// Each field with values, in its first view, scored by the share of its cards that hold one: past half, 1 and up
// (ahead of every built-in); at or under, 0.4 to 0.65 (among them).
function fieldSuggestions(
  fields: readonly BoardField[],
  items: readonly Item[],
  read: CalculatedRead | undefined,
): WidgetSuggestion[] {
  const fills = fieldFills(fields, items, read);
  const out: WidgetSuggestion[] = [];
  for (const f of fields) {
    const fill = fills.get(f.def.id);
    if (!fill || fill.filled === 0 || fill.cards === 0) continue;
    const share = fill.filled / fill.cards;
    const typesText = typeNamesText(f.types.map((t) => t.label));
    const reason =
      share >= 1
        ? `Every ${typesText} card has ${withArticle(f.def.label)}`
        : `${Math.max(1, Math.round(share * 100))}% of ${typesText} cards have ${withArticle(f.def.label)}`;
    out.push({
      id: fieldWidgetKey(f.def.id, viewsOfField(f.def)[0]!),
      score: share > 0.5 ? 1 + share : 0.4 + 0.5 * share,
      reason,
    });
  }
  return out;
}

export function suggestWidgets({
  setup,
  items,
  types,
  fields,
  widgets,
  now,
  read,
  max = SUGGESTIONS_MAX,
}: {
  setup: PlanBoardSetup;
  items: readonly Item[];
  types: readonly ItemTypeDef[];
  fields: readonly BoardField[];
  // The board's widgets: never suggested again.
  widgets: readonly BoardWidgetId[];
  now: Date;
  read?: CalculatedRead | undefined;
  max?: number;
}): WidgetSuggestion[] {
  // Fields first, so among equal scores a field leads (sort is stable).
  const all = [
    ...fieldSuggestions(fields, items, read),
    ...builtInSuggestions(setup, items, types, now),
  ];
  return all
    .filter((s) => !widgets.includes(s.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}
