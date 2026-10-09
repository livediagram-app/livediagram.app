// The sheets of one tab and their values (blueprint sheets-engine.md "Workbook and recalculation"). Values are
// worked out on demand and kept; a change forgets only the cells that read it, directly or through others, plus
// the volatile ones. Long chains of references never overflow the stack: past a depth the deep cell is worked
// out first, from the top, and the read is tried again.
import type { CardSource } from '../cards';
import { serialFromMs } from '../dates';
import { formatA1 } from '../address';
import { layoutIndex, posRangeOf } from '../layout';
import { nameHome } from '../range-names';
import { RECALC_READS_MAX } from '../limits';
import { cellKey, type Sheet } from '../sheet';
import { CARD_FUNCTION_NAMES } from '../formula/registry';
import { callsOf } from '../formula/ast';
import { storedAst, type SheetHandle, type SheetsCtx } from '../formula/stored';
import {
  dims,
  err,
  isArray,
  scalarOf,
  type Scalar,
  type Value,
  type ValueArray,
} from '../formula/values';
import { Dependencies } from './dependencies';
import { evaluate } from './evaluate';
import { deref } from '../formula/fn';
import type { Frame, RangeRef } from './frame';
import { maySpill } from './spill-shape';

export type WorkbookOptions = {
  sheets: readonly Sheet[];
  locale: string;
  // Today and now in the viewer's local time, as a serial.
  now?: () => number;
  rand?: () => number;
  cards?: CardSource | null;
};

const DEPTH_MAX = 250;

class Deep {
  readonly id: string;
  constructor(id: string) {
    this.id = id;
  }
}

function localNow(): number {
  const now = new Date();
  return serialFromMs(now.getTime() - now.getTimezoneOffset() * 60_000);
}

type Claim = { sheetId: string; r1: number; c1: number; r2: number; c2: number };

export class Workbook {
  readonly locale: string;
  private readonly sheets = new Map<string, Sheet>();
  private cards: CardSource | null;
  private readonly nowFn: () => number;
  private readonly randFn: () => number;
  // Worked-out formula values, by cell id (`sheetId|rowId:colId`).
  private readonly vals = new Map<string, Value>();
  private readonly deps = new Dependencies();
  private readonly volatileCells = new Set<string>();
  private readonly cardReaders = new Set<string>();
  // Spills: owner -> its rectangle; sheetId -> "r,c" -> owner.
  private readonly claimOf = new Map<string, Claim>();
  private readonly claimed = new Map<string, Map<string, string>>();
  // Formulas that may spill, per sheet, and whether all of them have been worked out.
  private readonly spillers = new Map<string, Set<string>>();
  private readonly spillersReady = new Set<string>();
  private readonly extents = new Map<string, { rows: number; cols: number }>();
  private readonly ctxs = new Map<string, SheetsCtx>();
  private readonly computing = new Set<string>();
  private readonly stack: string[] = [];
  private depth = 0;
  private reads = 0;
  // Formulas worked out after one read ran past RECALC_READS_MAX: their value is that read's
  // "too large" error, not their own, so the next read works them out afresh.
  private readonly overBudget = new Set<string>();
  // Raised on every change, so views know to read again.
  version = 0;
  truncated = false;

  constructor(opts: WorkbookOptions) {
    this.locale = opts.locale;
    this.cards = opts.cards ?? null;
    this.nowFn = opts.now ?? localNow;
    this.randFn = opts.rand ?? Math.random;
    for (const s of opts.sheets) this.sheets.set(s.id, s);
    this.reindexAll();
  }

  // ---- The sheets ---------------------------------------------------------------------------------------

  sheet(id: string): Sheet | undefined {
    return this.sheets.get(id);
  }

  sheetList(): Sheet[] {
    return [...this.sheets.values()];
  }

  // A sheet's cells changed (`keys`, as cellKey), or anything else about it when `keys` is undefined (its layout,
  // its title, a new sheet): then everything is worked out afresh, since positions and names may have moved.
  updateSheet(sheet: Sheet, keys?: readonly string[]): void {
    const before = this.sheets.get(sheet.id);
    this.sheets.set(sheet.id, sheet);
    this.version++;
    if (!before || !keys || before.layout !== sheet.layout || before.title !== sheet.title) {
      this.resetAll();
      return;
    }
    this.extents.delete(sheet.id);
    this.ctxs.clear();
    const changed: string[] = [];
    for (const key of keys) {
      const id = `${sheet.id}|${key}`;
      this.indexSpiller(sheet, key);
      changed.push(id);
    }
    this.invalidate([...changed, ...this.volatileCells]);
  }

