import { describe, expect, it } from 'vitest';
import { fakeApi } from '../testing/fake-api';
import { formPlan } from '../testing/forms';
import { readFormLink, sheetRefsOf, worldOf } from './form-world';

// The world a form verb reads (blueprint forms.md §15 "Engine flow"): the plan's tabs, boards and sheets.
describe('worldOf', () => {
  it('names a second sheet on a tab after it, and only Board tabs’ live boards', () => {
    expect(
      sheetRefsOf([
        { id: 's', name: 'Budget', kind: 'sheet', sheetIds: ['a', 'b'] },
        { id: 'e', name: 'Empty', kind: 'sheet' },
        { id: 'd', name: 'Diagram', kind: 'diagram' },
      ]),
    ).toEqual([
      { tabId: 's', sheetId: 'a', name: 'Budget' },
      { tabId: 's', sheetId: 'b', name: 'Budget 2' },
    ]);
    const plan = formPlan();
    const archive = { ...plan.boards[0]!, elementId: 'arch', kind: 'archive' as const };
    const offTab = { ...plan.boards[0]!, elementId: 'off', tabId: 'other' };
    const world = worldOf('doc', { ...plan, boards: [...plan.boards, archive, offTab] });
    expect(world.boards.map((b) => b.elementId)).toEqual(['b1']);
  });

  it('reads a plan from an api older than its tabs as having none', () => {
    const { tabs: _tabs, ...older } = formPlan();
    expect(worldOf('doc', older)).toMatchObject({ tabs: [], boards: [], sheets: [] });
  });

  it('reads no link when the api will not say', async () => {
    const api = fakeApi({});
    expect(await readFormLink(api, 'doc', 'form')).toBeNull();
  });
});
