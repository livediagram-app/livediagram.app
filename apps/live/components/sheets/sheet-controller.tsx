'use client';

// One Sheet's working state (docs/specs/029-sheets/sheet.md "The grid", "Selection", "Editing"), shared by its
// parts through context: the selection, the cell being edited and its draft, the grid's scroll and size, the menu
// open over it, and the write helper every command goes through. Lives inside MaximisableSlot, so maximising and
// restoring keep all of it.
import type { SheetChartKind } from './sheet-charts';
import type { IdRange } from '@livediagram/sheets';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  filteredOutRows,
  single,
  type GridRange,
  type Selection,
  type Sheet,
  type SheetLayout,
  type SheetWrite,
  type Workbook,
} from '@livediagram/sheets';
import { track } from '@/lib/telemetry';
import { useLatest } from '@/hooks/ui/useLatest';
import type { PlanPalette } from '@/components/plan/plan-palette';
import type { SheetStore } from './sheet-store-client';
import { geometryOf, mergeAt, type Geometry } from './sheet-geometry';
import { useFollowLayout } from './useFollowLayout';
import type { Grid } from '@livediagram/sheets';
import type { SheetChangeKind } from '@livediagram/api-schema';

export type { SheetChangeKind } from '@livediagram/api-schema';

export type Editing = {
  r: number;
  c: number;
  draft: string;
  // Where the edit began: typing over the cell, Enter/F2/double-click in it, or the formula bar.
  origin: 'type' | 'cell' | 'bar';
};

export type OpenMenu =
  | { kind: 'cell'; x: number; y: number }
  | { kind: 'header'; axis: 'r' | 'c'; index: number; x: number; y: number }
  | { kind: 'filter'; colId: string; x: number; y: number }
  | { kind: 'sort' }
  | null;

export type SheetController = {
  store: SheetStore;
  sheet: Sheet;
  workbook: Workbook;
  version: number;
  geometry: Geometry;
  grid: Grid;
  palette: PlanPalette;
  interactive: boolean;
  canEdit: boolean;
  maximised: boolean;
  locale: string;
  selection: Selection;
  setSelection: (s: Selection) => void;
  focused: boolean;
  setFocused: (focused: boolean) => void;
  // The selection as last set, for event handlers: a key pressed in the frame after a drag's last move runs
  // before that move's render, so the render's `selection` can be one step behind.
  selectionNow: () => Selection;
  // Where a run of entries committed with Tab began, so Enter returns to that column on the next row (as Sheets
  // and Excel do). Any other move ends the run.
  tabRun: () => { r: number; c: number } | null;
  setTabRun: (start: { r: number; c: number } | null) => void;
  editing: Editing | null;
  setEditing: (e: Editing | null) => void;
  scroll: { top: number; left: number };
  setScroll: (s: { top: number; left: number }) => void;
  view: { width: number; height: number };
  setView: (v: { width: number; height: number }) => void;
  // The copied (or cut) range's dashed outline.
  marquee: { range: GridRange; cut: boolean } | null;
  setMarquee: (m: { range: GridRange; cut: boolean } | null) => void;
  menu: OpenMenu;
  setMenu: (m: OpenMenu) => void;
  findOpen: 'find' | 'replace' | null;
  // Find's matches, highlighted on the grid while it is open.
  findHits: readonly { r: number; c: number }[];
  setFindHits: (hits: readonly { r: number; c: number }[]) => void;
  setFindOpen: (f: 'find' | 'replace' | null) => void;
  // Send a write and count it; false when it was refused (said in a toast).
  write: (w: SheetWrite, kind: SheetChangeKind) => boolean;
  writeAll: (
    edits: readonly { sheetId: string; write: SheetWrite }[],
    kind: SheetChangeKind,
  ) => boolean;
  // The grid's focusable frame (held as state through a callback ref), so commands can hand focus back.
  gridEl: HTMLDivElement | null;
  setGridEl: (el: HTMLDivElement | null) => void;
  focusGrid: () => void;
  announce: (message: string) => void;
  toast: (message: string) => void;
  notify: (message: string) => void;
  // Place a chart reading `range` over the Sheet (sheet-charts.ts).
  placeChart?: (kind: SheetChartKind, range: IdRange) => void;
};

const SheetControllerContext = createContext<SheetController | null>(null);

export const SheetControllerProvider = SheetControllerContext.Provider;

export function useSheetController(): SheetController {
  const c = useContext(SheetControllerContext);
  if (!c) throw new Error('useSheetController outside a Sheet');
  return c;
}

// Each sheet's last selection this session, so a remounted Sheet opens where it was.
const KEPT_SELECTIONS = new Map<string, Selection>();
const KEPT_SELECTIONS_MAX = 200;

function keptSelection(sheetId: string, layout: SheetLayout): Selection {
  const kept = KEPT_SELECTIONS.get(sheetId);
  if (!kept) return single({ r: 0, c: 0 });
  const rows = layout.rows.length;
  const cols = layout.cols.length;
  const inside =
    kept.ranges.every((g) => g.r2 < rows && g.c2 < cols) &&
    kept.active.r < rows &&
    kept.active.c < cols;
  if (KEPT_SELECTIONS.size > KEPT_SELECTIONS_MAX) KEPT_SELECTIONS.clear();
  return inside ? kept : single({ r: 0, c: 0 });
}

