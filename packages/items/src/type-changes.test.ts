import { describe, expect, it } from 'vitest';
import { ITEM_TYPES } from './item-types';
import { NEW_ITEM_TYPE, applyCardTypeChanges } from './type-changes';
import { ITEM_TYPE_CATALOGUE_VERSION, validateItemTypeCatalogue } from './type-catalogue';

const statuses = [
  { status: 'todo~a1', name: 'To Do' },
  { status: 'done~a1', name: 'Done' },
];

const ok = (r: ReturnType<typeof applyCardTypeChanges>) => {
  if (!r.ok) throw new Error(r.message);
  return r;
};

describe('applyCardTypeChanges: add', () => {
  it('adds a type as Add Type starts one, with custom fields by name', () => {
    const r = ok(
      applyCardTypeChanges(
        null,
        [
          {
            op: 'add',
            name: 'Bug',
            custom: [
              { name: 'Severity', kind: 'Choice', options: ['S1', 'S2'] },
              { name: 'Repro steps', kind: 'long text', onCard: true },
              { name: 'Blocks', kind: 'card', linkType: 'Task' },
            ],
            defaultStatus: 'to do',
            excludedStatuses: ['Done'],
          },
        ],
        statuses,
      ),
    );
    const bug = r.catalogue!.types.find((t) => t.id === 'bug')!;
    expect(bug).toMatchObject({
      label: 'Bug',
      newTitle: 'New bug',
      color: NEW_ITEM_TYPE.color,
      glyph: 'star',
      defaultStatus: 'todo~a1',
      excludedStatuses: ['done~a1'],
    });
    expect(bug.custom).toEqual([
      { id: 'f-severity', label: 'Severity', kind: 'choice', options: ['S1', 'S2'] },
      { id: 'f-repro-steps', label: 'Repro steps', kind: 'longtext', onCard: true },
      { id: 'f-blocks', label: 'Blocks', kind: 'card', linkType: 'task' },
    ]);
    expect(bug.fields).toEqual(
      expect.arrayContaining(['title', 'status', 'f-severity', 'f-blocks']),
    );
    expect(r.applied[0]).toBe(
      '+ Bug (bug): Severity (f-severity), Repro steps (f-repro-steps), Blocks (f-blocks)',
    );
    expect(r.catalogue!.types.slice(0, 5).map((t) => t.id)).toEqual(ITEM_TYPES.map((t) => t.id));
    expect(validateItemTypeCatalogue(r.catalogue).ok).toBe(true);
  });

  it('takes built-in fields, a colour and a glyph', () => {
    const r = ok(
      applyCardTypeChanges(
        null,
        [
          {
            op: 'add',
            name: 'Risk',
            fields: ['Due Date', 'priority'],
            color: '#DC2626',
            glyph: 'bug',
          },
        ],
        statuses,
      ),
    );
    expect(r.catalogue!.types.at(-1)).toMatchObject({
      fields: ['title', 'status', 'due', 'priority'],
      color: '#dc2626',
      glyph: 'bug',
    });
  });

  it('refuses a taken name, a bad colour, glyph, kind, status or link', () => {
    const refusal = (change: Parameters<typeof applyCardTypeChanges>[1][number]) =>
      applyCardTypeChanges(null, [change], statuses);
    expect(refusal({ op: 'add', name: 'task' })).toMatchObject({
      ok: false,
      code: 'type_change_invalid',
    });
    expect(refusal({ op: 'add', name: 'X', color: 'teal' })).toMatchObject({
      code: 'type_change_invalid',
    });
    expect(refusal({ op: 'add', name: 'X', glyph: 'unicorn' })).toMatchObject({
      code: 'type_change_invalid',
    });
    expect(
      refusal({ op: 'add', name: 'X', custom: [{ name: 'A', kind: 'person' }] }),
    ).toMatchObject({
      code: 'type_change_invalid',
    });
    expect(refusal({ op: 'add', name: 'X', defaultStatus: 'Doing' })).toMatchObject({
      code: 'status_unknown',
    });
    expect(refusal({ op: 'add', name: 'X', custom: [{ name: 'L', kind: 'card' }] })).toMatchObject({
      code: 'type_change_invalid',
    });
    expect(
      refusal({ op: 'add', name: 'X', custom: [{ name: 'L', kind: 'card', linkType: 'Epic' }] }),
    ).toMatchObject({
      code: 'type_unknown',
    });
    expect(
      refusal({ op: 'add', name: 'X', custom: [{ name: 'C', kind: 'choice' }] }),
    ).toMatchObject({
      code: 'type_change_invalid',
      message: expect.stringContaining('nothing was saved'),
    });
  });
});

