// What a plan's last seen copy keeps beyond the shared copy, and which first tabs paint from it
// (docs/specs/006-project/offline-mode.md "Warm open of a cloud project").
import { describe, expect, it } from 'vitest';
import type { ItemStoreState } from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import type { SheetJson } from '@liveplanner/sheets';
import type { LastSeenCopy } from '@liveworkspace/workbench/lib/api/last-seen-copies';
import {
  PLAN_COPY_MAX_CARDS,
  PLAN_COPY_MAX_CELLS,
  cardsForCopy,
  dashboardShownTabs,
  planCopyPaints,
  refsForCopy,
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

// A Dashboard first tab's tiles draw other tabs' bodies: the copy keeps them, and the Dashboard paints only when
// every slot can draw from it.
describe('a Dashboard first tab', () => {
  const cards = storeOf(2);
  const slot = (id: string, content: object) => ({ id, span: 4, content });
  const tabOf = (id: string, kind: string) =>
    ({ id, name: id, kind, elements: [{ id: `${id}-el` }] }) as unknown as Tab;
  function dashCopy(slots: object[], item: Partial<PlanCopyItem> = {}) {
    const c = copy('dashboard', {
      cards,
      tabs: [{ id: 't1' }, { id: 'b1' }, { id: 's1' }, { id: 'f1' }] as never,
      ...item,
    });
    (c.firstTab!.tab as { dashboard?: unknown }).dashboard = {
      rows: [{ id: 'r1', height: 300, slots }],
    };
    return c;
  }
  const boardSlot = slot('a', { type: 'tab', tabId: 'b1' });
  const sheetSlot = slot('b', { type: 'tab', tabId: 's1' });
  const keptSheet = { tabId: 's1', sheets: [] };

  it('names the tabs its tiles show, once each, in slot order', () => {
    const c = dashCopy([boardSlot, sheetSlot, slot('c', { type: 'tab', tabId: 'b1' })]);
    expect(dashboardShownTabs(c.firstTab!.tab as never)).toEqual(['b1', 's1']);
    expect(dashboardShownTabs({ kind: 'board' })).toEqual([]);
    expect(dashboardShownTabs({ kind: 'dashboard' })).toEqual([]);
  });

  it('keeps the shown tabs and their sheets up to the cell cap together, and none past it or after a capped read', () => {
    const tabs = [tabOf('b1', 'board')];
    const half = PLAN_COPY_MAX_CELLS / 2;
    const a = { tabId: 's1', sheets: [sheetOf('x', 's1', half)] };
    const b = { tabId: 's2', sheets: [sheetOf('y', 's2', half)] };
    expect(refsForCopy(tabs, [a, b])).toEqual({ tabs, sheets: [a, b] });
    expect(
      refsForCopy(tabs, [a, { tabId: 's2', sheets: [sheetOf('y', 's2', half + 1)] }]),
    ).toBeNull();
    expect(refsForCopy(tabs, [a, null])).toBeNull();
  });

  it('paints its tab tiles from the kept tabs, a Sheet with its sheets', () => {
    const refs = { tabs: [tabOf('b1', 'board'), tabOf('s1', 'sheet')], sheets: [keptSheet] };
    expect(planCopyPaints(dashCopy([boardSlot, sheetSlot], { refs }))).toBe(true);
    // A Dashboard of other slots needs no kept tabs.
    expect(planCopyPaints(dashCopy([slot('n', { type: 'note', text: 'Hi' })]))).toBe(true);
  });

  it('waits when a shown tab is not kept, or a Sheet without its sheets', () => {
    expect(planCopyPaints(dashCopy([boardSlot]))).toBe(false);
    expect(planCopyPaints(dashCopy([boardSlot], { refs: null }))).toBe(false);
    const noSheet = { tabs: [tabOf('b1', 'board'), tabOf('s1', 'sheet')], sheets: [] };
    expect(planCopyPaints(dashCopy([boardSlot, sheetSlot], { refs: noSheet }))).toBe(false);
    const noBoard = { tabs: [tabOf('s1', 'sheet')], sheets: [keptSheet] };
    expect(planCopyPaints(dashCopy([boardSlot, sheetSlot], { refs: noBoard }))).toBe(false);
  });

  it('waits on a tile naming a Form tab, a Sheet Metric or a Form Metric', () => {
    const refs = { tabs: [tabOf('f1', 'form')], sheets: [] };
    expect(planCopyPaints(dashCopy([slot('f', { type: 'tab', tabId: 'f1' })], { refs }))).toBe(
      false,
    );
    const sheetMetric = slot('m', { type: 'sheet-metric', metric: 'figure', sheetId: 'sh1' });
    expect(planCopyPaints(dashCopy([sheetMetric]))).toBe(false);
    const formMetric = slot('m', { type: 'form-metric', metric: 'responses', formTabId: 'f1' });
    expect(planCopyPaints(dashCopy([formMetric]))).toBe(false);
  });

  it('paints a tile whose tab was deleted, as it says so', () => {
    const gone = slot('g', { type: 'tab', tabId: 'gone' });
    expect(planCopyPaints(dashCopy([gone]))).toBe(true);
  });
});

describe('warmPlanOf', () => {
  it('hands the stores what the copy kept, null for each it has none of', () => {
    const cards = storeOf(1);
    expect(warmPlanOf(copy('board', { cards }))).toEqual({ cards, sheets: [], refTabs: [] });
    expect(warmPlanOf(copy('board'))).toEqual({ cards: null, sheets: [], refTabs: [] });
  });

  it("hands every kept sheets list, the first tab's and the shown tabs', and the shown tabs' bodies", () => {
    const first = { tabId: 't1', sheets: [] };
    const shown = { tabId: 's1', sheets: [] };
    const tab = { id: 's1', name: 'Budget', kind: 'sheet', elements: [] } as unknown as Tab;
    expect(
      warmPlanOf(copy('dashboard', { sheets: first, refs: { tabs: [tab], sheets: [shown] } })),
    ).toEqual({ cards: null, sheets: [first, shown], refTabs: [tab] });
  });
});
