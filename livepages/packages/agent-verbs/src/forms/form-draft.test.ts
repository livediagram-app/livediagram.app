import { describe, expect, it } from 'vitest';
import { questionsOf, type FormDefinition, type FormQuestion } from '@livepages/forms';
import { BUG, bugForm, formDraft, formWorld } from '../testing/forms';
import { setGoesTo, setRespondsTo, syncChoiceField } from './form-draft';

// Where responses and answers go (docs/specs/030-forms/forms.md "Agents"; blueprint forms.md §15 "Names and
// refusals"): Responses Go To and Answer Goes To as an agent names them.
const q = (form: FormDefinition, id: string) => questionsOf(form).find((x) => x.id === id)!;

describe('setRespondsTo', () => {
  it('refuses a sheet given a board’s parts, and a board given a sheet', () => {
    expect(setRespondsTo(formDraft(), { to: 'sheet', column: 'New' })).toMatchObject({
      code: 'responds_to_mixed',
    });
    expect(setRespondsTo(formDraft(), { to: 'board', sheet: 'Budget' })).toMatchObject({
      code: 'responds_to_mixed',
    });
  });

  it('refuses names that are not there, and a column for a new board', () => {
    expect(setRespondsTo(formDraft(), { to: 'sheet', sheet: 'Nope' })).toMatchObject({
      code: 'sheet_unknown',
    });
    expect(setRespondsTo(formDraft(), { to: 'board', board: 'Nope' })).toMatchObject({
      code: 'board_unknown',
    });
    expect(
      setRespondsTo(formDraft(), { to: 'board', board: 'Bugs', column: 'Nope' }),
    ).toMatchObject({
      code: 'column_unknown',
    });
    expect(setRespondsTo(formDraft(), { to: 'board', column: 'New' })).toMatchObject({
      code: 'column_unknown',
    });
  });

  it('keeps the form’s own type on a board that takes it, else the board’s first, else a new one', () => {
    const own = formDraft();
    expect(setRespondsTo(own, { to: 'board', board: 'Bugs' })).toBeNull();
    expect(own.form.destination?.typeId).toBe('bug');
    expect(own.lines.at(-1)).toBe('responses go to Bug cards in New on "Bugs"');

    const world = formWorld();
    const tasks = { ...world, boards: [{ ...world.boards[0]!, types: ['task'] }] };
    const first = formDraft(bugForm(), tasks);
    setRespondsTo(first, { to: 'board', board: 'Bugs' });
    expect(first.form.destination?.typeId).toBe('task');
    expect(first.changedBoards.size).toBe(0);

    const none = { ...world, boards: [{ ...world.boards[0]!, types: [] }] };
    const fresh = formDraft(bugForm(), none);
    setRespondsTo(fresh, { to: 'board', board: 'Bugs' });
    expect(fresh.types.at(-1)).toMatchObject({ label: 'Bug Report' });
  });

  it('takes a board that takes every type as it is', () => {
    const world = formWorld();
    const every = { ...world, boards: [{ ...world.boards[0]!, types: null }] };
    const d = formDraft(bugForm(), every);
    expect(setRespondsTo(d, { to: 'board', board: 'Bugs', cardType: 'Task' })).toBeNull();
    expect(d.changedBoards.size).toBe(0);
  });

  it('shortens a new type’s name to a card type’s length', () => {
    const d = formDraft();
    setRespondsTo(d, { to: 'board', cardType: 'A Very Long Card Type Name Beyond Limits' });
    expect(d.types.at(-1)!.label).toBe('A Very Long Card Type Name B');
  });
});

describe('setGoesTo', () => {
  it('sends an answer back to the Description', () => {
    const d = formDraft();
    expect(setGoesTo(d, q(d.form, 'q-sum'), 'description')).toBeNull();
    expect(q(d.form, 'q-sum').goesTo).toBeUndefined();
  });

  it('needs a board before a field', () => {
    const d = formDraft({ ...bugForm(), destination: undefined });
    expect(setGoesTo(d, q(d.form, 'q-sum'), 'Notes')).toMatchObject({
      code: 'goes_to_needs_board',
    });
  });

  it('refuses an Other answer on an existing choice field, and a type with no room', () => {
    const d = formDraft();
    const other: FormQuestion = { ...q(d.form, 'q-sev'), other: true };
    expect(setGoesTo(d, other, 'Severity')).toMatchObject({ code: 'field_does_not_fit' });
    const full = {
      ...BUG,
      custom: Array.from({ length: 12 }, (_, i) => ({
        id: `f${i}`,
        label: `F${i}`,
        kind: 'text' as const,
      })),
    };
    const crowded = formDraft(bugForm(), { ...formWorld(), types: [full] });
    expect(setGoesTo(crowded, q(crowded.form, 'q-sum'), 'Another')).toMatchObject({
      code: 'fields_full',
    });
  });

  it('makes a field on a type that has none of its own yet', () => {
    const plain = { ...BUG, custom: undefined };
    const d = formDraft(bugForm(), { ...formWorld(), types: [plain] });
    expect(setGoesTo(d, q(d.form, 'q-sum'), 'Notes')).toBeNull();
    expect(d.types[0]!.custom).toEqual([expect.objectContaining({ label: 'Notes', kind: 'text' })]);
  });
});