  removeSheet(id: string): void {
    if (!this.sheets.delete(id)) return;
    this.version++;
    this.resetAll();
  }

  setCards(cards: CardSource | null): void {
    this.cards = cards;
    this.version++;
    this.invalidate([...this.cardReaders]);
  }

  // TODAY and NOW move on: forget every volatile cell.
  tick(): void {
    if (this.volatileCells.size === 0) return;
    this.version++;
    this.invalidate([...this.volatileCells]);
  }

  // ---- Reading ------------------------------------------------------------------------------------------

  // A cell's value by position: its input, its formula's value (the top left of an array), or the value a spill
  // puts there.
  value(sheetId: string, r: number, c: number): Value {
    for (;;) {
      try {
        if (this.depth === 0) this.startRead();
        return scalarCell(this.cellValue(sheetId, r, c, null));
      } catch (e) {
        if (!(e instanceof Deep)) throw e;
        this.settle(e.id);
      }
    }
  }

  // A fresh top-level read: its own budget, and the formulas the last one cut short forgotten.
  private startRead(): void {
    this.reads = 0;
    if (this.overBudget.size === 0) return;
    for (const id of this.overBudget) {
      this.vals.delete(id);
      // A spill it claimed goes with it, and its sheet's spills are worked out again.
      if (this.releaseClaim(id)) this.spillersReady.delete(id.slice(0, id.indexOf('|')));
    }
    this.overBudget.clear();
  }

  // The whole array a formula gives (its spill), or its value.
  formulaResult(sheetId: string, r: number, c: number): Value {
    const id = this.idAt(sheetId, r, c);
    if (!id) return null;
    this.value(sheetId, r, c);
    return this.vals.get(id) ?? null;
  }

  // The formula cell whose spill covers (r, c), as positions, when it is not the cell itself.
  spillOwnerAt(sheetId: string, r: number, c: number): { r: number; c: number } | null {
    this.value(sheetId, r, c);
    const owner = this.claimed.get(sheetId)?.get(`${r},${c}`);
    if (!owner) return null;
    const claim = this.claimOf.get(owner)!;
    return claim.r1 === r && claim.c1 === c ? null : { r: claim.r1, c: claim.c1 };
  }

  // How far a sheet is filled (positions + 1).
  extent(sheetId: string): { rows: number; cols: number } {
    let e = this.extents.get(sheetId);
    if (!e) {
      const sheet = this.sheets.get(sheetId);
      e = { rows: 0, cols: 0 };
      if (sheet) {
        const ix = layoutIndex(sheet.layout);
        for (const [key, cell] of sheet.cells) {
          if (!cell.input) continue;
          const i = key.indexOf(':');
          const r = ix.rowPos.get(key.slice(0, i));
          const c = ix.colPos.get(key.slice(i + 1));
          if (r === undefined || c === undefined) continue;
          if (r + 1 > e.rows) e.rows = r + 1;
          if (c + 1 > e.cols) e.cols = c + 1;
        }
      }
      this.extents.set(sheetId, e);
    }
    return e;
  }

  // Whether any formula on the tab reads Plan cards (so the editor loads the items).
  usesCards(): boolean {
    for (const sheet of this.sheets.values())
      for (const cell of sheet.cells.values()) {
        const f = cell.input && 'f' in cell.input ? cell.input.f : null;
        if (!f) continue;
        const ast = storedAst(f);
        if (ast && [...callsOf(ast)].some((n) => CARD_FUNCTION_NAMES.has(n))) return true;
      }
    return false;
  }

  ctxFor(sheetId: string): SheetsCtx {
    let ctx = this.ctxs.get(sheetId);
    if (!ctx) {
      const handle = (s: Sheet): SheetHandle => ({ id: s.id, title: s.title, layout: s.layout });
      const own = this.sheets.get(sheetId);
      const list = [...this.sheets.values()].sort((a, b) => a.createdAt - b.createdAt);
      ctx = {
        own: own ? handle(own) : { id: sheetId, title: '', layout: { rows: [], cols: [] } },
        byTitle: (t) => {
          const lower = t.toLowerCase();
          const s = list.find((x) => x.title.toLowerCase() === lower);
          return s ? handle(s) : undefined;
        },
        byId: (id) => {
          const s = this.sheets.get(id);
          return s ? handle(s) : undefined;
        },
        name: (name) => {
          const home = nameHome(name, own, list);
          const at = home && posRangeOf(home.sheet.layout, home.range);
          return home && at ? { sheet: { id: home.sheet.id }, ...at, a: 15 } : null;
        },
      };
      this.ctxs.set(sheetId, ctx);
    }
    return ctx;
  }

