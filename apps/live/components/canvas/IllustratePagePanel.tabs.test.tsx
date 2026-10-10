// @vitest-environment jsdom

// The page panel's tabs (docs/specs/007-editor/illustrate-pages.md "page panel"): Page while there is a size
// or orientation to choose, Background beside it, then the kind's own.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutIllustratePages, type IllustratePage } from '@livediagram/document';
import type { IllustratePageEdits } from '@/hooks/editor/useIllustratePages';
import { IllustratePagePanel, pagePanelTabs, type PagePanelTab } from './IllustratePagePanel';

afterEach(cleanup);

const laidOut = (page: IllustratePage) => layOutIllustratePages([page])[0]!;

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
    removePage: vi.fn(),
  }) as IllustratePageEdits;

function renderPanel(page: IllustratePage, initialTab: PagePanelTab, onPreview = vi.fn()) {
  render(
    <IllustratePagePanel
      page={laidOut(page)}
      count={1}
      getAnchor={() => undefined}
      initialTab={initialTab}
      themeBackgrounds={[]}
      edit={edits()}
      onPreview={onPreview}
      onLayoutPreview={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  return onPreview;
}

describe('pagePanelTabs', () => {
  it('gives an infographic page Page, Background and Layouts', () => {
    expect(
      pagePanelTabs(laidOut({ id: 'p', orientation: 'portrait', kind: 'infographic' })),
    ).toEqual(['page', 'background', 'layouts']);
  });

  it('gives an article page Page, Background, Style and Text', () => {
    expect(
      pagePanelTabs(laidOut({ id: 'p', orientation: 'portrait', kind: 'article', flow: 'f' })),
    ).toEqual(['page', 'background', 'style', 'text']);
  });

  it('drops Page from a logo page, which has no size or orientation to choose', () => {
    expect(
      pagePanelTabs(laidOut({ id: 'p', orientation: 'portrait', kind: 'logo', size: 'logo' })),
    ).toEqual(['background', 'layouts']);
  });
});

describe('the Background tab', () => {
  const infographic: IllustratePage = { id: 'p', orientation: 'portrait', kind: 'infographic' };

  it('holds the backgrounds, which the Page tab no longer shows', () => {
    renderPanel(infographic, 'page');
    expect(screen.getByText('Size')).toBeTruthy();
    expect(screen.queryByText('Pattern')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    expect(screen.getByText('Pattern')).toBeTruthy();
    expect(screen.queryByText('Size')).toBeNull();
  });

  it('opens a logo page on Background, its first tab', () => {
    renderPanel({ id: 'p', orientation: 'portrait', kind: 'logo', size: 'logo' }, 'page');
    expect(screen.queryByRole('button', { name: 'Page' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Background' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('takes a hovered preview off the page when leaving it', () => {
    const onPreview = renderPanel(infographic, 'background');
    onPreview.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Layouts' }));
    expect(onPreview).toHaveBeenCalledWith(null);
  });
});
