'use client';

// What sits over the cells (docs/specs/029-sheets/sheet.md "Selection", "Writing formulas", "Filter",
// "Collaboration"): the selection's tint and border with its fill handle, the active cell, the copied range's dashed
// marquee, each peer's selection in their colour with their name, the references a formula being written names
// (in their colours), and the filter's buttons on its header row.
import { useEffect, useState } from 'react';
import { IDENTITY_FILL, identityVars } from '@livediagram/ui';
import type { GridRange, Selection } from '@livediagram/sheets';
import type { PlanPalette } from '@/components/plan/plan-palette';
import { cellBox, mergeAt, type Geometry } from './sheet-geometry';
import { FilterIcon } from './sheet-icons';

export const FILL_HANDLE_PX = 7;

// `highlight` tints the cells with no border (Find's matches).
// `labelAt` (a peer's selection): the label shows for PEER_TAG_MS after that time, then only while `labelHover`.
export type Outline = {
  range: GridRange;
  color: string;
  label?: string;
  labelAt?: number;
  labelHover?: boolean;
  thick?: boolean;
  dashed?: boolean;
  highlight?: boolean;
};

export const PEER_TAG_MS = 3_000;

// A peer's name tag: shown when they move, hidden after PEER_TAG_MS still, shown again on hover.
function PeerTag({
  text,
  color,
  at,
  hover,
}: {
  text: string;
  color: string;
  at?: number;
  hover?: boolean;
}) {
  const [quiet, setQuiet] = useState<number | null>(null);
  useEffect(() => {
    if (at === undefined) return;
    const left = at + PEER_TAG_MS - Date.now();
    const t = setTimeout(() => setQuiet(at), Math.max(0, left));
    return () => clearTimeout(t);
  }, [at]);
  if (at !== undefined && quiet === at && !hover) return null;
  return (
    <span
      className={`absolute -top-4 right-0 whitespace-nowrap rounded-sm px-1 text-[10px] font-medium leading-4 text-white ${IDENTITY_FILL}`}
      style={identityVars(color)}
    >
      {text}
    </span>
  );
}

type Props = {
  geometry: Geometry;
  scroll: { top: number; left: number };
  palette: PlanPalette;
  selection: Selection;
  showHandle: boolean;
  marquee: { range: GridRange; cut: boolean } | null;
  outlines: readonly Outline[];
  filter: { r: number; cols: { c: number; colId: string; active: boolean }[] } | null;
  // Drawn quieter while the Sheet does not have the keys (another Sheet on the tab is being worked in).
  quiet?: boolean;
  onFilterButton: ((colId: string, at: { x: number; y: number }) => void) | null;
};

function rectOf(g: Geometry, range: GridRange, scroll: { top: number; left: number }) {
  const a = cellBox(g, range.r1, range.c1, scroll);
  const b = cellBox(g, range.r2, range.c2, scroll, mergeAt(g, range.r2, range.c2));
  return { x: a.x, y: a.y, w: b.x + b.w - a.x, h: b.y + b.h - a.y };
}

export function fillHandleAt(g: Geometry, sel: Selection, scroll: { top: number; left: number }) {
  const range = sel.ranges[sel.ranges.length - 1]!;
  const r = rectOf(g, range, scroll);
  return { x: r.x + r.w, y: r.y + r.h };
}

export function SheetSelectionLayer({
  geometry: g,
  scroll,
  palette,
  selection,
  showHandle,
  marquee,
  outlines,
  filter,
  onFilterButton,
  quiet = false,
}: Props) {
  const ink = quiet ? palette.muted : palette.focus;
  const ranges = selection.ranges.map((range, i) => {
    const r = rectOf(g, range, scroll);
    const one = range.r1 === range.r2 && range.c1 === range.c2;
    return (
      <div
        key={`s${i}`}
        className="pointer-events-none absolute"
        style={{
          left: r.x,
          top: r.y,
          width: r.w,
          height: r.h,
          backgroundColor: one
            ? undefined
            : `color-mix(in srgb, ${ink} ${quiet ? 6 : 12}%, transparent)`,
          border: `1px solid ${ink}`,
          zIndex: 4,
        }}
      />
    );
  });
  const activeMerge = mergeAt(g, selection.active.r, selection.active.c);
  const a = cellBox(g, selection.active.r, selection.active.c, scroll, activeMerge);
  const handle = fillHandleAt(g, selection, scroll);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 4 }}>
      {ranges}
      <div
        className="pointer-events-none absolute"
        style={{
          left: a.x - 1,
          top: a.y - 1,
          width: a.w + 1,
          height: a.h + 1,
          border: `${quiet ? 1 : 2}px solid ${ink}`,
          zIndex: 5,
        }}
      />
      {showHandle ? (
        <div
          data-sheet-fill-handle
          className="pointer-events-none absolute"
          style={{
            left: handle.x - FILL_HANDLE_PX / 2,
            top: handle.y - FILL_HANDLE_PX / 2,
            width: FILL_HANDLE_PX,
            height: FILL_HANDLE_PX,
            backgroundColor: palette.focus,
            border: `1px solid ${palette.surface}`,
            zIndex: 6,
            cursor: 'crosshair',
          }}
        />
      ) : null}
      {marquee
        ? (() => {
            const r = rectOf(g, marquee.range, scroll);
            return (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: r.x,
                  top: r.y,
                  width: r.w,
                  height: r.h,
                  border: `2px dashed ${palette.focus}`,
                  zIndex: 5,
                }}
              />
            );
          })()
        : null}
      {outlines.map((o, i) => {
        const r = rectOf(g, o.range, scroll);
        return (
          <div
            key={`o${i}`}
            className="pointer-events-none absolute"
            style={{
              left: r.x,
              top: r.y,
              width: r.w,
              height: r.h,
              border: o.highlight
                ? undefined
                : `${o.thick ? 3 : 2}px ${o.dashed ? 'dashed' : 'solid'} ${o.color}`,
              backgroundColor: o.highlight
                ? `color-mix(in srgb, ${o.color} 35%, transparent)`
                : o.dashed
                  ? `color-mix(in srgb, ${o.color} 10%, transparent)`
                  : undefined,
              zIndex: 5,
            }}
          >
            {o.label ? (
              <PeerTag text={o.label} color={o.color} at={o.labelAt} hover={o.labelHover} />
            ) : null}
          </div>
        );
      })}
      {filter && onFilterButton
        ? filter.cols.map(({ c, colId, active }) => {
            const box = cellBox(g, filter.r, c, scroll);
            return (
              <button
                key={`f${colId}`}
                type="button"
                aria-label={`Filter column ${c + 1}`}
                className="pointer-events-auto absolute flex cursor-pointer items-center justify-center rounded-sm"
                style={{
                  left: box.x + box.w - 18,
                  top: box.y + (box.h - 16) / 2,
                  width: 16,
                  height: 16,
                  zIndex: 6,
                  backgroundColor: active ? palette.focus : palette.surface,
                  color: active ? '#ffffff' : palette.muted,
                  border: `1px solid ${palette.border}`,
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  onFilterButton(colId, { x: r.left, y: r.bottom + 2 });
                }}
              >
                <FilterIcon />
              </button>
            );
          })
        : null}
    </div>
  );
}