  // ---- Internals ----------------------------------------------------------------------------------------

  private idAt(sheetId: string, r: number, c: number): string | null {
    const sheet = this.sheets.get(sheetId);
    const rowId = sheet?.layout.rows[r];
    const colId = sheet?.layout.cols[c];
    return rowId && colId ? `${sheetId}|${rowId}:${colId}` : null;
  }

  private settle(id: string): void {
    const pending = [id];
    while (pending.length > 0) {
      const top = pending[pending.length - 1]!;
      try {
        this.compute(top);
        pending.pop();
      } catch (e) {
        if (!(e instanceof Deep)) throw e;
        const from = pending.indexOf(e.id);
        if (from >= 0) {
          // A chain deeper than DEPTH_MAX that comes back to a cell already restarted is a loop the
          // stack cannot see whole: each of its restarted cells is a circular reference. Their
          // dependencies were noted before the restart, so an edit breaking the loop still reaches them.
          const loop = pending.splice(from);
          const value = err('#REF!', `Circular reference: ${this.describeLoop(loop, e.id)}`);
          for (const cell of loop) this.vals.set(cell, value);
          continue;
        }
        pending.push(e.id);
      }
    }
  }

  private cellValue(sheetId: string, r: number, c: number, reader: string | null): Value {
    const sheet = this.sheets.get(sheetId);
    const rowId = sheet?.layout.rows[r];
    const colId = sheet?.layout.cols[c];
    if (!sheet || !rowId || !colId) return null;
    const key = cellKey(rowId, colId);
    const id = `${sheetId}|${key}`;
    if (reader) this.deps.noteCell(reader, id);
    const input = sheet.cells.get(key)?.input;
    if (input) {
      if ('n' in input) return input.n;
      if ('s' in input) return input.s;
      if ('b' in input) return input.b;
      return this.compute(id);
    }
    return this.spilledAt(sheetId, r, c);
  }

  private spilledAt(sheetId: string, r: number, c: number): Value {
    this.ensureSpillers(sheetId, r, c);
    const owner = this.claimed.get(sheetId)?.get(`${r},${c}`);
    if (!owner) return null;
    const claim = this.claimOf.get(owner)!;
    const arr = this.vals.get(owner);
    if (!arr || !isArray(arr)) return null;
    return arr.rows[r - claim.r1]?.[c - claim.c1] ?? null;
  }

  // Work out the formulas that could spill over (r, c): those at or above and to its left. Once every spiller of a
  // sheet is worked out the sheet is ready, and empty cells read their claims straight away.
  private ensureSpillers(sheetId: string, r: number, c: number): void {
    if (this.spillersReady.has(sheetId)) return;
    const set = this.spillers.get(sheetId);
    const sheet = this.sheets.get(sheetId);
    if (!set || !sheet) {
      this.spillersReady.add(sheetId);
      return;
    }
    const ix = layoutIndex(sheet.layout);
    let all = true;
    for (const id of set) {
      if (this.vals.has(id)) continue;
      const key = id.slice(id.indexOf('|') + 1);
      const colon = key.indexOf(':');
      const r0 = ix.rowPos.get(key.slice(0, colon));
      const c0 = ix.colPos.get(key.slice(colon + 1));
      if (r0 === undefined || c0 === undefined) continue;
      if (r0 > r || c0 > c || this.computing.has(id)) {
        all = false;
        continue;
      }
      this.compute(id);
    }
    if (all && this.computing.size === 0) this.spillersReady.add(sheetId);
  }