describe('applyCardTypeChanges: set, delete, restore', () => {
  const withBug = ok(
    applyCardTypeChanges(
      null,
      [{ op: 'add', name: 'Bug', custom: [{ name: 'Severity', kind: 'text' }] }],
      statuses,
    ),
  ).catalogue;

  it('edits a type by name, adding and removing fields', () => {
    const r = ok(
      applyCardTypeChanges(
        withBug,
        [
          {
            op: 'set',
            type: 'bug',
            name: 'Defect',
            addFields: ['labels'],
            removeFields: ['assignee'],
            addCustom: [{ name: 'Found in', kind: 'text' }],
            removeCustom: ['severity'],
            defaultStatus: 'Done',
          },
        ],
        statuses,
      ),
    );
    const t = r.catalogue!.types.find((x) => x.id === 'bug')!;
    expect(t.label).toBe('Defect');
    expect(t.fields).toEqual(['title', 'status', 'description', 'labels', 'f-found-in']);
    expect(t.custom).toEqual([{ id: 'f-found-in', label: 'Found in', kind: 'text' }]);
    expect(t.defaultStatus).toBe('done~a1');
    const cleared = ok(
      applyCardTypeChanges(
        r.catalogue,
        [{ op: 'set', type: 'Defect', defaultStatus: null }],
        statuses,
      ),
    );
    expect(cleared.catalogue!.types.find((x) => x.id === 'bug')!.defaultStatus).toBeUndefined();
  });

  it('never removes a field a type must keep', () => {
    expect(
      applyCardTypeChanges(null, [{ op: 'set', type: 'project', removeFields: ['due'] }], statuses),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining('cannot be removed'),
    });
    expect(
      applyCardTypeChanges(null, [{ op: 'set', type: 'task', removeFields: ['title'] }], statuses),
    ).toMatchObject({
      ok: false,
    });
  });

  it('deletes a type, naming it for its cards to go to the Trash, but never the last', () => {
    const r = ok(applyCardTypeChanges(withBug, [{ op: 'delete', type: 'Bug' }], statuses));
    expect(r.deleted).toEqual(['bug']);
    expect(r.catalogue!.types.some((t) => t.id === 'bug')).toBe(false);
    const one = { version: ITEM_TYPE_CATALOGUE_VERSION, types: [ITEM_TYPES[1]] };
    expect(applyCardTypeChanges(one, [{ op: 'delete', type: 'task' }], statuses)).toMatchObject({
      ok: false,
    });
  });

  it('restores the built-ins, keeping the document’s own types; none left goes back to null', () => {
    const edited = ok(
      applyCardTypeChanges(withBug, [{ op: 'delete', type: 'note' }], statuses),
    ).catalogue;
    const kept = ok(applyCardTypeChanges(edited, [{ op: 'restore_built_ins' }], statuses));
    expect(kept.catalogue!.types.map((t) => t.id)).toEqual([...ITEM_TYPES.map((t) => t.id), 'bug']);
    expect(
      ok(applyCardTypeChanges(null, [{ op: 'restore_built_ins' }], statuses)).catalogue,
    ).toBeNull();
    const after = ok(
      applyCardTypeChanges(
        null,
        [{ op: 'restore_built_ins' }, { op: 'add', name: 'Risk' }],
        statuses,
      ),
    );
    expect(after.catalogue).not.toBeNull();
  });

  it('reports what applied before a refusal, saving nothing', () => {
    const r = applyCardTypeChanges(
      null,
      [
        { op: 'add', name: 'Risk' },
        { op: 'delete', type: 'Epic' },
      ],
      statuses,
    );
    expect(r).toMatchObject({ ok: false, code: 'type_unknown', applied: ['+ Risk (risk)'] });
  });
});
