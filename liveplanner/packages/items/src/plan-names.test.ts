import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import {
  assignedPeople,
  choiceOption,
  fieldKeyOf,
  personNamed,
  resolveFields,
  resolveItem,
  resolveStatus,
  resolveType,
} from './plan-names';
import { ALI, SAM, item } from './test-items';

const statuses = [
  { status: 'backlog~k3f2', name: 'Backlog' },
  { status: 'in-progress~k3f2', name: 'In Progress' },
  { status: 'done~k3f2', name: 'Done' },
];

const bug: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'bug',
  label: 'Bug',
  fields: ['title', 'status', 'assignee', 'f-severity', 'f-blocks'],
  custom: [
    { id: 'f-severity', label: 'Severity', kind: 'choice', options: ['S1', 'S2', 'S3'] },
    { id: 'f-blocks', label: 'Blocks', kind: 'card', linkType: 'task' },
    { id: 'f-notes', label: 'Repro Steps', kind: 'longtext' },
  ],
};

describe('resolveStatus', () => {
  it('takes a status id or a column name, case, spacing and punctuation aside', () => {
    expect(resolveStatus('done~k3f2', statuses)).toMatchObject({ ok: true, status: 'done~k3f2' });
    for (const name of ['In Progress', 'in progress', 'IN-PROGRESS', ' in  progress '])
      expect(resolveStatus(name, statuses)).toMatchObject({ ok: true, status: 'in-progress~k3f2' });
  });
  it('refuses an unknown name, listing the columns', () => {
    const r = resolveStatus('Review', statuses);
    expect(r).toMatchObject({ ok: false, code: 'status_unknown' });
    expect(!r.ok && r.message).toContain('Columns: Backlog, In Progress, Done');
  });
  it('says when the project has no board', () => {
    const r = resolveStatus('Done', []);
    expect(!r.ok && r.message).toContain('no Plan board yet');
  });
});

describe('resolveType', () => {
  it('takes an id or a name', () => {
    expect(resolveType('bug', [bug])).toMatchObject({ ok: true, type: bug });
    expect(resolveType('BUG', [bug])).toMatchObject({ ok: true, type: bug });
    expect(resolveType('Task', ITEM_TYPES)).toMatchObject({ ok: true, type: { id: 'task' } });
  });
  it('refuses an unknown type, listing the catalogue', () => {
    const r = resolveType('Epic', ITEM_TYPES);
    expect(r).toMatchObject({ ok: false, code: 'type_unknown' });
    expect(!r.ok && r.message).toContain('Task (task)');
  });
});

