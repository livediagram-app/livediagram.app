// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { penColourHex } from '@livediagram/document';
import { presetSetup, statusColumn } from '@livediagram/items';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { PlanColumnPopover } from './PlanColumnPopover';

// docs/specs/026-plan/plan-board.md "Column settings" on the one colour picker
// (docs/specs/004-interface-design/colour-picker.md).
const plan = { items: new Map(), statusNames: new Map() };
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({ useIsMobileViewport: () => false }));
afterEach(cleanup);

function open(color?: string) {
  const setup = {
    ...presetSetup('kanban'),
    columns: [
      { ...statusColumn('todo', 'To Do'), ...(color ? { color } : {}) },
      { ...statusColumn('done', 'Done'), color: '#abcdef' },
    ],
  };
  const onChange = vi.fn();
  // Inside an editor with an empty document: no custom colours picked yet.
  render(
    <EditorContext.Provider value={{ tabs: [] } as never}>
      <PlanColumnPopover
        getAnchor={() => document.body}
        setup={setup}
        column={setup.columns[0]!}
        onChange={onChange}
        onMoveCards={() => {}}
        onTrashCards={() => {}}
        onClose={() => {}}
      />
    </EditorContext.Provider>,
  );
  return onChange;
}
const columnColour = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.lastCall![0].columns[0].color as string | undefined;

describe('a column colour', () => {
  it('offers No colour first, picked when the column has none, and the standard colours by hex', () => {
    const onChange = open();
    const picker = screen.getByRole('group', { name: 'Colour' });
    const none = within(picker).getByRole('button', { name: 'No colour' });
    expect(none.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(picker).getByRole('button', { name: 'Teal' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), 'ColumnColour');
    expect(columnColour(onChange)).toBe(penColourHex('teal', 'light'));
  });

  it('clears the colour with No colour, and shows only the colour in force as a custom colour', () => {
    const onChange = open('#2563eb');
    const yours = within(screen.getByRole('group', { name: 'Custom Colours' })).getAllByRole(
      'button',
    );
    // The colour in force (an earlier Plan blue); the Done column's is no one's pick with +.
    expect(yours.map((b) => b.getAttribute('aria-label'))).toEqual([
      '#2563eb',
      'Add a custom colour',
    ]);
    expect(yours[0]!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'No colour' }));
    expect(columnColour(onChange)).toBeUndefined();
  });
});
