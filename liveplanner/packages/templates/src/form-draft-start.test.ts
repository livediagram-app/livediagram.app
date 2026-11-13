import { describe, expect, it } from 'vitest';
import { createShape, type Tab } from '@liveplanner/project';
import { questionsOf, readFormDraft, type FormDraft } from '@liveplanner/forms';
import { ITEM_TYPES, presetSetup } from '@liveplanner/items';
import { boardsOf } from './form-start';
import { firstFormDraftTarget, formDraftTargets, planFormDraft } from './form-draft-start';

// docs/specs/030-forms/describe-a-form.md "The preview": where Create Form sends a drafted form's responses, and what
// it makes for them.

let n = 0;
const random = () => ((n += 7) % 100) / 100;

const boardTab = (id: string, setup = presetSetup('kanban')): Tab => ({
  id,
  name: id,
  kind: 'board',
  elements: [{ ...createShape('plan-board', 0, 0), id: `${id}-board`, planBoard: setup }],
});
const sheetTab: Tab = {
  id: 'budget',
  name: 'Budget',
  kind: 'sheet',
  elements: [{ ...createShape('plan-sheet', 0, 0), planSheet: { sheetId: 'sheet-1' } }],
};
const formTab: Tab = { id: 'form', name: 'Tab 2', elements: [], kind: 'form' };

const out = readFormDraft(
  {
    outcome: 'form',
    form: {
      heading: 'Equipment Request',
      respondsTo: 'board',
      sections: [
        {
          questions: [
            { type: 'short', prompt: 'What do you need?', required: true },
            { type: 'paragraph', prompt: 'Why?' },
            { type: 'single', prompt: 'Urgency', options: ['Low', 'High'] },
            { type: 'short', prompt: 'Team' },
          ],
        },
      ],
    },
  },
  'equipment requests',
);
if (!('draft' in out)) throw new Error('the fixture must read');
const draft: FormDraft = out.draft;

const plan = (target: Parameters<typeof planFormDraft>[0]['target'], tabs: Tab[] = [formTab]) =>
  planFormDraft({
    draft,
    target,
    formTab,
    tabs,
    types: [...ITEM_TYPES],
    statusNames: [],
    newSheetId: () => 'sheet-new',
    random,
  });

describe('formDraftTargets', () => {
  it('offers a new board, each board, a new sheet and each sheet, never the Form tab', () => {
    const options = formDraftTargets([formTab, boardTab('Triage'), sheetTab], 'form');
    expect(options.map((o) => o.name)).toEqual([
      'Cards on a New Board',
      'Cards on Triage',
      'Rows in a New Sheet',
      'Rows in Budget',
    ]);
  });

  it('selects where the form already sends responses first, else the draft’s choice', () => {
    const options = formDraftTargets([formTab, boardTab('Triage'), sheetTab], 'form');
    expect(firstFormDraftTarget(options, draft).id).toBe('new-board');
    expect(firstFormDraftTarget(options, { respondsTo: 'sheet' }).id).toBe('new-sheet');
    expect(
      firstFormDraftTarget(options, draft, { sheet: { tabId: 'budget', sheetId: 'sheet-1' } }).name,
    ).toBe('Rows in Budget');
    expect(
      firstFormDraftTarget(options, draft, {
        destination: { tabId: 'Triage', typeId: 'task', status: 'todo' },
      }).name,
    ).toBe('Cards on Triage');
  });
});

describe('planFormDraft', () => {
  it('to a new board: a type named after the form, the first Short Answer its Title, a field for the rest', () => {
    const made = plan({ to: 'new-board' });
    expect(made.type?.label).toBe('Equipment Request');
    expect(made.newTab?.name).toBe('Equipment Request Responses');
    const board = boardsOf(made.newTab!)[0]!;
    expect(board.setup.addTypes).toEqual([made.type!.id]);
    expect(made.form.destination).toEqual({
      tabId: made.newTab!.id,
      typeId: made.type!.id,
      status: board.setup.columns[0]!.status,
    });
    const qs = questionsOf(made.form);
    expect(qs[0]!.goesTo).toEqual({ to: 'title' });
    // The first Paragraph stays the card's Description.
    expect(qs[1]!.goesTo).toBeUndefined();
    expect(qs[2]!.goesTo).toMatchObject({ to: 'field' });
    expect(qs[3]!.goesTo).toMatchObject({ to: 'field' });
    expect(made.type!.custom?.map((f) => [f.label, f.kind])).toEqual([
      ['Urgency', 'choice'],
      ['Team', 'text'],
    ]);
    // Fresh ids, never the draft's.
    expect(qs.some((q) => /^q-\d$/.test(q.id))).toBe(false);
  });

  it('to an existing board: the board takes the type when it confines its types', () => {
    const ideas = boardTab('ideas', { ...presetSetup('kanban'), addTypes: ['idea'] });
    const made = plan({ to: 'board', tabId: 'ideas', elementId: 'ideas-board' }, [formTab, ideas]);
    expect(made.newTab).toBeNull();
    expect(made.form.destination?.tabId).toBe('ideas');
    expect(boardsOf(made.changedTab!)[0]!.setup.addTypes).toEqual(['idea', made.type!.id]);
  });

  it('to a board gone since: a new board instead', () => {
    const made = plan({ to: 'board', tabId: 'gone', elementId: 'gone-board' });
    expect(made.newTab?.kind).toBe('board');
    expect(made.form.destination?.tabId).toBe(made.newTab!.id);
  });

  it('to a new sheet: a Sheet tab and its sheet, no card type, nothing mapped', () => {
    const made = plan({ to: 'new-sheet' });
    expect(made.type).toBeNull();
    expect(made.newTab?.kind).toBe('sheet');
    expect(made.newSheet).toEqual({
      tabId: made.newTab!.id,
      sheetId: 'sheet-new',
      title: 'Equipment Request Responses',
    });
    expect(made.form.sheet).toEqual({ tabId: made.newTab!.id, sheetId: 'sheet-new' });
    expect(questionsOf(made.form).some((q) => q.goesTo)).toBe(false);
  });

  it('to an existing sheet: rows there, nothing made', () => {
    const made = plan({ to: 'sheet', tabId: 'budget', sheetId: 'sheet-1' }, [formTab, sheetTab]);
    expect(made.newTab).toBeNull();
    expect(made.form.sheet).toEqual({ tabId: 'budget', sheetId: 'sheet-1' });
  });
});