describe('people', () => {
  it('lists each assigned person once', () => {
    const items = [
      item({ assignee: SAM }),
      item({ assignee: SAM }),
      item({ assignee: ALI }),
      item({}),
    ];
    expect(assignedPeople(items)).toEqual([SAM, ALI]);
  });
  it('reuses an assigned person by name, else makes a stable named one', () => {
    expect(personNamed('sam lee', [SAM])).toBe(SAM);
    const a = personNamed('Robin', [SAM]);
    expect(a).toMatchObject({ id: 'n-robin', name: 'Robin' });
    expect(a.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(personNamed('robin', [])).toEqual({ ...a, name: 'robin' });
  });
});

describe('resolveFields', () => {
  const parent = item({ title: 'Relaunch' }, { id: 'proj0001', key: 40, type: 'project' });
  const naming = { statuses, items: [parent, item({ assignee: SAM })] };

  it('resolves built-in fields by id and interface name', () => {
    const r = resolveFields(
      {
        'Due Date': '2026-11-20',
        Priority: 'High',
        labels: 'seo, copy',
        status: 'done',
        assignee: 'Sam Lee',
        parent: '#40',
      },
      ITEM_TYPES[1],
      naming,
    );
    expect(r).toEqual({
      ok: true,
      fields: {
        due: '2026-11-20',
        priority: 'high',
        labels: ['seo', 'copy'],
        status: 'done~k3f2',
        assignee: SAM,
        parent: 'proj0001',
      },
    });
  });

  it('keeps a person object as given', () => {
    const r = resolveFields({ assignee: ALI }, ITEM_TYPES[1], naming);
    expect(r).toEqual({ ok: true, fields: { assignee: ALI } });
  });

  // The api refused these with a bare field_value_invalid (production Error·Api·Http400.ItemChange); they are
  // refused here, saying what the field takes.
  it('refuses a built-in value the api would, naming what the field takes', () => {
    const refusal = (fields: Record<string, unknown>) => {
      const r = resolveFields(fields, ITEM_TYPES[1], naming);
      return r.ok ? null : r;
    };
    expect(refusal({ priority: 'whenever' })).toMatchObject({
      code: 'value_invalid',
      message: '"whenever" is not a Priority: give one of Urgent, High, Medium, Low.',
    });
    expect(refusal({ estimate: 1000 })?.message).toBe(
      '1000 is not an Estimate: give a number from 0 to 999.',
    );
    expect(refusal({ due: 'tomorrow' })?.message).toContain('give a date');
    // A number written as text is read as the number.
    expect(resolveFields({ estimate: '5' }, ITEM_TYPES[1], naming)).toEqual({
      ok: true,
      fields: { estimate: 5 },
    });
  });

  it('resolves custom fields by name, Choice options and Card links', () => {
    const r = resolveFields(
      { severity: 's2', Blocks: '#40', 'repro steps': 'Click it', 'f-severity': 'S1' },
      bug,
      naming,
    );
    expect(r).toEqual({
      ok: true,
      fields: { 'f-severity': 'S1', 'f-blocks': 'proj0001', 'f-notes': 'Click it' },
    });
  });

  it('refuses an unknown field, option, status or item', () => {
    expect(resolveFields({ Effort: 3 }, bug, naming)).toMatchObject({
      ok: false,
      code: 'field_unknown',
    });
    const choice = resolveFields({ Severity: 'S9' }, bug, naming);
    expect(!choice.ok && choice.message).toContain('Options: S1, S2, S3');
    expect(resolveFields({ status: 'Review' }, bug, naming)).toMatchObject({
      code: 'status_unknown',
    });
    expect(resolveFields({ Blocks: '#99' }, bug, naming)).toMatchObject({ code: 'item_unknown' });
    // Parent is Task's Card field, so a card it names must exist; a type without it does not know it.
    expect(resolveFields({ parent: '#99' }, ITEM_TYPES[1], naming)).toMatchObject({
      code: 'item_unknown',
    });
    expect(resolveFields({ parent: '#99' }, bug, naming)).toMatchObject({ code: 'field_unknown' });
  });

  it('reads "#12 Title", as list_items shows a card link, by its number', () => {
    const items = [item({ title: 'Login' }, { id: 'abc1', key: 12 })];
    expect(resolveItem('#12 Login', items)).toMatchObject({ ok: true, item: { id: 'abc1' } });
    expect(resolveItem('#12 Anything else', items)).toMatchObject({ ok: true });
  });

  it('gives a new person a colour no one on the project has, while colours remain', () => {
    const first = personNamed('Sam', []);
    const people = [first];
    for (const name of ['Alex', 'Priya', 'Jo', 'Kim', 'Lee'])
      people.push(personNamed(name, people));
    expect(new Set(people.map((p) => p.color)).size).toBe(people.length);
    // The same name, with no one else around, is the same person and colour.
    expect(personNamed('Sam', [])).toEqual(first);
  });

  it('matches a Choice option exactly before loosely, never by symbols alone', () => {
    const stars = ['★', '★★', '★★★'];
    expect(choiceOption(stars, '★★')).toBe('★★');
    expect(choiceOption(stars, '★★★★')).toBeUndefined();
    expect(choiceOption(['In Progress', 'Done'], 'in progress')).toBe('In Progress');
    expect(choiceOption(['In Progress', 'Done'], 'in-progress')).toBe('In Progress');
    // Two options one key apart are told apart only exactly.
    expect(choiceOption(['A-1', 'A 1'], 'a1')).toBeUndefined();
    expect(choiceOption(['A-1', 'A 1'], 'A 1')).toBe('A 1');
  });

  it('names an ambiguous item', () => {
    const items = [item({ title: 'a' }, { id: 'abc1' }), item({ title: 'b' }, { id: 'abc2' })];
    expect(resolveItem('abc', items)).toMatchObject({ ok: false, code: 'item_unknown' });
  });
});

// docs/specs/026-plan/plan-agents.md "Naming things as people do": a type's own field name wins over a built-in's
// other name.
describe('fieldKeyOf', () => {
  const post: ItemTypeDef = {
    ...ITEM_TYPES[1],
    id: 'post',
    label: 'Post',
    fields: ['title', 'status', 'assignee', 'f-owner'],
    custom: [{ id: 'f-owner', label: 'Owner', kind: 'text' }],
  };

  it('reads "Owner" as the type’s own Owner field where it has one, else the Assignee', () => {
    expect(fieldKeyOf('Owner', post)).toEqual({ ok: true, key: 'f-owner' });
    expect(fieldKeyOf('owner', post)).toEqual({ ok: true, key: 'f-owner' });
    expect(fieldKeyOf('Owner', bug)).toEqual({ ok: true, key: 'assignee' });
    expect(fieldKeyOf('Assigned To', post)).toEqual({ ok: true, key: 'assignee' });
  });

  it('always reads a built-in’s id as the built-in', () => {
    expect(fieldKeyOf('assignee', post)).toEqual({ ok: true, key: 'assignee' });
    expect(fieldKeyOf('Due', post)).toEqual({ ok: true, key: 'due' });
  });

  it('writes a value named "Owner" to the custom field', () => {
    expect(resolveFields({ Owner: 'Ana' }, post, { statuses, items: [] })).toEqual({
      ok: true,
      fields: { 'f-owner': 'Ana' },
    });
  });
});
