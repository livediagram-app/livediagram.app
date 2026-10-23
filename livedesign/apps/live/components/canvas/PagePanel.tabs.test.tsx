// @vitest-environment jsdom

// The page panel's tabs (docs/specs/007-editor/pages-mode.md "page panel"): Page while there is a size
// or orientation to choose, Background beside it, then the kind's own.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, type Page } from '@livedesign/design';
import type { PageEdits } from '@/hooks/editor/usePagesMode';
import { PagePanel, pagePanelTabs, type PagePanelTab } from './PagePanel';

afterEach(cleanup);

const laidOut = (page: Page) => layOutPages([page])[0]!;

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
  removePage: vi.fn(),
});

function renderPanel(page: Page, initialTab: PagePanelTab, onPreview = vi.fn()) {
  render(
    <PagePanel
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
  it('gives a page whose kind is not chosen yet its Page alone', () => {
    expect(pagePanelTabs(laidOut({ id: 'p', orientation: 'portrait' }))).toEqual(['page']);
  });

  it('gives a wireframe page its Device alone, its Background and Layouts beside the cog', () => {
    expect(
      pagePanelTabs(
        laidOut({ id: 'p', orientation: 'portrait', kind: 'wireframe', device: 'iphone' }),
      ),
    ).toEqual(['device']);
  });

  it('drops Page from a logo page, which has no size or orientation to choose', () => {
    expect(
      pagePanelTabs(laidOut({ id: 'p', orientation: 'portrait', kind: 'logo', size: 'logo' })),
    ).toEqual(['background', 'layouts']);
  });
});

describe('the Background tab', () => {
  it('opens a page whose kind is not chosen asked for Background on Page, with no tab switch', () => {
    renderPanel({ id: 'p', orientation: 'portrait' }, 'background');
    expect(screen.queryByRole('group', { name: 'Page panel section' })).toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Orientation' })).toBeTruthy();
  });

  it('opens a logo page on Background, its first tab', () => {
    renderPanel({ id: 'p', orientation: 'portrait', kind: 'logo', size: 'logo' }, 'page');
    expect(screen.queryByRole('button', { name: 'Page' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Background' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('takes a hovered preview off the page when leaving it', () => {
    const onPreview = renderPanel(
      { id: 'p', orientation: 'portrait', kind: 'logo', size: 'logo' },
      'background',
    );
    onPreview.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Layouts' }));
    expect(onPreview).toHaveBeenCalledWith(null);
  });
});