  private compute(id: string): Value {
    const known = this.vals.get(id);
    if (known !== undefined) return known;
    if (this.computing.has(id)) {
      const from = this.stack.indexOf(id);
      return err('#REF!', `Circular reference: ${this.describeLoop(this.stack.slice(from), id)}`);
    }
    if (this.depth >= DEPTH_MAX) throw new Deep(id);
    const bar = id.indexOf('|');
    const sheetId = id.slice(0, bar);
    const key = id.slice(bar + 1);
    const sheet = this.sheets.get(sheetId);
    const input = sheet?.cells.get(key)?.input;
    if (!sheet || !input || !('f' in input)) return null;
    const ix = layoutIndex(sheet.layout);
    const colon = key.indexOf(':');
    const row = ix.rowPos.get(key.slice(0, colon)) ?? 0;
    const col = ix.colPos.get(key.slice(colon + 1)) ?? 0;
    this.deps.clear(id);
    this.volatileCells.delete(id);
    this.cardReaders.delete(id);
    this.releaseClaim(id);
    this.computing.add(id);
    this.stack.push(id);
    this.depth++;
    let value: Value;
    try {
      const ast = storedAst(input.f);
      if (!ast) value = err('#ERROR!');
      else {
        const frame = this.frame(id, sheetId, row, col);
        value = deref(evaluate(ast, input.f.r, frame), frame);
      }
    } finally {
      this.depth--;
      this.stack.pop();
      this.computing.delete(id);
    }
    if (isArray(value)) value = this.claim(id, sheet, row, col, value);
    this.vals.set(id, value);
    if (this.reads > RECALC_READS_MAX) this.overBudget.add(id);
    return value;
  }

  private claim(id: string, sheet: Sheet, row: number, col: number, value: ValueArray): Value {
    const d = dims(value);
    if (d.rows === 0 || d.cols === 0) return err('#N/A', 'The result is empty');
    if (d.rows === 1 && d.cols === 1) return scalarOf(value.rows[0]![0]!);
    // A spill reads its whole rectangle, so filling or emptying a cell in it re-works the spill.
    this.deps.noteRange(id, sheet.id, row, col, row + d.rows - 1, col + d.cols - 1);
    if (row + d.rows > sheet.layout.rows.length || col + d.cols > sheet.layout.cols.length)
      return err('#SPILL!', 'The result runs past the edge of the sheet');
    const claimed = this.claimed.get(sheet.id) ?? new Map<string, string>();
    for (let i = 0; i < d.rows; i++)
      for (let j = 0; j < d.cols; j++) {
        if (i === 0 && j === 0) continue;
        const r = row + i;
        const c = col + j;
        const key = cellKey(sheet.layout.rows[r]!, sheet.layout.cols[c]!);
        const other = claimed.get(`${r},${c}`);
        if (sheet.cells.get(key)?.input || (other && other !== id)) {
          return err('#SPILL!', `The result would overwrite ${formatA1(r, c)}`);
        }
      }
    const readers = new Set<string>();
    for (let i = 0; i < d.rows; i++)
      for (let j = 0; j < d.cols; j++) {
        claimed.set(`${row + i},${col + j}`, id);
        if (i === 0 && j === 0) continue;
        const r = row + i;
        const c = col + j;
        const cellId = `${sheet.id}|${cellKey(sheet.layout.rows[r]!, sheet.layout.cols[c]!)}`;
        this.deps.readersOf(cellId, sheet.id, r, c, readers);
      }
    this.claimed.set(sheet.id, claimed);
    this.claimOf.set(id, {
      sheetId: sheet.id,
      r1: row,
      c1: col,
      r2: row + d.rows - 1,
      c2: col + d.cols - 1,
    });
    // Whatever read these cells as empty before the spill reached them reads again.
    readers.delete(id);
    if (readers.size > 0) this.invalidate([...readers]);
    return value;
  }

  private releaseClaim(id: string): Claim | undefined {
    const claim = this.claimOf.get(id);
    if (!claim) return undefined;
    const claimed = this.claimed.get(claim.sheetId);
    for (let r = claim.r1; r <= claim.r2; r++)
      for (let c = claim.c1; c <= claim.c2; c++)
        if (claimed?.get(`${r},${c}`) === id) claimed.delete(`${r},${c}`);
    this.claimOf.delete(id);
    return claim;
  }

