// The phone's way round (liveworkspace/docs/specs/004-index/one-explorer.md "The sidebar", On a phone): the sections
// bar under the header names the view on screen and is one button; it opens the sidebar as a full-screen drawer that
// keeps the row a keyboard user moved to, locks the page's scroll, closes on Escape, its close, a pick or a change of
// view, and hands focus back to the bar.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Folder } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex } from '../test/fakeClient';
import type { ExplorerView } from '../views';
import { Explorer } from './Explorer';

afterEach(cleanup);

const folder = (id: string, name: string): Folder => ({
  id,
  name,
  parentId: null,
  teamId: null,
  ownerId: 'user_me',
  createdAt: 1,
  updatedAt: 1,
});

function page(view: ExplorerView = { kind: 'all' }, folders: Folder[] = []) {
  const index = createFakeIndex({ folders });
  const onNavigate = vi.fn();
  const props = {
    app: 'liveplanner' as const,
    client: index.client,
    onNavigate,
    itemHref: (item: { id: string }) => `/plan/${item.id}`,
    viewerId: 'user_me',
    heroHidden: true,
  };
  const at = (v: ExplorerView) => <Explorer {...props} view={v} onCreate={() => {}} />;
  const { rerender } = render(at(view));
  // A fresh onCreate each time, as a host that renders again hands down.
  return { onNavigate, rerender: (v: ExplorerView = view) => rerender(at(v)) };
}

const bar = () => screen.getByRole('button', { name: /^Open Sidebar, Current: / });
const drawer = () => screen.queryByRole('dialog', { name: 'Sidebar' });

describe('the sections bar', () => {
  it.each<[ExplorerView, string]>([
    [{ kind: 'all' }, 'My Work'],
    [{ kind: 'inbox' }, 'Inbox'],
    [{ kind: 'shared' }, 'Shared With Me'],
    [{ kind: 'trash' }, 'Trash'],
    [{ kind: 'archived' }, 'Archived'],
  ])('names the view on screen (%o)', async (view, name) => {
    page(view);
    const button = await screen.findByRole('button', { name: `Open Sidebar, Current: ${name}` });
    expect(button.textContent).toBe(name);
  });

  it('names a folder by its own name once the folders are in', async () => {
    page({ kind: 'folder', id: 'f1' }, [folder('f1', 'Quarterly Planning')]);
    expect(
      await screen.findByRole('button', { name: 'Open Sidebar, Current: Quarterly Planning' }),
    ).toBeTruthy();
  });

  it('is one full-width button that opens the drawer, the whole screen wide', () => {
    page();
    const open = bar();
    expect(open.className).toContain('w-full');
    expect(open.className).toContain('h-12');
    expect(open.getAttribute('aria-expanded')).toBe('false');
    // Anywhere in the row: its name, not only the glyph.
    fireEvent.click(within(open).getByText('My Work'));
    const panel = drawer()!;
    expect(panel).toBeTruthy();
    expect(open.getAttribute('aria-expanded')).toBe('true');
    expect(open.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.className).toMatch(/\binset-0\b/);
    expect(panel.className).toMatch(/\bw-full\b/);
    expect(panel.className).not.toMatch(/max-w-|w-72/);
  });

  it('is the only menu button: the pane heading has none', () => {
    page();
    expect(screen.getAllByRole('button', { name: /Open Sidebar|Browse sections/i })).toHaveLength(
      1,
    );
  });
});

describe('the Sidebar drawer', () => {
  it('keeps focus where it was moved when the Explorer renders again, and returns it to the bar on Escape', () => {
    const { rerender } = page();
    const open = bar();
    open.focus();
    fireEvent.click(open);
    const panel = drawer()!;
    expect(document.activeElement).toBe(panel);
    const close = within(panel).getByRole('button', { name: 'Close' });
    close.focus();
    rerender();
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(drawer()).toBeNull();
    expect(document.activeElement).toBe(bar());
  });

  it('closes on its close and hands focus back to the bar', () => {
    page();
    bar().focus();
    fireEvent.click(bar());
    fireEvent.click(within(drawer()!).getByRole('button', { name: 'Close' }));
    expect(drawer()).toBeNull();
    expect(document.activeElement).toBe(bar());
  });

  it('locks the page’s scroll while open, and gives it back as it was', () => {
    page();
    document.documentElement.style.overflow = 'auto';
    fireEvent.click(bar());
    expect(document.documentElement.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.documentElement.style.overflow).toBe('auto');
    document.documentElement.style.overflow = '';
  });

  it('closes on a pick, asking the host to go there', () => {
    const { onNavigate } = page();
    fireEvent.click(bar());
    const inbox = within(drawer()!).getByRole('treeitem', { name: /^Inbox/ });
    fireEvent.click(inbox.querySelector<HTMLElement>('[data-tree-activate]')!);
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'inbox' }, '/explorer/inbox');
    expect(drawer()).toBeNull();
  });

  it('closes when the view changes another way (Back, an address)', () => {
    const { rerender } = page();
    fireEvent.click(bar());
    expect(drawer()).toBeTruthy();
    rerender({ kind: 'trash' });
    expect(drawer()).toBeNull();
    expect(bar().getAttribute('aria-label')).toBe('Open Sidebar, Current: Trash');
  });
});
