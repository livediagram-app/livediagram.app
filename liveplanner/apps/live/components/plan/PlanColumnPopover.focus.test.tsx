// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { presetSetup, statusColumn } from '@liveplanner/items';
import { EditorContext } from '@/app/project/[id]/EditorContext';
import { PlanColumnPopover } from './PlanColumnPopover';

// docs/specs/026-plan/plan-board.md "Column settings": the name takes focus on a desktop; on a phone only for a column
// just added, there to be named, so opening a column for its WIP limit raises no keyboard over the sheet.
const plan = { items: new Map(), statusNames: new Map() };
const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({ useIsMobileViewport: () => viewport.mobile }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  viewport.mobile = false;
});

function open(selectName = false) {
  const setup = {
    ...presetSetup('kanban'),
    columns: [statusColumn('todo', 'To Do'), statusColumn('done', 'Done')],
  };
  render(
    <EditorContext.Provider value={{ tabs: [] } as never}>
      <PlanColumnPopover
        getAnchor={() => document.body}
        setup={setup}
        column={setup.columns[0]!}
        selectName={selectName}
        onChange={() => {}}
        onMoveCards={() => {}}
        onTrashCards={() => {}}
        onClose={() => {}}
      />
    </EditorContext.Provider>,
  );
  return screen.getByRole('textbox', { name: 'Column name' });
}

// Whether opening asked for the name's focus (what React's autoFocus does on mount).
function focusesName(selectName = false): boolean {
  const focus = vi.spyOn(HTMLElement.prototype, 'focus');
  const name = open(selectName);
  return focus.mock.contexts.includes(name);
}

describe('a column’s settings, first focus', () => {
  it('focuses the name on a desktop', () => {
    expect(focusesName()).toBe(true);
  });

  it('leaves the name alone on a phone', () => {
    viewport.mobile = true;
    expect(focusesName()).toBe(false);
  });

  it('focuses a just-added column’s name on a phone, to name it', () => {
    viewport.mobile = true;
    expect(focusesName(true)).toBe(true);
  });
});
