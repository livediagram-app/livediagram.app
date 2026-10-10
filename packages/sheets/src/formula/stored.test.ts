import { describe, expect, it } from 'vitest';
import {
  compileFormula,
  formatPosRef,
  formulaReadsSheet,
  mapFormulaRefs,
  quoteSheet,
  renderFormula,
  resolveRef,
  shiftForCopy,
  storedAst,
  type SheetHandle,
  type SheetsCtx,
} from './stored';
import type { SheetLayout } from '../sheet';

function layout(rows: number, cols: number, tag: string): SheetLayout {
  return {
    rows: Array.from({ length: rows }, (_, i) => `${tag}r${i}`),
    cols: Array.from({ length: cols }, (_, i) => `${tag}c${i}`),
  };
}

function ctxOf(own: SheetHandle, others: SheetHandle[] = []): SheetsCtx {
  const all = [own, ...others];
  return {
    own,
    byTitle: (t) => all.find((s) => s.title.toLowerCase() === t.toLowerCase()),
    byId: (id) => all.find((s) => s.id === id),
  };
}

const own: SheetHandle = { id: 'own000', title: 'Sheet 1', layout: layout(10, 5, 'a') };
const budget: SheetHandle = { id: 'bud000', title: 'Budget', layout: layout(10, 5, 'b') };
const ctx = ctxOf(own, [budget]);

function compile(text: string, c = ctx) {
  const r = compileFormula(text, c);
  if (!r.ok) throw new Error(r.reason);
  return r.formula;
}

describe('compile and render', () => {
  it('stores ids and renders A1 back, as typed', () => {
    const f = compile('=SUM( A1:$B$2 ) + Budget!C3*2');
    expect(f.t).toBe('SUM( @0 ) + @1*2');
    expect(f.r[0]).toEqual({ r1: 'ar0', c1: 'ac0', r2: 'ar1', c2: 'ac1', a: 12 });
    expect(f.r[1]).toEqual({ s: 'bud000', r1: 'br2', c1: 'bc2' });
    expect(renderFormula(f, ctx)).toBe('=SUM( A1:$B$2 ) + Budget!C3*2');
  });
  it('follows rows that move, and titles that change', () => {
    const f = compile('=A3+Budget!A1');
    const moved: SheetHandle = {
      ...own,
      layout: { ...own.layout, rows: ['new', ...own.layout.rows] },
    };
    const renamed: SheetHandle = { ...budget, title: 'Q3 Costs' };
    expect(renderFormula(f, ctxOf(moved, [renamed]))).toBe("=A4+'Q3 Costs'!A1");
  });
  it('makes #REF! for deleted cells, gone sheets and off-grid refs', () => {
    const f = compile('=A3+Budget!A1+Z99');
    expect(f.t).toBe('@0+@1+#REF!');
    const deleted: SheetHandle = {
      ...own,
      layout: { ...own.layout, rows: own.layout.rows.filter((r) => r !== 'ar2') },
    };
    expect(renderFormula(f, ctxOf(deleted))).toBe('=#REF!+#REF!+#REF!');
    expect(compile('=Budget!A99').t).toBe('#REF!');
  });
  it('keeps references to titles no sheet has, by position', () => {
    const f = compile('=Later!B2:C3');
    expect(f.r[0]).toEqual({ st: 'Later', p: [1, 1, 2, 2] });
    expect(renderFormula(f, ctx)).toBe('=Later!B2:C3');
    const later: SheetHandle = { id: 'lat000', title: 'later', layout: layout(5, 5, 'l') };
    const pos = resolveRef(f.r[0]!, ctxOf(own, [later]));
    expect(pos).toMatchObject({ sheet: { id: 'lat000' }, r1: 1, c2: 2 });
    expect(renderFormula(f, ctxOf(own, [later]))).toBe('=later!B2:C3');
  });
  it('treats its own title as its own sheet', () => {
    expect(compile("='Sheet 1'!A1").r[0]).toEqual({ r1: 'ar0', c1: 'ac0' });
  });
  it('stores columns, rows, open ranges and spills', () => {
    const f = compile('=SUM(A:B)+SUM(2:3)+SUM(A2:A)+B2#');
    expect(f.r).toEqual([
      { c1: 'ac0', c2: 'ac1' },
      { r1: 'ar1', r2: 'ar2' },
      { r1: 'ar1', c1: 'ac0', c2: 'ac0', open: 'r' },
      { r1: 'ar1', c1: 'ac1', spill: true },
    ]);
    expect(renderFormula(f, ctx)).toBe('=SUM(A:B)+SUM(2:3)+SUM(A2:A)+B2#');
  });
  it('passes parse failures through', () => {
    expect(compileFormula('=(1', ctx)).toMatchObject({
      ok: false,
      reason: 'missing_close_bracket',
    });
  });
  it('quotes sheet names that need it', () => {
    expect(quoteSheet('Budget')).toBe('Budget');
    expect(quoteSheet('Q3 Costs')).toBe("'Q3 Costs'");
    expect(quoteSheet("Bob's")).toBe("'Bob''s'");
    expect(quoteSheet('AB12')).toBe("'AB12'");
    expect(formatPosRef({ sheet: { id: 'gone' }, a: 0, r1: 0, c1: 0 }, ctx)).toBe('#REF!');
  });
});

