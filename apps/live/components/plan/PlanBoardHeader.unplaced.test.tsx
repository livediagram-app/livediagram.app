// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup, projectBoard, type Item } from '@livediagram/items';
import { PlanBoardHeader } from './PlanBoardHeader';
import { planPalette } from './plan-palette';

// docs/specs/026-plan/item-types.md "An item type": the tray of cards not on the board offers only the columns
// whose status the card's type uses.
afterEach(cleanup);

const setup = { ...presetSetup('kanban'), widgets: ['unplaced' as const] };
const last = setup.columns[setup.columns.length - 1]!;
const types = ITEM_TYPES.map((t) =>
  t.id === 'task' ? { ...t, excludedStatuses: [last.status] } : t,
);
const PERSON = { id: 'p', name: 'Me', color: '#2563eb' };
const stray: Item = {
  id: 'i1',
  type: 'task',
  key: 7,
  rank: 'i',
  fields: { title: 'Stray', status: 'elsewhere' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
};

describe('the cards not on the board', () => {
  it('offers no column whose status the card’s type leaves out', () => {
    render(
      <PlanBoardHeader
        setup={setup}
        projection={projectBoard(setup, new Map([['i1', stray]]), undefined, types)}
        items={[]}
        types={types}
        palette={planPalette('light', {})}
        quick={{}}
        onQuick={vi.fn()}
        canFilterMine={null}
        canEdit
        loadFailed={false}
        widgetDropAt={null}
        flashWidget={null}
        onWidgets={vi.fn()}
        onSetup={vi.fn()}
        onOpenItem={vi.fn()}
        onRetry={vi.fn()}
        onReveal={vi.fn()}
        onMoveUnplaced={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /not on board/ }));
    const options = [...screen.getByLabelText('Move #7 to').querySelectorAll('option')].map(
      (o) => o.textContent,
    );
    expect(options).toContain(setup.columns[0]!.name);
    expect(options).not.toContain(last.name);
  });
});
