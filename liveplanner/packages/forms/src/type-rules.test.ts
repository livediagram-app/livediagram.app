import { describe, expect, it } from 'vitest';
import type { ItemTypeDef } from '@liveplanner/items';
import { responseCard } from './card';
import type { CardTypeRule, FormDefinition } from './model';
import { publishProblems, publishProblemText } from './publish-check';
import { readForm } from './read';
import {
  chooseCardType,
  newTypeRule,
  ruleFieldChoices,
  ruleTarget,
  TYPE_RULE_PROBLEM_TEXT,
  typeRuleProblem,
  typeRulesOffered,
  updateTypeRule,
  withTypeRules,
  type RulePlace,
} from './type-rules';

// Choosing the card type by an answer (docs/specs/030-forms/forms.md "Choosing the card type by an answer").

const base = (id: string, label: string, extra: Partial<ItemTypeDef> = {}): ItemTypeDef => ({
  id,
  label,
  newTitle: `New ${label}`,
  glyph: 'task',
  color: '#64748b',
  fields: ['title', 'status'],
  ...extra,
});
const task = base('task', 'Task');
const bug = base('bug', 'Bug', {
  fields: ['title', 'status', 'f-sev', 'f-steps'],
  statuses: ['triage', 'done'],
  custom: [
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low', 'High'] },
    { id: 'f-steps', label: 'Steps', kind: 'longtext' },
  ],
});
const feature = base('feature', 'Feature');
const types = [task, bug, feature];
const board = {
  columns: [{ status: 'new' }, { status: 'triage' }, { status: 'done' }],
  addTypes: ['task', 'bug', 'feature'],
};
const place: RulePlace = { types, boards: [board] };

const bugRule: CardTypeRule = {
  id: 'r-bug',
  questionId: 'q-kind',
  anyOf: ['Bug'],
  typeId: 'bug',
  status: 'triage',
  fields: { 'q-sev': 'f-sev', 'q-what': 'f-steps' },
};
const featureRule: CardTypeRule = {
  id: 'r-feat',
  questionId: 'q-kind',
  anyOf: ['Feature', 'Idea'],
  typeId: 'feature',
  status: 'new',
};

function form(rules?: CardTypeRule[]): FormDefinition {
  return {
    v: 1,
    heading: 'Requests',
    sections: [
      {
        id: 's-1',
        title: '',
        questions: [
          { id: 'q-title', type: 'short', prompt: 'Summary', goesTo: { to: 'title' } },
          {
            id: 'q-kind',
            type: 'single',
            prompt: 'What type of request is this?',
            options: ['Bug', 'Feature', 'Idea', 'Question'],
            dropdown: true,
          },
          { id: 'q-what', type: 'paragraph', prompt: 'Details' },
        ],
      },
      {
        id: 's-2',
        title: 'Bug',
        showIf: { questionId: 'q-kind', anyOf: ['Bug'] },
        questions: [{ id: 'q-sev', type: 'single', prompt: 'Severity', options: ['Low', 'High'] }],
      },
    ],
    destination: {
      tabId: 'tab-b',
      typeId: 'task',
      status: 'new',
      ...(rules ? { typeRules: rules } : {}),
    },
  };
}

const answers = (kind: string, more: Record<string, unknown> = {}) =>
  new Map<string, never>(
    Object.entries({ 'q-title': 'Export fails', 'q-kind': kind, ...more }) as [string, never][],
  );

describe('reading and writing rules', () => {
  it('round-trips rules through readForm, and a form without rules is stored as before', () => {
    const ruled = readForm(form([bugRule, featureRule]))!;
    expect(ruled.destination!.typeRules).toEqual([bugRule, featureRule]);
    expect(readForm(JSON.parse(JSON.stringify(ruled)))).toEqual(ruled);
    expect(Object.keys(readForm(form())!.destination!)).toEqual(['tabId', 'typeId', 'status']);
  });

  it('drops a malformed rule, a repeated id or type, and a rule on the default type', () => {
    const read = readForm({
      ...form(),
      destination: {
        ...form().destination,
        typeRules: [
          bugRule,
          { ...featureRule, id: 'r-bug' },
          { ...featureRule, id: 'r-2', typeId: 'bug' },
          { ...featureRule, id: 'r-3', typeId: 'task' },
          { ...featureRule, id: 'r-4', anyOf: [] },
          { ...featureRule, id: 'BAD ID' },
          { ...featureRule, id: 'r-5', fields: { 'q-a': 'f-x', 'q-b': 'f-x', 'q-c': 7 } },
          'nonsense',
        ],
      },
    })!;
    expect(read.destination!.typeRules).toEqual([
      bugRule,
      { ...featureRule, id: 'r-5', fields: { 'q-a': 'f-x' } },
    ]);
    const none = readForm({ ...form(), destination: { ...form().destination, typeRules: [] } })!;
    expect(none.destination).not.toHaveProperty('typeRules');
  });

  it('withTypeRules takes the key away when the last rule goes; updateTypeRule clears emptied fields', () => {
    const ruled = withTypeRules(form(), [bugRule]);
    expect(ruled.destination!.typeRules).toEqual([bugRule]);
    expect(withTypeRules(ruled, []).destination).not.toHaveProperty('typeRules');
    const moved = updateTypeRule(ruled, 'r-bug', { typeId: 'feature', fields: undefined });
    expect(moved.destination!.typeRules![0]).toEqual({
      ...bugRule,
      typeId: 'feature',
      fields: undefined,
    });
    expect(moved.destination!.typeRules![0]).not.toHaveProperty('fields');
    expect(withTypeRules({ heading: 'x' } as unknown as FormDefinition, [bugRule])).toEqual({
      heading: 'x',
    });
  });
});

