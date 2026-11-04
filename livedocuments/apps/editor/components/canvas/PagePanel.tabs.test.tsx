// @vitest-environment jsdom

// The page panel's sections (docs/specs/007-editor/pages-mode.md "page panel"): its name, its Page section while there
// is a size or orientation to choose, then its actions. No Background tab: a page's Background is its title bar's
// button. An unnamed card or article page goes by its article's title (pages-mode.md "Page names").

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, type Page } from '@livedocuments/document';
import type { PageEdits } from '@/hooks/editor/usePagesMode';
import { PagePanel, pageHasPageSection } from './PagePanel';

afterEach(cleanup);

const laidOut = (page: Page) => layOutPages([page])[0]!;

const edits = (): PageEdits => ({
  setOrientation: vi.fn(),
  setSize: vi.fn(),
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
  splitPage: vi.fn(),
  splitCard: vi.fn(),
  cardSplitState: vi.fn(() => 'fits' as const),
  removePage: vi.fn(),
});

function renderPanel(page: Page, titleName?: string) {
  render(
    <PagePanel
      page={laidOut(page)}
      count={1}
      getAnchor={() => undefined}
      titleName={titleName}
      edit={edits()}
      onClose={vi.fn()}
    />,
  );
}

const slide: Page = { id: 'p', orientation: 'landscape', kind: 'slide', size: 'slide' };

describe('the page panel', () => {
  it('has no Background tab, nor any tab switch: a slide shows its size and no backgrounds', () => {
    renderPanel(slide);
    expect(screen.queryByRole('group', { name: 'Page panel section' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Background' })).toBeNull();
    expect(screen.queryByText('Pattern')).toBeNull();
    expect(screen.getByText('Size')).toBeTruthy();
  });

  it('shows a Page section only where there is a size or orientation to choose', () => {
    expect(pageHasPageSection(laidOut(slide))).toBe(true);
    expect(
      pageHasPageSection(laidOut({ id: 'p', orientation: 'portrait', kind: 'infographic' })),
    ).toBe(true);
  });

  it("shows an unnamed card's title as its name, in the name's own ink, so typing a name overrides it", () => {
    renderPanel({ id: 'c', orientation: 'landscape', kind: 'flashcard', flow: 'f' }, 'Opening');
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Page name' });
    expect(field.value).toBe('');
    expect(field.placeholder).toBe('Opening');
    expect(field.className).toContain('placeholder:text-slate-900');
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Opening settings');
  });

  it('keeps the hint look on a page with no title to go by', () => {
    renderPanel(slide);
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Page name' });
    expect(field.placeholder).toBe('Untitled page');
    expect(field.className).toContain('placeholder:text-slate-400');
  });
});
