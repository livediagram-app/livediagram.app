import { describe, expect, it } from 'vitest';
import { ITEM_TYPES } from './item-types';
import { DEFAULT_STATUS_PENDING, NEW_ITEM_TYPE, applyCardTypeChanges } from './type-changes';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  defaultCatalogue,
  validateItemTypeCatalogue,
} from './type-catalogue';

const statuses = [
  { status: 'todo~a1', name: 'To Do' },
  { status: 'done~a1', name: 'Done' },
];

// A project with the default types, as one made before card types started empty reads.
const DEFAULTS = defaultCatalogue();

const ok = (r: ReturnType<typeof applyCardTypeChanges>) => {
  if (!r.ok) throw new Error(r.message);
  return r;
};

describe('applyCardTypeChanges: add', () => {
  it('adds a type as Add Type starts one, with custom fields by name', () => {
    const r = ok(
      applyCardTypeChanges(
        DEFAULTS,
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

  it('places a field ticked Show on Card on the Display a new type is given', () => {
    const r = ok(
      applyCardTypeChanges(
        DEFAULTS,
        [
          {
            op: 'add',
            name: 'Lead',
            custom: [
              { name: 'Value', kind: 'number', onCard: true },
              { name: 'Notes', kind: 'long text' },
            ],
            display: { detailed: { head: ['Number'] } },
          },
        ],
        statuses,
      ),
    );
    const lead = r.catalogue!.types.find((t) => t.label === 'Lead')!;
    expect(lead.display!.detailed).toEqual({ head: ['key'], body: ['f-value'] });
  });

  it('takes built-in fields, a colour and a glyph', () => {
    const r = ok(
      applyCardTypeChanges(
        DEFAULTS,
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
      applyCardTypeChanges(DEFAULTS, [change], statuses);
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

// docs/specs/026-plan/plan-agents.md "Changing card types": a Card field of several card types.
describe('applyCardTypeChanges: card fields of several types', () => {
  it('adds one linking to every type named, linkType first, each once', () => {
    const r = ok(
      applyCardTypeChanges(
        DEFAULTS,
        [
          {
            op: 'add',
            name: 'Risk',
            custom: [
              { name: 'Owner', kind: 'card', linkType: 'Project', linkTypes: ['task', 'Project'] },
              { name: 'About', kind: 'card', linkTypes: ['Task'] },
            ],
          },
        ],
        statuses,
      ),
    );
    const risk = r.catalogue!.types.find((t) => t.id === 'risk')!;
    expect(risk.custom).toEqual([
      {
        id: 'f-owner',
        label: 'Owner',
        kind: 'card',
        linkType: 'project',
        linkTypes: ['project', 'task'],
      },
      { id: 'f-about', label: 'About', kind: 'card', linkType: 'task' },
    ]);
    expect(validateItemTypeCatalogue(r.catalogue).ok).toBe(true);
  });

  it('replaces a Card field’s types in place, and refuses them on any other kind or empty', () => {
    const r = ok(
      applyCardTypeChanges(
        DEFAULTS,
        [
          {
            op: 'set',
            type: 'Task',
            editCustom: [{ field: 'Parent', linkTypes: ['Project', 'Task'] }],
          },
        ],
        statuses,
      ),
    );
    const parent = r
      .catalogue!.types.find((t) => t.id === 'task')!
      .custom!.find((f) => f.id === 'parent');
    expect(parent).toMatchObject({ linkType: 'project', linkTypes: ['project', 'task'] });
    const back = ok(
      applyCardTypeChanges(
        r.catalogue,
        [{ op: 'set', type: 'Task', editCustom: [{ field: 'Parent', linkTypes: ['Project'] }] }],
        statuses,
      ),
    );
    expect(
      back.catalogue!.types.find((t) => t.id === 'task')!.custom!.find((f) => f.id === 'parent'),
    ).toEqual({
      id: 'parent',
      label: 'Parent',
      kind: 'card',
      linkType: 'project',
    });
    const withText = ok(
      applyCardTypeChanges(
        DEFAULTS,
        [{ op: 'add', name: 'Bug', custom: [{ name: 'Severity', kind: 'text' }] }],
        statuses,
      ),
    ).catalogue;
    expect(
      applyCardTypeChanges(
        withText,
        [{ op: 'set', type: 'Bug', editCustom: [{ field: 'Severity', linkTypes: ['Task'] }] }],
        statuses,
      ),
    ).toMatchObject({ ok: false, code: 'type_change_invalid' });
    expect(
      applyCardTypeChanges(
        DEFAULTS,
        [{ op: 'set', type: 'Task', editCustom: [{ field: 'Parent', linkTypes: [] }] }],
        statuses,
      ),
    ).toMatchObject({ ok: false, code: 'type_change_invalid' });
    expect(
      applyCardTypeChanges(
        DEFAULTS,
        [{ op: 'set', type: 'Task', editCustom: [{ field: 'Parent', linkTypes: ['Epic'] }] }],
        statuses,
      ),
    ).toMatchObject({ ok: false, code: 'type_unknown' });
  });
});

describe('applyCardTypeChanges: set, delete, restore', () => {
  const withBug = ok(
    applyCardTypeChanges(
      DEFAULTS,
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

  // docs/specs/026-plan/plan-agents.md "Changing card types": a type is made before the board that shows it.
  it('makes a type whose Default State names a column no board has yet, without one, and says so', () => {
    const r = ok(
      applyCardTypeChanges(
        DEFAULTS,
        [
          {
            op: 'add',
            name: 'Candidate',
            defaultStatus: 'Applied',
            custom: [{ name: 'Role', kind: 'text' }],
          },
        ],
        statuses,
      ),
    );
    const made = r.catalogue!.types.find((t) => t.label === 'Candidate')!;
    expect(made.defaultStatus).toBeUndefined();
    expect(made.custom).toEqual([{ id: 'f-role', label: 'Role', kind: 'text' }]);
    expect(r.applied).toEqual([
      `+ Candidate (candidate): Role (f-role); ${DEFAULT_STATUS_PENDING('Applied')}`,
    ]);
    expect(DEFAULT_STATUS_PENDING('Applied')).toBe(
      'no Default State, no board has a column "Applied" yet; set it once one does',
    );
    // With no board at all, the same.
    expect(
      ok(applyCardTypeChanges(DEFAULTS, [{ op: 'add', name: 'Y', defaultStatus: 'Doing' }], []))
        .applied,
    ).toEqual([`+ Y (y); ${DEFAULT_STATUS_PENDING('Doing')}`]);
  });

  // The benchmark's P4: "A Post card cannot show "Owner". It can show: … Owner".
  it('shows a custom field named Owner on the card, not the Assignee', () => {
    const r = ok(
      applyCardTypeChanges(
        DEFAULTS,
        [
          {
            op: 'add',
            name: 'Post',
            custom: [{ name: 'Owner', kind: 'text', onCard: true }],
            display: { detailed: { header: ['Type'], underTitle: ['Owner'] } },
          },
        ],
        statuses,
      ),
    );
    const post = r.catalogue!.types.find((t) => t.label === 'Post')!;
    expect(JSON.stringify(post.display)).toContain('f-owner');
    expect(JSON.stringify(post.display)).not.toContain('assignee');
  });

  it('keeps a type’s Default State when a set names a column no board has', () => {
    const before = ok(
      applyCardTypeChanges(
        DEFAULTS,
        [{ op: 'set', type: 'task', defaultStatus: 'Done' }],
        statuses,
      ),
    );
    const r = ok(
      applyCardTypeChanges(
        before.catalogue,
        [{ op: 'set', type: 'task', defaultStatus: 'Shipped' }],
        statuses,
      ),
    );
    expect(r.catalogue!.types.find((t) => t.id === 'task')!.defaultStatus).toBe('done~a1');
    expect(r.applied[0]).toMatch(/; no Default State, no board has a column "Shipped" yet/);
  });

  it('never removes a field a type must keep', () => {
    expect(
      applyCardTypeChanges(
        DEFAULTS,
        [{ op: 'set', type: 'project', removeFields: ['due'] }],
        statuses,
      ),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining('cannot be removed'),
    });
    expect(
      applyCardTypeChanges(
        DEFAULTS,
        [{ op: 'set', type: 'task', removeFields: ['title'] }],
        statuses,
      ),
    ).toMatchObject({
      ok: false,
    });
  });

  it('deletes a type, naming it for its cards to go to the Trash, the last one too', () => {
    const r = ok(applyCardTypeChanges(withBug, [{ op: 'delete', type: 'Bug' }], statuses));
    expect(r.deleted).toEqual(['bug']);
    expect(r.catalogue!.types.some((t) => t.id === 'bug')).toBe(false);
    const one = { version: ITEM_TYPE_CATALOGUE_VERSION, types: [ITEM_TYPES[1]] };
    expect(
      ok(applyCardTypeChanges(one, [{ op: 'delete', type: 'task' }], statuses)).catalogue?.types,
    ).toEqual([]);
  });

  // docs/specs/026-plan/plan-agents.md "Changing card types": Add Default Types adds what is missing, changes nothing.
  it('adds the default types the project lacks, after its own, changing none it has', () => {
    const edited = ok(
      applyCardTypeChanges(
        withBug,
        [
          { op: 'delete', type: 'note' },
          { op: 'set', type: 'task', name: 'Chore' },
        ],
        statuses,
      ),
    ).catalogue;
    const added = ok(applyCardTypeChanges(edited, [{ op: 'add_default_types' }], statuses));
    expect(added.catalogue!.types.map((t) => t.id)).toEqual([
      'project',
      'task',
      'idea',
      'action',
      'bug',
      'note',
    ]);
    expect(added.catalogue!.types.find((t) => t.id === 'task')!.label).toBe('Chore');
    expect(added.applied).toEqual(['+ Note (note)']);
    // Its older name does the same.
    expect(ok(applyCardTypeChanges(edited, [{ op: 'restore_built_ins' }], statuses))).toEqual(
      added,
    );
  });

  it('stores the default types for a project whose card types are not chosen, nothing when none are left', () => {
    const added = ok(applyCardTypeChanges(null, [{ op: 'add_default_types' }], statuses));
    expect(added.catalogue?.types.map((t) => t.id)).toEqual(ITEM_TYPES.map((t) => t.id));
    const none = ok(
      applyCardTypeChanges(
        null,
        [
          { op: 'add', name: 'Risk' },
          { op: 'delete', type: 'Risk' },
        ],
        statuses,
      ),
    );
    expect(none.catalogue).toBeNull();
  });

  it('reports what applied before a refusal, saving nothing', () => {
    const r = applyCardTypeChanges(
      DEFAULTS,
      [
        { op: 'add', name: 'Risk' },
        { op: 'delete', type: 'Epic' },
      ],
      statuses,
    );
    expect(r).toMatchObject({ ok: false, code: 'type_unknown', applied: ['+ Risk (risk)'] });
  });
});

describe('applyCardTypeChanges: every edit path', () => {
  const tabbed = {
    version: ITEM_TYPE_CATALOGUE_VERSION,
    types: [
      ...ITEM_TYPES,
      {
        ...NEW_ITEM_TYPE,
        id: 'bug',
        label: 'Bug',
        newTitle: 'New bug',
        fields: ['title', 'status', 'f-sev'],
        custom: [{ id: 'f-sev', label: 'Severity', kind: 'text' as const }],
        tabs: [{ id: 't-more', label: 'More', fields: ['f-sev'] }],
      },
    ],
  };

  it('places a field ticked Show on Card on a Display of the type’s own, and takes it off when unticked', () => {
    const displayed = {
      ...tabbed,
      types: tabbed.types.map((t) =>
        t.id === 'bug' ? { ...t, display: { detailed: { head: ['key' as const] } } } : t,
      ),
    };
    const shown = ok(
      applyCardTypeChanges(
        displayed,
        [
          {
            op: 'set',
            type: 'Bug',
            addCustom: [
              { name: 'Customer reported', kind: 'checkbox', onCard: true },
              { name: 'Scratch', kind: 'text', onCard: true },
            ],
            editCustom: [{ field: 'Severity', onCard: true }],
            removeCustom: ['Scratch'],
          },
        ],
        statuses,
      ),
    );
    const bug = shown.catalogue!.types.find((t) => t.id === 'bug')!;
    expect(bug.display!.detailed).toEqual({
      head: ['key'],
      body: ['f-customer-reported', 'f-sev'],
    });
    // Ticked again, it is not placed twice; unticked, it leaves the Display.
    const again = ok(
      applyCardTypeChanges(
        shown.catalogue,
        [{ op: 'set', type: 'Bug', editCustom: [{ field: 'Severity', onCard: true }] }],
        statuses,
      ),
    );
    expect(again.catalogue!.types.find((t) => t.id === 'bug')!.display!.detailed!.body).toEqual([
      'f-customer-reported',
      'f-sev',
    ]);
    const off = ok(
      applyCardTypeChanges(
        shown.catalogue,
        [{ op: 'set', type: 'Bug', editCustom: [{ field: 'Severity', onCard: false }] }],
        statuses,
      ),
    );
    expect(off.catalogue!.types.find((t) => t.id === 'bug')!.display!.detailed).toEqual({
      head: ['key'],
      body: ['f-customer-reported'],
    });
    // A type without a Display of its own keeps none: its default layout shows the field.
    const plain = ok(
      applyCardTypeChanges(
        tabbed,
        [{ op: 'set', type: 'Bug', editCustom: [{ field: 'Severity', onCard: false }] }],
        statuses,
      ),
    );
    expect(plain.catalogue!.types.find((t) => t.id === 'bug')!.display).toBeUndefined();
  });

  it('sets a colour and glyph, keeps a field it already has, and drops a removed field from tabs', () => {
    const r = ok(
      applyCardTypeChanges(
        tabbed,
        [
          {
            op: 'set',
            type: 'Bug',
            color: '#16a34a',
            glyph: 'flag',
            addFields: ['status'],
            removeCustom: ['Severity'],
          },
        ],
        statuses,
      ),
    );
    const bug = r.catalogue!.types.find((t) => t.id === 'bug')!;
    expect(bug).toMatchObject({
      color: '#16a34a',
      glyph: 'flag',
      fields: ['title', 'status'],
    });
    expect(bug.custom ?? []).toEqual([]);
    expect(bug.tabs?.[0]?.fields ?? []).toEqual([]);
  });

  it('refuses a taken name, a second field of one name, and a built-in as a custom field', () => {
    expect(
      applyCardTypeChanges(tabbed, [{ op: 'set', type: 'Bug', name: 'task' }], statuses),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining('already exists'),
    });
    expect(
      applyCardTypeChanges(
        tabbed,
        [{ op: 'set', type: 'Bug', addCustom: [{ name: 'severity', kind: 'text' }] }],
        statuses,
      ),
    ).toMatchObject({ ok: false, message: expect.stringContaining('already has a field') });
    expect(
      applyCardTypeChanges(
        tabbed,
        [{ op: 'set', type: 'Bug', removeCustom: ['status'] }],
        statuses,
      ),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining('use removeFields'),
    });
    expect(
      applyCardTypeChanges(tabbed, [{ op: 'add', name: 'X', fields: ['Severity'] }], statuses),
    ).toMatchObject({
      ok: false,
      code: 'field_unknown',
    });
  });

  it('lets a mistake that is not a refusal throw', () => {
    expect(() =>
      applyCardTypeChanges(
        DEFAULTS,
        [{ op: 'add', name: undefined as unknown as string }],
        statuses,
      ),
    ).toThrow(TypeError);
  });
});
