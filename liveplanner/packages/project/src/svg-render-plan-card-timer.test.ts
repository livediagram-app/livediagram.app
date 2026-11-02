import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import { planPalette } from './plan-palette';
import { planCardFace, TIMER_RUNNING_GREEN } from './svg-render-plan-card';

// Time Spent in exports and thumbnails (docs/specs/026-plan/item-types.md "Time Spent"): a card with a timer running
// draws a green "Running" pill naming who, at every size; one with none draws no pill.

const palette = planPalette('light');
const task = ITEM_TYPES.find((t) => t.id === 'task')!;
const tracked: ItemTypeDef = {
  ...task,
  fields: [...task.fields, 'f-spent'],
  custom: [
    ...(task.custom ?? []),
    { id: 'f-spent', label: 'Time Spent', kind: 'duration', timeSpent: true },
    // Taken off the type: never read.
    { id: 'f-old', label: 'Old Time', kind: 'duration', timeSpent: true },
  ],
};
const types = ITEM_TYPES.map((t) => (t.id === 'task' ? tracked : t));
const SAM = { id: 'p-sam', name: 'Sam', color: '#2563eb' };

const card = (running: { by: string; name: string }[]): Item => ({
  id: 'c1',
  type: 'task',
  key: 3,
  rank: 'i',
  fields: {
    title: 'Fix the login',
    status: 'doing',
    'f-spent': {
      people: Object.fromEntries(running.map((r) => [r.by, { name: r.name, color: '#123456' }])),
      entries: [{ id: 'entry001', by: SAM.id, minutes: 90, at: 1 }],
      running: running.map((r, i) => ({ id: `timer00${i}`, by: r.by, start: 1 })),
    },
  },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: SAM,
  updatedBy: SAM,
});
const face = (c: Item, size: 'minimal' | 'detailed' | undefined, t = types) =>
  planCardFace(c, 0, 0, 260, { palette, types: t, size }).svg;

describe('a running timer on an exported card', () => {
  it('draws a green pill naming who, at every size', () => {
    for (const size of ['minimal', 'detailed', undefined] as const) {
      const svg = face(card([{ by: 'p-sam', name: 'Sam' }]), size);
      expect(svg, String(size)).toContain('Running · Sam');
      expect(svg).toContain(`fill="${TIMER_RUNNING_GREEN}"`);
    }
  });

  it('names the first and counts the rest', () => {
    const svg = face(
      card([
        { by: 'p-sam', name: 'Sam' },
        { by: 'p-ali', name: 'Ali' },
        { by: 'p-sam', name: 'Sam' },
        { by: 'p-jo', name: 'Jo' },
      ]),
      'detailed',
    );
    expect(svg).toContain('Running · Sam +2');
  });

  it('draws no pill with none running, or on a type without the field', () => {
    expect(face(card([]), 'detailed')).not.toContain('Running');
    expect(face(card([{ by: 'p-sam', name: 'Sam' }]), 'detailed', [...ITEM_TYPES])).not.toContain(
      'Running',
    );
  });
});
