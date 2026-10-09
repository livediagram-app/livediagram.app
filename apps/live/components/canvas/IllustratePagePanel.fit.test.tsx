// @vitest-environment jsdom

// A Fit to Content page in its panel (docs/specs/007-editor/illustrate-pages.md "Sizes", "Page
// actions"): its own size tile, offered first and only on a page already in it, and Split into
// Pages in the action row.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutIllustratePages, type IllustratePage } from '@livediagram/document';
import type { IllustratePageEdits } from '@/hooks/editor/useIllustratePages';
import { IllustratePagePanel } from './IllustratePagePanel';

afterEach(cleanup);

const edits = (): IllustratePageEdits =>
  ({
    setOrientation: vi.fn(),
    setSize: vi.fn(),
    rename: vi.fn(),
    setBackground: vi.fn(),
    movePage: vi.fn(),
    movePageTo: vi.fn(),
    choosePageKind: vi.fn(),
    canDuplicate: () => true,
    canMove: () => false,
    applyLayout: vi.fn(),
    contentCount: () => 0,
    previewInk: vi.fn(),
    isLocked: () => false,
    setLocked: vi.fn(),
    startBlank: vi.fn(),
    splitPage: vi.fn(),
  }) as IllustratePageEdits;

const panel = (page: IllustratePage, edit = edits()) => {
  render(
    <IllustratePagePanel
      page={layOutIllustratePages([page])[0]!}
      count={1}
      getAnchor={() => undefined}
      initialTab="page"
      themeBackgrounds={[]}
      edit={edit}
      onPreview={vi.fn()}
      onLayoutPreview={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  return edit;
};

const fit: IllustratePage = {
  id: 'f',
  orientation: 'landscape',
  size: 'fit',
  fit: { width: 2400, height: 1300 },
  kind: 'infographic',
};

describe('a Fit to Content page in its panel', () => {
  it('offers its own size first, checked, with no orientation choice', () => {
    panel(fit);
    const sizes = screen
      .getByRole('radiogroup', { name: 'Page size' })
      .querySelectorAll('[role="radio"]');
    expect(sizes[0]!.getAttribute('aria-label')).toBe('Fit to Content');
    expect(sizes[0]!.getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByRole('radiogroup', { name: 'Orientation' })).toBeNull();
  });

  it('splits from the action row', () => {
    const edit = panel(fit);
    fireEvent.click(screen.getByRole('button', { name: 'Split Into Pages' }));
    expect(edit.splitPage).toHaveBeenCalledWith('f');
  });

  it('is not offered, nor is Split, on a page in a paper size', () => {
    panel({ id: 'p', orientation: 'portrait', kind: 'infographic' });
    expect(screen.queryByRole('radio', { name: 'Fit to Content' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Split Into Pages' })).toBeNull();
  });
});
