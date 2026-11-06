// @vitest-environment jsdom

// An empty page's layout card (docs/specs/007-editor/pages-mode.md "Layouts"); a logo page's
// adds Start From Scratch (docs/specs/007-editor/logo-pages.md "Logo layouts").
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
