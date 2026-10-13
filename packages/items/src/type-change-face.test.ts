import { describe, expect, it } from 'vitest';
import { applyCardTypeChanges } from './type-changes';
import { defaultCatalogue } from './type-catalogue';
import { typeCardLayout } from './card-display';
import { namedDisplay, type DisplayInput } from './type-change-face';
import type { ItemTypeDef } from './item-types';

// A card type's face and panel through change_card_types (docs/specs/026-plan/plan-agents.md "Changing card types").

const statuses = [
  { status: 'todo~a1', name: 'To Do' },
  { status: 'done~a1', name: 'Done' },
];
const DEFAULTS = defaultCatalogue();
const run = (changes: Parameters<typeof applyCardTypeChanges>[1]) =>
  applyCardTypeChanges(DEFAULTS, changes, statuses);
const typeIn = (r: ReturnType<typeof run>, label: string): ItemTypeDef => {
  if (!r.ok) throw new Error(r.message);
  const t = r.catalogue?.types.find((x) => x.label === label);
  if (!t) throw new Error(`no ${label}`);
  return t;
};

const BUG = {
  op: 'add' as const,
  name: 'Bug',
  fields: ['assignee', 'priority', 'due', 'description'],
  custom: [{ name: 'Severity', kind: 'choice', options: ['S1', 'S2'] }],
};

describe('display', () => {
  it('places fields by name in the slots people see', () => {
    const r = run([
      {
        ...BUG,
        display: {
          detailed: {
            header: ['Type', 'Number'],
            underTitle: ['Severity'],
            bottomRight: ['Assignee'],
          },
          compact: { besideTitle: ['Number'], belowTitle: ['Priority', 'Due Date'] },
        },
      },
    ]);
    const bug = typeIn(r, 'Bug');
    const sev = bug.custom![0]!.id;
    expect(typeCardLayout(bug, 'detailed')).toEqual({
      head: ['type', 'key'],
      body: [sev],
      footEnd: ['assignee'],
    });
    expect(typeCardLayout(bug, 'compact')).toEqual({ lead: ['key'], row: ['priority', 'due'] });
  });

  it('keeps a size left out as it was', () => {
    const r = run([
      { ...BUG, display: { compact: { besideTitle: ['Number'] } } },
      { op: 'set', type: 'Bug', display: { minimal: { afterTitle: ['Assignee'] } } },
    ]);
    const bug = typeIn(r, 'Bug');
    expect(typeCardLayout(bug, 'compact')).toEqual({ lead: ['key'] });
    expect(typeCardLayout(bug, 'minimal')).toEqual({ trail: ['assignee'] });
  });

  it('refuses a field the size cannot draw, naming what it can', () => {
    const r = run([{ ...BUG, display: { minimal: { beforeTitle: ['Severity', 'Description'] } } }]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe('display_invalid');
    expect(r.message).toContain('cannot show "Description"');
    expect(r.message).toContain('Number');
  });

  it('refuses a field the type lacks, an unknown size or place, and a field placed twice', () => {
    const displays: DisplayInput[] = [
      { detailed: { footer: ['Estimate'] } },
      { huge: { header: ['Number'] } },
      { detailed: { sidebar: ['Number'] } },
      { detailed: { header: ['Number'], footer: ['#'] } },
    ];
    for (const display of displays) {
      const r = run([{ ...BUG, display }]);
      expect(r.ok, JSON.stringify(display)).toBe(false);
    }
  });

  it('reads back by name', () => {
    const bug = typeIn(
      run([{ ...BUG, display: { detailed: { underTitle: ['Severity'] } } }]),
      'Bug',
    );
    const named = namedDisplay(bug, (size) => typeCardLayout(bug, size));
    expect(named.detailed).toEqual({ underTitle: ['Severity'] });
  });
});

describe('tabs and detailsLabel', () => {
  it('sets the panel tabs by field name, keeping a same-named tab', () => {
    const first = typeIn(
      run([
        {
          ...BUG,
          tabs: [{ name: 'Triage', fields: ['Severity', 'priority'] }],
          detailsLabel: 'Facts',
        },
      ]),
      'Bug',
    );
    expect(first.tabs).toEqual([
      {
        id: expect.stringMatching(/^t-triage/),
        label: 'Triage',
        fields: [first.custom![0]!.id, 'priority'],
      },
    ]);
    expect(first.detailsLabel).toBe('Facts');
    const again = typeIn(
      run([
        { ...BUG, tabs: [{ name: 'Triage', fields: ['Severity'] }] },
        {
          op: 'set',
          type: 'Bug',
          tabs: [{ name: 'triage', fields: ['description'] }],
          detailsLabel: 'Details',
        },
      ]),
      'Bug',
    );
    expect(again.tabs![0]!.id).toMatch(/^t-triage/);
    expect(again.detailsLabel).toBeUndefined();
  });

  it('refuses the title, votes, a field in two tabs, a missing field and too many tabs', () => {
    const cases = [
      [{ name: 'A', fields: ['title'] }],
      [{ name: 'A', fields: ['votes'] }],
      [
        { name: 'A', fields: ['due'] },
        { name: 'B', fields: ['due'] },
      ],
      [{ name: 'A', fields: ['estimate'] }],
      [
        { name: 'A', fields: [] },
        { name: 'a', fields: [] },
      ],
      Array.from({ length: 7 }, (_, i) => ({ name: `T${i}`, fields: [] })),
    ];
    for (const tabs of cases) {
      const r = run([{ ...BUG, tabs }]);
      expect(r.ok, JSON.stringify(tabs)).toBe(false);
    }
    expect(run([{ ...BUG, detailsLabel: ' ' }]).ok).toBe(false);
  });
});

describe('editCustom and former names', () => {
  it('renames a custom field, replaces its options and draws it on the card', () => {
    const bug = typeIn(
      run([
        BUG,
        {
          op: 'set',
          type: 'Bug',
          editCustom: [
            { field: 'Severity', name: 'Impact', options: ['High', 'Low'], onCard: true },
          ],
        },
      ]),
      'Bug',
    );
    expect(bug.custom![0]).toMatchObject({
      label: 'Impact',
      options: ['High', 'Low'],
      onCard: true,
    });
    const off = typeIn(
      run([
        BUG,
        {
          op: 'set',
          type: 'Bug',
          editCustom: [
            { field: 'Severity', onCard: true },
            { field: 'Severity', onCard: false },
          ],
        },
      ]),
      'Bug',
    );
    expect(off.custom![0]!.onCard).toBeUndefined();
  });

  it('refuses options on a non-choice field, a built-in field and a taken name', () => {
    const withNotes = { ...BUG, custom: [...BUG.custom, { name: 'Notes', kind: 'text' }] };
    for (const edit of [
      { field: 'Notes', options: ['x'] },
      { field: 'due', name: 'When' },
      { field: 'Notes', name: 'severity' },
    ]) {
      expect(
        run([withNotes, { op: 'set', type: 'Bug', editCustom: [edit] }]).ok,
        JSON.stringify(edit),
      ).toBe(false);
    }
  });

  it('answers to a type’s former name later in the batch', () => {
    const r = run([
      BUG,
      { op: 'set', type: 'Bug', name: 'Defect' },
      { op: 'set', type: 'Bug', color: '#dc2626' },
    ]);
    expect(typeIn(r, 'Defect').color).toBe('#dc2626');
    const gone = run([
      BUG,
      { op: 'set', type: 'Bug', name: 'Defect' },
      { op: 'delete', type: 'Bug' },
    ]);
    expect(gone.ok && gone.catalogue?.types.some((t) => t.label === 'Defect')).toBe(false);
  });
});
