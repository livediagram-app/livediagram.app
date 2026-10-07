// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup, projectBoard } from '@livediagram/items';
import { PlanBoardHeader } from './PlanBoardHeader';
import { planPalette } from './plan-palette';

// docs/specs/026-plan/plan-board.md "What the board shows": a double-click on a board's title renames it.
afterEach(cleanup);

const setup = presetSetup('kanban');

function header(canRename: boolean) {
  const onSetup = vi.fn();
  const outer = vi.fn();
  render(
    <div onDoubleClick={outer}>
      <PlanBoardHeader
        setup={setup}
        projection={projectBoard(setup, new Map(), undefined, ITEM_TYPES)}
        items={[]}
        types={ITEM_TYPES}
        palette={planPalette('light', {})}
        quick={{}}
        onQuick={vi.fn()}
        canFilterMine={null}
        canEdit
        canRename={canRename}
        votesLeft={null}
        loadFailed={false}
        widgetDropAt={null}
        flashWidget={null}
        onWidgets={vi.fn()}
        onSetup={onSetup}
        onOpenItem={vi.fn()}
        onRetry={vi.fn()}
        onReveal={vi.fn()}
        onMoveUnplaced={vi.fn()}
      />
    </div>,
  );
  return { onSetup, outer };
}

describe('renaming a board', () => {
  it('turns the title into a selected field on a double-click, and saves on Enter', () => {
    const { onSetup, outer } = header(true);
    fireEvent.doubleClick(screen.getByText(setup.title));
    const field = screen.getByRole('textbox', { name: 'Board title' }) as HTMLInputElement;
    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(setup.title.length);
    // The double-click goes no further: the canvas never sees it.
    expect(outer).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: '  Launch Plan  ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSetup).toHaveBeenCalledWith({ ...setup, title: 'Launch Plan' }, 'Title');
    expect(screen.queryByRole('textbox', { name: 'Board title' })).toBeNull();
  });

  it('cancels on Escape, and ignores an empty name', () => {
    const { onSetup } = header(true);
    fireEvent.doubleClick(screen.getByText(setup.title));
    let field = screen.getByRole('textbox', { name: 'Board title' });
    fireEvent.change(field, { target: { value: 'Something else' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onSetup).not.toHaveBeenCalled();
    fireEvent.doubleClick(screen.getByText(setup.title));
    field = screen.getByRole('textbox', { name: 'Board title' });
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.blur(field);
    expect(onSetup).not.toHaveBeenCalled();
  });

  it('leaves the double-click alone for someone who may not rename, or outside Plan mode', () => {
    const { outer } = header(false);
    fireEvent.doubleClick(screen.getByText(setup.title));
    expect(screen.queryByRole('textbox', { name: 'Board title' })).toBeNull();
    expect(outer).toHaveBeenCalled();
  });
});