export function useSheetControllerState(opts: {
  store: SheetStore;
  sheet: Sheet;
  workbook: Workbook;
  version: number;
  palette: PlanPalette;
  interactive: boolean;
  canEdit: boolean;
  maximised: boolean;
  locale: string;
  announce: (message: string) => void;
  toast: (message: string) => void;
  notify: (message: string) => void;
  placeChart?: (kind: SheetChartKind, range: IdRange) => void;
  // After this person's own write to this sheet lands locally (card tables push it to the cards).
  onWrote?: (before: Sheet, write: SheetWrite) => void;
}): SheetController {
  const { store, sheet, workbook, version } = opts;
  const onWrote = useLatest(opts.onWrote);
  // The selection outlives the element's tree for the session (a mode switch, maximising, a remount), as a
  // spreadsheet tab keeps its place; within the grid's bounds.
  const [selection, setSelectionState] = useState<Selection>(() =>
    keptSelection(sheet.id, sheet.layout),
  );
  const liveSelection = useRef(selection);
  const sheetId = sheet.id;
  const setSelection = useCallback(
    (s: Selection) => {
      liveSelection.current = s;
      KEPT_SELECTIONS.set(sheetId, s);
      setSelectionState(s);
    },
    [sheetId],
  );
  // Whether the grid (or its editor, formula bar or menus) has the keys: an unfocused Sheet's selection is drawn
  // quieter, so with several on a tab the one being worked in stands out.
  const [focused, setFocused] = useState(false);
  const selectionNow = useCallback(() => liveSelection.current, []);
  const tabStart = useRef<{ r: number; c: number } | null>(null);
  const tabRun = useCallback(() => tabStart.current, []);
  const setTabRun = useCallback((start: { r: number; c: number } | null) => {
    tabStart.current = start;
  }, []);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [view, setView] = useState({ width: 0, height: 0 });
  const [marquee, setMarquee] = useState<{ range: GridRange; cut: boolean } | null>(null);
  const [menu, setMenu] = useState<OpenMenu>(null);
  const [findOpen, setFindOpen] = useState<'find' | 'replace' | null>(null);
  const [findHits, setFindHits] = useState<readonly { r: number; c: number }[]>([]);
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  // A layout change this person made keeps their selection where it is (as a spreadsheet's Insert does); only
  // someone else's moves it.
  const ownLayout = useRef(false);
  const takeOwnLayout = useCallback(() => {
    const own = ownLayout.current;
    ownLayout.current = false;
    return own;
  }, []);
  useFollowLayout({
    layout: sheet.layout,
    editing,
    setEditing,
    selectionNow,
    setSelection,
    toast: opts.toast,
    takeOwnLayout,
  });
  // Rows the filter hides are drawn at no height; worked out again whenever a value may have changed.
  const filtered = useMemo(
    () => (sheet.layout.filter ? filteredOutRows(workbook, sheet.id) : new Set<string>()),
    [workbook, sheet.id, sheet.layout.filter, version], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const geometry = useMemo(() => geometryOf(sheet.layout, filtered), [sheet.layout, filtered]);
  const grid = useMemo<Grid>(() => {
    const ix = { rows: sheet.layout.rows.length, cols: sheet.layout.cols.length };
    return {
      rows: ix.rows,
      cols: ix.cols,
      hiddenRow: geometry.hiddenRow,
      hiddenCol: geometry.hiddenCol,
      filled: (r, c) => {
        const v = workbook.value(sheet.id, r, c);
        return v !== null && v !== '';
      },
      mergeAt: (r, c) => mergeAt(geometry, r, c),
    };
  }, [sheet.layout, geometry, workbook, sheet.id]);
  const write = useCallback(
    (w: SheetWrite, kind: SheetChangeKind) => {
      const before = store.sheet(sheet.id);
      const refused = store.write(sheet.id, w);
      if (refused) return false;
      if (w.kind === 'layout') ownLayout.current = true;
      track('Sheet', 'Changed', kind);
      if (before) onWrote.current?.(before, w);
      return true;
    },
    [store, sheet.id, onWrote],
  );
  // Writes to several sheets as one change, one undo step (Insert Cells, a cut other sheets' formulas follow).
  const writeAll = useCallback(
    (edits: readonly { sheetId: string; write: SheetWrite }[], kind: SheetChangeKind) => {
      const before = store.sheet(sheet.id);
      const refused = store.writeAll(edits);
      if (refused) return false;
      if (edits.some((e) => e.write.kind === 'layout' && e.sheetId === sheet.id))
        ownLayout.current = true;
      track('Sheet', 'Changed', kind);
      if (before)
        for (const e of edits) if (e.sheetId === sheet.id) onWrote.current?.(before, e.write);
      return true;
    },
    [store, sheet.id, onWrote],
  );
  const focusGrid = useCallback(() => gridEl?.focus({ preventScroll: true }), [gridEl]);
  return {
    ...opts,
    geometry,
    grid,
    selection,
    setSelection,
    focused,
    setFocused,
    selectionNow,
    tabRun,
    setTabRun,
    editing,
    setEditing,
    scroll,
    setScroll,
    view,
    setView,
    marquee,
    setMarquee,
    menu,
    setMenu,
    findOpen,
    findHits,
    setFindHits,
    setFindOpen,
    write,
    writeAll,
    gridEl,
    setGridEl,
    focusGrid,
  };
}
