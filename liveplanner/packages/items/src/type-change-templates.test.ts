import { describe, expect, it } from 'vitest';
import type { Item } from './item';
import type { ItemTypeDef } from './item-types';
import { applyCardTypeChanges } from './type-changes';
import { templateProblem, withTemplateChanges } from './type-change-templates';
import { templateOf } from './template-names';

// docs/specs/026-plan/plan-agents.md "Card templates": an agent's add, edit and remove of a type's templates.

const statuses = [
  { status: 'todo', name: 'To Do' },
  { status: 'done', name: 'Done' },
];

const BUG: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  color: '#dc2626',
  glyph: 'bug',
  fields: [
    'title',
    'status',
    'description',
    'checklist',
    'labels',
    'due',
    'f-area',
    'f-steps',
    'f-owner',
    'f-tags',
    'f-score',
  ],
  custom: [
    { id: 'f-area', label: 'Area', kind: 'choice', options: ['Web', 'API'] },
    { id: 'f-steps', label: 'Steps', kind: 'longtext' },
    { id: 'f-owner', label: 'Owner', kind: 'person' },
    { id: 'f-tags', label: 'Tags', kind: 'multichoice', options: ['a', 'b'] },
    { id: 'f-score', label: 'Score', kind: 'calculated', calculation: 'childCount' },
  ],
};
const TASK: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  color: '#2563eb',
  glyph: 'star',
  fields: ['title', 'status', 'description'],
  templates: [{ id: 'tp-chore', name: 'Chore', fields: { title: 'Chore' } }],
};
const stored = (...types: ItemTypeDef[]) => ({ version: 1, types });
const SAM = { id: 'p-sam', name: 'Sam Reed', color: '#16a34a' };
const ITEMS = [
  {
    id: 'i1',
    type: 'bug',
    key: 1,
    rank: 'a',
    fields: { title: 'Old', assignee: SAM },
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: SAM,
    updatedBy: SAM,
  },
] as Item[];

const apply = (changes: Parameters<typeof applyCardTypeChanges>[1], types = [BUG, TASK]) =>
  applyCardTypeChanges(stored(...types), changes, statuses, ITEMS);
const typeAfter = (r: ReturnType<typeof apply>, id = 'bug') => {
  if (!r.ok) throw new Error(r.message);
  return r.catalogue!.types.find((t) => t.id === id)!;
};
const refusal = (r: ReturnType<typeof apply>) => {
  if (r.ok) throw new Error('applied');
  return { code: r.code, message: r.message };
};

describe('change_card_types: adding templates', () => {
  it('adds templates on a new type, values named as change_items names them', () => {
    const r = apply([
      {
        op: 'add',
        name: 'Incident',
        fields: ['description', 'checklist', 'labels'],
        custom: [{ name: 'Impact', kind: 'choice', options: ['Low', 'High'] }],
        templates: [
          {
            name: 'Outage',
            fields: {
              title: 'Outage:',
              description: '## What broke\n**Customers** affected',
              Impact: 'high',
              checklist: [{ text: 'Page on-call', done: false }],
              labels: 'ops, p1',
            },
          },
        ],
      },
    ]);
    const incident = typeAfter(r, 'incident');
    const [outage] = incident.templates!;
    expect(outage).toMatchObject({ id: 'tp-outage', name: 'Outage' });
    expect(outage!.fields).toMatchObject({
      title: 'Outage:',
      description: 'What broke\nCustomers affected',
      checklist: [{ text: 'Page on-call', done: false }],
      labels: ['ops', 'p1'],
    });
    expect(Array.isArray(outage!.fields['descriptionRich'])).toBe(true);
    expect(Object.values(outage!.fields)).toContain('High');
  });

  it('adds templates with set, after the fields the change adds, and resolves a person from the cards', () => {
    const r = apply([
      {
        op: 'set',
        type: 'Bug',
        addCustom: [{ name: 'Browser', kind: 'text' }],
        addTemplates: [
          { name: 'Bug Report', fields: { Area: 'web', Browser: 'Firefox', Owner: 'sam reed' } },
          { name: 'Empty' },
        ],
      },
    ]);
    const bug = typeAfter(r);
    const browser = bug.custom!.find((f) => f.label === 'Browser')!.id;
    expect(bug.templates).toEqual([
      {
        id: 'tp-bug-report',
        name: 'Bug Report',
        fields: { 'f-area': 'Web', [browser]: 'Firefox', 'f-owner': SAM },
      },
      { id: 'tp-empty', name: 'Empty', fields: {} },
    ]);
  });

  it('leaves out a field that holds several given as empty', () => {
    const bug = typeAfter(
      apply([{ op: 'set', type: 'bug', addTemplates: [{ name: 'T', fields: { Tags: [] } }] }]),
    );
    expect(bug.templates![0]!.fields).toEqual({});
  });

  it('gives a second template of one name its own id, and refuses the clash by name', () => {
    const r = apply([
      { op: 'set', type: 'bug', addTemplates: [{ name: 'Report' }, { name: 'report' }] },
    ]);
    expect(refusal(r)).toEqual({
      code: 'type_change_invalid',
      message: "report on Bug: a template's name is 1 to 32 characters, unique in its type.",
    });
  });

  it('refuses an 11th template', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ name: `T${i}` }));
    expect(refusal(apply([{ op: 'set', type: 'bug', addTemplates: many }])).message).toBe(
      'Bug can hold at most 10 templates.',
    );
  });

  it('refuses a template over 16 KB', () => {
    const fields = {
      description: 'a'.repeat(10_000),
      'f-steps': 'b'.repeat(2000),
      checklist: Array.from({ length: 50 }, () => ({ text: 'c'.repeat(200), done: false })),
    };
    const r = apply([{ op: 'set', type: 'bug', addTemplates: [{ name: 'Huge', fields }] }]);
    expect(refusal(r).message).toBe('Huge on Bug holds more than 16 KB: shorten it.');
  });

  it('refuses the plan’s templates past 128 KB', () => {
    const fields = {
      title: 't'.repeat(500),
      description: 'a'.repeat(10_000),
      checklist: Array.from({ length: 20 }, () => ({ text: 'c'.repeat(200), done: false })),
    };
    const nine = Array.from({ length: 9 }, (_, i) => ({ name: `Big ${i}`, fields }));
    const r = apply([{ op: 'set', type: 'bug', addTemplates: nine }]);
    expect(refusal(r).message).toBe(
      'The plan’s card templates would hold more than 128 KB: shorten or remove one. Nothing was saved.',
    );
  });
});

