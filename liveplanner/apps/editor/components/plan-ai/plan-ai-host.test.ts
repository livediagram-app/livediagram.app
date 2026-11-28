import { describe, expect, it, vi } from 'vitest';
import { AGENT_LOCALE, Workbook } from '@liveplanner/sheets';
import type { DashboardLayout, Tab } from '@liveplanner/project';
import { planAiTabOf, type PlanAiHostInput } from './plan-ai-host';
import { ITEMS, SETUP, TYPES } from './plan-ai-fixtures';

// The open tab as Plan AI works on it, a kind at a time (docs/specs/026-plan/plan-ai.md "What it may change").

const tab = (over: Partial<Tab>): Tab => ({ id: 't1', name: 'Tab', elements: [], ...over });

const LAYOUT: DashboardLayout = {
  rows: [{ id: 'r1', height: 300, slots: [{ id: 's1', span: 12 }] }],
};

function input(t: Tab, over: Partial<PlanAiHostInput> = {}): PlanAiHostInput {
  return {
    tab: t,
    tabs: [t, tab({ id: 'b2', name: 'Roadmap', kind: 'board' })],
    projectId: 'p1',
    board: {
      items: ITEMS,
      types: TYPES,
      addItems: vi.fn(async () => true),
      moveItems: vi.fn(),
      patchItems: vi.fn(),
      trashItems: vi.fn(() => 1),
    },
    changeForm: vi.fn(),
    renameForm: vi.fn(),
    changeDashboard: vi.fn(),
    dashboardOf: () => LAYOUT,
    sheets: null,
    newId: () => 'n1',
    ...over,
  };
}

const boardTab = tab({
  kind: 'board',
  name: 'Roadmap',
  elements: [{ id: 'e1', type: 'shape', shape: 'plan-board', planBoard: SETUP }] as never,
});

describe('planAiTabOf', () => {
  it('is null on a canvas tab', () => {
    expect(planAiTabOf(input(tab({})))).toBeNull();
  });

  it('reads a board and makes its changes through the card writes', async () => {
    const i = input(boardTab);
    const host = planAiTabOf(i)!;
    expect(host).toMatchObject({ kind: 'board', tabId: 't1', tabName: 'Roadmap' });
    const text = host.read()!;
    expect(text).toContain('Board "Roadmap"');
    expect(text).toContain('Columns, left to right: To Do, Done');
    expect(text).toContain('Write brief');
    expect(text).toContain('Size: 3');
    expect(text).toContain('Assignee: Sam Lee');
    expect(text).toContain('Description: All of it now');
    expect(text).toContain('Flagged');
    expect(text).not.toContain('Old');
    const out = await host.apply([{ op: 'move', item: '#1', status: 'Done' }]);
    expect(out.steps).toBe(1);
    expect(i.board!.moveItems).toHaveBeenCalled();
  });

  it('can neither read nor change a board tab with no board on it', async () => {
    const host = planAiTabOf(input(tab({ kind: 'board' }), { board: null }))!;
    expect(host.read()).toBeNull();
    expect((await host.apply([{ op: 'add' }])).lines[0]!.ok).toBe(false);
  });

  it('reads a form and changes it as one step, renaming the tab through the form’s own rename', async () => {
    const formTab = tab({
      kind: 'form',
      name: 'Feedback',
      form: {
        v: 1,
        heading: 'Feedback',
        sections: [
          { id: 's1', title: '', questions: [{ id: 'q1', type: 'short', prompt: 'Name' }] },
        ],
      },
    } as never);
    const i = input(formTab);
    const host = planAiTabOf(i)!;
    expect(host.read()).toContain('[q1] short: "Name"');
    const same = await host.apply([
      { op: 'set_question', question: 'q1', set: { prompt: 'Full name' } },
    ]);
    expect(same.steps).toBe(1);
    const changed = vi.mocked(i.changeForm).mock.calls[0]![0];
    expect(changed({} as never).sections[0]!.questions[0]!.prompt).toBe('Full name');
    const renamed = await host.apply([{ op: 'set_form', heading: 'Thoughts' }]);
    expect(renamed.steps).toBe(2);
    expect(i.renameForm).toHaveBeenCalledWith('Thoughts');
    expect(vi.mocked(i.changeForm).mock.calls[1]![0]({} as never).heading).toBe('Feedback');
    const refused = await host.apply([{ op: 'delete_question', question: 'q9' }]);
    expect(refused.steps).toBe(0);
    // A Form tab with no form yet reads as an empty one.
    expect(planAiTabOf(input(tab({ kind: 'form', name: 'New' })))!.read()).toContain('Form "New"');
  });

  it('reads a dashboard and changes its layout as one step', async () => {
    const i = input(tab({ kind: 'dashboard', name: 'Overview' }));
    const host = planAiTabOf(i)!;
    const text = host.read()!;
    expect(text).toContain('Row 1, 300 px tall: slot 1 (span 12) shows empty');
    expect(text).toContain('"Roadmap" (board)');
    expect((await host.apply([{ op: 'add_row' }])).steps).toBe(1);
    expect(i.changeDashboard).toHaveBeenCalledTimes(1);
    expect((await host.apply([{ op: 'remove_row', row: 4 }])).steps).toBe(0);
    expect(i.changeDashboard).toHaveBeenCalledTimes(1);
  });

  it('reads a sheet tab’s sheet and writes to it through the store', async () => {
    const sheetTab = tab({
      kind: 'sheet',
      name: 'Budget',
      elements: [
        {
          id: 'e2',
          type: 'shape',
          shape: 'plan-sheet',
          planSheet: { sheetId: 'sh1' },
          x: 0,
          y: 0,
          width: 400,
          height: 300,
        },
      ] as never,
    });
    const writeAll = vi.fn(() => null);
    const wb = new Workbook({ sheets: [], locale: AGENT_LOCALE });
    const host = planAiTabOf(
      input(sheetTab, {
        sheets: { workbook: () => wb, writeAll, commitElements: vi.fn(), locale: AGENT_LOCALE },
      }),
    )!;
    // The sheet isn't loaded yet: nothing to read, nothing to change.
    expect(host.read()).toBeNull();
    expect((await host.apply([{ op: 'set', at: 'A1', rows: [['x']] }])).steps).toBe(0);
    const none = planAiTabOf(input(sheetTab))!;
    expect(none.read()).toBeNull();
    expect((await none.apply([])).lines[0]!.ok).toBe(false);
  });
});
