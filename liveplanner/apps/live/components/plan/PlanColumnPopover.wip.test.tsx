// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { presetSetup, statusColumn } from '@liveplanner/items';
import { EditorContext } from '@/app/project/[id]/EditorContext';
import { PlanColumnPopover } from './PlanColumnPopover';

// docs/specs/026-plan/plan-board.md "Column settings": the WIP limit's line names its count ("1 card", not "1 cards").
const plan = { items: new Map(), statusNames: new Map() };
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({ useIsMobileViewport: () => false }));
afterEach(cleanup);

function open(wipLimit?: number) {
  const setup = {
    ...presetSetup('kanban'),
    columns: [
      { ...statusColumn('todo', 'To Do'), ...(wipLimit ? { wipLimit } : {}) },
      statusColumn('done', 'Done'),
    ],
  };
  render(
    <EditorContext.Provider value={{ tabs: [] } as never}>
      <PlanColumnPopover
        getAnchor={() => document.body}
        setup={setup}
        column={setup.columns[0]!}
        onChange={() => {}}
        onMoveCards={() => {}}
        onTrashCards={() => {}}
        onClose={() => {}}
      />
    </EditorContext.Provider>,
  );
}

describe('a column’s WIP limit line', () => {
  it.each([
    [undefined, 'No limit'],
    [1, 'Warns past 1 card'],
    [3, 'Warns past 3 cards'],
  ])('reads for a limit of %s: %s', (limit, line) => {
    open(limit);
    expect(screen.getByText(line)).toBeTruthy();
  });
});