  private frame(id: string, sheetId: string, row: number, col: number): Frame {
    return {
      sheetId,
      row,
      col,
      ctx: this.ctxFor(sheetId),
      locale: this.locale,
      cell: (s, r, c, inRange) => this.cellValue(s, r, c, inRange ? null : id),
      extent: (s) => this.extent(s),
      isFormula: (s, r, c) => {
        const sh = this.sheets.get(s);
        const rowId = sh?.layout.rows[r];
        const colId = sh?.layout.cols[c];
        const input = rowId && colId ? sh!.cells.get(cellKey(rowId, colId))?.input : undefined;
        return !!input && 'f' in input;
      },
      grid: (s) => {
        const sh = this.sheets.get(s);
        return sh ? { rows: sh.layout.rows.length, cols: sh.layout.cols.length } : undefined;
      },
      spillOf: (s, r, c): RangeRef | null => {
        const ownerId = this.idAt(s, r, c);
        if (!ownerId) return null;
        this.cellValue(s, r, c, id);
        const claim = this.claimOf.get(ownerId);
        return claim ? { ...claim } : null;
      },
      noteRange: (range) =>
        this.deps.noteRange(id, range.sheetId, range.r1, range.c1, range.r2, range.c2),
      spend: (n) => {
        this.reads += n;
        if (this.reads > RECALC_READS_MAX) {
          this.truncated = true;
          return false;
        }
        return true;
      },
      now: this.nowFn,
      rand: this.randFn,
      cards: this.cards,
      volatile: () => this.volatileCells.add(id),
      readsCards: () => this.cardReaders.add(id),
    };
  }

  // Forget the given cells' values and, transitively, every value that read them.
  private invalidate(ids: readonly string[]): void {
    const queue = [...ids];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const id = queue.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      // A cell being worked out right now gets its fresh value anyway.
      if (this.computing.has(id)) continue;
      const bar = id.indexOf('|');
      const sheetId = id.slice(0, bar);
      const key = id.slice(bar + 1);
      if (this.vals.delete(id)) this.spillersReady.delete(sheetId);
      const claim = this.releaseClaim(id);
      const sheet = this.sheets.get(sheetId);
      if (!sheet) continue;
      const readers = new Set<string>();
      const ix = layoutIndex(sheet.layout);
      const colon = key.indexOf(':');
      const r = ix.rowPos.get(key.slice(0, colon));
      const c = ix.colPos.get(key.slice(colon + 1));
      if (r !== undefined && c !== undefined) this.deps.readersOf(id, sheetId, r, c, readers);
      if (r !== undefined && c !== undefined) {
        // A cell inside someone's spill: the spill's owner is re-worked (it may now be blocked).
        const owner = this.claimed.get(sheetId)?.get(`${r},${c}`);
        if (owner && owner !== id) readers.add(owner);
      }
      if (claim) {
        // Everything that read the spilled cells reads again.
        for (let rr = claim.r1; rr <= claim.r2; rr++)
          for (let cc = claim.c1; cc <= claim.c2; cc++) {
            const cellId = this.idAt(sheetId, rr, cc);
            if (cellId) this.deps.readersOf(cellId, sheetId, rr, cc, readers);
          }
      }
      for (const x of readers) if (!seen.has(x)) queue.push(x);
    }
  }

  private resetAll(): void {
    this.vals.clear();
    this.deps.reset();
    this.volatileCells.clear();
    this.cardReaders.clear();
    this.claimOf.clear();
    this.claimed.clear();
    this.extents.clear();
    this.ctxs.clear();
    this.spillersReady.clear();
    this.overBudget.clear();
    this.truncated = false;
    this.reindexAll();
  }

  private reindexAll(): void {
    this.spillers.clear();
    for (const sheet of this.sheets.values())
      for (const key of sheet.cells.keys()) this.indexSpiller(sheet, key);
  }

  private indexSpiller(sheet: Sheet, key: string): void {
    const id = `${sheet.id}|${key}`;
    let set = this.spillers.get(sheet.id);
    const input = sheet.cells.get(key)?.input;
    const ast = input && 'f' in input ? storedAst(input.f) : null;
    if (input && 'f' in input && ast && maySpill(ast, input.f.r)) {
      if (!set) {
        set = new Set();
        this.spillers.set(sheet.id, set);
      }
      set.add(id);
      this.spillersReady.delete(sheet.id);
    } else {
      set?.delete(id);
    }
  }

  private describeLoop(path: string[], back: string): string {
    const names = [...path, back].map((id) => {
      const bar = id.indexOf('|');
      const sheet = this.sheets.get(id.slice(0, bar));
      const key = id.slice(bar + 1);
      const colon = key.indexOf(':');
      if (!sheet) return '?';
      const ix = layoutIndex(sheet.layout);
      const r = ix.rowPos.get(key.slice(0, colon));
      const c = ix.colPos.get(key.slice(colon + 1));
      return r === undefined || c === undefined ? '?' : formatA1(r, c);
    });
    return names.join(' → ');
  }
}

function scalarCell(v: Value): Scalar {
  return isArray(v) ? scalarOf(v) : v;
}
