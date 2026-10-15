import { describe, expect, it } from 'vitest';
import { questionsOf, type FormDefinition } from '@livediagram/forms';
import { boardsOf } from '@livediagram/templates';
import { BUG, formDraft, formWorld } from '../testing/forms';
import { applyFormChanges, type FormChange } from './form-changes';
import type { FormDraft } from './form-draft';

// change_form's changes (docs/specs/030-forms/forms.md "Agents"), in order on a draft, checked as the builder checks.
const run = (changes: FormChange[], d: FormDraft = formDraft()) => ({
  d,
  refused: applyFormChanges(d, changes),
});
const prompts = (f: FormDefinition) => f.sections.map((s) => s.questions.map((q) => q.prompt));

describe('questions', () => {
  it('adds after a question, at the end of a section, or at the end of the form', () => {
    const { d, refused } = run([
      { op: 'add_question', question: { type: 'email', prompt: 'Email' }, after: 'Summary' },
      { op: 'add_section', title: 'More' },
      { op: 'add_question', question: { type: 'date', prompt: 'When?' }, section: 2 },
      { op: 'add_question', question: { type: 'paragraph', prompt: 'Anything else?' } },
    ]);
    expect(refused).toBeNull();
    expect(prompts(d.form)).toEqual([
      ['Summary', 'Email', 'Severity', 'Can we contact you?'],
      ['When?', 'Anything else?'],
    ]);
  });

  it('changes, retypes, moves and deletes, each named by prompt or id', () => {
    const { d, refused } = run([
      {
        op: 'set_question',
        question: 'Can we contact you?',
        set: { required: true, help: 'We never share it.' },
      },
      { op: 'set_question', question: 'q-sev', set: { type: 'multi' } },
      { op: 'move_question', question: 'Summary', after: 'Can we contact you?' },
      { op: 'delete_question', question: 'Severity' },
    ]);
    expect(refused).toBeNull();
    expect(prompts(d.form)).toEqual([['Can we contact you?', 'Summary']]);
    expect(questionsOf(d.form)[0]).toMatchObject({ required: true, help: 'We never share it.' });
  });

  it('names the change that is refused, and writes nothing', () => {
    const d = formDraft();
    const before = d.form;
    const refused = applyFormChanges(d, [
      { op: 'delete_question', question: 'Summary' },
      { op: 'set_question', question: 'Nope', set: { required: true } },
    ]);
    expect(refused?.message).toMatch(/^Change 2 \(set_question\): No question "Nope"\./);
    expect(refused?.message).toContain('Nothing was written.');
    expect(before.sections[0]!.questions).toHaveLength(3);
  });
});

describe('where an answer goes', () => {
  it('maps to Title, Description, an existing field, or a new one of the kind that fits', () => {
    const { d, refused } = run([
      {
        op: 'add_question',
        question: { type: 'rating', prompt: 'Impact', scale: 5, goesTo: 'Impact' },
      },
      { op: 'add_question', question: { type: 'email', prompt: 'Email', goesTo: 'Description' } },
    ]);
    expect(refused).toBeNull();
    const type = d.types.find((t) => t.id === 'bug')!;
    expect(type.custom?.map((f) => [f.label, f.kind])).toEqual([
      ['Severity', 'choice'],
      ['Impact', 'rating'],
    ]);
    expect(d.typesChanged).toBe(true);
    expect(d.lines).toContain('added the rating field "Impact" to Bug');
  });

  it('keeps a choice field holding every option its question offers', () => {
    const { d, refused } = run([
      { op: 'set_question', question: 'Severity', set: { options: ['Low', 'High', 'Critical'] } },
    ]);
    expect(refused).toBeNull();
    expect(d.types.find((t) => t.id === 'bug')!.custom![0]!.options).toEqual([
      'Low',
      'High',
      'Critical',
    ]);
  });

  it('refuses a field that cannot hold the answer, a title it cannot be, and a field on a sheet form', () => {
    expect(
      run([{ op: 'set_question', question: 'Summary', set: { goesTo: 'Severity' } }]).refused,
    ).toMatchObject({
      code: 'field_does_not_fit',
    });
    expect(
      run([{ op: 'set_question', question: 'Can we contact you?', set: { goesTo: 'Title' } }])
        .refused,
    ).toMatchObject({
      code: 'title_not_allowed',
    });
    expect(
      run([
        { op: 'responds_to', to: 'sheet', sheet: 'Budget' },
        { op: 'set_question', question: 'Summary', set: { goesTo: 'Notes' } },
      ]).refused,
    ).toMatchObject({ code: 'goes_to_on_sheet' });
  });
});

