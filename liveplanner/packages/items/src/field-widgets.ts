// Field widgets (docs/specs/026-plan/board-widgets.md "Field widgets"): a board widget that reads one custom field of
// the card types the board takes, in one view (Sum, Breakdown, Upcoming, ...). It is kept in the board's widget list as
// `field:<view>:<fieldId>`, beside the built-in kinds, so it orders, moves and comes off as they do. Pure.
import type { PlanBoardSetup } from './board';
import { calculatedResultOf } from './calculated-result';
import type { CustomFieldDef, ItemTypeDef } from './item-types';
import { CUSTOM_FIELD_ID_PATTERN } from './type-catalogue';

// Every view a field widget can take, in the order the gallery offers them.
export const FIELD_WIDGET_VIEWS = [
  'sum',
  'average',
  'range',
  'spread',
  'stars',
  'breakdown',
  'donut',
  'ticked',
  'upcoming',
  'timeline',
] as const;
export type FieldWidgetView = (typeof FIELD_WIDGET_VIEWS)[number];

// A field widget as the board's widget list keeps it.
export type FieldWidgetKey = `field:${FieldWidgetView}:${string}`;

// The most field widgets one board holds (board-widgets.md "Field widgets"): a header row stays readable, and the
// widget list stays bounded however many fields the types carry.
export const FIELD_WIDGETS_MAX = 12;

// What a field holds, as a widget reads it: a number of some unit, values to count, a tick, or a day. Undefined for a
// field no widget reads (text, links, pictures, cards).
export type FieldShape =
  | { kind: 'number'; unit: 'number' | 'currency' | 'duration' | 'votes' }
  | { kind: 'number'; unit: 'percent' }
  | { kind: 'number'; unit: 'rating'; scale: number }
  | { kind: 'category'; from: 'choice' | 'multichoice' | 'labels' | 'person' | 'text' }
  | { kind: 'ticked'; from: 'checkbox' | 'checklist' }
  | { kind: 'date'; from: 'date' | 'datetime' | 'daterange' };

const VIEWS_OF: Readonly<Record<string, readonly FieldWidgetView[]>> = {
  number: ['sum', 'average', 'range', 'spread'],
  percent: ['average', 'range', 'spread'],
  rating: ['stars', 'spread'],
  category: ['breakdown', 'donut'],
  ticked: ['ticked'],
  date: ['upcoming', 'timeline'],
};

const RATING_SCALE_DEFAULT = 5;

// The shape a field reads as; a Calculated field by its result kind (calculated-result.ts).
export function fieldShapeOf(field: CustomFieldDef): FieldShape | undefined {
  switch (field.kind) {
    case 'number':
    case 'currency':
    case 'duration':
    case 'votes':
      return { kind: 'number', unit: field.kind };
    case 'percent':
      return { kind: 'number', unit: 'percent' };
    case 'rating':
      return { kind: 'number', unit: 'rating', scale: field.scale ?? RATING_SCALE_DEFAULT };
    case 'choice':
    case 'multichoice':
    case 'labels':
    case 'person':
      return { kind: 'category', from: field.kind };
    case 'checkbox':
    case 'checklist':
      return { kind: 'ticked', from: field.kind };
    case 'date':
    case 'datetime':
    case 'daterange':
      return { kind: 'date', from: field.kind };
    case 'calculated': {
      const result = calculatedResultOf(field);
      switch (result) {
        case 'number':
        case 'currency':
        case 'duration':
          return { kind: 'number', unit: result };
        case 'percent':
          return { kind: 'number', unit: 'percent' };
        case 'text':
          return { kind: 'category', from: 'text' };
        case 'checkbox':
          return { kind: 'ticked', from: 'checkbox' };
        case 'date':
          return { kind: 'date', from: 'date' };
        default:
          return undefined;
      }
    }
    default:
      return undefined;
  }
}

// The views a field offers, its first the one For You suggests; none for a field no widget reads.
export function viewsOfField(field: CustomFieldDef): readonly FieldWidgetView[] {
  const shape = fieldShapeOf(field);
  if (!shape) return [];
  if (shape.kind === 'number') return VIEWS_OF[shape.unit] ?? VIEWS_OF['number']!;
  return VIEWS_OF[shape.kind]!;
}

