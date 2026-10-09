// Formulas as stored (blueprint sheets-engine.md "Stored form"): references point at row and column ids (and
// other sheets at their id), so inserting, moving and sorting rows never rewrites a cell, and a write sent before
// someone else's layout change still lands where its writer meant. People see and type A1; this file converts.
import { columnLetters } from '../address';
import { layoutIndex } from '../layout';
import type { SheetLayout, StoredFormula, StoredRef } from '../sheet';
import type { A1Ref, Node } from './ast';
import { parseFormula, type ParseFailure } from './parse';
import { refsOf } from './ast';
import { tokenize } from './tokens';

export type SheetHandle = { id: string; title: string; layout: SheetLayout };

// Where a formula lives and the sheets it can name (the tab's).
export type SheetsCtx = {
  own: SheetHandle;
  byTitle(title: string): SheetHandle | undefined;
  byId(id: string): SheetHandle | undefined;
  // A named range by name, as the formula's sheet reads it (formulas.md "Named ranges"); null when it reads none.
  name?(name: string): PosRef | null;
};

// A reference as positions in its target sheet. `sheet` null is the formula's own sheet.
export type PosRef = {
  sheet: { id: string } | { title: string } | null;
  r1?: number;
  c1?: number;
  r2?: number;
  c2?: number;
  a: number;
  open?: 'r' | 'c';
  spill?: true;
};

const REF_ERROR = '#REF!';

export function sheetNeedsQuotes(title: string): boolean {
  return !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(title) || /^[A-Za-z]{1,4}[0-9]+$/.test(title);
}

export function quoteSheet(title: string): string {
  return sheetNeedsQuotes(title) ? `'${title.replace(/'/g, "''")}'` : title;
}

function targetOf(ref: { sheet: PosRef['sheet'] }, ctx: SheetsCtx): SheetHandle | undefined {
  if (ref.sheet === null) return ctx.own;
  if ('id' in ref.sheet) return ctx.byId(ref.sheet.id);
  return ctx.byTitle(ref.sheet.title);
}

function a1ToPos(ref: A1Ref, ctx: SheetsCtx): PosRef {
  let sheet: PosRef['sheet'] = null;
  if (ref.sheet !== undefined) {
    const h = ctx.byTitle(ref.sheet);
    sheet = h ? (h.id === ctx.own.id ? null : { id: h.id }) : { title: ref.sheet };
  }
  const out: PosRef = { sheet, a: ref.a };
  if (ref.r1 !== undefined) out.r1 = ref.r1;
  if (ref.c1 !== undefined) out.c1 = ref.c1;
  if (ref.r2 !== undefined) out.r2 = ref.r2;
  if (ref.c2 !== undefined) out.c2 = ref.c2;
  if (ref.open) out.open = ref.open;
  if (ref.spill) out.spill = true;
  return out;
}

// Positions to ids in the target's layout; null when a part lies past the grid (it becomes #REF!).
export function encodeRef(pos: PosRef, ctx: SheetsCtx): StoredRef | null {
  const out: StoredRef = {};
  if (pos.a) out.a = pos.a;
  if (pos.open) out.open = pos.open;
  if (pos.spill) out.spill = true;
  if (pos.sheet && 'title' in pos.sheet) {
    out.st = pos.sheet.title;
    out.p = [pos.r1 ?? -1, pos.c1 ?? -1, pos.r2 ?? -1, pos.c2 ?? -1];
    if ([pos.r1, pos.c1, pos.r2, pos.c2].some((v) => v !== undefined && v < 0)) return null;
    return out;
  }
  const target = targetOf(pos, ctx);
  if (!target) return null;
  if (pos.sheet) out.s = pos.sheet.id;
  const { rows, cols } = target.layout;
  const pick = (list: string[], v: number | undefined): string | undefined | null =>
    v === undefined ? undefined : v >= 0 && v < list.length ? list[v]! : null;
  const r1 = pick(rows, pos.r1);
  const c1 = pick(cols, pos.c1);
  const r2 = pick(rows, pos.r2);
  const c2 = pick(cols, pos.c2);
  if (r1 === null || c1 === null || r2 === null || c2 === null) return null;
  if (r1 !== undefined) out.r1 = r1;
  if (c1 !== undefined) out.c1 = c1;
  if (r2 !== undefined) out.r2 = r2;
  if (c2 !== undefined) out.c2 = c2;
  return out;
}