describe('change_card_types: what a template never holds', () => {
  it('refuses a value a template never holds, saying what one holds', () => {
    const r = apply([
      { op: 'set', type: 'bug', addTemplates: [{ name: 'Dated', fields: { due: '2026-12-01' } }] },
    ]);
    expect(refusal(r)).toEqual({
      code: 'type_change_invalid',
      message: expect.stringMatching(/^Dated on Bug can't hold due: a template holds the title/),
    });
  });

  it('refuses a custom field a template never holds by its name', () => {
    const r = apply([
      { op: 'set', type: 'bug', addTemplates: [{ name: 'Flag', fields: { flagged: true } }] },
    ]);
    expect(refusal(r).message).toMatch(/^Flag on Bug can't hold flagged/);
  });

  it('refuses a built-in the type doesn’t offer, rather than drop it', () => {
    const r = apply([
      { op: 'add', name: 'Note', templates: [{ name: 'N', fields: { labels: 'x' } }] },
    ]);
    expect(refusal(r)).toEqual({
      code: 'field_unknown',
      message:
        "N on Note can't hold labels: Note cards have no such field (add it with addFields).",
    });
  });

  it('refuses a field the type lacks, naming the template', () => {
    const r = apply([
      { op: 'add', name: 'Note', templates: [{ name: 'N', fields: { Mood: 'x' } }] },
    ]);
    expect(refusal(r)).toEqual({
      code: 'field_unknown',
      message: expect.stringMatching(/^N on Note: Note cards have no field "Mood"/),
    });
  });

  it('refuses a value the card check refuses, as change_items does', () => {
    const r = apply([
      { op: 'set', type: 'bug', addTemplates: [{ name: 'Bad', fields: { Area: 'Desktop' } }] },
    ]);
    expect(refusal(r).code).toBe('choice_unknown');
  });
});

describe('change_card_types: editing and removing templates', () => {
  const withReport = (): ItemTypeDef =>
    typeAfter(
      apply([
        {
          op: 'set',
          type: 'bug',
          addTemplates: [
            {
              name: 'Bug Report',
              fields: { description: '**Steps**', Steps: '*one*', Area: 'Web', labels: ['bug'] },
            },
            { name: 'Release' },
          ],
        },
      ]),
    );

  it('renames a template by name and keeps its id', () => {
    const bug = typeAfter(
      apply(
        [{ op: 'set', type: 'bug', editTemplates: [{ template: 'bug report', name: 'Defect ' }] }],
        [withReport()],
      ),
    );
    expect(bug.templates![0]).toMatchObject({ id: 'tp-bug-report', name: 'Defect' });
  });

  it('sets values over its own, a plain description dropping the old formatting', () => {
    const bug = typeAfter(
      apply(
        [
          {
            op: 'set',
            type: 'bug',
            editTemplates: [{ template: 'tp-bug-report', fields: { description: 'Plain now' } }],
          },
        ],
        [withReport()],
      ),
    );
    const fields = bug.templates![0]!.fields;
    expect(fields['description']).toBe('Plain now');
    expect(fields['descriptionRich']).toBeUndefined();
    expect(fields['f-area']).toBe('Web');
  });

  it('clears values by field name, with their formatting', () => {
    const bug = typeAfter(
      apply(
        [
          {
            op: 'set',
            type: 'bug',
            editTemplates: [{ template: 'Bug Report', clear: ['Steps', 'labels'] }],
          },
        ],
        [withReport()],
      ),
    );
    const fields = bug.templates![0]!.fields;
    expect(fields['f-steps']).toBeUndefined();
    expect(fields['f-stepsRich']).toBeUndefined();
    expect(fields['labels']).toBeUndefined();
    expect(fields['description']).toBe('Steps');
  });

  it('refuses clearing a field the type lacks', () => {
    const r = apply(
      [{ op: 'set', type: 'bug', editTemplates: [{ template: 'Release', clear: ['Mood'] }] }],
      [withReport()],
    );
    expect(refusal(r)).toEqual({
      code: 'field_unknown',
      message: expect.stringMatching(/^Release on Bug: Bug cards have no field "Mood"/),
    });
  });

  it('refuses an edit’s value a template never holds', () => {
    const r = apply(
      [
        {
          op: 'set',
          type: 'bug',
          editTemplates: [{ template: 'Release', fields: { due: '2026-01-01' } }],
        },
      ],
      [withReport()],
    );
    expect(refusal(r).message).toMatch(/^Release on Bug can't hold due/);
  });

  it('removes templates by name or id, and the last one takes the key with it', () => {
    const one = typeAfter(
      apply([{ op: 'set', type: 'bug', removeTemplates: ['release'] }], [withReport()]),
    );
    expect(one.templates!.map((t) => t.name)).toEqual(['Bug Report']);
    const none = typeAfter(
      apply(
        [{ op: 'set', type: 'bug', removeTemplates: ['tp-bug-report', 'Release'] }],
        [withReport()],
      ),
    );
    expect(none.templates).toBeUndefined();
  });

  it('refuses an unknown template, listing the type’s', () => {
    const r = apply([{ op: 'set', type: 'bug', removeTemplates: ['Nope'] }], [withReport()]);
    expect(refusal(r)).toEqual({
      code: 'template_unknown',
      message: 'Bug has no template "Nope". Templates: Bug Report, Release.',
    });
  });

  it('says a type with none has none, and how to add one', () => {
    const r = apply([{ op: 'set', type: 'bug', editTemplates: [{ template: 'X', name: 'Y' }] }]);
    expect(refusal(r).message).toBe(
      'Bug has no template "X". Bug has no templates: add one with change_card_types (addTemplates).',
    );
  });

  it('leaves a type with no template change as it was', () => {
    expect(withTemplateChanges(BUG, {}, { statuses, items: [] })).toBe(BUG);
  });
});

describe('templateOf', () => {
  it('names a template another type holds, and the type to give', () => {
    const r = templateOf(BUG, 'chore', [BUG, TASK]);
    expect(r).toEqual({
      ok: false,
      code: 'template_unknown',
      message:
        'Chore is a Task template, not a Bug one: give type "Task". Bug has no templates: add one with change_card_types (addTemplates).',
    });
  });

  it('finds a template by id or by name, case and spacing aside', () => {
    expect(templateOf(TASK, 'tp-chore')).toMatchObject({ ok: true, template: { name: 'Chore' } });
    expect(templateOf(TASK, '  CHORE ')).toMatchObject({ ok: true });
    expect(templateOf(TASK, '   ')).toMatchObject({ ok: false });
  });
});

describe('templateProblem', () => {
  const typed = { ...BUG, templates: [{ id: 'tp-a', name: 'A', fields: {} }] };
  it('says a card rule and an id clash in words', () => {
    expect(templateProblem(typed, 'types[0].templates[0].fields')).toMatch(
      /^A on Bug: a value breaks a card’s rule \(a title up to 500 characters, a description up to 10,000/,
    );
    expect(templateProblem(typed, 'types[0].templates[0].id')).toBe(
      'A on Bug: two templates have one id.',
    );
    expect(templateProblem(typed, 'types[0].templates[3].name')).toBe(
      "Bug: a template's name is 1 to 32 characters, unique in its type.",
    );
  });

  it('answers null for a reason not about templates', () => {
    expect(templateProblem(typed, 'types[0].fields')).toBeNull();
    expect(templateProblem(undefined, 'types[0].templates[0]')).toBeNull();
  });

  it('says a catalogue refusal of another kind as before', () => {
    const r = applyCardTypeChanges(
      stored(BUG),
      [{ op: 'set', type: 'bug', name: 'x'.repeat(40) }],
      statuses,
    );
    expect(refusal(r).message).toMatch(
      /^The card types would break a rule \(Bug: types\[0\]\.label\)|rule/,
    );
  });
});
