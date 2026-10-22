import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livepages/vitest-config/cpu-time';
import type { ElementAction, Element, Tab } from '@livepages/document';
import type { PlanBoardSetup } from '@livepages/items';
import {
  actionsBoardIn,
  applyActionChanges,
  goneActionIds,
  placedActions,
  removeAction,
  restoreAction,
  unloadedTabIds,
} from './linked-actions';

// docs/specs/026-plan/linked-boards.md: the canvas half of the Actions board.
const action = (id: string, over: Partial<ElementAction> = {}): ElementAction => ({
  id,
  name: `Action ${id}`,
  description: '',
  assignee: { userId: 'u1', name: 'Sam' },
  teamId: null,
  assignerId: 'u1',
  assignerName: 'Sam',
  status: 'open',
  createdAt: 1,
  updatedAt: 1,
  ...over,
});
const shape = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    type: 'shape',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    label: id,
    ...extra,
  }) as unknown as Element;
const panel = (id: string, actions: ElementAction[]) =>
  shape(id, { shape: 'action-card', actions });
const setup = (collects?: 'actions'): PlanBoardSetup => ({
  title: 'B',
  columns: [{ id: 'c', status: 'new', name: 'New' }],
  swimlaneBy: 'none',
  cardFields: [],
  hideWriting: false,
  ...(collects ? { collects } : {}),
});
const board = (id: string, collects?: 'actions') =>
  shape(id, { shape: 'plan-board', planBoard: setup(collects) });
const tab = (id: string, elements: Element[], extra: Partial<Tab> = {}): Tab => ({
  id,
  name: `Tab ${id}`,
  elements,
  ...extra,
});

describe('placedActions', () => {
  it('lists every action on loaded tabs, a panel’s list and an element’s one', () => {
    const tabs = [
      tab('t1', [shape('s1', { action: action('a1') }), panel('p1', [action('a2'), action('a3')])]),
      tab('t2', [shape('s2', { action: action('a4') })]),
    ];
    expect(
      placedActions(tabs, new Set(['t1'])).map((p) => [p.tabId, p.elementId, p.action.id]),
    ).toEqual([
      ['t1', 's1', 'a1'],
      ['t1', 'p1', 'a2'],
      ['t1', 'p1', 'a3'],
    ]);
  });
});

describe('actionsBoardIn', () => {
  it('is the first board, in tab order, that collects actions', () => {
    const tabs = [
      tab('t1', [board('b0')]),
      tab('t2', [board('b1', 'actions')]),
      tab('t3', [board('b2', 'actions')]),
    ];
    expect(actionsBoardIn(tabs)).toMatchObject({ tabId: 't2', elementId: 'b1' });
    expect(actionsBoardIn([tab('t1', [board('b0')])])).toBeNull();
  });
});

describe('unloadedTabIds', () => {
  it('names every tab whose content has not loaded', () => {
    const tabs = [tab('t1', []), tab('t2', []), tab('t3', [])];
    expect(unloadedTabIds(tabs, new Set(['t2']))).toEqual(['t1', 't3']);
  });
});

describe('applyActionChanges', () => {
  const tabs = [
    tab('t1', [shape('s1', { action: action('a1') }), panel('p1', [action('a2'), action('a3')])]),
    tab('t2', [shape('s2', { action: action('a4') })]),
  ];
  it('writes each change onto its action wherever it is, stamping it', () => {
    const next = applyActionChanges(
      tabs,
      [
        { id: 'a1', tabId: 't1', elementId: 's1', status: 'done', updatedAt: 9 },
        {
          id: 'a3',
          tabId: 't1',
          elementId: 'p1',
          title: 'Renamed',
          description: 'More',
          updatedAt: 9,
        },
      ],
      new Set(['t1', 't2']),
    );
    const [s1, p1] = next[0]!.elements as unknown as [
      { action: ElementAction },
      { actions: ElementAction[] },
    ];
    expect(s1.action).toMatchObject({ status: 'done', updatedAt: 9 });
    expect(p1.actions[0]).toEqual(action('a2'));
    expect(p1.actions[1]).toMatchObject({ name: 'Renamed', description: 'More', updatedAt: 9 });
    expect(next[1]).toBe(tabs[1]);
  });
  it('leaves tabs not loaded, and returns the same tabs for no change', () => {
    const change = [
      { id: 'a4', tabId: 't2', elementId: 's2', status: 'done' as const, updatedAt: 9 },
    ];
    expect(applyActionChanges(tabs, change, new Set(['t1']))).toBe(tabs);
    expect(applyActionChanges(tabs, [], new Set(['t1']))).toBe(tabs);
  });
});

