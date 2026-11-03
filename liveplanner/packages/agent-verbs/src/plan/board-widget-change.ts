// A board's header widgets by name, for change_board (docs/specs/026-plan/plan-agents.md "Changing a board"): `add`
// and `remove` name a built-in kind by its id (or its gallery name), or a field widget by its name, the field's and
// its view's ("Budget Sum"), or the field's name alone for the view the gallery suggests first. A field widget is
// stored as `field:<view>:<fieldId>`; the raw key is read too, so a widget whose field is gone can still come off.
import {
  BOARD_WIDGET_INFO,
  BOARD_WIDGET_KINDS,
  FIELD_WIDGETS_MAX,
  FIELD_WIDGET_VIEW_INFO,
  fieldWidgetCount,
  fieldWidgetKey,
  fieldWidgetLabel,
  fieldWidgetState,
  isBoardWidgetKind,
  isFieldWidgetKey,
  placeWidget,
  removeWidget,
  statusKey,
  viewsOfField,
  type BoardField,
  type BoardWidgetId,
} from '@liveplanner/items';

export interface WidgetsChange {
  add?: readonly string[] | undefined;
  remove?: readonly string[] | undefined;
}

type Refusal = { ok: false; code: 'board_invalid'; message: string };

const refuse = (message: string): Refusal => ({ ok: false, code: 'board_invalid', message });

// A widget's name as the board's header gives it: a kind's gallery name, a field widget's "Budget Sum", or the
// stored key of a field widget whose field is gone or changed kind (the name a remove takes for it).
export function widgetName(id: BoardWidgetId, fields: readonly BoardField[]): string {
  if (isBoardWidgetKind(id)) return BOARD_WIDGET_INFO[id].label;
  const state = fieldWidgetState(id, fields);
  return state.state === 'ok' ? fieldWidgetLabel(state.field, state.view) : id;
}

// What a board offers, for a refusal: each kind by id, then each readable field with its views.
function offered(readable: readonly BoardField[]): string {
  const kinds = `Widgets: ${BOARD_WIDGET_KINDS.join(', ')}`;
  if (!readable.length) return `${kinds}; the board's card types have no field a widget reads.`;
  const byField = readable.map(
    (f) =>
      `${f.def.label} (${viewsOfField(f.def)
        .map((v) => FIELD_WIDGET_VIEW_INFO[v].label)
        .join(', ')})`,
  );
  return `${kinds}; field widgets: ${byField.join('; ')}.`;
}

type Resolved = { ok: true; id: BoardWidgetId } | Refusal;

// A resolver for names against one board's fields. `all` holds every field of the board's types, readable or not
// (boardFields(…, false)), so a field no widget reads is refused by name rather than as unknown. The names are keyed
// once, so each lookup is a map read: a kind's id or label first, then a field widget's name, then a field's label
// or id alone (its first view), the first to claim a key keeping it.
export function widgetResolver(all: readonly BoardField[]): (name: string) => Resolved {
  const readable = all.filter((f) => viewsOfField(f.def).length > 0);
  const named = new Map<string, BoardWidgetId | BoardField>();
  const claim = (key: string, to: BoardWidgetId | BoardField) => {
    if (!named.has(key)) named.set(key, to);
  };
  for (const k of BOARD_WIDGET_KINDS) {
    claim(statusKey(k), k);
    claim(statusKey(BOARD_WIDGET_INFO[k].label), k);
  }
  for (const f of readable)
    for (const view of viewsOfField(f.def))
      claim(statusKey(fieldWidgetLabel(f, view)), fieldWidgetKey(f.def.id, view));
  const byId = new Map(all.map((f) => [f.def.id, f] as const));
  for (const f of all) claim(statusKey(f.def.label), f);
  return (name) => {
    const trimmed = name.trim();
    if (isBoardWidgetKind(trimmed) || isFieldWidgetKey(trimmed)) return { ok: true, id: trimmed };
    const hit = named.get(statusKey(trimmed)) ?? byId.get(trimmed);
    if (typeof hit === 'string') return { ok: true, id: hit };
    if (!hit) return refuse(`No widget "${trimmed}". ${offered(readable)}`);
    const first = viewsOfField(hit.def)[0];
    if (first) return { ok: true, id: fieldWidgetKey(hit.def.id, first) };
    return refuse(
      `"${hit.def.label}" is a field no widget reads (text, links, pictures and cards have nothing to add up). ` +
        offered(readable),
    );
  };
}

// One name as a widget (widgetResolver, for a single name).
export const resolveWidget = (name: string, all: readonly BoardField[]): Resolved =>
  widgetResolver(all)(name);

// The board's widgets after a change: each `remove` taken off, then each `add` placed at the end (one the board has
// stays where it is). A field widget added must read a field of the board's types in a view it offers, and the board
// holds at most FIELD_WIDGETS_MAX of them; removing one the board does not show changes nothing.
export function changedWidgets(
  current: readonly BoardWidgetId[],
  change: WidgetsChange,
  all: readonly BoardField[],
): { ok: true; widgets: BoardWidgetId[] } | Refusal {
  const resolve = widgetResolver(all);
  let widgets = [...current];
  for (const name of change.remove ?? []) {
    const r = resolve(name);
    if (!r.ok) return r;
    widgets = removeWidget(widgets, r.id);
  }
  for (const name of change.add ?? []) {
    const r = resolve(name);
    if (!r.ok) return r;
    if (widgets.includes(r.id)) continue;
    if (isFieldWidgetKey(r.id)) {
      // A raw key may name a field the board's types lack, or a view its field does not offer.
      if (fieldWidgetState(r.id, all).state !== 'ok')
        return refuse(
          `"${name.trim()}" reads no field of the board's card types in that view. ` +
            offered(all.filter((f) => viewsOfField(f.def).length > 0)),
        );
      if (fieldWidgetCount(widgets) >= FIELD_WIDGETS_MAX)
        return refuse(
          `A board holds up to ${FIELD_WIDGETS_MAX} field widgets: remove one to add "${name.trim()}".`,
        );
    }
    widgets = placeWidget(widgets, r.id, widgets.length);
  }
  return { ok: true, widgets };
}