describe('copy shift and rewrites', () => {
  it('moves relative parts, keeps absolute ones', () => {
    const f = compile('=A1+$A$1+A$1+$A1+SUM(A1:B2)');
    expect(renderFormula(shiftForCopy(f, 2, 1, ctx), ctx)).toBe('=B3+$A$1+B$1+$A3+SUM(B3:C4)');
  });
  it('makes #REF! when shifted off the grid', () => {
    expect(renderFormula(shiftForCopy(compile('=A1'), -1, 0, ctx), ctx)).toBe('=#REF!');
  });
  it('lands on the destination sheet', () => {
    const other: SheetHandle = { id: 'oth000', title: 'Other', layout: layout(10, 5, 'o') };
    const to = ctxOf(other, [own, budget]);
    const g = shiftForCopy(compile('=A1+Budget!A1'), 0, 0, ctx, to);
    expect(g.r[0]).toEqual({ r1: 'or0', c1: 'oc0' });
    expect(g.r[1]).toEqual({ s: 'bud000', r1: 'br0', c1: 'bc0' });
    // A reference into the destination becomes its own.
    const h = shiftForCopy(
      compile('=Other!A1', ctxOf(own, [other])),
      0,
      0,
      ctxOf(own, [other]),
      to,
    );
    expect(h.r[0]).toEqual({ r1: 'or0', c1: 'oc0' });
    // A deleted source cell stays #REF!.
    const gone = { ...own, layout: { ...own.layout, rows: [] } };
    expect(shiftForCopy(compile('=A1'), 0, 0, ctxOf(gone)).t).toBe('#REF!');
  });
  it('maps references and keeps identity when nothing changes', () => {
    const f = compile('=A1+B1');
    expect(mapFormulaRefs(f, (r) => r)).toBe(f);
    const g = mapFormulaRefs(f, (r) => (r.c1 === 'ac0' ? null : r));
    expect(g).toEqual({ t: '#REF!+@0', r: [{ r1: 'ar0', c1: 'ac1' }] });
  });
  it('caches the template tree and reads sheets', () => {
    const f = compile('=Budget!A1+A1');
    expect(storedAst(f)).toBe(storedAst(f));
    expect(storedAst({ t: '(((', r: [] })).toBeNull();
    expect(formulaReadsSheet(f, 'own000', 'bud000')).toBe(true);
    expect(formulaReadsSheet(compile('=A1'), 'own000', 'bud000')).toBe(false);
    expect(formulaReadsSheet(compile('=A1'), 'own000', 'own000')).toBe(true);
  });
});