describe('removeAction and restoreAction', () => {
  const loaded = new Set(['t1']);
  it('takes an action off a panel or an element, and puts it back', () => {
    const tabs = [
      tab('t1', [shape('s1', { action: action('a1') }), panel('p1', [action('a2'), action('a3')])]),
    ];
    const without = removeAction(removeAction(tabs, 'a1', loaded), 'a3', loaded);
    const [s1, p1] = without[0]!.elements as unknown as [
      { action?: ElementAction },
      { actions: ElementAction[] },
    ];
    expect(s1.action).toBeUndefined();
    expect(p1.actions.map((a) => a.id)).toEqual(['a2']);
    const back = restoreAction(
      restoreAction(without, { tabId: 't1', elementId: 's1', action: action('a1') }, loaded),
      { tabId: 't1', elementId: 'p1', action: action('a3') },
      loaded,
    );
    expect(back[0]!.elements).toEqual(tabs[0]!.elements);
  });
  it('restores nothing over an element that gained another action, or holds it already, or is gone', () => {
    const tabs = [
      tab('t1', [shape('s1', { action: action('other') }), panel('p1', [action('a2')])]),
    ];
    expect(
      restoreAction(tabs, { tabId: 't1', elementId: 's1', action: action('a1') }, loaded),
    ).toBe(tabs);
    expect(
      restoreAction(tabs, { tabId: 't1', elementId: 'p1', action: action('a2') }, loaded),
    ).toBe(tabs);
    expect(
      restoreAction(tabs, { tabId: 't1', elementId: 'gone', action: action('a1') }, loaded),
    ).toBe(tabs);
    expect(removeAction(tabs, 'nope', loaded)).toBe(tabs);
  });
});

describe('goneActionIds', () => {
  it('names actions seen before and found nowhere loaded now', () => {
    const now = placedActions(
      [tab('t1', [shape('s1', { action: action('a1') })])],
      new Set(['t1']),
    );
    expect(goneActionIds(new Set(['a1', 'a2']), now)).toEqual(['a2']);
    expect(goneActionIds(new Set(), now)).toEqual([]);
  });
});

// docs/specs/026-plan/blueprints/linked-boards.md "Performance and limits": the walks run on every tabs change, so a
// big document (40 tabs of 500 elements, 40 full Action panels) stays well inside a frame.
describe('budget', () => {
  it('finds every action and the board in a big document within budget', () => {
    const tabs = Array.from({ length: 40 }, (_, t) =>
      tab(`t${t}`, [
        ...Array.from({ length: 499 }, (_, i) => shape(`s${t}-${i}`)),
        panel(
          `p${t}`,
          Array.from({ length: 50 }, (_, i) => action(`a${t}-${i}`)),
        ),
      ]),
    );
    tabs.push(tab('tb', [board('b', 'actions')]));
    const loaded = new Set(tabs.map((t) => t.id));
    let found = 0;
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 10; i++)
        found = placedActions(tabs, loaded).length + (actionsBoardIn(tabs) ? 1 : 0);
    });
    expect(found).toBe(2001);
    expect(ms / 10).toBeLessThan(16);
  });
});