describe('offering the option', () => {
  it('shows only with more than one type on the board and a choice question', () => {
    expect(typeRulesOffered(form(), types)).toBe(true);
    expect(typeRulesOffered(form(), [task])).toBe(false);
    const noChoice: FormDefinition = {
      ...form(),
      sections: [{ id: 's-1', title: '', questions: [{ id: 'q', type: 'short', prompt: 'Name' }] }],
    };
    expect(typeRulesOffered(noChoice, types)).toBe(false);
  });

  it('a new rule takes the first question and answer and the first type with no rule, its first column', () => {
    expect(newTypeRule(form(), types, board, 'r-1')).toEqual({
      id: 'r-1',
      questionId: 'q-kind',
      anyOf: ['Bug'],
      typeId: 'bug',
      status: 'triage',
    });
    expect(newTypeRule(form([bugRule, featureRule]), types, board, 'r-1')).toBeNull();
    expect(newTypeRule(form(), types, undefined, 'r-1')).toBeNull();
  });
});

describe('chooseCardType', () => {
  it('files by the first rule that matches, else the default type and column', () => {
    const f = form([bugRule, featureRule]);
    expect(chooseCardType(f, answers('Bug'), place)).toMatchObject({
      type: { id: 'bug' },
      status: 'triage',
      rule: { id: 'r-bug' },
    });
    expect(chooseCardType(f, answers('Idea'), place)).toMatchObject({
      type: { id: 'feature' },
      status: 'new',
    });
    // Every other answer, and an unanswered question, take the default.
    for (const a of [answers('Question'), new Map()]) {
      const chosen = chooseCardType(f, a, place)!;
      expect(chosen.type.id).toBe('task');
      expect(chosen.status).toBe('new');
      expect(chosen.rule).toBeUndefined();
    }
    // A form without rules is the destination as it was.
    expect(chooseCardType(form(), answers('Bug'), place)).toEqual({ type: task, status: 'new' });
  });

  it('matches a Multiple Choice by any pick, a Checkbox by its state, and never a hidden question', () => {
    const multi: FormDefinition = {
      ...form(),
      sections: [
        {
          id: 's-1',
          title: '',
          questions: [
            { id: 'q-m', type: 'multi', prompt: 'Areas', options: ['UI', 'API'] },
            { id: 'q-c', type: 'checkbox', prompt: 'Urgent?' },
          ],
        },
        {
          id: 's-2',
          title: '',
          showIf: { questionId: 'q-m', anyOf: ['API'] },
          questions: [{ id: 'q-h', type: 'single', prompt: 'Hidden', options: ['Yes'] }],
        },
      ],
    };
    const rule = (questionId: string, anyOf: string[], typeId: string): CardTypeRule => ({
      id: `r-${typeId}`,
      questionId,
      anyOf,
      typeId,
      status: 'new',
    });
    const m = withTypeRules(multi, [rule('q-h', ['Yes'], 'bug'), rule('q-m', ['API'], 'feature')]);
    const pick = (a: Record<string, unknown>) =>
      chooseCardType(m, new Map(Object.entries(a) as [string, never][]), place)!.type.id;
    expect(pick({ 'q-m': ['UI', 'API'] })).toBe('feature');
    expect(pick({ 'q-m': ['UI'], 'q-h': 'Yes' })).toBe('task');
    const c = withTypeRules(multi, [rule('q-c', ['Not Ticked'], 'bug')]);
    expect(chooseCardType(c, new Map(), place)!.type.id).toBe('bug');
    expect(chooseCardType(c, new Map([['q-c', true as never]]), place)!.type.id).toBe('task');
  });

  it('skips a broken rule, so the default type takes the response, never dropping it', () => {
    const broken = [
      { ...bugRule, questionId: 'q-gone' },
      { ...bugRule, anyOf: ['Defect'] },
      { ...bugRule, typeId: 'gone' },
      { ...bugRule, status: 'archived' },
    ];
    for (const r of broken) {
      const chosen = chooseCardType(form([r]), answers('Bug'), place)!;
      expect(chosen.type.id).toBe('task');
    }
    const off: RulePlace = { types, boards: [{ ...board, addTypes: ['task', 'feature'] }] };
    expect(chooseCardType(form([bugRule]), answers('Bug'), off)!.type.id).toBe('task');
    // No default type: nothing to file (the destination's own problem speaks).
    expect(
      chooseCardType(form([bugRule]), answers('Bug'), { types: [bug], boards: [board] }),
    ).toBeNull();
  });

  it('moves a rule column its type no longer uses to its first column', () => {
    const r = { ...bugRule, status: 'new' };
    expect(chooseCardType(form([r]), answers('Bug'), place)!.status).toBe('triage');
  });
});

