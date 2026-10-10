// @vitest-environment jsdom

// An empty page's layout card (docs/specs/007-editor/illustrate-pages.md "Layouts"); a logo page's
// adds Start From Scratch (docs/specs/007-editor/logo-pages.md "Logo layouts").
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutIllustratePages, newLogoPage } from '@livediagram/document';
import { EmptyPageLayouts } from './EmptyPageLayouts';

afterEach(() => cleanup());

describe('EmptyPageLayouts', () => {
  it('offers Start From Scratch on a logo page, starting it blank (not merely hiding the card)', () => {
    const [page] = layOutIllustratePages([newLogoPage('l')]);
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

  it('offers no Start From Scratch on an infographic page', () => {
    const [page] = layOutIllustratePages([{ id: 'i', orientation: 'portrait' }]);
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
