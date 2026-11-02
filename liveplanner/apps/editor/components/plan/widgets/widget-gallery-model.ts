// The widget gallery's sections (docs/specs/026-plan/board-widgets.md "The widget gallery"): For You, the built-in
// widgets grouped by what they are for, then one section per card type of the fields its cards carry, each field with
// the views it offers. A search narrows every section to the tiles whose name, line, field or card type holds the
// text. Pure: the picker draws what this returns.
import {
  fieldWidgetKey,
  isBoardWidgetKind,
  parseFieldWidget,
  viewsOfField,
  type BoardField,
  type BoardWidgetId,
  type BoardWidgetKind,
  type FieldWidgetView,
  type ItemTypeDef,
} from '@liveplanner/items';
import {
  BOARD_WIDGET_INFO,
  FIELD_WIDGET_VIEW_INFO,
  fieldWidgetLabel,
  typeNamesText,
  type WidgetSuggestion,
} from '@liveplanner/plan-art';
import { CUSTOM_KIND_LABELS } from '../ItemTypeFieldForms';

export type GalleryTile = {
  id: BoardWidgetId;
  // What the tile says: a built-in's name, a field view's ("Sum") under its field's heading, or the whole name
  // ("Budget Sum") where no heading names the field (For You).
  name: string;
  // The widget's whole name, for the tile's accessible name ("Add Budget Sum").
  fullName: string;
  line: string;
  // A field widget's view, for its glyph; a built-in's kind.
  view?: FieldWidgetView;
  kind?: BoardWidgetKind;
  // A field widget, which the cap on field widgets applies to.
  field?: boolean;
};

export type GalleryFieldGroup = {
  field: BoardField;
  // "Currency", and the other card types it is on ("Also on Bug cards").
  kindLabel: string;
  also?: string;
  tiles: GalleryTile[];
};

export type GalleryIcon =
  | { kind: 'spark' }
  | { kind: 'widget'; widget: BoardWidgetKind }
  | { kind: 'type'; type: ItemTypeDef }
  | { kind: 'fields' };

export type GallerySection = {
  key: string;
  title: string;
  line: string;
  icon: GalleryIcon;
  // Where the rail lists it: the top entries, or under its Fields heading.
  rail: 'top' | 'fields';
  tiles: GalleryTile[];
  fields: GalleryFieldGroup[];
  // What it says with nothing to show (and no search running).
  empty: { title: string; description: string };
};

// The built-in widgets' sections, in order: every kind in exactly one.
export const WIDGET_GROUPS: readonly {
  key: string;
  title: string;
  line: string;
  icon: BoardWidgetKind;
  kinds: readonly BoardWidgetKind[];
}[] = [
  {
    key: 'focus',
    title: 'Focus',
    line: 'Narrow the cards to the ones that matter right now.',
    icon: 'filter',
    kinds: ['filter', 'mine', 'types', 'priorities'],
  },
  {
    key: 'progress',
    title: 'Progress',
    line: 'See how the work is going at a glance.',
    icon: 'points',
    kinds: ['progress', 'count', 'points', 'time', 'top-voted'],
  },
  {
    key: 'people',
    title: 'People',
    line: 'Who has what, and what nobody has picked up.',
    icon: 'people',
    kinds: ['people', 'unassigned'],
  },
  {
    key: 'dates',
    title: 'Dates',
    line: 'What is due, and what has gone quiet.',
    icon: 'due',
    kinds: ['due', 'stale'],
  },
  {
    key: 'health',
    title: 'Health',
    line: 'Catch what is overloaded or off the board.',
    icon: 'wip',
    kinds: ['wip', 'unplaced'],
  },
];

const builtInTile = (kind: BoardWidgetKind, line?: string): GalleryTile => ({
  id: kind,
  name: BOARD_WIDGET_INFO[kind].label,
  fullName: BOARD_WIDGET_INFO[kind].label,
  line: line ?? BOARD_WIDGET_INFO[kind].description,
  kind,
});

const fieldTile = (field: BoardField, view: FieldWidgetView, whole: boolean, line?: string) => ({
  id: fieldWidgetKey(field.def.id, view),
  name: whole ? fieldWidgetLabel(field, view) : FIELD_WIDGET_VIEW_INFO[view].label,
  fullName: fieldWidgetLabel(field, view),
  line: line ?? FIELD_WIDGET_VIEW_INFO[view].description,
  view,
  field: true,
});

