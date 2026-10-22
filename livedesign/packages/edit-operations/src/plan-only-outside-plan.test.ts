// Boards and Sheets only in Plan (docs/specs/026-plan/plan-tabs.md "Only in Plan", docs/specs/024-agents/agent-changesets.md
// "Boards and Sheets only in Plan"): a changeset that would leave a new board or Sheet on a tab not in Plan is refused,
// whatever way it arrives; a tab in Plan takes one, and one a tab already holds is left alone.
import { describe, expect, it } from 'vitest';
import type { Tab } from '@livedesign/document';
import { applyEditOperations } from './apply';
import { applyReplace } from './replace';
import { checkoutFlow, fixedIds } from './fixtures/checkout-flow';
import { applied, refused } from './fixtures/outcomes';
import type { EditOperation } from './types';

const sheet = (id: string) => ({
  id,
  type: 'shape',
  shape: 'plan-sheet',
  x: 600,
  y: 0,
  width: 960,
  height: 560,
  planSheet: { sheetId: `sheet-${id}` },
});
const board = (id: string) => ({
  id,
  type: 'shape',
  shape: 'plan-board',
  x: 600,
  y: 0,
  width: 640,
  height: 420,
});
const addSheet = (id: string): EditOperation => ({ op: 'add', element: sheet(id) });
const addBoard = (id: string): EditOperation => ({ op: 'add', element: board(id) });
const run = (tab: Tab, operations: EditOperation[]) =>
  applyEditOperations(tab, operations, { makeId: fixedIds() });
const inPlan = (tab: Tab): Tab => ({ ...tab, opensIn: 'plan' });
const holding = (tab: Tab, id: string): Tab => ({
  ...tab,
  elements: [...tab.elements, sheet(id) as Tab['elements'][number]],
});

const rejection = {
  code: 'invalid_value',
  details: ['a board or Sheet goes only on a tab in Plan: s1'],
  hint: 'add a Board tab or a Sheet tab with add_tab (template "kanban" or "blank-spreadsheet")',
};

describe('operations', () => {
  it('refuses a Sheet added to a tab in Diagram', () => {
    expect(refused(run(checkoutFlow(), [addSheet('s1')]))).toEqual(rejection);
  });

  it('refuses it in every mode but Plan', () => {
    for (const opensIn of ['draw', 'workshop', 'pages'] as const)
      expect(refused(run({ ...checkoutFlow(), opensIn }, [addSheet('s1')])).code).toBe(
        'invalid_value',
      );
  });

  it('names every Sheet it refuses', () => {
    expect(refused(run(checkoutFlow(), [addSheet('s1'), addSheet('s2')])).details).toEqual([
      'a board or Sheet goes only on a tab in Plan: s1, s2',
    ]);
  });

  it('refuses a board added to a tab in Diagram, naming it', () => {
    expect(refused(run(checkoutFlow(), [addBoard('b1')])).details).toEqual([
      'a board or Sheet goes only on a tab in Plan: b1',
    ]);
  });

  it('places a board on a tab in Plan', () => {
    const { tab } = applied(run(inPlan(checkoutFlow()), [addBoard('b1')]));
    expect(tab.elements.some((el) => el.id === 'b1')).toBe(true);
  });

  it('places a Sheet on a tab in Plan', () => {
    const { tab } = applied(run(inPlan(checkoutFlow()), [addSheet('s1')]));
    expect(tab.elements.some((el) => el.id === 's1')).toBe(true);
  });

  it('places a Sheet on a Sheet tab, whatever its stored mode', () => {
    const sheetTab: Tab = { ...checkoutFlow(), kind: 'sheet', opensIn: 'diagram' };
    expect(applied(run(sheetTab, [addSheet('s1')])).tab.elements.at(-1)!.id).toBe('s1');
  });

  it('leaves alone a Sheet the tab already holds', () => {
    const tab = holding(checkoutFlow(), 'old');
    const moved = applied(run(tab, [{ op: 'set', target: 'old', fields: { x: 900 } }]));
    expect(moved.tab.elements.find((el) => el.id === 'old')).toMatchObject({ x: 900 });
  });
});

describe('replace', () => {
  const options = { tabId: 't', name: 'Tab', makeId: fixedIds() };

  it('refuses elements holding a new Sheet on a tab not in Plan', () => {
    const tab = checkoutFlow();
    expect(
      refused(
        applyReplace(
          tab,
          { elements: [...tab.elements, sheet('s1')], layout: 'preserve' },
          options,
        ),
      ),
    ).toEqual(rejection);
  });

  it('takes them on a tab in Plan', () => {
    const tab = inPlan(checkoutFlow());
    const outcome = applyReplace(
      tab,
      { elements: [...tab.elements, sheet('s1')], layout: 'preserve' },
      options,
    );
    expect(applied(outcome).createdIds).toContain('s1');
  });

  it('keeps a Sheet the tab already holds', () => {
    const tab = holding(checkoutFlow(), 'old');
    expect(
      applied(applyReplace(tab, { elements: tab.elements, layout: 'preserve' }, options)).tab
        .elements,
    ).toHaveLength(tab.elements.length);
  });

  it('refuses a board template over a tab not in Plan, and makes a Board tab of a new one', () => {
    expect(refused(applyReplace(checkoutFlow(), { template: 'kanban' }, options)).code).toBe(
      'invalid_value',
    );
    expect(applied(applyReplace(null, { template: 'kanban' }, options)).tab.kind).toBe('board');
  });

  it('makes a new Sheet tab from the blank spreadsheet template', () => {
    const { tab } = applied(applyReplace(null, { template: 'blank-spreadsheet' }, options));
    expect(tab.kind).toBe('sheet');
  });
});
