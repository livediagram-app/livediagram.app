import { describe, expect, it, vi } from 'vitest';
import { applyCardTypeChanges, defaultCatalogue, ITEM_TYPES, type Item } from '@liveplanner/items';
import { listedType, listedTypes, planListing } from './plan-listing';
import type { PlanState } from './plan-state';

describe('a repeating card in list_items', () => {
  it('lists its rule in words with its next day and zone, never the raw field', () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2026-11-02T10:00:00Z'));
    const repeat = { every: 'week', days: [1, 4], from: '2026-11-02', timeZone: 'Europe/London' };
    const card = (id: string, key: number, fields: Item['fields']): Item => ({
      id,
      type: 'task',
      key,
      rank: 'i',
      fields: { title: id, status: 'todo', ...fields },
      rev: 1,
      createdAt: 0,
      updatedAt: 0,
      createdBy: { id: 'p', name: 'P', color: '#000000' },
      updatedBy: { id: 'p', name: 'P', color: '#000000' },
    });
    const listing = planListing({
      items: [card('a', 1, { repeat }), card('b', 2, {})],
      plan: { boards: [], statuses: [], types: ITEM_TYPES } as unknown as PlanState['plan'],
    });
    expect(listing.items[0]).toMatchObject({
      repeat: { rule: 'every week on Mon and Thu', next: '2026-11-05', timeZone: 'Europe/London' },
    });
    expect(listing.items[0]!.fields).not.toHaveProperty('repeat');
    expect(listing.items[1]).not.toHaveProperty('repeat');
    vi.useRealTimers();
  });
});

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

  it('lists Notifies: a notifying Person field, and an Assignee switched off', () => {
    const review = listedType({
      ...ITEM_TYPES[1],
      id: 'review',
      label: 'Review',
      fields: ['title', 'status', 'assignee', 'f-r'],
      custom: [{ id: 'f-r', label: 'Reviewer', kind: 'person', notifies: true }],
      assigneeNotifies: false,
    });
    expect(review.custom).toEqual([
      { id: 'f-r', name: 'Reviewer', kind: 'person', notifies: true },
    ]);
    expect(review.assigneeNotifies).toBe(false);
    expect(listedType(ITEM_TYPES[1])).not.toHaveProperty('assigneeNotifies');
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
          display: { minimal: { afterTitle: ['Severity'] } },
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
    expect(bug.display['minimal']).toEqual({ afterTitle: ['Severity'] });
    expect(Object.keys(bug.display)).toEqual(['minimal', 'detailed']);
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

// docs/specs/026-plan/plan-agents.md "Reading the plan": each type's statuses, by column name, in its order.
describe('a listed type’s statuses', () => {
  const task = ITEM_TYPES.find((t) => t.id === 'task')!;

  it('names the statuses a type uses in its order, leaving out one no board names', () => {
    expect(
      listedType({ ...task, statuses: ['done~a1', 'gone', 'todo~a1'] }, statuses).statuses,
    ).toEqual(['Done', 'To Do']);
  });

  it('reads a legacy type as every column less what it left out', () => {
    expect(listedType({ ...task, excludedStatuses: ['todo~a1'] }, statuses).statuses).toEqual([
      'Done',
    ]);
  });
});