describe('the card a rule makes', () => {
  it('maps answers by the rule on its type and takes its column; Title stays the form’s', () => {
    const f = form([bugRule]);
    const a = answers('Bug', { 'q-sev': 'High', 'q-what': 'Click Export' });
    const chosen = chooseCardType(f, a, place)!;
    const card = responseCard(f, 'form', a, chosen.type, 3, false, 0, {
      rule: chosen.rule!,
      status: chosen.status,
    });
    expect(card.type).toBe('bug');
    expect(card.fields).toMatchObject({
      title: 'Export fails',
      status: 'triage',
      'f-sev': 'High',
      'f-steps': 'Click Export',
    });
    expect(card.fields['description']).toContain('What type of request is this?');
    // Without a rule, the default card as ever.
    const plain = responseCard(f, 'form', a, task, 3, false, 0);
    expect(plain.fields['status']).toBe('new');
    expect(plain.fields).not.toHaveProperty('f-sev');
  });

  it('ruleTarget: Title from goesTo, a field from the rule, Description otherwise, broken when gone', () => {
    const qs = form().sections.flatMap((s) => s.questions);
    const q = (id: string) => qs.find((x) => x.id === id)!;
    expect(ruleTarget(q('q-title'), bugRule, bug).to).toBe('title');
    expect(ruleTarget(q('q-sev'), bugRule, bug)).toMatchObject({ to: 'field', fieldId: 'f-sev' });
    expect(ruleTarget(q('q-kind'), bugRule, bug)).toEqual({ to: 'description' });
    expect(ruleTarget(q('q-sev'), bugRule, feature)).toEqual({ to: 'description', broken: true });
    expect(ruleFieldChoices(bugRule, q('q-what'), bug)).toEqual([{ field: bug.custom![1] }]);
    expect(ruleFieldChoices(bugRule, q('q-sev'), bug).map((c) => c.field.id)).toEqual(['f-sev']);
  });
});

