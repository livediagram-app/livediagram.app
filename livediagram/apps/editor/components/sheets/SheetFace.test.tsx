// @vitest-environment jsdom
// A Sheet that cannot show its grid (blueprint sheet-element.md "Presentation and UX"): the title, a quiet line and
// the action that line offers.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { planPalette } from '@/components/plan/plan-palette';
import { SheetFace } from './SheetFace';

const palette = planPalette('light');

describe('the sheet face', () => {
  it('loads as the site does: a table filling in, its line and the sweep, with no action', () => {
    render(<SheetFace palette={palette} title="Budget" message="Opening Sheet" loading />);
    expect(screen.getByText('Budget')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Opening Sheet');
    expect(screen.getByRole('img', { name: 'Filling in a sheet' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers Try Again after an error, and keeps the press from reaching the canvas', () => {
    const run = vi.fn();
    const outside = vi.fn();
    render(
      <div onPointerDown={outside}>
        <SheetFace
          palette={palette}
          title="Sheet"
          message="Couldn't load this sheet"
          action={{ label: 'Try Again', run }}
        />
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Try Again' });
    fireEvent.pointerDown(button);
    expect(outside).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('offers Remove when the sheet is gone', () => {
    const run = vi.fn();
    render(
      <SheetFace
        palette={palette}
        title="Sheet"
        message="This sheet is no longer in this document"
        action={{ label: 'Remove', run }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(run).toHaveBeenCalled();
  });

  it('draws only the frame and title with no message (outside the editor)', () => {
    const { container } = render(
      <SheetFace
        palette={palette}
        title="Sheet"
        message=""
        action={{ label: 'X', run: vi.fn() }}
      />,
    );
    expect(container.textContent).toBe('Sheet');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
