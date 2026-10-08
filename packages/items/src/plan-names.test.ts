import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import {
  assignedPeople,
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
  it('says when the document has no board', () => {
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

  it('keeps a person object and an unknown priority as given (the api checks them)', () => {
    const r = resolveFields({ assignee: ALI, priority: 'whenever' }, ITEM_TYPES[1], naming);
    expect(r).toEqual({ ok: true, fields: { assignee: ALI, priority: 'whenever' } });
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
    expect(resolveFields({ parent: '#99' }, bug, naming)).toMatchObject({ code: 'item_unknown' });
  });

  it('names an ambiguous item', () => {
    const items = [item({ title: 'a' }, { id: 'abc1' }), item({ title: 'b' }, { id: 'abc2' })];
    expect(resolveItem('abc', items)).toMatchObject({ ok: false, code: 'item_unknown' });
  });
});
