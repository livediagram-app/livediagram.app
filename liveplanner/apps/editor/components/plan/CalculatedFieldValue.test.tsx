// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Item, ItemTypeDef } from '@liveplanner/items';
import { CalculatedFieldValue } from './CalculatedFieldValue';
import { calculatedFieldValue } from './calculated-values';

// docs/specs/026-plan/item-types.md "Calculated fields": read-only in the card panel.
afterEach(cleanup);

const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
const card = (id: string, type: string, fields: Item['fields']): Item => ({
  id,
  type,
  key: 1,
  rank: 'i',
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const progress = {
  label: 'Progress',
  kind: 'calculated' as const,
  calculation: 'childrenDone' as const,
};
const count = { label: 'Stories', kind: 'calculated' as const, calculation: 'childCount' as const };

describe('CalculatedFieldValue', () => {
  it('shows a share done with its bar, never an input', () => {
    const { container } = render(<CalculatedFieldValue id="v" field={progress} value={40} />);
    expect(screen.getByText('40%')).toBeTruthy();
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('output#v')).toBeTruthy();
    expect((container.querySelector('.bg-brand-500') as HTMLElement).style.width).toBe('40%');
  });

  it('says when there are no children, and a count has no bar', () => {
    const { container, rerender } = render(
      <CalculatedFieldValue id="v" field={progress} value={null} />,
    );
    expect(screen.getByText('No linked cards')).toBeTruthy();
    expect(container.querySelector('.bg-brand-500')).toBeNull();
    rerender(<CalculatedFieldValue id="v" field={count} value={3} />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(container.querySelector('.bg-brand-500')).toBeNull();
  });
});

describe('calculatedFieldValue', () => {
  const epic: ItemTypeDef = {
    id: 'epic',
    label: 'Epic',
    newTitle: 'New epic',
    glyph: 'project',
    color: '#2563eb',
    fields: ['title', 'status'],
  };
  const story: ItemTypeDef = {
    id: 'story',
    label: 'Story',
    newTitle: 'New story',
    glyph: 'task',
    color: '#71717a',
    fields: ['title', 'status', 'f-epic'],
    custom: [{ id: 'f-epic', label: 'Epic', kind: 'card', linkType: 'epic' }],
  };
  const e = card('e1', 'epic', { title: 'Checkout' });
  const items = new Map(
    [
      e,
      card('s1', 'story', { title: 'A', status: 'done', 'f-epic': 'e1' }),
      card('s2', 'story', { title: 'B', status: 'todo', 'f-epic': 'e1' }),
      card('s3', 'story', { title: 'C', status: 'shipped', 'f-epic': 'e1' }),
      card('s4', 'story', { title: 'D', status: 'todo', 'f-epic': 'e1' }),
    ].map((i) => [i.id, i]),
  );
  const plan = {
    items,
    types: [epic, story],
    statusPhases: new Map([
      ['done', 'done'],
      ['shipped', 'done'],
      ['todo', 'todo'],
    ]),
  };

  it('works the values out from the plan’s cards and phases', () => {
    expect(calculatedFieldValue(plan, count, e)).toBe(4);
    expect(calculatedFieldValue(plan, progress, e)).toBe(50);
    // The same map again reads the index already made.
    expect(calculatedFieldValue(plan, count, e)).toBe(4);
    expect(calculatedFieldValue({ ...plan, types: [epic] }, count, e)).toBe(0);
  });
});
