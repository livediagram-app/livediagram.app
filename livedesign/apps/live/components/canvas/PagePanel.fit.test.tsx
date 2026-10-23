// @vitest-environment jsdom

// A Fit to Content page in its panel (docs/specs/007-editor/pages-mode.md "Sizes", "Page
// actions"): its own size tile, offered first and only on a page already in it, and Split into
// Pages in the action row.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, type Page } from '@livedesign/design';
import type { PageEdits } from '@/hooks/editor/usePagesMode';
import { PagePanel } from './PagePanel';

afterEach(cleanup);

const edits = (): PageEdits => ({
  setOrientation: vi.fn(),
  setSize: vi.fn(),
  setDevice: vi.fn(),
  rename: vi.fn(),
  setBackground: vi.fn(),
  applyToAllReach: vi.fn(() => 0),
  applyBackgroundToAll: vi.fn(),
  copyBackground: vi.fn(() => false),
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
});

const panel = (page: Page, edit = edits()) => {
  render(
    <PagePanel
      page={layOutPages([page])[0]!}
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

const fit: Page = {
  id: 'f',
  orientation: 'landscape',
  size: 'fit',
  fit: { width: 2400, height: 1300 },
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
    panel({ id: 'p', orientation: 'portrait' });
    expect(screen.queryByRole('radio', { name: 'Fit to Content' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Split Into Pages' })).toBeNull();
  });
});
