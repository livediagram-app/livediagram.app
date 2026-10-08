// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Item, ItemFields } from '@livediagram/items';
import { PlanCardFace } from './PlanCardFace';
import { dueState, keyTextOn } from './plan-card-parts';
import { contrastRatio } from '@livediagram/document';
import { ITEM_TYPES, PLAN_TYPE_COLOURS } from '@livediagram/items';
import { planPalette } from './plan-palette';
import { PlanProvider, type PlanContextValue } from './PlanContext';

// The card face's layout (docs/specs/026-plan/plan-board.md "What the board shows"): the type chip, the priority's
// signal bars, the footer's pills, label chips, and an item's own colour beside its type.

afterEach(cleanup);

const PERSON = { id: 'p', name: 'Sam Reed', color: '#2563eb' };
const card = (fields: ItemFields, type = 'task'): Item => ({
  id: `item-${type}`,
  type,
  key: 7,
  rank: 'i',
  fields: { title: 'A card', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});
const dayKey = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const ALL = [
  'key',
  'type',
  'priority',
  'labels',
  'estimate',
  'due',
  'checklist',
  'assignee',
] as const;

function face(item: Item, size?: 'compact' | 'detailed', muted?: boolean) {
  render(
    <PlanCardFace
      item={item}
      palette={planPalette('light', {})}
      fields={ALL}
      {...(size ? { size } : {})}
      {...(muted ? { muted } : {})}
    />,
  );
}

describe('the card face', () => {
  it('heads a Detailed card with its type, number and priority, and ends it with pills', () => {
    face(
      card({
        priority: 'high',
        estimate: 3,
        labels: ['Design', 'Frontend'],
        checklist: [
          { id: 'a', text: 'a', done: true },
          { id: 'b', text: 'b' },
        ] as never,
        assignee: PERSON as never,
      }),
    );
    expect(screen.getByText('Task')).toBeTruthy();
    expect(screen.getByText('#7')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'High priority' })).toBeTruthy();
    expect(screen.getByLabelText('Estimate 3')).toBeTruthy();
    expect(screen.getByLabelText('Checklist 1 of 2 done')).toBeTruthy();
    expect(screen.getByText('Design')).toBeTruthy();
    expect(screen.getByText('Frontend')).toBeTruthy();
  });

  it('shows four labels and counts the rest', () => {
    face(card({ labels: ['a', 'b', 'c', 'd', 'e', 'f'] }));
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.queryByText('e')).toBeNull();
  });

  it('marks a due date late, soon or neither, and never late once done', () => {
    expect(dueState(dayKey(-1), false)).toBe('late');
    expect(dueState(dayKey(1), false)).toBe('soon');
    expect(dueState(dayKey(10), false)).toBe('later');
    expect(dueState(dayKey(-1), true)).toBe('later');
    face(card({ due: dayKey(-3) }));
    expect(screen.getByLabelText(/^Due .*, overdue$/)).toBeTruthy();
  });

  it('puts an item’s own colour beside its type, on Detailed and Compact cards', () => {
    face(card({ color: '#0d9488' }, 'project'));
    expect(screen.getByRole('img', { name: 'Teal colour' })).toBeTruthy();
    expect(screen.getByText('Project')).toBeTruthy();
    cleanup();
    face(card({ color: '#0d9488' }, 'project'), 'compact');
    expect(screen.getByRole('img', { name: 'Teal colour' })).toBeTruthy();
    cleanup();
    face(card({ color: 'not-a-swatch' }, 'project'));
    expect(screen.queryByRole('img', { name: /colour$/ })).toBeNull();
  });
});

describe('the card number', () => {
  // docs/specs/026-plan/item-types.md "Card fields": Parent is Task's Card field, drawn where its Display puts it.
  it('draws a Parent as its project, with the project’s own colour dot', () => {
    const launch = { ...card({ title: 'Launch', color: '#ea580c' }, 'project'), id: 'p1' };
    const plain = { ...card({ title: 'Plain' }, 'project'), id: 'p2' };
    const items = new Map([launch, plain].map((i) => [i.id, i]));
    const draw = (parent: string) =>
      render(
        <PlanProvider value={{ items, types: ITEM_TYPES } as unknown as PlanContextValue}>
          <PlanCardFace
            item={card({ parent })}
            palette={planPalette('light', {})}
            fields={ALL}
            size="detailed"
          />
        </PlanProvider>,
      );
    draw('p1');
    expect(screen.getByLabelText('Parent: Launch')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Orange colour' })).toBeTruthy();
    cleanup();
    draw('p2');
    expect(screen.getByLabelText('Parent: Plain')).toBeTruthy();
    expect(screen.queryByRole('img', { name: /colour$/ })).toBeNull();
  });

  it('reads at 4.5:1 or better on every type colour', () => {
    for (const c of PLAN_TYPE_COLOURS)
      expect(contrastRatio(c, keyTextOn(c))).toBeGreaterThanOrEqual(4.5);
  });
});
