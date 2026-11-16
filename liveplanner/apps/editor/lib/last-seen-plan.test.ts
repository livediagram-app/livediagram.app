// What a plan's last seen copy keeps beyond the shared copy, and which first tabs paint from it
// (docs/specs/006-project/offline-mode.md "Warm open of a cloud project").
import { describe, expect, it } from 'vitest';
import type { ItemStoreState } from '@liveplanner/items';
import type { SheetJson } from '@liveplanner/sheets';
import type { LastSeenCopy } from '@liveworkspace/workbench/lib/api/last-seen-copies';
import {
  PLAN_COPY_MAX_CARDS,
  PLAN_COPY_MAX_CELLS,
  cardsForCopy,
  planCopyPaints,
  sheetsForCopy,
  warmPlanOf,
  type PlanCopyItem,
} from './last-seen-plan';

const storeOf = (n: number): ItemStoreState =>
  ({
    items: Array.from({ length: n }, (_, i) => ({ id: `c${i}` })),
    rev: 3,
    nextKey: n + 1,
  }) as never;
const sheetOf = (id: string, tabId: string, cells: number): SheetJson =>
  ({ id, tabId, cells: Array.from({ length: cells }, () => ['A1', { v: 1 }]) }) as never;

function copy(kind: string | undefined, item: Partial<PlanCopyItem> = {}, firstId = 't1') {
  return {
    reader: 'u',
    itemId: 'p1',
    item: { id: 'p1', name: 'Plan', tabs: [], ...item },
    firstTab: { id: firstId, rev: 1, tab: { id: firstId, name: 'One', elements: [], kind } },
    via: null,
    access: { role: 'edit', isOwner: true, sessionShareCode: null, tabScope: null },
  } as unknown as LastSeenCopy<PlanCopyItem, unknown>;
}

describe('cardsForCopy', () => {
  it('keeps the store itself up to the cap, and none past it', () => {
    const at = storeOf(PLAN_COPY_MAX_CARDS);
    expect(cardsForCopy(at)).toBe(at);
    expect(cardsForCopy(storeOf(PLAN_COPY_MAX_CARDS + 1))).toBeNull();
  });
});

describe('sheetsForCopy', () => {
  it('keeps the sheets up to the cell cap across them, and none past it', () => {
    const half = PLAN_COPY_MAX_CELLS / 2;
    const kept = sheetsForCopy('t1', [sheetOf('s1', 't1', half), sheetOf('s2', 't1', half)]);
    expect(kept?.tabId).toBe('t1');
    expect(kept?.sheets.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(
      sheetsForCopy('t1', [sheetOf('s1', 't1', half), sheetOf('s2', 't1', half + 1)]),
    ).toBeNull();
  });
});

describe('planCopyPaints', () => {
  const cards = storeOf(2);
  const sheets = { tabId: 't1', sheets: [] };

  it('never paints a Form first tab, whatever the copy holds', () => {
    expect(planCopyPaints(copy('form', { cards, sheets }))).toBe(false);
  });

  it('paints a Board or Dashboard first tab only with cards kept', () => {
    for (const kind of ['board', 'dashboard']) {
      expect(planCopyPaints(copy(kind, { cards }))).toBe(true);
      expect(planCopyPaints(copy(kind, { cards: null }))).toBe(false);
      expect(planCopyPaints(copy(kind))).toBe(false);
    }
  });

  it("paints a Sheet first tab only with that tab's sheets kept", () => {
    expect(planCopyPaints(copy('sheet', { sheets }))).toBe(true);
    expect(planCopyPaints(copy('sheet', { sheets: { tabId: 't9', sheets: [] } }))).toBe(false);
    expect(planCopyPaints(copy('sheet', { sheets: null }))).toBe(false);
  });

  it('asks the same of any tab that draws the cards or a sheet', () => {
    const drawing = (elements: object[], item: Partial<PlanCopyItem>) => {
      const c = copy(undefined, item);
      (c.firstTab!.tab as { elements: object[] }).elements = elements;
      return planCopyPaints(c);
    };
    expect(drawing([{ planBoard: {} }], {})).toBe(false);
    expect(drawing([{ planCard: {} }], { cards })).toBe(true);
    expect(drawing([{ planView: {} }], {})).toBe(false);
    expect(drawing([{ planSheet: {} }], {})).toBe(false);
    expect(drawing([{ chartSource: {} }], { sheets })).toBe(true);
    expect(drawing([{ id: 'plain' }], {})).toBe(true);
  });

  it('paints any other first tab from its body, and nothing without a first tab', () => {
    expect(planCopyPaints(copy(undefined))).toBe(true);
    const bare = copy(undefined);
    delete (bare.firstTab!.tab as { elements?: unknown }).elements;
    expect(planCopyPaints(bare)).toBe(true);
    expect(planCopyPaints({ ...copy('board'), firstTab: null })).toBe(false);
  });
});

describe('warmPlanOf', () => {
  it('hands the stores what the copy kept, null for each it has none of', () => {
    const cards = storeOf(1);
    expect(warmPlanOf(copy('board', { cards }))).toEqual({ cards, sheets: null });
    expect(warmPlanOf(copy('board'))).toEqual({ cards: null, sheets: null });
  });
});