// Ids to positions in the target's current layout; null when the reference reads #REF! (its sheet is gone or a
// cell it names was deleted). A range with one corner gone is null too: deleting rows shrinks ranges in the
// write itself (store.ts), so a stored range never keeps a dead corner on its own sheet.
export function resolveRef(ref: StoredRef, ctx: SheetsCtx): PosRef | null {
  const base = {
    a: ref.a ?? 0,
    ...(ref.open ? { open: ref.open } : {}),
    ...(ref.spill ? { spill: true as const } : {}),
  };
  if (ref.st !== undefined) {
    const p = ref.p ?? [-1, -1, -1, -1];
    const h = ctx.byTitle(ref.st);
    const out: PosRef = { sheet: h ? { id: h.id } : { title: ref.st }, ...base };
    if (p[0] >= 0) out.r1 = p[0];
    if (p[1] >= 0) out.c1 = p[1];
    if (p[2] >= 0) out.r2 = p[2];
    if (p[3] >= 0) out.c2 = p[3];
    return out;
  }
  const sheet = ref.s === undefined || ref.s === ctx.own.id ? null : { id: ref.s };
  const target = sheet ? ctx.byId(sheet.id) : ctx.own;
  if (!target) return null;
  const ix = layoutIndex(target.layout);
  const out: PosRef = { sheet, ...base };
  const parts: [keyof PosRef, string | undefined, ReadonlyMap<string, number>][] = [
    ['r1', ref.r1, ix.rowPos],
    ['c1', ref.c1, ix.colPos],
    ['r2', ref.r2, ix.rowPos],
    ['c2', ref.c2, ix.colPos],
  ];
  for (const [key, id, map] of parts) {
    if (id === undefined) continue;
    const pos = map.get(id);
    if (pos === undefined) return null;
    (out as Record<string, unknown>)[key] = pos;
  }
  return out;
}

function partText(r: number | undefined, c: number | undefined, absR: boolean, absC: boolean) {
  return `${c === undefined ? '' : `${absC ? '$' : ''}${columnLetters(c)}`}${
    r === undefined ? '' : `${absR ? '$' : ''}${r + 1}`
  }`;
}

export function formatPosRef(pos: PosRef, ctx: SheetsCtx): string {
  let prefix = '';
  if (pos.sheet) {
    const title = 'title' in pos.sheet ? pos.sheet.title : ctx.byId(pos.sheet.id)?.title;
    if (title === undefined) return REF_ERROR;
    prefix = `${quoteSheet(title)}!`;
  }
  const a = pos.a;
  const first = partText(pos.r1, pos.c1, !!(a & 1), !!(a & 2));
  let text = first;
  const hasSecond = pos.r2 !== undefined || pos.c2 !== undefined;
  if (hasSecond) text += `:${partText(pos.r2, pos.c2, !!(a & 4), !!(a & 8))}`;
  return `${prefix}${text}${pos.spill ? '#' : ''}`;
}

export type CompileResult =
  { ok: true; formula: StoredFormula; ast: Node } | { ok: false; reason: ParseFailure; at: number };

// A typed formula (`=...`) to its stored form, against the tab's sheets.
export function compileFormula(text: string, ctx: SheetsCtx): CompileResult {
  const parsed = parseFormula(text);
  if (!parsed.ok) return parsed;
  const refs = refsOf(parsed.ast);
  const body = text.startsWith('=') ? 1 : 0;
  let t = '';
  let at = body;
  const r: StoredRef[] = [];
  for (const ref of refs) {
    t += text.slice(at, ref.start);
    const stored = encodeRef(a1ToPos(ref, ctx), ctx);
    if (stored) {
      t += `@${r.length}`;
      r.push(stored);
    } else {
      t += REF_ERROR;
    }
    at = ref.end;
  }
  t += text.slice(at);
  return { ok: true, formula: { t, r }, ast: parsed.ast };
}