describe('Problems with this Form', () => {
  it('lists each broken rule with its reason, on its question while it is there', () => {
    const cases: [CardTypeRule, string, boolean][] = [
      [{ ...bugRule, questionId: 'q-gone' }, 'question_missing', false],
      [{ ...bugRule, anyOf: ['Defect'] }, 'answer_missing', true],
      [{ ...bugRule, typeId: 'gone', fields: undefined }, 'type_missing', true],
      [{ ...bugRule, status: 'archived' }, 'status_missing', true],
    ];
    for (const [rule, reason, onQuestion] of cases) {
      const problems = publishProblems(form([rule]), task, place).filter(
        (p) => p.kind === 'broken_type_rule',
      );
      expect(problems).toEqual([
        {
          kind: 'broken_type_rule',
          ruleId: 'r-bug',
          reason,
          ...(onQuestion ? { questionId: 'q-kind' } : {}),
        },
      ]);
      expect(publishProblemText(problems[0]!)).toBe(
        TYPE_RULE_PROBLEM_TEXT[reason as keyof typeof TYPE_RULE_PROBLEM_TEXT],
      );
    }
    const off: RulePlace = { types, boards: [{ ...board, addTypes: ['task'] }] };
    expect(typeRuleProblem(bugRule, form([bugRule]), off)).toBe('type_not_on_board');
    // Judged only with the board: without it (or on a sheet form) rules are not read.
    expect(publishProblems(form([{ ...bugRule, questionId: 'q-gone' }]), task)).toEqual([]);
  });

  it('lists a rule mapping whose field went, and a required field of its type no question fills', () => {
    const required: ItemTypeDef = {
      ...bug,
      custom: [
        {
          id: 'f-sev',
          label: 'Severity',
          kind: 'choice',
          options: ['Low', 'High'],
          required: true,
        },
      ],
      fields: ['title', 'status', 'f-sev'],
    };
    const problems = publishProblems(form([bugRule]), task, {
      types: [task, required, feature],
      boards: [board],
    });
    expect(problems).toEqual([
      { kind: 'broken_mapping', questionId: 'q-what', ruleId: 'r-bug' },
      { kind: 'required_unasked', fieldId: 'f-sev', field: 'Severity', type: 'Bug' },
    ]);
    expect(publishProblemText(problems[0]!)).toMatch(/card type rule/);
    // A healthy rule adds nothing.
    expect(publishProblems(form([bugRule, featureRule]), task, place)).toEqual([]);
    // A required question in a section every response sees, mapped by the rule, fills the field.
    const steps: ItemTypeDef = {
      ...bug,
      custom: [
        bug.custom![0]!,
        { id: 'f-steps', label: 'Steps', kind: 'longtext', required: true },
      ],
    };
    const asked = form([bugRule]);
    asked.sections[0]!.questions[2]!.required = true;
    expect(
      publishProblems(asked, task, { types: [task, steps, feature], boards: [board] }),
    ).toEqual([]);
  });
});

describe('edges', () => {
  it('reads a rule without a destination as off its board, and files nothing without one', () => {
    const { destination: _d, ...bare } = form();
    expect(typeRuleProblem(bugRule, bare, place)).toBe('type_not_on_board');
    expect(chooseCardType(bare, new Map(), place)).toBeNull();
  });

  it('takes answers as a plain record too', () => {
    expect(chooseCardType(form([bugRule]), { 'q-kind': 'Bug' }, place)!.type.id).toBe('bug');
  });

  it('marks a field another question uses on the rule’s type, and lists none without fields', () => {
    const q = form().sections[0]!.questions.find((x) => x.id === 'q-what')!;
    expect(ruleFieldChoices({ fields: { 'q-x': 'f-steps' } }, q, bug)).toEqual([
      { field: bug.custom![1], takenBy: 'q-x' },
    ]);
    expect(ruleFieldChoices({}, q, feature)).toEqual([]);
  });

  it('a new rule on a board none of whose columns its type uses keeps the default column', () => {
    expect(newTypeRule(form(), [task, bug], { columns: [{ status: 'new' }] }, 'r-1')).toMatchObject(
      {
        typeId: 'bug',
        status: 'new',
      },
    );
    expect(newTypeRule({ sections: [] }, types, board, 'r-1')).toBeNull();
  });

  it('updateTypeRule changes only its rule, and drops emptied fields', () => {
    const f = form([bugRule, featureRule]);
    const next = updateTypeRule(f, 'r-feat', { fields: {} });
    expect(next.destination!.typeRules).toEqual([bugRule, featureRule]);
    expect(updateTypeRule(f, 'r-bug', { status: 'done' }).destination!.typeRules![0]).toEqual({
      ...bugRule,
      status: 'done',
    });
    expect(updateTypeRule(form(), 'r-x', { status: 'done' }).destination).not.toHaveProperty(
      'typeRules',
    );
  });

  it('caps rules and their fields, and drops a rule with a bad question id or status', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...featureRule,
      id: `r-${i}`,
      typeId: `t${i}`,
    }));
    const fields = Object.fromEntries(Array.from({ length: 105 }, (_, i) => [`q-${i}`, `f-${i}`]));
    const read = readForm({
      ...form(),
      destination: {
        ...form().destination,
        typeRules: [
          { ...bugRule, fields: { ...fields, 'q-bad': 'nope' } },
          { ...featureRule, id: 'r-q', questionId: 7 },
          { ...featureRule, id: 'r-s', status: ' bad' },
          { ...featureRule, id: 'r-f', fields: { 'q-a': 'nope' } },
          ...many,
        ],
      },
    })!;
    const rules = read.destination!.typeRules!;
    expect(rules).toHaveLength(10);
    expect(Object.keys(rules[0]!.fields!)).toHaveLength(100);
    expect(rules.map((r) => r.id)).not.toContain('r-q');
    expect(rules.map((r) => r.id)).not.toContain('r-s');
    expect(rules.find((r) => r.id === 'r-f')).not.toHaveProperty('fields');
  });
});
