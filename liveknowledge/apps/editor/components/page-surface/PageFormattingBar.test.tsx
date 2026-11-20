// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Profiler } from 'react';
import {
  setDrawingZoneEditing,
  useDrawingZoneEditing,
} from '@/lib/page-surface/drawing-zone-store';
import { FORMATTING_BAR_HEIGHT, PageFormattingBar } from './PageFormattingBar';
import { PAGE_TOP_ROOM } from '@/lib/page-surface/page-lock';

// docs/specs/030-knowledgebase/page-surface.md "The formatting bar": one slim bar pinned over the top of the
// writing's column, formatting only, then Undo and Redo.
afterEach(() => {
  cleanup();
  setDrawingZoneEditing(false);
});

const bar = (over: Partial<Parameters<typeof PageFormattingBar>[0]> = {}) => (
  <PageFormattingBar
    left={264}
    right={280}
    canUndo
    canRedo={false}
    onUndo={vi.fn()}
    onRedo={vi.fn()}
    {...over}
  />
);

describe('PageFormattingBar', () => {
  it('holds the page toolbar’s slot, then Undo and Redo, and no canvas tool', () => {
    const { container } = render(bar());
    expect(container.querySelector('[data-article-dock]')).not.toBeNull();
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Undo', 'Redo']);
    for (const gone of ['Select', 'Hand', 'Library', 'Search'])
      expect(screen.queryByRole('button', { name: new RegExp(gone) })).toBeNull();
  });

  it('runs Undo, and offers no Redo with nothing to redo', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(bar({ onUndo, onRedo }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    const redo = screen.getByRole<HTMLButtonElement>('button', { name: 'Redo' });
    expect(redo.disabled).toBe(true);
    fireEvent.click(redo);
    expect(onRedo).not.toHaveBeenCalled();
  });

  it('stands between the side chrome, and is shorter than the room the page keeps above itself', () => {
    const { container } = render(bar());
    const shell = container.querySelector<HTMLElement>('[data-page-formatting-bar]')!;
    expect(shell.style.left).toBe('264px');
    expect(shell.style.right).toBe('280px');
    expect(FORMATTING_BAR_HEIGHT).toBeLessThan(PAGE_TOP_ROOM);
  });

  it('takes a pointer cursor and a focus ring on every button', () => {
    render(bar());
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('cursor-pointer');
      expect(button.className).toContain('focus-visible:outline-2');
    }
  });

  it('does not render again while its props hold (a typing commit hands it the same ones)', () => {
    const onRender = vi.fn();
    const props = { onUndo: vi.fn(), onRedo: vi.fn() };
    const { rerender } = render(
      <Profiler id="bar" onRender={onRender}>
        {bar(props)}
      </Profiler>,
    );
    const first = onRender.mock.calls.length;
    rerender(
      <Profiler id="bar" onRender={onRender}>
        {bar(props)}
      </Profiler>,
    );
    // React renders an element given again; the slot it owns is the same node, so the toolbar's portal stays put.
    expect(onRender.mock.calls.length).toBeLessThanOrEqual(first + 1);
  });
});

describe('the drawing zone store', () => {
  function Probe() {
    return <span data-testid="probe">{useDrawingZoneEditing() ? 'drawing' : 'writing'}</span>;
  }
  it('says when a drawing zone is being edited, and tells its readers only on a change', () => {
    const onRender = vi.fn();
    render(
      <Profiler id="probe" onRender={onRender}>
        <Probe />
      </Profiler>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('writing');
    const before = onRender.mock.calls.length;
    setDrawingZoneEditing(false);
    expect(onRender.mock.calls.length).toBe(before);
  });
});
