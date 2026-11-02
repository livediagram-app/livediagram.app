// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  doneColumnsOf,
  presetSetup,
  statusColumn,
  type PlanBoardSetup,
  type PlanColumn,
} from '@liveplanner/items';
import { EditorContext } from '@/app/project/[id]/EditorContext';
import { PlanColumnPopover } from './PlanColumnPopover';

// docs/specs/026-plan/plan-board.md "Done columns": Counts as Done is on for a done column found by its name, and
// turns any column on or off by hand.
const plan = { items: new Map(), statusNames: new Map() };
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => false,
}));
afterEach(cleanup);

function open(columns: PlanColumn[], at: number) {
  const setup: PlanBoardSetup = { ...presetSetup('blank'), columns };
  const onChange = vi.fn<(next: PlanBoardSetup, part: string) => void>();
  render(
    <EditorContext.Provider value={{ tabs: [] } as never}>
      <PlanColumnPopover
        getAnchor={() => document.body}
        setup={setup}
        column={setup.columns[at]!}
        onChange={onChange}
        onMoveCards={() => {}}
        onTrashCards={() => {}}
        onClose={() => {}}
      />
    </EditorContext.Provider>,
  );
  return onChange;
}

const doneSwitch = () => screen.getByRole('switch', { name: /Counts as Done/ });

describe('Counts as Done', () => {
  it('is on for a column named as a closing state, and turns it off by hand', () => {
    const onChange = open([statusColumn('todo', 'To Do'), statusColumn('wont', 'Won’t Do')], 1);
    expect(doneSwitch().getAttribute('aria-checked')).toBe('true');
    fireEvent.click(doneSwitch());
    const [next, part] = onChange.mock.calls[0]!;
    expect(part).toBe('DoneColumn');
    expect(doneColumnsOf(next)).toEqual([]);
    expect(next.columns[1]!.done).toBe(false);
  });

  it('turns any column on, beside a done column it leaves done', () => {
    const onChange = open([statusColumn('review', 'Review'), statusColumn('done', 'Done')], 0);
    expect(doneSwitch().getAttribute('aria-checked')).toBe('false');
    fireEvent.click(doneSwitch());
    expect(doneColumnsOf(onChange.mock.calls[0]![0]).map((c) => c.id)).toEqual(['review', 'done']);
  });
});