// What a tile is found by: its words, its field's name and kind, and its card types.
function haystack(tile: GalleryTile, field?: BoardField): string {
  const extra = field
    ? ` ${field.def.label} ${CUSTOM_KIND_LABELS[field.def.kind]} ${field.types.map((t) => t.label).join(' ')}`
    : '';
  return `${tile.fullName} ${tile.line}${extra}`.toLowerCase();
}

export function gallerySections({
  fields,
  suggestions,
  query = '',
}: {
  fields: readonly BoardField[];
  suggestions: readonly WidgetSuggestion[];
  query?: string;
}): GallerySection[] {
  const q = query.trim().toLowerCase();
  const byId = new Map(fields.map((f) => [f.def.id, f]));
  const keep = (tile: GalleryTile, field?: BoardField) => !q || haystack(tile, field).includes(q);

  const forYou: GalleryTile[] = [];
  for (const s of suggestions) {
    if (isBoardWidgetKind(s.id)) {
      const tile = builtInTile(s.id, s.reason);
      if (keep(tile)) forYou.push(tile);
      continue;
    }
    const parsed = parseFieldWidget(s.id);
    const field = parsed ? byId.get(parsed.fieldId) : undefined;
    if (!parsed || !field) continue;
    const tile = fieldTile(field, parsed.view, true, s.reason);
    if (keep(tile, field)) forYou.push(tile);
  }
  const sections: GallerySection[] = [
    {
      key: 'for-you',
      title: 'For You',
      line: 'Picked for this board from what its cards hold.',
      icon: { kind: 'spark' },
      rail: 'top',
      tiles: forYou,
      fields: [],
      empty: {
        title: 'Nothing to suggest yet',
        description: 'Suggestions appear as this board’s cards fill in.',
      },
    },
    ...WIDGET_GROUPS.map((g): GallerySection => ({
      key: g.key,
      title: g.title,
      line: g.line,
      icon: { kind: 'widget', widget: g.icon },
      rail: 'top',
      tiles: g.kinds.map((k) => builtInTile(k)).filter((t) => keep(t)),
      fields: [],
      empty: { title: 'No widgets here', description: '' },
    })),
  ];

  // The fields, grouped under the first of the board's types that offers each.
  const byType = new Map<string, { type: ItemTypeDef; groups: GalleryFieldGroup[] }>();
  for (const field of fields) {
    const [first, ...others] = field.types;
    if (!first) continue;
    const tiles = viewsOfField(field.def)
      .map((v) => fieldTile(field, v, false))
      .filter((t) => keep(t, field));
    const row = byType.get(first.id) ?? { type: first, groups: [] };
    byType.set(first.id, row);
    if (tiles.length === 0) continue;
    row.groups.push({
      field,
      kindLabel: CUSTOM_KIND_LABELS[field.def.kind],
      ...(others.length
        ? { also: `Also on ${typeNamesText(others.map((t) => t.label))} cards` }
        : {}),
      tiles,
    });
  }
  if (byType.size === 0)
    sections.push({
      key: 'fields',
      title: 'Fields',
      line: 'Widgets for the fields on this board’s cards.',
      icon: { kind: 'fields' },
      rail: 'fields',
      tiles: [],
      fields: [],
      empty: {
        title: 'No fields to chart',
        description:
          'Add a Number, Choice, Date or other field to a card type this board takes, and its widgets appear here.',
      },
    });
  for (const { type, groups } of byType.values())
    sections.push({
      key: `type:${type.id}`,
      title: `${type.label} Fields`,
      line: `The fields on ${type.label} cards, each in the views it has.`,
      icon: { kind: 'type', type },
      rail: 'fields',
      tiles: [],
      fields: groups,
      empty: { title: 'No widgets here', description: '' },
    });
  return q ? sections.filter((s) => sectionSize(s) > 0) : sections;
}

// How many tiles a section holds.
export const sectionSize = (s: GallerySection): number =>
  s.tiles.length + s.fields.reduce((n, g) => n + g.tiles.length, 0);
