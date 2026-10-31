// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollapseColumnButton, CollapsedColumnCell } from './CollapsedColumn';
import { planPalette } from './plan-palette';

// docs/specs/026-plan/plan-board.md "Collapse Column": a strip's cell is lit while a card is held over it, in the
// focus colour, or red when the card's type leaves the status out.
afterEach(cleanup);

const palette = planPalette('light', {});

const cell = (held: 'over' | 'refused' | null, overLimit = false) => {
  const onExpand = vi.fn();
  render(
    <CollapsedColumnCell
      column={{ id: 'done', name: 'Done' }}
      status="done"
      laneKey=""
      count={4}
      overLimit={overLimit}
      palette={palette}
      held={held}
      onExpand={onExpand}
    />,
  );
  return {
    onExpand,
    box: document.querySelector<HTMLElement>('[data-plan-strip]')!,
  };
};

describe('CollapsedColumnCell', () => {
  it('reads its count and name, and expands on a press', () => {
    const { onExpand, box } = cell(null);
    expect(box.style.outline).toBe('none');
    fireEvent.click(screen.getByRole('button', { name: 'Expand Column, Done, 4 items' }));
    expect(onExpand).toHaveBeenCalledOnce();
  });

  it('lights in the focus colour while a card is held over it', () => {
    expect(cell('over').box.style.outline).toContain('dashed');
  });

  it('lights red when the card cannot go there', () => {
    expect(cell('refused').box.style.outline).toContain('#dc2626');
  });

  it('shows its count in the warning colour over its WIP limit', () => {
    cell(null, true);
    const badge = screen.getByText('4').parentElement!;
    expect(badge.style.backgroundColor).not.toBe('');
    cleanup();
    cell(null, false);
    expect(screen.getByText('4').parentElement!.style.color).not.toBe(badge.style.color);
  });
});

describe('CollapseColumnButton', () => {
  it('is always shown, never hidden until hover', () => {
    const onCollapse = vi.fn();
    render(
      <CollapseColumnButton
        column={{ id: 'done', name: 'Done' }}
        palette={palette}
        onCollapse={onCollapse}
      />,
    );
    const button = screen.getByRole('button', { name: 'Collapse Column, Done' });
    expect(button.className).not.toContain('opacity-0');
    fireEvent.click(button);
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });
});
