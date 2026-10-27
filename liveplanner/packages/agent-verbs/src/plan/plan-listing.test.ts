import { describe, expect, it } from 'vitest';
import { applyCardTypeChanges, defaultCatalogue, ITEM_TYPES } from '@liveplanner/items';
import { listedType, listedTypes } from './plan-listing';

// A card type as list_items lists it (docs/specs/026-plan/plan-agents.md "What a card type is made of, as facts"):
// everything change_card_types sets, by the names it takes.

const statuses = [
  { status: 'todo~a1', name: 'To Do' },
  { status: 'done~a1', name: 'Done' },
];

describe('listedType', () => {
  it('lists a built-in type with its look, display by name, tabs and Details', () => {
    const task = listedType(ITEM_TYPES.find((t) => t.id === 'task')!);
    expect(task).toMatchObject({
      id: 'task',
      name: 'Task',
      glyph: expect.any(String),
      detailsLabel: 'Details',
    });
    expect(task.color).toMatch(/^#/);
    expect(task.display['detailed']).toMatchObject({
      header: ['Type', 'Number'],
      bottomRight: ['Assignee'],
    });
    expect(task.tabs[0]).toMatchObject({ name: 'Overview' });
  });

  it('lists what change_card_types set, the Default State by column name', () => {
    const r = applyCardTypeChanges(
      defaultCatalogue(),
      [
        {
          op: 'add',
          name: 'Bug',
          custom: [{ name: 'Severity', kind: 'choice', options: ['S1'], onCard: true }],
          defaultStatus: 'To Do',
          display: { compact: { belowTitle: ['Severity'] } },
          tabs: [{ name: 'Triage', fields: ['Severity'] }],
          detailsLabel: 'Facts',
        },
      ],
      statuses,
    );
    if (!r.ok) throw new Error(r.message);
    const bug = listedTypes(r.catalogue!.types, statuses).find((t) => t.name === 'Bug')!;
    expect(bug).toMatchObject({
      defaultStatus: 'To Do',
      detailsLabel: 'Facts',
      tabs: [{ name: 'Triage', fields: ['Severity'] }],
    });
    expect(bug.custom[0]).toMatchObject({ name: 'Severity', onCard: true });
    expect(bug.display['compact']).toEqual({ belowTitle: ['Severity'] });
    expect(bug.fields).not.toContain(bug.custom[0]!.id);
    // A Default State no board names reads as its status; a link field names its target; a currency its code; a
    // Rating its top score.
    expect(
      listedType({ ...r.catalogue!.types.find((t) => t.label === 'Bug')!, defaultStatus: 'gone' })
        .defaultStatus,
    ).toBe('gone');
    const deal = listedType({
      ...ITEM_TYPES[1],
      id: 'deal',
      label: 'Deal',
      fields: ['title', 'status', 'f-v', 'f-c', 'f-r', 'f-n'],
      custom: [
        { id: 'f-v', label: 'Value', kind: 'currency' },
        { id: 'f-c', label: 'Company', kind: 'card', linkType: 'project' },
        { id: 'f-r', label: 'Fit', kind: 'rating' },
        { id: 'f-n', label: 'Score', kind: 'rating', scale: 10 },
      ],
    });
    expect(deal.custom).toEqual([
      { id: 'f-v', name: 'Value', kind: 'currency', currency: 'GBP' },
      { id: 'f-c', name: 'Company', kind: 'card', linkType: 'project', linkTypes: ['project'] },
      { id: 'f-r', name: 'Fit', kind: 'rating', scale: 5 },
      { id: 'f-n', name: 'Score', kind: 'rating', scale: 10 },
    ]); // A Card field of several types lists them all (docs/specs/026-plan/plan-agents.md).
    const risk = listedType({
      ...ITEM_TYPES[1],
      id: 'risk',
      label: 'Risk',
      fields: ['title', 'status', 'f-o'],
      custom: [
        {
          id: 'f-o',
          label: 'Owner',
          kind: 'card',
          linkType: 'project',
          linkTypes: ['project', 'task'],
        },
      ],
    });
    expect(risk.custom).toEqual([
      {
        id: 'f-o',
        name: 'Owner',
        kind: 'card',
        linkType: 'project',
        linkTypes: ['project', 'task'],
      },
    ]);
  });
});
