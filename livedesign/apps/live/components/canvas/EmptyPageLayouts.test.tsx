// @vitest-environment jsdom

// An empty page's layout card (docs/specs/007-editor/pages-mode.md "Layouts"); a logo page's
// adds Start From Scratch (docs/specs/007-editor/logo-pages.md "Logo layouts").
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, newLogoPage } from '@livedesign/design';
import { EmptyPageLayouts } from './EmptyPageLayouts';

afterEach(() => cleanup());

describe('EmptyPageLayouts', () => {
  it('offers Start From Scratch on a logo page, starting it blank (not merely hiding the card)', () => {
    const [page] = layOutPages([newLogoPage('l')]);
    const onHide = vi.fn();
    const onBlank = vi.fn();
    render(
      <EmptyPageLayouts
        page={page!}
        zoom={1}
        onApply={vi.fn()}
        onHide={onHide}
        onBlank={onBlank}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start From Scratch' }));
    expect(onBlank).toHaveBeenCalled();
    expect(onHide).not.toHaveBeenCalled();
  });

  it('hides on Escape pressed inside the card, keeping the press from the canvas', () => {
    const [page] = layOutPages([newLogoPage('l')]);
    const onHide = vi.fn();
    const onCanvasKey = vi.fn();
    render(
      <div onKeyDown={onCanvasKey}>
        <EmptyPageLayouts
          page={page!}
          zoom={1}
          onApply={vi.fn()}
          onHide={onHide}
          onBlank={vi.fn()}
        />
      </div>,
    );
    const hide = screen.getByRole('button', { name: 'Hide' });
    fireEvent.keyDown(hide, { key: 'Enter' });
    expect(onHide).not.toHaveBeenCalled();
    expect(onCanvasKey).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(hide, { key: 'Escape' });
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(onCanvasKey).toHaveBeenCalledTimes(1);
  });

  it('hands the focus to the canvas when Escape or Hide puts the card away', () => {
    const [page] = layOutPages([newLogoPage('l')]);
    // The host takes the card away once it is hidden, as CanvasPages does.
    function Host() {
      const [shown, setShown] = useState(true);
      return (
        <main tabIndex={0} aria-label="Canvas" data-canvas-a11y-root="">
          {shown ? (
            <EmptyPageLayouts
              page={page!}
              zoom={1}
              onApply={vi.fn()}
              onHide={() => setShown(false)}
              onBlank={vi.fn()}
            />
          ) : null}
        </main>
      );
    }
    const { unmount } = render(<Host />);
    const hide = screen.getByRole('button', { name: 'Hide' });
    hide.focus();
    fireEvent.keyDown(hide, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Hide' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('main', { name: 'Canvas' }));
    unmount();
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(document.activeElement).toBe(screen.getByRole('main', { name: 'Canvas' }));
  });

  it('offers no Start From Scratch on an infographic page', () => {
    const [page] = layOutPages([{ id: 'i', orientation: 'portrait' }]);
    render(
      <EmptyPageLayouts
        page={page!}
        zoom={1}
        onApply={vi.fn()}
        onHide={vi.fn()}
        onBlank={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Start From Scratch' })).toBeNull();
  });
});