// The formula as A1 text (with its `=`) from the current layouts and titles.
export function renderFormula(stored: StoredFormula, ctx: SheetsCtx): string {
  let out = '=';
  for (const tok of tokenize(stored.t, 0, true)) {
    if (tok.k === 'stored') {
      const ref = stored.r[Number(tok.v)];
      const pos = ref ? resolveRef(ref, ctx) : null;
      out += pos ? formatPosRef(pos, ctx) : REF_ERROR;
    } else {
      out += stored.t.slice(tok.start, tok.end);
    }
  }
  return out;
}

const AST_CACHE = new WeakMap<StoredFormula, Node | null>();

// The template's tree, parsed once per stored formula (stored formulas are never mutated). Null when the template
// cannot be read (only a hand-made or corrupted one): it evaluates to #ERROR!.
export function storedAst(stored: StoredFormula): Node | null {
  let ast = AST_CACHE.get(stored);
  if (ast === undefined) {
    const parsed = parseFormula(stored.t, true);
    ast = parsed.ok ? parsed.ast : null;
    AST_CACHE.set(stored, ast);
  }
  return ast;
}

// Rewrite each reference of a formula; `fn` returns the new reference, or null for #REF!. Returns the same object
// when nothing changed.
export function mapFormulaRefs(
  stored: StoredFormula,
  fn: (ref: StoredRef) => StoredRef | null,
): StoredFormula {
  let changed = false;
  const kept: (StoredRef | null)[] = stored.r.map((ref) => {
    const next = fn(ref);
    if (next !== ref) changed = true;
    return next;
  });
  if (!changed) return stored;
  // Rebuild the template: dead references become #REF!, live ones are renumbered.
  let t = '';
  const r: StoredRef[] = [];
  for (const tok of tokenize(stored.t, 0, true)) {
    if (tok.k === 'stored') {
      const ref = kept[Number(tok.v)];
      if (ref) {
        t += `@${r.length}`;
        r.push(ref);
      } else {
        t += REF_ERROR;
      }
    } else {
      t += stored.t.slice(tok.start, tok.end);
    }
  }
  return { t, r };
}

// A formula copied `dr` rows and `dc` columns away (copy-paste, fill, Ctrl+Enter): relative parts move, absolute
// parts stay, and a part moved off the grid is #REF!. `from` resolves the source; `to` encodes at the destination
// (another sheet, when pasted there).
export function shiftForCopy(
  stored: StoredFormula,
  dr: number,
  dc: number,
  from: SheetsCtx,
  to: SheetsCtx = from,
): StoredFormula {
  return mapFormulaRefs(stored, (ref) => {
    const pos = resolveRef(ref, from);
    if (!pos) return null;
    const a = pos.a;
    const moved: PosRef = { ...pos };
    if (moved.r1 !== undefined && !(a & 1)) moved.r1 += dr;
    if (moved.c1 !== undefined && !(a & 2)) moved.c1 += dc;
    if (moved.r2 !== undefined && !(a & 4)) moved.r2 += dr;
    if (moved.c2 !== undefined && !(a & 8)) moved.c2 += dc;
    // The source's own sheet is the destination's own sheet.
    if (moved.sheet && 'id' in moved.sheet && moved.sheet.id === to.own.id) moved.sheet = null;
    const encoded = encodeRef(moved, to);
    return encoded ?? null;
  });
}

// Whether a formula reads any reference into `sheetId` (its own sheet when the formula is there).
export function formulaReadsSheet(stored: StoredFormula, ownId: string, sheetId: string): boolean {
  return stored.r.some((ref) => (ref.s ?? (ref.st === undefined ? ownId : undefined)) === sheetId);
}
