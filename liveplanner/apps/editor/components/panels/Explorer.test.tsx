// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { ProjectListItem, Folder } from '@/lib/api-client';
import { Explorer } from './Explorer';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/components/panels/ProjectThumbnail', () => ({ ProjectThumbnail: () => <span /> }));
const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({ useIsMobileViewport: () => viewport.mobile }));
// The views each fetch their own feed; here only which one the pane shows matters.
vi.mock('./explorer-panel/PanelViews', () => ({
  HomeSection: () => <p>home view</p>,
  InboxSection: () => <p>inbox view</p>,
  TrashSection: () => <p>trash view</p>,
  LibrarySection: () => <p>library view</p>,
}));

// docs/specs/013-workspace/explorer-structure.md "The editor's Explorer": a rail of sections beside a pane.
const doc = (id: string, name: string, over: Partial<ProjectListItem> = {}) =>
  ({
    id,
    name,
    ownerId: 'me',
    folderId: null,
    savedAt: 1,
    source: null,
    empty: true,
    ...over,
  }) as ProjectListItem;

function show(over: Partial<ComponentProps<typeof Explorer>> = {}) {
  render(
    <Explorer
      position={null}
      projects={[doc('d1', 'Roadmap'), doc('d2', 'Budget')]}
      ownerId="me"
      folders={[]}
      loading={false}
      currentProjectId="d1"
      recentExcludedIds={[]}
      onToggleRecentExclusion={vi.fn()}
      favouriteIds={new Set()}
      onToggleFavourite={vi.fn()}
      onMoveTo={vi.fn()}
      onOpenProject={vi.fn()}
      onRenameCurrent={vi.fn()}
      {...over}
    />,
  );
}

const folder = (id: string, name: string, parentId: string | null = null): Folder => ({
  id,
  name,
  parentId,
  ownerId: 'me',
  teamId: null,
  createdAt: 1,
  updatedAt: 1,
});

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline'))),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  viewport.mobile = false;
});

describe('Explorer', () => {
  // A short phone's sheet: pinned, the card and the sign-in note left the pane a sliver (43px on an iPhone SE).
  it("scrolls a phone sheet's card and pane as one, the pane never shorter than 18rem", () => {
    viewport.mobile = true;
    show({ asPopover: true, popoverOpen: true, onPopoverClose: vi.fn() });
    const scroll = document.querySelector<HTMLElement>('[data-explorer-sheet-scroll]');
    expect(scroll).toBeTruthy();
    expect(scroll!.className).toContain('overflow-y-auto');
    expect(scroll!.contains(screen.getByRole('region', { name: 'Current plan' }))).toBe(true);
    expect(scroll!.querySelector('.min-h-\\[18rem\\]')).toBeTruthy();
    // The product links stay pinned under it.
    expect(scroll!.contains(screen.getByRole('navigation', { name: 'Go to' }))).toBe(false);
  });

  it('adds no scroll box of its own outside a phone sheet', () => {
    show();
    expect(document.querySelector('[data-explorer-sheet-scroll]')).toBeNull();
  });

  it('opens on Home under its Current Project card, and lists My Work when picked', async () => {
    show();
    expect(screen.getByRole('region', { name: 'Current plan' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rename Roadmap' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy();
    expect(await screen.findByText('home view')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'My Work' }));
    expect(screen.getByRole('heading', { name: 'My Work' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Budget' })).toBeTruthy();
  });

  it('shows the picked section in the pane, never leaving the editor', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Inbox' }));
    expect(screen.getByRole('heading', { name: 'Inbox' })).toBeTruthy();
    expect(await screen.findByText('inbox view')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open Page/ }).getAttribute('href')).toBe(
      '/explorer/inbox',
    );
  });

  it('is never faded by Panel opacity, so its menus stay readable', () => {
    show();
    expect(document.querySelector('[data-tour-id="explorer"]')).not.toBeNull();
    expect(document.querySelector('[data-tour-id="explorer"][data-panel-translucent]')).toBeNull();
  });

  it('carries the product links in its footer', () => {
    show();
    const links = screen.getByRole('navigation', { name: 'Go to' });
    expect(links.textContent).toContain('Help');
    expect(links.textContent).not.toContain('Editor');
  });

  // "The pane": a folder opens in the pane, and New Folder makes the folder there, not at the root.
  it('makes a new folder inside the folder open in the pane', async () => {
    const onCreateFolder = vi.fn(async ({ parentId }: { name: string; parentId: string | null }) =>
      folder('new', 'New folder', parentId),
    );
    show({ folders: [folder('f1', 'Projects'), folder('f2', 'Drafts', 'f1')], onCreateFolder });
    fireEvent.click(screen.getByRole('button', { name: 'My Work' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Folder' }));
    expect(onCreateFolder).toHaveBeenLastCalledWith({ name: 'New folder', parentId: null });
    fireEvent.click(await screen.findByRole('button', { name: 'Projects' }));
    fireEvent.click(screen.getByRole('button', { name: 'Drafts' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Subfolder' }));
    expect(onCreateFolder).toHaveBeenLastCalledWith({ name: 'New folder', parentId: 'f2' });
    // Back out to the root: New Folder makes a root folder again.
    fireEvent.click(screen.getByRole('button', { name: /^Projects/ }));
    fireEvent.click(screen.getByRole('button', { name: /^My Work.*Projects/ }));
    fireEvent.click(screen.getByRole('button', { name: 'New Folder' }));
    expect(onCreateFolder).toHaveBeenLastCalledWith({ name: 'New folder', parentId: null });
  });

  it('opens the folder whose New Subfolder made one, so the new folder shows where it went', async () => {
    const onCreateFolder = vi.fn(async ({ parentId }: { name: string; parentId: string | null }) =>
      folder('new', 'New folder', parentId),
    );
    show({ folders: [folder('f1', 'Projects')], onCreateFolder, onRenameFolder: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'My Work' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Menu for Projects' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /New Subfolder/ }));
    expect(onCreateFolder).toHaveBeenLastCalledWith({ name: 'New folder', parentId: 'f1' });
    // The pane is now in Projects, under its back bar.
    expect(await screen.findByRole('button', { name: /^My Work.*Projects/ })).toBeTruthy();
  });
});