export const fieldWidgetKey = (fieldId: string, view: FieldWidgetView): FieldWidgetKey =>
  `field:${view}:${fieldId}`;

// The field and view a stored widget names, or null for anything that is not a well-formed field widget.
export function parseFieldWidget(id: unknown): { fieldId: string; view: FieldWidgetView } | null {
  if (typeof id !== 'string' || !id.startsWith('field:')) return null;
  const rest = id.slice('field:'.length);
  const at = rest.indexOf(':');
  if (at < 0) return null;
  const view = rest.slice(0, at);
  const fieldId = rest.slice(at + 1);
  if (!(FIELD_WIDGET_VIEWS as readonly string[]).includes(view)) return null;
  if (!CUSTOM_FIELD_ID_PATTERN.test(fieldId)) return null;
  return { fieldId, view: view as FieldWidgetView };
}

export const isFieldWidgetKey = (id: unknown): id is FieldWidgetKey =>
  parseFieldWidget(id) !== null;

// A custom field a board's widgets can read: its definition (from the first type offering it) and every one of the
// board's types that offers it, in the board's order.
export interface BoardField {
  def: CustomFieldDef;
  types: readonly ItemTypeDef[];
}

// The card types whose fields a board's widgets read: the types it takes (boardAddTypes' rule), or every type for a
// board that takes none of its own (an Archive board shows cards of any type). Kept here rather than calling
// boardAddTypes so board.ts and this module never import each other.
export function boardFieldTypes(
  setup: Pick<PlanBoardSetup, 'addTypes'>,
  types: readonly ItemTypeDef[],
): ItemTypeDef[] {
  const own = setup.addTypes ? types.filter((t) => setup.addTypes!.includes(t.id)) : [];
  return own.length ? own : [...types];
}

// The fields a board's widgets can read (board-widgets.md "Field widgets" "Which fields"): each custom field one of
// its types offers and a view reads, once, in the order the types offer them. `readable` false keeps the fields no
// view reads too (a Text field), for fieldWidgetState: a field turned into one has changed kind, not gone.
export function boardFields(
  setup: Pick<PlanBoardSetup, 'addTypes'>,
  types: readonly ItemTypeDef[],
  readable = true,
): BoardField[] {
  const out = new Map<string, { def: CustomFieldDef; types: ItemTypeDef[] }>();
  for (const t of boardFieldTypes(setup, types))
    for (const f of t.custom ?? []) {
      if (!t.fields.includes(f.id) || (readable && viewsOfField(f).length === 0)) continue;
      const row = out.get(f.id);
      if (row) row.types.push(t);
      else out.set(f.id, { def: f, types: [t] });
    }
  return [...out.values()];
}

// How a field widget stands against the board's fields now (board-widgets.md "A field gone"): reading, its field gone
// from the board's types, or its view no longer one the field offers (its kind changed).
export type FieldWidgetState =
  | { state: 'ok'; field: BoardField; view: FieldWidgetView }
  | { state: 'removed' }
  | { state: 'changed'; field: BoardField };

// A field still on some other type of the project, but on none the board takes, reads as removed from the board: the
// same quiet state. `fields` is boardFields(…, false), so a field whose kind no view reads any more (a Rating made Text)
// reads as changed, not removed.
export function fieldWidgetState(
  key: FieldWidgetKey,
  fields: readonly BoardField[],
): FieldWidgetState {
  const parsed = parseFieldWidget(key)!;
  const field = fields.find((f) => f.def.id === parsed.fieldId);
  if (!field) return { state: 'removed' };
  if (!viewsOfField(field.def).includes(parsed.view)) return { state: 'changed', field };
  return { state: 'ok', field, view: parsed.view };
}

// How many field widgets a widget list holds.
export const fieldWidgetCount = (widgets: readonly string[]): number =>
  widgets.filter((w) => w.startsWith('field:')).length;
