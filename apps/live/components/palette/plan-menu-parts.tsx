'use client';

// The parts the Plan element menus share (docs/specs/026-plan/plan-board.md "The board set-up", plan-views.md
// "Swimlanes"): a flyout group under a heading, the Swimlanes tile grid a board and a Gantt chart both set, and
// the card type tiles a board's Card Types and a Gantt chart's Card Types both press.
import type { ReactNode } from 'react';
import {
  CARD_SIZES,
  SWIMLANE_BY,
  laneFieldsOf,
  swimlaneGroupingsFor,
  type ItemTypeDef,
  type LaneField,
  type LaneFieldKind,
  type CardSize,
  type SwimlaneBy,
} from '@livediagram/items';
import { OptionRows } from '@/components/plan/OptionRows';
import type { PlanPalette } from '@/components/plan/plan-palette';
import { CardSizeArt } from '@/components/plan/plan-tile-art';
import { PlanTypeGlyph } from '@/components/plan/plan-type-glyph';
import { ACCENT_TEXT, accentVars } from '@/components/plan/plan-palette';
import { SWIMLANE_LABELS } from '@/components/plan/board-setup-edits';

// One group of a flyout: a heading (matching the menu's section headings), an optional hint, its tiles.
export function MenuGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-100 pt-1 first:border-t-0 dark:border-slate-800">
      <h3 className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      {hint ? <InfoNote>{hint}</InfoNote> : null}
      {children}
    </section>
  );
}

// A glyph per row grouping, from the Plan glyph set.
const ROW_GLYPHS: Record<SwimlaneBy, string> = {
  none: 'item',
  assignee: 'person',
  type: 'task',
  priority: 'flag',
  status: 'action',
  field: 'note',
};
// A field lane's tile glyph, by how the field groups.
const LANE_KIND_GLYPHS: Record<LaneFieldKind, string> = {
  labels: 'bookmark',
  number: 'cube',
  date: 'calendar',
  choice: 'star',
  checkbox: 'task',
  card: 'person',
  text: 'note',
};

// A field lane's tile glyph: a Card field draws the type it links to (Parent, a project), any other its kind's.
function laneGlyph(f: LaneField, types: readonly ItemTypeDef[]): string {
  const linked =
    f.kind === 'card' && f.linkType ? types.find((t) => t.id === f.linkType) : undefined;
  return linked?.glyph ?? LANE_KIND_GLYPHS[f.kind];
}

// The Swimlanes grid: built in, then any field the shown card types offer, in one grid (one grouping each).
export function SwimlaneOptions({
  by,
  field,
  types,
  allTypes,
  noNone,
  noStatus,
  palette,
  onPick,
}: {
  by: SwimlaneBy;
  field: string | undefined;
  // The card types the board or chart shows: only what they offer is listed.
  types: readonly ItemTypeDef[];
  // Every type of the document, to name a field in use that the shown types no longer offer.
  allTypes?: readonly ItemTypeDef[];
  // Leaves out None (Cards by Field always groups).
  noNone?: boolean;
  // Leaves out Status: a board's columns are its statuses (every board but All Cards), so rows by status would
  // repeat them (docs/specs/026-plan/plan-board.md "Swimlanes"). A Gantt chart keeps it.
  noStatus?: boolean;
  // The board's colours (Setup Board), else the menu's.
  palette?: PlanPalette;
  // A built-in grouping (no field), or a field's id with `field`.
  onPick: (by: SwimlaneBy, field?: string) => void;
}) {
  // The fields the shown types offer, and the one in use (from every type) when they no longer offer it.
  const lanes = laneFieldsOf(types);
  if (by === 'field' && field && !lanes.some((f) => f.id === field)) {
    const kept = laneFieldsOf(allTypes ?? types).find((f) => f.id === field);
    if (kept) lanes.push(kept);
  }
  // What the shown types offer, and the grouping in use even when they no longer offer it; then the fields.
  const built = SWIMLANE_BY.filter(
    (s) =>
      s !== 'field' &&
      !(noNone && s === 'none') &&
      !(noStatus && s === 'status') &&
      (s === by || swimlaneGroupingsFor(types).includes(s)),
  );
  const FIELD = 'field:';
  return (
    <OptionRows
      kind="single"
      label="Group Rows By"
      palette={palette}
      className={palette ? '' : 'mx-3 my-1.5'}
      selected={by === 'field' && field ? `${FIELD}${field}` : by}
      rows={[
        ...built.map((s) => ({
          id: s,
          label: SWIMLANE_LABELS[s],
          icon: <PlanTypeGlyph glyph={ROW_GLYPHS[s]} size={16} />,
        })),
        ...lanes.map((f) => ({
          id: `${FIELD}${f.id}`,
          label: f.label,
          icon: <PlanTypeGlyph glyph={laneGlyph(f, allTypes ?? types)} size={16} />,
        })),
      ]}
      onPick={(id) =>
        id.startsWith(FIELD) ? onPick('field', id.slice(FIELD.length)) : onPick(id as SwimlaneBy)
      }
    />
  );
}

