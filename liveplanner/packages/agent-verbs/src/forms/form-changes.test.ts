import { describe, expect, it } from 'vitest';
import { questionsOf, type FormDefinition } from '@liveplanner/forms';
import { boardsOf } from '@liveplanner/templates';
import { BUG, bugForm, formDraft } from '../testing/forms';
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

  it('puts a question first, or right before another', () => {
    const { d, refused } = run([
      { op: 'move_question', question: 'Can we contact you?', before: 'Summary' },
      { op: 'add_question', question: { type: 'email', prompt: 'Email' }, before: 'Severity' },
    ]);
    expect(refused).toBeNull();
    expect(prompts(d.form)).toEqual([['Can we contact you?', 'Summary', 'Email', 'Severity']]);
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
    expect(type.custom?.map((f) => [f.label, f.kind, !!f.onCard])).toEqual([
      ['Severity', 'choice', false],
      ['Impact', 'rating', true],
    ]);
    expect(d.typesChanged).toBe(true);
    expect(d.lines).toContain('added the rating field "Impact" to Bug, shown on the card');
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

  it('gives a choice with "Other" a text field, as its answer is no option of a choice field', () => {
    const { d, refused } = run([
      {
        op: 'add_question',
        question: {
          type: 'multi',
          prompt: 'Stack',
          options: ['Go', 'Rust'],
          other: true,
          goesTo: 'Stack',
        },
      },
    ]);
    expect(refused).toBeNull();
    expect(d.types.find((t) => t.id === 'bug')!.custom!.at(-1)).toMatchObject({
      label: 'Stack',
      kind: 'longtext',
    });
    expect(
      run([{ op: 'set_question', question: 'Severity', set: { other: true } }]).refused,
    ).toMatchObject({
      code: 'field_does_not_fit',
    });
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

  it('reads a closing time with no offset as UTC', () => {
    const { d } = run([{ op: 'settings', closesAt: '2026-12-15T17:00:00' }]);
    expect(d.form.closesAt).toBe(Date.UTC(2026, 11, 15, 17));
    expect(run([{ op: 'settings', closesAt: '2026-12-15T17:00:00+01:00' }]).d.form.closesAt).toBe(
      Date.UTC(2026, 11, 15, 16),
    );
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
    expect(d.changedBoards.get('b1')?.types).toEqual(['bug', 'task']);
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

  it('makes a card type named after a form with none, its new board taking that type alone', () => {
    const lunch: FormDefinition = {
      v: 1,
      heading: 'Lunch Order',
      sections: [{ id: 's', title: '', questions: [] }],
    };
    const d = formDraft(lunch);
    expect(applyFormChanges(d, [{ op: 'responds_to', to: 'board' }])).toBeNull();
    const made = d.types.at(-1)!;
    expect(made).toMatchObject({ label: 'Lunch Order', glyph: 'checklist' });
    expect(boardsOf(d.newTabs[0]!)[0]!.setup.addTypes).toEqual([made.id]);
    expect(d.types.some((t) => t === BUG)).toBe(true);
  });

  it('brings in a ready-made card type by name, or makes one of that name', () => {
    const candidate = run([{ op: 'responds_to', to: 'board', cardType: 'Candidate' }]).d;
    expect(candidate.types.some((t) => t.id === 'candidate')).toBe(true);
    expect(candidate.form.destination?.typeId).toBe('candidate');
    const custom = run([{ op: 'responds_to', to: 'board', cardType: 'Guest' }]).d;
    expect(custom.types.at(-1)).toMatchObject({ label: 'Guest' });
  });
});

describe('every refusal, named', () => {
  const split: FormChange = { op: 'add_section', after: 'Severity' };
  const cases: [string, FormChange[], string][] = [
    [
      'an unknown question to place before',
      [{ op: 'add_question', question: { type: 'short', prompt: 'X' }, before: 'Nope' }],
      'question_unknown',
    ],
    [
      'an unknown question to place after',
      [{ op: 'move_question', question: 'Summary', after: 'Nope' }],
      'question_unknown',
    ],
    [
      'a question after itself',
      [{ op: 'move_question', question: 'Summary', after: 'Summary' }],
      'invalid_value',
    ],
    [
      'an unknown section',
      [{ op: 'add_question', question: { type: 'short', prompt: 'X' }, section: 9 }],
      'section_unknown',
    ],
    [
      'a bad question',
      [{ op: 'add_question', question: { type: 'short', prompt: '' } }],
      'prompt_empty',
    ],
    [
      'a bad setting',
      [{ op: 'set_question', question: 'Summary', set: { prompt: '' } }],
      'prompt_empty',
    ],
    [
      'a question to delete that is not there',
      [{ op: 'delete_question', question: 'Nope' }],
      'question_unknown',
    ],
    [
      'a question to move that is not there',
      [{ op: 'move_question', question: 'Nope', section: 1 }],
      'question_unknown',
    ],
    ['a move to nowhere', [{ op: 'move_question', question: 'Summary' }], 'invalid_value'],
    ['a section split after nothing', [{ op: 'add_section', after: 'Nope' }], 'question_unknown'],
    ['a new section with a long title', [{ op: 'add_section', title: 'x'.repeat(81) }], 'too_long'],
    [
      'a section to change that is not there',
      [{ op: 'set_section', section: 'Nope', title: 'X' }],
      'section_unknown',
    ],
    [
      'a section description too long',
      [split, { op: 'set_section', section: 2, description: 'x'.repeat(1001) }],
      'too_long',
    ],
    [
      'a rule on a question that is not there',
      [split, { op: 'set_section', section: 2, showIf: { question: 'Nope', anyOf: ['x'] } }],
      'question_unknown',
    ],
    [
      'a rule with no answers',
      [split, { op: 'set_section', section: 2, showIf: { question: 'Severity', anyOf: [] } }],
      'rule_answer_none',
    ],
    [
      'a section to delete that is not there',
      [{ op: 'delete_section', section: 'Nope' }],
      'section_unknown',
    ],
    ['a heading too long', [{ op: 'set_form', heading: 'x'.repeat(81) }], 'too_long'],
    ['an empty heading', [{ op: 'set_form', heading: ' ' }], 'heading_empty'],
    ['a description too long', [{ op: 'set_form', description: 'x'.repeat(1001) }], 'too_long'],
    ['a cover that is no cover', [{ op: 'set_form', cover: 'red' }], 'cover_invalid'],
    ['an empty cover', [{ op: 'set_form', cover: {} }], 'cover_invalid'],
    ['an empty theme', [{ op: 'set_form', theme: ' ' }], 'invalid_value'],
    ['a closing time that is none', [{ op: 'settings', closesAt: 'soon' }], 'invalid_value'],
    ['a message too long', [{ op: 'settings', confirmation: 'x'.repeat(501) }], 'too_long'],
  ];
  for (const [what, changes, code] of cases)
    it(`refuses ${what}`, () => expect(run(changes).refused).toMatchObject({ code }));

  it('says there is no earlier question to decide a rule', () => {
    const d = formDraft({
      ...bugForm(),
      sections: [{ id: 's', title: '', questions: [{ id: 'q', type: 'short', prompt: 'Q' }] }],
    });
    const refused = applyFormChanges(d, [
      { op: 'add_section' },
      { op: 'set_section', section: 2, showIf: { question: 'Q', anyOf: ['x'] } },
    ]);
    expect(refused?.message).toContain('none yet: add one first');
  });

  it('stops at the most questions and sections a form holds', () => {
    const many: FormDefinition = {
      ...bugForm(),
      sections: Array.from({ length: 10 }, (_, s) => ({
        id: `s${s}`,
        title: '',
        questions: Array.from({ length: 10 }, (_, i) => ({
          id: `q${s}-${i}`,
          type: 'short' as const,
          prompt: `Q${s}-${i}`,
        })),
      })),
    };
    expect(
      applyFormChanges(formDraft(many), [
        { op: 'add_question', question: { type: 'short', prompt: 'X' } },
      ]),
    ).toMatchObject({ code: 'questions_full' });
    expect(applyFormChanges(formDraft(many), [{ op: 'add_section' }])).toMatchObject({
      code: 'sections_full',
    });
  });
});

describe('every change, applied', () => {
  it('moves a question before itself as no move, and to the end of a section', () => {
    const { d, refused } = run([
      { op: 'move_question', question: 'Summary', before: 'Summary' },
      { op: 'add_section', title: 'Two', description: 'More' },
      { op: 'move_question', question: 'Summary', section: 'Two' },
    ]);
    expect(refused).toBeNull();
    expect(prompts(d.form)).toEqual([['Severity', 'Can we contact you?'], ['Summary']]);
    expect(d.form.sections[1]).toMatchObject({ title: 'Two', description: 'More' });
  });

  it('changes a section’s description and drops its rule, and reads a rule’s answers once', () => {
    const { d } = run([
      {
        op: 'add_section',
        after: 'Severity',
        showIf: { question: 'Severity', anyOf: ['High', 'high', 'Low'] },
      },
      { op: 'set_section', section: 2, description: 'Why' },
    ]);
    expect(d.form.sections[1]).toMatchObject({
      description: 'Why',
      showIf: { anyOf: ['High', 'Low'] },
    });
    expect(
      run([
        { op: 'add_section', after: 'Severity', showIf: { question: 'Severity', anyOf: ['Low'] } },
        { op: 'set_section', section: 2, showIf: null },
      ]).d.form.sections[1],
    ).not.toHaveProperty('showIf');
  });

  it('sets and clears the description, a solid cover, a pattern alone, and clears the cover', () => {
    const solid = run([
      { op: 'set_form', description: 'Tell us', cover: { color: '#0f766e', pattern: 'grid' } },
    ]).d.form;
    expect(solid).toMatchObject({
      description: 'Tell us',
      cover: { fill: { kind: 'solid', color: '#0f766e' }, pattern: 'grid' },
    });
    expect(run([{ op: 'set_form', cover: { pattern: 'dots' } }]).d.form.cover).toEqual({
      pattern: 'dots',
    });
    expect(
      run([{ op: 'set_form', cover: { gradient: ['#000000', '#ffffff'], motion: 'aurora' } }]).d
        .form.cover,
    ).toMatchObject({
      fill: { kind: 'gradient', angle: 160, motion: 'aurora' },
    });
    const cleared = run([
      { op: 'set_form', description: 'x', cover: { color: '#000000' } },
      { op: 'set_form', description: '', cover: null },
    ]).d.form;
    expect(cleared.description).toBeUndefined();
    expect(cleared.cover).toBeUndefined();
  });

  it('sets and clears every setting', () => {
    const set = run([
      {
        op: 'settings',
        closesAt: '2026-12-01T18:00:00Z',
        limit: 5,
        confirmation: 'Ta',
        closedMessage: 'Shut',
      },
    ]).d.form;
    expect(set).toMatchObject({ limit: 5, confirmation: 'Ta', closedMessage: 'Shut' });
    const cleared = run([
      {
        op: 'settings',
        closesAt: '2026-12-01T18:00:00Z',
        confirmation: 'Ta',
        closedMessage: 'Shut',
      },
      { op: 'settings', closesAt: null, confirmation: null, closedMessage: '' },
    ]).d.form;
    expect(cleared).not.toHaveProperty('closesAt');
    expect(cleared).not.toHaveProperty('confirmation');
    expect(cleared).not.toHaveProperty('closedMessage');
  });
});
