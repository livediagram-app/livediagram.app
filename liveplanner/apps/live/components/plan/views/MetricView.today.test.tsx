// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { createShape, type ShapeElement } from '@liveplanner/document';
import { ITEM_TYPES, planViewSize, type Item } from '@liveplanner/items';
import { PlanProvider, type PlanContextValue } from '../PlanContext';
import { PlanViewView } from './PlanViewView';

// docs/specs/026-plan/plan-views.md "Metrics": a metric reads today, and rolls over at midnight with no reload.
const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
const dueOn = (due: string): Item => ({
  id: 'i1',
  type: 'task',
  key: 1,
  rank: 'r',
  fields: { title: 'a', status: 'todo', due },
  rev: 1,
  createdBy: SAM,
  updatedBy: SAM,
  createdAt: 0,
  updatedAt: 0,
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('a metric over midnight', () => {
  it('turns a card due today overdue once the day ends', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 11, 23, 59));
    const plan = {
      items: new Map([['i1', dueOn('2026-10-11')]]),
      types: ITEM_TYPES,
      status: 'ready',
      planInput: true,
      canEdit: true,
      openItem: vi.fn(),
      statusNames: new Map([['todo', 'To do']]),
      statusPhases: new Map([['todo', 'todo']]),
    } as unknown as PlanContextValue;
    const el = {
      ...createShape('plan-view', 0, 0),
      ...planViewSize('metric:due'),
      planView: { view: 'metric:due' },
    } as ShapeElement;
    render(
      <PlanProvider value={plan}>
        <PlanViewView element={el} />
      </PlanProvider>,
    );
    expect(screen.getByText('due soon')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });
    expect(screen.getByText('overdue')).toBeTruthy();
  });
});
