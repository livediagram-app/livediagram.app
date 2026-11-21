// @vitest-environment jsdom

// The page tree's sidebar and its phone sheet (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page
// tree"): the knowledgebase's name, New Page at the foot, the collapse to a rail, the brand tint's contrast.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessLevel } from '@liveknowledge/api-schema';
import { contrastRatio, MAX_KNOWLEDGEBASE_PAGES } from '@liveknowledge/document';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import type { PageTreeActions } from './PageTree';
import { PageTreeSheet } from './PageTreeSheet';
import { PageTreeSidebar, type PageTreeSidebarProps } from './PageTreeSidebar';
import { PAGE_TREE_RAIL_WIDTH, PAGE_TREE_TOUCH_ROW, PAGE_TREE_WIDTH } from './page-tree-view';

const TABS = [
  { id: 'a', name: 'Start Here' },
  { id: 'b', name: 'Release Process', parent: 'a' },
];

function actions(): PageTreeActions {
  return {
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onAdd: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    onStep: vi.fn(),
    onIndent: vi.fn(),
    onOutdent: vi.fn(),
    onCopyLink: vi.fn(),
  };
}

// The head's menu, as the tree's host hands it (usePageTreeChrome): here a button that starts the rename, so the
// sidebar's own part (the name, and the field it becomes) is tested without the editor's store. The menu itself is
// components/knowledge-menu/KnowledgebaseMenu.test.tsx.
const menu: NonNullable<PageTreeSidebarProps['menu']> = (head) =>
  head.onRename ? (
    <button type="button" onClick={head.onRename}>
      {head.name}
    </button>
  ) : (
    <p>{head.name}</p>
  );

