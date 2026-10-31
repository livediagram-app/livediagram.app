// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type CardField, type Item, type ItemTypeDef } from '@liveplanner/items';
import { PlanCardFace } from './PlanCardFace';
import { planPalette } from './plan-palette';

// docs/specs/026-plan/item-types.md "Formula fields": a card face draws a Formula's value by its result, and one that
// can't be worked out as a red "Error" with the problem in its spoken label; never a crash.

const plan = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('./PlanContext', async (actual) => ({
  ...(await actual<typeof import('./PlanContext')>()),
  usePlan: () => plan.value,
}));
afterEach(cleanup);

const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
const FIELDS = ['f-left', 'f-gone'] as CardField[];
const deal: ItemTypeDef = {
  ...ITEM_TYPES.find((t) => t.id === 'task')!,
  id: 'deal',
  label: 'Deal',
  fields: ['title', 'status', 'f-budget', 'f-left', 'f-gone'],
  custom: [
    { id: 'f-budget', label: 'Budget', kind: 'number' },
    {
      id: 'f-left',
      label: 'Left',
      kind: 'calculated',
      calculation: 'formula',
      formula: '{f-budget} * 2',
      result: 'currency',
      currency: 'GBP',
    },
    {
      id: 'f-gone',
      label: 'Gone',
      kind: 'calculated',
      calculation: 'formula',
      formula: '{f-deleted}',
    },
  ],
  display: { detailed: { body: FIELDS } },
};
const card: Item = {
  id: 'd1',
  type: 'deal',
  key: 1,
  rank: 'i',
  fields: { title: 'Acme', 'f-budget': 1250 },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
};

describe('a Formula on the card face', () => {
  it('draws its value, and its problem as Error', () => {
    plan.value = {
      items: new Map([[card.id, card]]),
      types: [deal],
      statusPhases: new Map(),
      presence: new Map(),
    };
    render(
      <PlanCardFace
        item={card}
        palette={planPalette('light', {})}
        fields={FIELDS}
        size="detailed"
        typeOverride={deal}
      />,
    );
    expect(screen.getByText('£2,500')).toBeTruthy();
    expect(screen.getByText('Error')).toBeTruthy();
    expect(
      screen.getByText('Gone: Error. Uses a field that was deleted or taken off the type')
        .className,
    ).toContain('sr-only');
  });
});
