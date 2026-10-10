// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PathEditToolbar, type PathToolbarView } from './PathEditToolbar';

// The edit toolbar (docs/specs/023-draw-mode/path-tool.md "Editing").

afterEach(cleanup);

function renderBar(over: Partial<PathToolbarView> = {}) {
  const handlers = {
    onSetType: vi.fn(),
    onDelete: vi.fn(),
    onToggleClosed: vi.fn(),
    onDone: vi.fn(),
  };
  render(
    <PathEditToolbar
      view={{
        bounds: { x: 0, y: 0, width: 100, height: 60 },
        type: 'mirrored',
        hasSelection: true,
        closed: false,
        canOpen: false,
        ...over,
      }}
      viewportOffset={{ x: 0, y: 0 }}
      zoom={1}
      {...handlers}
    />,
  );
  return handlers;
}

describe('PathEditToolbar', () => {
  it('shows the selected nodes’ shared type and sets another', () => {
    const h = renderBar();
    const group = screen.getByRole('radiogroup', { name: 'Node type' });
    const radios = [...group.querySelectorAll('[role="radio"]')];
    expect(radios.map((r) => [r.textContent, r.getAttribute('aria-checked')])).toEqual([
      ['Corner', 'false'],
      ['Mirrored', 'true'],
      ['Aligned', 'false'],
    ]);
    fireEvent.click(screen.getByRole('radio', { name: 'Aligned' }));
    expect(h.onSetType).toHaveBeenCalledWith('aligned');
  });

  it('deletes, closes and finishes, each with its key', () => {
    const h = renderBar();
    const del = screen.getByRole('button', { name: 'Delete Point' });
    expect(del.getAttribute('aria-keyshortcuts')).toBe('Delete');
    fireEvent.click(del);
    fireEvent.click(screen.getByRole('button', { name: 'Close Path' }));
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done.getAttribute('aria-keyshortcuts')).toBe('Escape');
    fireEvent.click(done);
    expect(h.onDelete).toHaveBeenCalled();
    expect(h.onToggleClosed).toHaveBeenCalled();
    expect(h.onDone).toHaveBeenCalled();
  });

  it('asks for a node before typing, deleting or opening', () => {
    renderBar({ hasSelection: false, type: null, closed: true, canOpen: false });
    expect((screen.getByRole('radio', { name: 'Corner' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('button', { name: 'Delete Point' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('button', { name: 'Open Path' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('is a toolbar over the canvas, so a held tool leaves its presses alone', () => {
    renderBar();
    expect(
      screen.getByRole('toolbar', { name: 'Edit path' }).closest('[data-canvas-toolbar]'),
    ).not.toBeNull();
  });
});
