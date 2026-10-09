// @vitest-environment jsdom

// A page of a partly locked article in its panel (docs/specs/007-editor/illustrate-pages.md
// "Locking a page"): the edits its pages share are held from every page, its own name is not.

import { cleanup, render, screen } from '@testing-library/react';
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
    removePage: vi.fn(),
  }) as IllustratePageEdits;

const pages: IllustratePage[] = [
  { id: 'd1', orientation: 'portrait', kind: 'article', flow: 'f', locked: true },
  { id: 'd2', orientation: 'portrait', kind: 'article', flow: 'f' },
];

describe('a page held by its article lock', () => {
  it('disables Delete and says why, leaving its name editable', () => {
    render(
      <IllustratePagePanel
        page={layOutIllustratePages(pages)[1]!}
        count={2}
        heldByLock
        getAnchor={() => undefined}
        initialTab="page"
        themeBackgrounds={[]}
        edit={edits()}
        onPreview={vi.fn()}
        onLayoutPreview={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('A page of this article is locked');
    expect(screen.getByRole('button', { name: 'Delete article' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByRole('textbox').closest('[inert]')).toBeNull();
  });
});