// A row per card type, ticked when `selected` holds it; a press toggles it, and the last one ticked cannot be let go
// (at least one type stays on) unless `allowNone`. `onChange` gets the new list, in catalogue order.
export function CardTypeOptions({
  types,
  selected,
  allowNone = false,
  onChange,
}: {
  types: readonly ItemTypeDef[];
  selected: readonly string[];
  // A board may turn its last type off (it then adds one with Add New Card Type); a view keeps one on.
  allowNone?: boolean;
  onChange: (next: string[]) => void;
}) {
  return (
    <OptionRows
      kind="multiple"
      label="Card Types"
      className="mx-3 my-1.5"
      selected={selected}
      rows={types.map((t) => ({
        id: t.id,
        label: t.label,
        icon: (
          <span className={ACCENT_TEXT} style={accentVars(t.color)}>
            <PlanTypeGlyph glyph={t.glyph} size={16} />
          </span>
        ),
      }))}
      onPick={(id) => {
        const on = selected.includes(id);
        // At least one type stays on: pressing the last one changes nothing.
        const last =
          !allowNone && on && selected.filter((x) => types.some((t) => t.id === x)).length <= 1;
        if (last) return;
        onChange(types.map((x) => x.id).filter((x) => (x === id ? !on : selected.includes(x))));
      }}
    />
  );
}

// A small info block under a menu heading: what the choices below it do, in a line (an "i" in a circle, then the text).
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="note"
      className="mx-3 mb-1 mt-1 flex gap-1.5 rounded-md bg-brand-50 px-2 py-1.5 text-[11px] leading-snug text-brand-800 dark:bg-brand-500/10 dark:text-brand-200"
    >
      <span
        aria-hidden
        className="mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-current text-[9px] font-bold"
      >
        <span className="text-optical-centre">i</span>
      </span>
      <span>{children}</span>
    </p>
  );
}

const SIZE_LABELS: Record<CardSize, string> = {
  minimal: 'Minimal',
  compact: 'Compact',
  detailed: 'Detailed',
};

// A board's Card Size as three rows (absent is Detailed): its Card Layout and Setup Board's Layout step both set it.
export function CardSizeOptions({
  size,
  palette,
  onPick,
}: {
  size: CardSize | undefined;
  palette?: PlanPalette;
  onPick: (size: CardSize) => void;
}) {
  return (
    <OptionRows
      kind="single"
      label="Card Size"
      palette={palette}
      className={palette ? '' : 'mx-3 my-1.5'}
      selected={size ?? 'detailed'}
      rows={CARD_SIZES.map((z) => ({
        id: z,
        label: SIZE_LABELS[z],
        icon: <CardSizeArt size={z} />,
      }))}
      onPick={(z) => onPick(z as CardSize)}
    />
  );
}