describe('syncChoiceField', () => {
  it('leaves a question that maps nowhere or to a non-choice field alone', () => {
    const d = formDraft();
    expect(syncChoiceField(d, 'q-sum')).toBeNull();
    expect(syncChoiceField(d, 'nope')).toBeNull();
  });

  it('gives a choice field with no options the question’s, and refuses past twenty', () => {
    const bare = {
      ...BUG,
      custom: [{ id: 'f-severity', label: 'Severity', kind: 'choice' as const }],
    };
    const d = formDraft(bugForm(), { ...formWorld(), types: [bare] });
    expect(syncChoiceField(d, 'q-sev')).toBeNull();
    expect(d.types[0]!.custom![0]!.options).toEqual(['Low', 'High']);
    const many = {
      ...BUG,
      custom: [
        {
          id: 'f-severity',
          label: 'Severity',
          kind: 'choice' as const,
          options: Array.from({ length: 20 }, (_, i) => `O${i}`),
        },
      ],
    };
    const crowded = formDraft(bugForm(), { ...formWorld(), types: [many] });
    expect(syncChoiceField(crowded, 'q-sev')).toMatchObject({ code: 'field_options_full' });
  });

  it('refuses a mapped choice given Other', () => {
    const form = bugForm();
    const withOther = {
      ...form,
      sections: [
        {
          ...form.sections[0]!,
          questions: form.sections[0]!.questions.map((x) =>
            x.id === 'q-sev' ? { ...x, other: true as const } : x,
          ),
        },
      ],
    };
    expect(syncChoiceField(formDraft(withOther), 'q-sev')).toMatchObject({
      code: 'field_does_not_fit',
    });
  });
});

describe('the remaining paths', () => {
  const notes = { id: 'f-notes', label: 'Notes', kind: 'text' as const };
  const typed = { ...BUG, fields: [...BUG.fields, 'f-notes'], custom: [...BUG.custom!, notes] };

  it('keeps the form’s type on a board that takes every type, among several boards', () => {
    const world = formWorld();
    const second = { ...world.boards[0]!, elementId: 'b2', tabId: 'ops', tabName: 'Ops' };
    const d = formDraft(bugForm(), {
      ...world,
      boards: [
        { ...world.boards[0]!, types: null },
        { ...second, types: ['task'] },
      ],
    });
    expect(setRespondsTo(d, { to: 'board', board: 'Bugs' })).toBeNull();
    expect(d.form.destination?.typeId).toBe('bug');
    expect(setRespondsTo(d, { to: 'board', board: 'Ops', cardType: 'Bug' })).toBeNull();
    expect(d.boards.map((b) => b.types)).toEqual([null, ['task', 'bug']]);
    const fresh = formDraft(
      { ...bugForm(), destination: undefined },
      { ...world, boards: [{ ...world.boards[0]!, types: null }] },
    );
    expect(setRespondsTo(fresh, { to: 'board', board: 'Bugs' })).toBeNull();
    expect(fresh.form.destination?.typeId).toBe(fresh.types[0]!.id);
  });

  it('maps to the Title, and reuses a field there is, an Other answer to a text one', () => {
    const d = formDraft(bugForm(), { ...formWorld(), types: [typed] });
    expect(setGoesTo(d, q(d.form, 'q-sum'), 'Title')).toBeNull();
    expect(q(d.form, 'q-sum').goesTo).toEqual({ to: 'title' });
    const other: FormQuestion = { id: 'q-sum', type: 'short', prompt: 'S' };
    expect(setGoesTo(d, other, 'notes')).toBeNull();
    expect(d.types[0]!.custom).toHaveLength(2);
    const otherChoice: FormQuestion = { ...q(d.form, 'q-sev'), other: true };
    expect(setGoesTo(d, otherChoice, 'Notes')).toBeNull();
  });

  it('syncs a choice field among several, and a mapped choice that offers no options yet', () => {
    const d = formDraft(
      {
        ...bugForm(),
        sections: [
          {
            id: 's',
            title: '',
            questions: [
              {
                id: 'q-sev',
                type: 'single',
                prompt: 'S',
                goesTo: { to: 'field', fieldId: 'f-severity' },
              },
            ],
          },
        ],
      },
      { ...formWorld(), types: [typed] },
    );
    expect(syncChoiceField(d, 'q-sev')).toBeNull();
    const withMore = formDraft(
      {
        ...bugForm(),
        sections: [
          {
            id: 's',
            title: '',
            questions: [{ ...q(bugForm(), 'q-sev'), options: ['Low', 'High', 'Urgent'] }],
          },
        ],
      },
      { ...formWorld(), types: [typed] },
    );
    expect(syncChoiceField(withMore, 'q-sev')).toBeNull();
    expect(withMore.types[0]!.custom!.map((f) => f.options)).toEqual([
      ['Low', 'High', 'Urgent'],
      undefined,
    ]);
  });
});