function props(over: Partial<PageTreeSidebarProps> = {}): PageTreeSidebarProps {
  return {
    tabs: TABS,
    activeId: 'a',
    closed: new Set(),
    onSetOpen: vi.fn(),
    canEdit: true,
    actions: actions(),
    name: 'Engineering',
    onRenameKnowledgebase: vi.fn(),
    menu,
    collapsed: false,
    onSetCollapsed: vi.fn(),
    top: 64,
    joined: true,
    ...over,
  };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PageTreeSidebar', () => {
  it('is the Pages landmark, 264px wide, measured as the docked sidebar', () => {
    render(<PageTreeSidebar {...props()} />);
    const aside = screen.getByRole('complementary', { name: 'Pages' });
    expect(aside.style.width).toBe(`${PAGE_TREE_WIDTH}px`);
    // What the page framing and Zoom to Fit measure, so the page centres beside it.
    expect(aside.hasAttribute('data-contents-sidebar')).toBe(true);
    // Joined to the menu box, it rises to the canvas's top.
    expect(aside.style.top).toBe('0px');
    expect(within(aside).getByText('Pages')).toBeTruthy();
    expect(within(aside).getByRole('tree', { name: 'Pages' })).toBeTruthy();
  });

  it('shows the name alone, as text, with no menu to host (an embed, a preview)', () => {
    render(<PageTreeSidebar {...props({ menu: undefined })} />);
    expect(screen.getByText('Engineering').tagName).toBe('P');
    expect(screen.queryByRole('button', { name: 'Engineering' })).toBeNull();
  });

  it('shows the knowledgebase’s name and renames it in place', () => {
    const p = props();
    render(<PageTreeSidebar {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Engineering' }));
    const field = screen.getByRole('textbox', { name: 'Knowledgebase name' });
    fireEvent.change(field, { target: { value: 'Platform' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(p.onRenameKnowledgebase).toHaveBeenCalledWith('Platform');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('names an unnamed knowledgebase Untitled Knowledgebase', () => {
    render(<PageTreeSidebar {...props({ name: ' ' })} />);
    expect(screen.getByRole('button', { name: 'Untitled Knowledgebase' })).toBeTruthy();
  });

  it('adds a top-level page from New Page at its foot', () => {
    const p = props();
    render(<PageTreeSidebar {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Page' }));
    expect(p.actions.onAdd).toHaveBeenCalledWith();
  });

  it('disables New Page at the page limit, and says why', () => {
    const full = Array.from({ length: MAX_KNOWLEDGEBASE_PAGES }, (_, i) => ({
      id: `t${i}`,
      name: `P${i}`,
    }));
    render(<PageTreeSidebar {...props({ tabs: full, activeId: 't0', closed: new Set() })} />);
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'New Page' });
    expect(button.disabled).toBe(true);
    expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe(
      'A knowledgebase holds 500 pages at most.',
    );
  });

  it('collapses to a rail with the way back, and no tree', () => {
    const p = props();
    const { rerender } = render(<PageTreeSidebar {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide Pages' }));
    expect(p.onSetCollapsed).toHaveBeenCalledWith(true);
    rerender(<PageTreeSidebar {...p} collapsed joined={false} />);
    const rail = screen.getByRole('complementary', { name: 'Pages' });
    expect(rail.style.width).toBe(`${PAGE_TREE_RAIL_WIDTH}px`);
    // The rail stands under the menu box rather than joined to it.
    expect(rail.style.top).toBe('64px');
    expect(screen.queryByRole('tree')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show Pages' }));
    expect(p.onSetCollapsed).toHaveBeenCalledWith(false);
  });

  it('keeps presses and the context menu from reaching the canvas under it', () => {
    const onPointerDown = vi.fn();
    render(
      <div onPointerDown={onPointerDown}>
        <PageTreeSidebar {...props()} />
      </div>,
    );
    fireEvent.pointerDown(screen.getByRole('complementary', { name: 'Pages' }));
    expect(onPointerDown).not.toHaveBeenCalled();
  });

  // docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles".
  describe.each(['edit', 'participate', 'view'] as AccessLevel[])('share roles: %s', (level) => {
    const may = resolveEditorCapabilities(level).editPages;
    it(`${may ? 'offers' : 'withholds'} New Page and the knowledgebase’s rename, open or collapsed`, () => {
      const p = props({ canEdit: may, onRenameKnowledgebase: may ? vi.fn() : undefined });
      const { rerender } = render(<PageTreeSidebar {...p} />);
      expect(screen.queryByRole('button', { name: 'New Page' }) !== null).toBe(may);
      expect(screen.queryByRole('button', { name: 'Engineering' }) !== null).toBe(may);
      // The name still reads, and the tree still collapses, whatever the role.
      expect(screen.getByText('Engineering')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Hide Pages' })).toBeTruthy();
      rerender(<PageTreeSidebar {...p} collapsed joined={false} />);
      expect(screen.queryByRole('button', { name: 'New Page' }) !== null).toBe(may);
    });
  });
});

describe('PageTreeSheet', () => {
  it('opens the same tree in a sheet from the Pages button, its rows 44px tall', () => {
    render(<PageTreeSheet {...props()} />);
    expect(screen.queryByRole('tree')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pages' }));
    const sheet = screen.getByRole('dialog', { name: 'Pages' });
    expect(within(sheet).getByText('Engineering')).toBeTruthy();
    const rows = within(sheet).getAllByRole('treeitem');
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.style.height).toBe(`${PAGE_TREE_TOUCH_ROW}px`);
    expect(PAGE_TREE_TOUCH_ROW).toBeGreaterThanOrEqual(44);
    // No hover on a touch screen: every row's menu button is there.
    expect(within(sheet).getAllByRole('button', { name: /^Page Options for/ })).toHaveLength(2);
  });

  it('closes when a page is chosen or added', () => {
    const p = props();
    render(<PageTreeSheet {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pages' }));
    fireEvent.click(screen.getByRole('treeitem', { name: 'Release Process' }));
    expect(p.actions.onSelect).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pages' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Page' }));
    expect(p.actions.onAdd).toHaveBeenCalledWith(undefined);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('gives a reader the tree with no New Page', () => {
    render(<PageTreeSheet {...props({ canEdit: false })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pages' }));
    expect(screen.getByRole('tree', { name: 'Pages' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New Page' })).toBeNull();
  });
});

describe('the current page’s tint', () => {
  it('is brand-900 on brand-100, over 4.5:1', () => {
    // The suite runs from the editor's own folder.
    const theme = readFileSync(resolve('../../packages/tailwind-config/theme.css'), 'utf8');
    const colour = (step: number) =>
      new RegExp(`--color-brand-${step}:\\s*(#[0-9a-fA-F]{6})`).exec(theme)![1]!;
    expect(contrastRatio(colour(900), colour(100))).toBeGreaterThan(4.5);
    const row = readFileSync(resolve('components/page-tree/PageTreeRow.tsx'), 'utf8');
    expect(row).toContain('bg-brand-100 font-medium text-brand-900');
  });
});
