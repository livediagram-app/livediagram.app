'use client';

// The visible cells (docs/specs/029-sheets/sheet.md "The grid"): four regions (the frozen corner, the frozen
// rows, the frozen columns and the scrolling body), each drawing only its window of rows and columns. Text runs
// over empty neighbours to its right; numbers too wide for their column show fewer decimals, then scientific,
// then ####. Memoised on what it draws, so moving the selection redraws none of it.
import { memo, type CSSProperties } from 'react';
import { resolveFontStack } from '@livediagram/document';
import {
  cellKey,
  displayValue,
  isPending,
  numberText,
  type Border,
  type CellFormat,
  type Sheet,
  type Value,
  type Workbook,
} from '@livediagram/sheets';
import type { PlanPalette } from '@/components/plan/plan-palette';
import { cellBox, mergeAt, type Geometry, type GridWindow } from './sheet-geometry';

const CELL_PAD = 4;
const BASE_PX = 13;
const ERROR_INK = '#dc2626';

export function fontPx(f: CellFormat | undefined): number {
  return f?.fs ? Math.round((f.fs * 4) / 3) : BASE_PX;
}

// A rough text width (no layout pass per cell): average glyph advance of about 0.58em, digits a touch less.
export function roughWidth(text: string, px: number): number {
  let w = 0;
  for (const ch of text) w += /[0-9.,]/.test(ch) ? 0.55 : ch === ' ' ? 0.28 : 0.6;
  return w * px;
}

// A number that does not fit: fewer significant digits (Automatic), then scientific, then ####.
export function fitNumber(
  text: string,
  value: number,
  f: CellFormat | undefined,
  width: number,
  px: number,
): string {
  const room = width - CELL_PAD * 2;
  if (roughWidth(text, px) <= room) return text;
  if (!f?.nf || f.nf === 'auto') {
    for (let digits = 10; digits >= 2; digits--) {
      const t = numberText(Number(value.toPrecision(digits)));
      if (roughWidth(t, px) <= room) return t;
    }
    const sci = value.toExponential(1).replace('e+', 'E+').replace('e-', 'E-');
    if (roughWidth(sci, px) <= room) return sci;
  }
  return '#'.repeat(Math.max(1, Math.floor(room / (px * 0.6))));
}

function borderCss(b: Border | undefined): string | undefined {
  return b ? `${b.w}px ${b.s} ${b.c}` : undefined;
}

type CellsProps = {
  sheet: Sheet;
  workbook: Workbook;
  version: number;
  geometry: Geometry;
  window: GridWindow;
  scroll: { top: number; left: number };
  palette: PlanPalette;
  locale: string;
  fontFamily?: string;
  // Columns whose cells keep room at their right for a dropdown arrow (a card table's set-value columns).
  padEnd?: ReadonlySet<string>;
};

// The room a dropdown column keeps at its cells' right, so its arrow never covers the value.
export const DROPDOWN_PAD_PX = 22;

type Region = { r1: number; r2: number; c1: number; c2: number; clip: CSSProperties };

function shownValue(v: Value): { text: string; pending: boolean } {
  return isPending(v) ? { text: 'Loading…', pending: true } : { text: '', pending: false };
}

