import { describe, expect, it } from 'vitest';
import { bugForm, formWorld } from '../testing/forms';
import {
  resolveBoard,
  resolveColumn,
  resolveFormTab,
  resolveQuestion,
  resolveSection,
  resolveSheet,
} from './form-names';

// Names as the builder says them (blueprint §15 "Names and refusals"): an unknown name lists what there is.
describe('form names', () => {
  const world = formWorld();

  it('finds the Form tab by id or name, the first when none is named', () => {
    expect(resolveFormTab(world.tabs, undefined)).toMatchObject({ ok: true, tab: { id: 'form' } });
    expect(resolveFormTab(world.tabs, 'bug report')).toMatchObject({
      ok: true,
      tab: { id: 'form' },
    });
    expect(resolveFormTab(world.tabs, 'Bugs')).toMatchObject({ ok: false, code: 'not_a_form_tab' });
    expect(resolveFormTab(world.tabs, 'Nope')).toMatchObject({
      ok: false,
      code: 'form_tab_unknown',
    });
    expect(
      resolveFormTab(
        world.tabs.filter((t) => t.kind !== 'form'),
        undefined,
      ),
    ).toMatchObject({
      code: 'form_tab_none',
    });
  });

  it('finds a question by id or prompt, and says which when two read alike', () => {
    const form = bugForm();
    expect(resolveQuestion(form, 'q-sev')).toMatchObject({
      ok: true,
      question: { prompt: 'Severity' },
    });
    expect(resolveQuestion(form, ' severity ')).toMatchObject({
      ok: true,
      question: { id: 'q-sev' },
    });
    const unknown = resolveQuestion(form, 'Colour');
    expect(!unknown.ok && unknown.message).toContain('Summary (q-sum)');
    const twice = {
      ...form,
      sections: [
        {
          ...form.sections[0]!,
          questions: [
            ...form.sections[0]!.questions,
            { id: 'q-2', type: 'short' as const, prompt: 'Summary' },
          ],
        },
      ],
    };
    expect(resolveQuestion(twice, 'Summary')).toMatchObject({
      ok: false,
      code: 'question_ambiguous',
    });
  });

  it('finds a section by id, title or place', () => {
    const form = {
      ...bugForm(),
      sections: [...bugForm().sections, { id: 's-2', title: 'Details', questions: [] }],
    };
    expect(resolveSection(form, 2)).toMatchObject({ ok: true, index: 1 });
    expect(resolveSection(form, 'details')).toMatchObject({ ok: true, index: 1 });
    expect(resolveSection(form, 's-1')).toMatchObject({ ok: true, index: 0 });
    expect(resolveSection(form, 3)).toMatchObject({ ok: false, code: 'section_unknown' });
  });

  it('finds a Board tab’s board and its column, and a sheet by its Responses Go To name', () => {
    const board = resolveBoard(world.boards, 'bugs');
    expect(board).toMatchObject({ ok: true, board: { elementId: 'b1' } });
    expect(board.ok && resolveColumn(board.board, 'nope')).toMatchObject({
      code: 'column_unknown',
    });
    expect(board.ok && resolveColumn(board.board, 'fixed')).toMatchObject({ ok: true });
    expect(resolveBoard(world.boards, 'Budget')).toMatchObject({
      ok: false,
      code: 'board_unknown',
    });
    expect(resolveSheet(world.sheets, 'budget')).toMatchObject({
      ok: true,
      sheet: { sheetId: 'sheet_budget' },
    });
    expect(resolveSheet(world.sheets, 'Bugs')).toMatchObject({ ok: false, code: 'sheet_unknown' });
  });
});

describe('naming nothing', () => {
  it('says none when there is nothing of the kind', () => {
    const r = resolveBoard([], 'Bugs');
    expect(!r.ok && r.message).toContain('Board tabs: none');
  });
});
