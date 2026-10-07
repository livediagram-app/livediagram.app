'use client';

// The parts the Plan element menus share (docs/specs/026-plan/plan-board.md "The board set-up", plan-views.md
// "Swimlanes"): a flyout group under a heading, the Swimlanes tile grid a board and a Gantt chart both set, and
// the card type tiles a board's Card Types and a Gantt chart's Card Types both press.
import type { ReactNode } from 'react';
import {
  SWIMLANE_BY,
  laneFieldsOf,
  swimlaneGroupingsFor,
  type ItemTypeDef,
  type LaneFieldKind,
  type SwimlaneBy,
} from '@livediagram/items';
import { MenuTile, MenuTileGrid } from '@/components/primitives/MenuTiles';
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
      {hint ? (
        <p className="px-3 pt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
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
  parent: 'project',
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

// The Swimlanes grid: built in, then any field the shown card types offer, in one grid (one grouping each).
export function SwimlaneTiles({
  by,
  field,
  types,
  allTypes,
  noNone,
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
  // A built-in grouping (no field), or a field's id with `field`.
  onPick: (by: SwimlaneBy, field?: string) => void;
}) {
  // The fields the shown types offer, and the one in use (from every type) when they no longer offer it.
  const lanes = laneFieldsOf(types);
  if (by === 'field' && field && !lanes.some((f) => f.id === field)) {
    const kept = laneFieldsOf(allTypes ?? types).find((f) => f.id === field);
    if (kept) lanes.push(kept);
  }
  return (
    <MenuTileGrid cols={3} fitRows>
      {/* What the shown types offer, and the grouping in use even when they no longer offer it. */}
      {SWIMLANE_BY.filter(
        (s) =>
          s !== 'field' &&
          !(noNone && s === 'none') &&
          (s === by || swimlaneGroupingsFor(types).includes(s)),
      ).map((s) => (
        <MenuTile
          key={s}
          icon={<PlanTypeGlyph glyph={ROW_GLYPHS[s]} size={16} />}
          label={SWIMLANE_LABELS[s]}
          active={by === s}
          onClick={() => onPick(s)}
        />
      ))}
      {lanes.map((f) => (
        <MenuTile
          key={f.id}
          icon={<PlanTypeGlyph glyph={LANE_KIND_GLYPHS[f.kind]} size={16} />}
          label={f.label}
          active={by === 'field' && field === f.id}
          onClick={() => onPick('field', f.id)}
        />
      ))}
    </MenuTileGrid>
  );
}

// A tile per card type, pressed when `selected` holds it; a press toggles it, and the last one pressed cannot be
// let go (at least one type stays on). `onChange` gets the new list, in catalogue order.
export function TypeToggleTiles({
  types,
  selected,
  onChange,
}: {
  types: readonly ItemTypeDef[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <MenuTileGrid cols={3} fitRows>
      {types.map((t) => {
        const on = selected.includes(t.id);
        // At least one type stays on. The last one keeps its pressed look (a disabled tile is dimmed, which read
        // as not selected); pressing it changes nothing.
        const last = on && selected.filter((id) => types.some((x) => x.id === id)).length <= 1;
        return (
          <MenuTile
            key={t.id}
            icon={
              <span className={ACCENT_TEXT} style={accentVars(t.color)}>
                <PlanTypeGlyph glyph={t.glyph} size={16} />
              </span>
            }
            label={t.label}
            active={on}
            onClick={() => {
              if (last) return;
              onChange(
                types.map((x) => x.id).filter((id) => (id === t.id ? !on : selected.includes(id))),
              );
            }}
          />
        );
      })}
    </MenuTileGrid>
  );
}