function RegionCells({ region, ...p }: CellsProps & { region: Region }) {
  const { sheet, workbook, geometry: g, scroll, palette, locale } = p;
  const { rows, cols } = sheet.layout;
  const showGrid = sheet.layout.showGrid !== false;
  const out: React.ReactNode[] = [];
  for (let r = region.r1; r <= region.r2; r++) {
    if (g.hiddenRow(r)) continue;
    // Each row's text runs right over empty cells; `width` is how far the current run reaches.
    for (let c = region.c1; c <= region.c2; c++) {
      if (g.hiddenCol(c)) continue;
      const m = mergeAt(g, r, c);
      if (m && (m.r1 !== r || m.c1 !== c)) continue;
      const key = cellKey(rows[r]!, cols[c]!);
      const cell = sheet.cells.get(key);
      const f = cell?.format;
      const value = workbook.value(sheet.id, r, c);
      const box = cellBox(g, r, c, scroll, m);
      const shown = displayValue(value, f, locale);
      const pending = shownValue(value);
      const px = fontPx(f);
      let text = pending.pending ? pending.text : shown.text;
      if (shown.kind === 'number' && typeof value === 'number')
        text = fitNumber(
          text,
          value,
          f,
          box.w - (p.padEnd?.has(cols[c]!) ? DROPDOWN_PAD_PX : 0),
          px,
        );
      const align = f?.ha ?? (pending.pending ? 'l' : shown.align);
      const wrap = f?.wr ?? 'o';
      // Overflow: left-aligned text with empty cells to its right runs into them (not past the window).
      let width = box.w;
      if (text && wrap === 'o' && align === 'l' && !m && shown.kind === 'text') {
        const need = roughWidth(text, px) + CELL_PAD * 2;
        for (let k = c + 1; k <= region.c2 && width < need; k++) {
          if (g.hiddenCol(k)) continue;
          const next = workbook.value(sheet.id, r, k);
          if (next !== null || mergeAt(g, r, k)) break;
          width += g.cols[k + 1]! - g.cols[k]!;
        }
      }
      const style: CSSProperties = {
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        backgroundColor: f?.bg ?? (m ? palette.surface : undefined),
      };
      out.push(
        <div
          key={key}
          className="absolute box-border border-b border-r"
          // Gridlines, unless the sheet hides them (Sheet Settings): then only fills and set borders show.
          style={{ ...style, borderColor: showGrid ? palette.cardBorder : 'transparent' }}
        />,
      );
      if (f && (f.bt || f.br || f.bb || f.bl))
        out.push(
          <div
            key={`${key}b`}
            className="pointer-events-none absolute box-border"
            style={{
              left: box.x - 1,
              top: box.y - 1,
              width: box.w + 1,
              height: box.h + 1,
              borderTop: borderCss(f.bt),
              borderRight: borderCss(f.br),
              borderBottom: borderCss(f.bb),
              borderLeft: borderCss(f.bl),
              zIndex: 2,
            }}
          />,
        );
      if (!text) continue;
      const deco = [f?.u ? 'underline' : '', f?.st ? 'line-through' : ''].filter(Boolean).join(' ');
      out.push(
        <div
          key={`${key}t`}
          data-sheet-text
          className={`pointer-events-none absolute flex px-1 ${wrap === 'w' ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'} ${
            wrap === 'c' || width === box.w ? 'overflow-hidden' : ''
          }`}
          style={{
            left: box.x,
            top: box.y,
            width,
            height: box.h,
            zIndex: 1,
            fontSize: px,
            ...(p.padEnd?.has(cols[c]!) ? { paddingRight: DROPDOWN_PAD_PX } : {}),
            lineHeight: `${Math.round(px * 1.3)}px`,
            // The cell's own font; unset (or one no longer offered), the sheet's.
            fontFamily: resolveFontStack(f?.ff),
            fontWeight: f?.b ? 700 : undefined,
            fontStyle: f?.i ? 'italic' : undefined,
            textDecoration: deco || undefined,
            // A value still waiting on the cards reads quietly, never as an error.
            color: pending.pending
              ? palette.muted
              : shown.kind === 'error'
                ? ERROR_INK
                : (f?.fc ?? palette.text),
            justifyContent: align === 'r' ? 'flex-end' : align === 'c' ? 'center' : 'flex-start',
            // Middle unless the cell says otherwise.
            alignItems: f?.va === 't' ? 'flex-start' : f?.va === 'b' ? 'flex-end' : 'center',
            paddingBottom: f?.va === 'b' ? 3 : 0,
            textAlign: align === 'r' ? 'right' : align === 'c' ? 'center' : 'left',
          }}
        >
          {text}
        </div>,
      );
    }
  }
  // The clip box sits at its pane's corner; the cells inside are placed from the grid's own origin.
  const left = Number(region.clip.left ?? 0);
  const top = Number(region.clip.top ?? 0);
  return (
    <div className="pointer-events-none absolute overflow-hidden" style={region.clip}>
      <div className="absolute" style={{ left: -left, top: -top }}>
        {out}
      </div>
    </div>
  );
}

function SheetCellsInner(props: CellsProps) {
  const { geometry: g, window: w } = props;
  const fr = g.frozenRows;
  const fc = g.frozenCols;
  const regions: Region[] = [
    // Body first, frozen panes over it.
    {
      r1: w.r1,
      r2: w.r2,
      c1: w.c1,
      c2: w.c2,
      clip: { left: g.frozenWidth, top: g.frozenHeight, right: 0, bottom: 0 },
    },
  ];
  if (fr > 0)
    regions.push({
      r1: 0,
      r2: fr - 1,
      c1: w.c1,
      c2: w.c2,
      clip: { left: g.frozenWidth, top: 0, right: 0, height: g.frozenHeight },
    });
  if (fc > 0)
    regions.push({
      r1: w.r1,
      r2: w.r2,
      c1: 0,
      c2: fc - 1,
      clip: { left: 0, top: g.frozenHeight, bottom: 0, width: g.frozenWidth },
    });
  if (fr > 0 && fc > 0)
    regions.push({
      r1: 0,
      r2: fr - 1,
      c1: 0,
      c2: fc - 1,
      clip: { left: 0, top: 0, width: g.frozenWidth, height: g.frozenHeight },
    });
  return (
    <div
      className="absolute inset-0"
      style={props.fontFamily ? { fontFamily: props.fontFamily } : undefined}
    >
      {regions.map((region, i) => (
        <RegionCells key={i} {...props} region={region} />
      ))}
      {/* The frozen edges: a thicker line, dragged to change the freeze (SheetHeaders). */}
      {fr > 0 ? (
        <div
          className="pointer-events-none absolute left-0 right-0"
          style={{
            top: g.frozenHeight - 1,
            height: 2,
            backgroundColor: props.palette.border,
            zIndex: 3,
          }}
        />
      ) : null}
      {fc > 0 ? (
        <div
          className="pointer-events-none absolute bottom-0 top-0"
          style={{
            left: g.frozenWidth - 1,
            width: 2,
            backgroundColor: props.palette.border,
            zIndex: 3,
          }}
        />
      ) : null}
    </div>
  );
}

export const SheetCells = memo(SheetCellsInner);
