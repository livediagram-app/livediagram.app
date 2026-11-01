import { describe, expect, it } from 'vitest';
import { applyCardTypeChanges, type CardTypeChange } from './type-changes';
import { typesOf, type ItemTypeCatalogue } from './type-catalogue';
import { refuseInheritedEdits, withBase, withOwnFields } from './type-change-inherit';

// docs/specs/026-plan/plan-agents.md "Changing card types": `inherits` on add and set, and the refusals on an
// inherited type (docs/specs/026-plan/item-types.md "Inherited types").

const statuses = [
  { status: 'todo~a1', name: 'To Do' },
  { status: 'done~a1', name: 'Done' },
];

const run = (stored: ItemTypeCatalogue | null, changes: readonly CardTypeChange[]) =>
  applyCardTypeChanges(stored, changes, statuses);

const ok = (r: ReturnType<typeof run>) => {
  if (!r.ok) throw new Error(r.message);
  return r;
};
const refused = (r: ReturnType<typeof run>) => {
  if (r.ok) throw new Error('expected a refusal');
  return r.message;
};

// Work, with an Area choice and Blocked By; Bug inheriting from it, with a Severity of its own.
const PLAN = ok(
  run(null, [
    {
      op: 'add',
      name: 'Work',
      fields: ['description', 'assignee'],
      custom: [{ name: 'Area', kind: 'choice', options: ['Web', 'API'] }],
      statuses: ['To Do', 'Done'],
      defaultStatus: 'To Do',
    },
    {
      op: 'set',
      type: 'Work',
      addCustom: [{ name: 'Blocked By', kind: 'card', linkType: 'Work', blocks: true }],
    },
    {
      op: 'add',
      name: 'Bug',
      inherits: 'work',
      color: '#dc2626',
      custom: [{ name: 'Severity', kind: 'choice', options: ['S1', 'S2'] }],
    },
  ]),
).catalogue!;
const byId = (c: ItemTypeCatalogue | null, id: string) => typesOf(c).find((t) => t.id === id)!;