describe('sections and their rules', () => {
  it('splits after a question and shows the new section on an earlier answer', () => {
    const { d, refused } = run([
      {
        op: 'add_section',
        title: 'Details',
        after: 'Severity',
        showIf: { question: 'Severity', anyOf: ['high'] },
      },
    ]);
    expect(refused).toBeNull();
    expect(prompts(d.form)).toEqual([['Summary', 'Severity'], ['Can we contact you?']]);
    expect(d.form.sections[1]).toMatchObject({
      title: 'Details',
      showIf: { questionId: 'q-sev', anyOf: ['High'] },
    });
  });

  it('refuses a rule on the first section, on a question that cannot decide it, or an answer it lacks', () => {
    expect(
      run([{ op: 'set_section', section: 1, showIf: { question: 'Severity', anyOf: ['Low'] } }])
        .refused,
    ).toMatchObject({
      code: 'rule_on_first',
    });
    expect(run([{ op: 'set_section', section: 1, title: 'Hi' }]).refused).toMatchObject({
      code: 'first_section_is_form',
    });
    const split: FormChange = { op: 'add_section', after: 'Severity' };
    expect(
      run([split, { op: 'set_section', section: 2, showIf: { question: 'Summary', anyOf: ['x'] } }])
        .refused,
    ).toMatchObject({
      code: 'rule_question_unfit',
    });
    expect(
      run([
        split,
        { op: 'set_section', section: 2, showIf: { question: 'Severity', anyOf: ['Meh'] } },
      ]).refused,
    ).toMatchObject({
      code: 'rule_answer_unknown',
    });
  });

  it('deletes a later section, its questions joining the one before; never the first', () => {
    const { d } = run([
      { op: 'add_section', after: 'Summary' },
      { op: 'delete_section', section: 2 },
    ]);
    expect(prompts(d.form)).toEqual([['Summary', 'Severity', 'Can we contact you?']]);
    expect(run([{ op: 'delete_section', section: 1 }]).refused).toMatchObject({
      code: 'first_section',
    });
  });
});

describe('the form, its settings and where responses go', () => {
  it('sets the heading, a cover from a gradient, and the settings (null clears)', () => {
    const { d, refused } = run([
      {
        op: 'set_form',
        heading: 'Crash Report',
        cover: { gradient: ['#7c3aed', '#db2777'], angle: 135, pattern: 'dots' },
      },
      { op: 'settings', closesAt: '2026-12-01T18:00:00Z', limit: 50, confirmation: 'Thanks!' },
      { op: 'settings', limit: null },
    ]);
    expect(refused).toBeNull();
    expect(d.form).toMatchObject({
      heading: 'Crash Report',
      cover: {
        fill: { kind: 'gradient', from: '#7c3aed', to: '#db2777', angle: 135 },
        pattern: 'dots',
      },
      closesAt: Date.UTC(2026, 11, 1, 18),
      confirmation: 'Thanks!',
    });
    expect(d.form.limit).toBeUndefined();
    expect(run([{ op: 'set_form', cover: { color: 'red' } }]).refused).toMatchObject({
      code: 'cover_invalid',
    });
    expect(run([{ op: 'settings', limit: 0 }]).refused).toMatchObject({ code: 'invalid_value' });
  });

  it('sends responses to a new board as + New Board makes it, the form’s card type its own', () => {
    const { d, refused } = run([{ op: 'responds_to', to: 'board' }]);
    expect(refused).toBeNull();
    const made = d.newTabs[0]!;
    expect(made).toMatchObject({ name: 'Bug Report Responses', kind: 'board' });
    const board = boardsOf(made)[0]!;
    expect(d.form.destination).toEqual({
      tabId: made.id,
      typeId: 'bug',
      status: board.setup.columns[0]!.status,
    });
  });

  it('sends responses to a named board and column, the board taking the type', () => {
    const { d, refused } = run([
      { op: 'responds_to', to: 'board', board: 'Bugs', cardType: 'Task', column: 'fixed' },
    ]);
    expect(refused).toBeNull();
    expect(d.form.destination).toMatchObject({ tabId: 'bugs', typeId: 'task' });
    const board = boardsOf(d.changedTabs.get('bugs')!)[0]!;
    expect(board.setup.addTypes).toEqual(['bug', 'task']);
  });

  it('sends responses to a new or named sheet, keeping the board for switching back', () => {
    const named = run([{ op: 'responds_to', to: 'sheet', sheet: 'Budget' }]).d;
    expect(named.form.sheet).toEqual({ tabId: 'budget', sheetId: 'sheet_budget' });
    expect(named.form.destination).toBeDefined();
    const fresh = run([{ op: 'responds_to', to: 'sheet' }]).d;
    const tab = fresh.newTabs[0]!;
    expect(tab).toMatchObject({ kind: 'sheet', name: 'Bug Report Responses' });
    // The api makes a sheet marked so as the tab is written, under the id the form names.
    const el = tab.elements[0] as { planSheet: { sheetId: string; start: string } };
    expect(el.planSheet).toEqual({
      sheetId: fresh.form.sheet!.sheetId,
      start: 'blank-spreadsheet',
    });
  });

  it('makes a card type named after a form with none', () => {
    const world = formWorld({
      v: 1,
      heading: 'Lunch Order',
      sections: [{ id: 's', title: '', questions: [] }],
    });
    const d = formDraft({ ...world, tabs: world.tabs.filter((t) => t.id !== 'bugs') });
    expect(applyFormChanges(d, [{ op: 'responds_to', to: 'board' }])).toBeNull();
    expect(d.types.at(-1)).toMatchObject({ label: 'Lunch Order', glyph: 'checklist' });
    expect(d.types.some((t) => t === BUG)).toBe(true);
  });
});