describe('change_card_types: inherits', () => {
  it('adds a type inheriting from a base, its own fields after the base’s', () => {
    const bug = byId(PLAN, 'bug');
    expect(bug.inherits).toBe('work');
    expect(bug.color).toBe('#dc2626');
    expect(bug.fields).toEqual([...byId(PLAN, 'work').fields, 'f-severity']);
    expect(bug.ownFields).toEqual(['f-severity']);
    expect(bug.custom!.find((c) => c.id === 'f-blocked-by')).toMatchObject({ blocks: true });
    expect(bug.statuses).toEqual(['todo~a1', 'done~a1']);
    expect(bug.defaultStatus).toBe('todo~a1');
  });

  it('flows a base change to its inheriting types within the same call', () => {
    const r = ok(
      run(PLAN, [
        { op: 'set', type: 'Work', addFields: ['due'], removeCustom: ['Area'] },
        { op: 'set', type: 'Bug', addFields: ['priority'] },
      ]),
    );
    const bug = byId(r.catalogue, 'bug');
    expect(bug.fields).toContain('due');
    expect(bug.fields).not.toContain('f-area');
    expect(bug.ownFields).toEqual(['f-severity', 'priority']);
  });

  it('sets a base on an existing type, and detaches with null keeping a copy', () => {
    const r = ok(
      run(PLAN, [
        { op: 'add', name: 'Story', fields: ['labels'] },
        { op: 'set', type: 'Story', inherits: 'Work' },
      ]),
    );
    const story = byId(r.catalogue, 'story');
    expect(story.inherits).toBe('work');
    expect(story.ownFields).toEqual(['labels']);
    const detached = byId(
      ok(run(r.catalogue, [{ op: 'set', type: 'Story', inherits: null }])).catalogue,
      'story',
    );
    expect(detached.inherits).toBeUndefined();
    expect(detached.fields).toEqual(story.fields);
  });

  it('detaches the inheriting types of a deleted base', () => {
    const r = ok(run(PLAN, [{ op: 'delete', type: 'Work' }]));
    const bug = byId(r.catalogue, 'bug');
    expect(bug.inherits).toBeUndefined();
    expect(bug.custom!.map((c) => c.label)).toEqual(['Area', 'Blocked By', 'Severity']);
  });

  it('refuses a chain, a base given a base, and a type inheriting from itself', () => {
    expect(refused(run(PLAN, [{ op: 'add', name: 'Story', inherits: 'Bug' }]))).toBe(
      'Bug inherits from Work, and a type inherits only from one that inherits from none.',
    );
    expect(
      refused(
        run(PLAN, [
          { op: 'add', name: 'Epic' },
          { op: 'set', type: 'Work', inherits: 'Epic' },
        ]),
      ),
    ).toBe('Bug inherits from Work: a base type inherits from none.');
    expect(refused(run(PLAN, [{ op: 'set', type: 'Work', inherits: 'Work' }]))).toBe(
      "Work can't inherit from itself.",
    );
  });

  it('names every inheriting type when a base with several is given a base', () => {
    const two = ok(
      run(PLAN, [
        { op: 'add', name: 'Story', inherits: 'Work' },
        { op: 'add', name: 'Epic' },
      ]),
    );
    expect(refused(run(two.catalogue, [{ op: 'set', type: 'Work', inherits: 'Epic' }]))).toBe(
      'Bug and Story inherit from Work: a base type inherits from none.',
    );
  });

  it('refuses a change to what an inherited type takes from its base, naming the base', () => {
    const tail = 'change Work, or detach Bug with inherits: null.';
    expect(refused(run(PLAN, [{ op: 'set', type: 'Bug', statuses: ['Done'] }]))).toBe(
      `Bug takes its statuses from Work: ${tail}`,
    );
    expect(refused(run(PLAN, [{ op: 'set', type: 'Bug', defaultStatus: null }]))).toBe(
      `Bug takes its Default State from Work: ${tail}`,
    );
    expect(refused(run(PLAN, [{ op: 'set', type: 'Bug', removeFields: ['assignee'] }]))).toBe(
      `Bug takes "assignee" from Work: ${tail}`,
    );
    expect(refused(run(PLAN, [{ op: 'set', type: 'Bug', removeCustom: ['Area'] }]))).toBe(
      `Bug takes "Area" from Work: ${tail}`,
    );
    expect(
      refused(
        run(PLAN, [{ op: 'set', type: 'Bug', editCustom: [{ field: 'Area', name: 'Zone' }] }]),
      ),
    ).toBe(`Bug takes "Area" from Work: ${tail}`);
    expect(refused(run(PLAN, [{ op: 'add', name: 'Story', inherits: 'Work', tabs: [] }]))).toBe(
      'Story takes its tabs from Work: change Work, or detach Story with inherits: null.',
    );
    // Its own fields stay its own to change.
    const own = ok(
      run(PLAN, [
        {
          op: 'set',
          type: 'Bug',
          editCustom: [{ field: 'Severity', name: 'Sev' }],
          name: 'Defect',
        },
      ]),
    );
    expect(byId(own.catalogue, 'bug').custom!.at(-1)!.label).toBe('Sev');
  });

  it('names the inheriting type a base change takes past a cap', () => {
    const custom = Array.from({ length: 10 }, (_, i) => ({ name: `Own ${i}`, kind: 'text' }));
    const full = ok(run(PLAN, [{ op: 'set', type: 'Bug', addCustom: custom.slice(0, 9) }]));
    expect(
      refused(
        run(full.catalogue, [
          { op: 'set', type: 'Work', addCustom: [{ name: 'More', kind: 'text' }] },
        ]),
      ),
    ).toBe('The card types would break a rule (Bug: types[1].custom); nothing was saved.');
  });
});

describe('the inheritance helpers agents’ changes use', () => {
  const work = byId(PLAN, 'work');
  const bare = {
    ...work,
    id: 'bare',
    label: 'Bare',
    fields: ['title', 'status', 'assignee'],
    custom: undefined,
  };
  const child = { ...byId(PLAN, 'bug'), inherits: 'bare' };

  it('names a base’s base by id when the list lacks it', () => {
    expect(() => withBase(child, { ...bare, inherits: 'gone' }, [bare, child])).toThrow(
      'Bare inherits from gone, and a type inherits only from one that inherits from none.',
    );
  });

  it('names an inherited built-in field by id, and leaves a type with no base alone', () => {
    expect(() => refuseInheritedEdits(child, {}, ['assignee'], [bare, child])).toThrow(
      'Bug takes "assignee" from Bare',
    );
    expect(() => refuseInheritedEdits(child, {}, ['f-severity'], [bare, child])).not.toThrow();
    expect(withOwnFields(work, [work])).toBe(work);
  });
});
