// What a folder holds, at a glance (one-explorer.md "What a folder holds, at a glance", Work Tracker 1517): the app
// badges, the stacked and empty glyphs, the words they say, and the same parts on the cards, rows and panel.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { App, Folder } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { Explorer } from './Explorer';
import { ExplorerPanel } from '../panel/ExplorerPanel';
import {
  FolderAppBadges,
  FolderEmpty,
  FolderGlyph,
  folderInside,
  insidePhrase,
  type FolderInsideCounts,
} from './FolderInside';

const folder = (id: string, parentId: string | null = null): Folder => ({
  id,
  name: id,
  parentId,
  teamId: null,
  ownerId: 'user_me',
  createdAt: 1,
  updatedAt: 1,
});

const preview = (apps?: Partial<Record<App, number>>, itemCount = 0, elsewhere?: number) => ({
  folderId: 'f',
  itemCount,
  items: [],
  ...(apps ? { apps } : {}),
  ...(elsewhere === undefined ? {} : { elsewhere: { itemCount: elsewhere, items: [] } }),
});

describe('folderInside', () => {
  it('is unknown until the index says, unless the folder holds folders', () => {
    expect(folderInside(undefined, 0, 'liveplanner')).toEqual({
      apps: [],
      items: 0,
      folders: 0,
      capped: false,
      empty: null,
    });
    expect(folderInside(undefined, 2, 'liveplanner').empty).toBe(false);
  });

  it("puts the host's app first, then the rest by count, and leaves out an app with none", () => {
    const inside = folderInside(
      preview({ livediagram: 1, livedocuments: 4, liveplanner: 2, livedesign: 4, livehuddle: 0 }),
      1,
      'liveplanner',
    );
    expect(inside.apps).toEqual([
      ['liveplanner', 2],
      ['livedocuments', 4],
      ['livedesign', 4],
      ['livediagram', 1],
    ]);
    expect(inside.items).toBe(11);
    expect(inside.empty).toBe(false);
  });

  it('is empty only with no item of any app and no folder', () => {
    expect(folderInside(preview({}), 0, 'liveplanner').empty).toBe(true);
    expect(folderInside(preview({}), 1, 'liveplanner').empty).toBe(false);
    expect(folderInside(preview({ livediagram: 1 }), 0, 'liveplanner').empty).toBe(false);
  });

  it("falls back to what is directly inside when the index sends no `apps`, other apps' included", () => {
    expect(folderInside(preview(undefined, 0, 3), 0, 'liveplanner')).toMatchObject({
      apps: [],
      items: 3,
      empty: false,
    });
    expect(folderInside(preview(undefined, 0), 0, 'liveplanner').empty).toBe(true);
  });

  it('marks a count at the cap', () => {
    expect(folderInside(preview({ livediagram: 1000 }), 0, 'liveplanner').capped).toBe(true);
  });
});

describe('insidePhrase', () => {
  const counts = (over: Partial<FolderInsideCounts>): FolderInsideCounts => ({
    apps: [],
    items: 0,
    folders: 0,
    capped: false,
    empty: null,
    ...over,
  });
  it('names each app by its kind, then the folders', () => {
    expect(
      insidePhrase(
        counts({
          apps: [
            ['livediagram', 3],
            ['livedocuments', 1],
          ],
          folders: 2,
        }),
      ),
    ).toBe('3 canvases, 1 document and 2 folders');
    expect(insidePhrase(counts({ apps: [['liveplanner', 1]] }))).toBe('1 plan');
    expect(insidePhrase(counts({ folders: 1 }))).toBe('1 folder');
    expect(insidePhrase(counts({}))).toBe('Empty');
    expect(insidePhrase(counts({ apps: [['liveplanner', 1000]], capped: true }))).toBe(
      'At least 1000 plans',
    );
  });
});

describe('FolderAppBadges', () => {
  const inside = (apps: [App, number][], folders = 0): FolderInsideCounts => ({
    apps,
    items: apps.reduce((s, [, n]) => s + n, 0),
    folders,
    capped: false,
    empty: false,
  });

  it('draws nothing for a folder with no items', () => {
    const { container } = render(<FolderAppBadges inside={inside([], 2)} size="card" />);
    expect(container.innerHTML).toBe('');
  });

  it('shows up to three logos, then +N, named for a screen reader', () => {
    render(
      <FolderAppBadges
        size="row"
        inside={inside([
          ['liveplanner', 1],
          ['livediagram', 2],
          ['livedocuments', 1],
          ['livedesign', 1],
          ['liveknowledge', 1],
        ])}
      />,
    );
    const badges = screen.getByRole('img', {
      name: '1 plan, 2 canvases, 1 document, 1 design and 1 knowledgebase',
    });
    expect(
      [...badges.querySelectorAll('[data-folder-app]')].map((el) =>
        el.getAttribute('data-folder-app'),
      ),
    ).toEqual(['liveplanner', 'livediagram', 'livedocuments']);
    expect(badges.querySelector('[data-folder-apps-more="2"]')!.textContent).toBe('+2');
  });

  it('shows three logos and no +N for exactly three apps', () => {
    render(
      <FolderAppBadges
        size="pane"
        inside={inside([
          ['liveplanner', 1],
          ['livediagram', 1],
          ['livedocuments', 1],
        ])}
      />,
    );
    expect(document.querySelectorAll('[data-folder-app]')).toHaveLength(3);
    expect(document.querySelector('[data-folder-apps-more]')).toBeNull();
  });

  it('names what is inside in a hover card, counted through the folders inside', async () => {
    render(<FolderAppBadges size="card" inside={inside([['livediagram', 3]], 2)} />);
    fireEvent.pointerEnter(screen.getByRole('img').parentElement!, { pointerType: 'mouse' });
    expect(await screen.findByText('3 canvases and 2 folders')).toBeTruthy();
    expect(screen.getAllByText('Counted through every folder inside.').length).toBeGreaterThan(0);
  });
});

describe('FolderGlyph and FolderEmpty', () => {
  it('stacks for a folder of folders, mutes an empty one, else the solid folder', () => {
    const { rerender } = render(<FolderGlyph inside={{ folders: 1, empty: false }} />);
    expect(document.querySelector('[data-folder-glyph="stack"]')).toBeTruthy();
    rerender(<FolderGlyph inside={{ folders: 0, empty: true }} />);
    expect(document.querySelector('[data-folder-glyph="empty"]')).toBeTruthy();
    rerender(<FolderGlyph inside={{ folders: 0, empty: null }} tone="text-brand-700" />);
    expect(document.querySelector('[data-folder-glyph="folder"]')!.className).toContain(
      'text-brand-700',
    );
  });

  it('says Empty, at either size', () => {
    const { rerender } = render(<FolderEmpty />);
    expect(screen.getByText('Empty')).toBeTruthy();
    rerender(<FolderEmpty compact />);
    expect(screen.getByText('Empty').className).toContain('text-[10px]');
  });
});

describe('on the Explorer and its panel', () => {
  beforeEach(() => localStorage.removeItem('liveworkspace:explorer-view-mode'));

  // A folder of a plan, with a subfolder holding a canvas and a document; an empty folder beside it.
  const data = () => {
    const folders = [folder('f1'), folder('sub', 'f1'), folder('bare')];
    const items = [
      makeItem(1, { folderId: 'f1' }),
      makeItem(2, { folderId: 'sub', app: 'livediagram', kind: 'canvas' }),
      makeItem(3, { folderId: 'sub', app: 'livedocuments', kind: 'document' }),
    ];
    return createFakeIndex({ items, folders });
  };

  it("badges a card with every app inside, the host's first, even filtered to one app", async () => {
    const index = data();
    render(
      <Explorer
        app="livediagram"
        client={index.client}
        view={{ kind: 'all' }}
        onNavigate={vi.fn()}
        itemHref={(i) => `/p/${i.id}`}
        onCreate={vi.fn()}
      />,
    );
    const badges = await waitFor(() => {
      const el = document.querySelector('[data-folder-card="f1"] [data-folder-apps]');
      expect(el).toBeTruthy();
      return el!;
    });
    expect(badges.getAttribute('data-folder-apps')).toBe('livediagram liveplanner livedocuments');
    expect(badges.getAttribute('aria-label')).toBe('1 canvas, 1 plan, 1 document and 1 folder');
    expect(
      document.querySelector('[data-folder-card="f1"] [data-folder-glyph="stack"]'),
    ).toBeTruthy();
    expect(document.querySelector('[data-folder-card="bare"] [data-folder-empty]')).toBeTruthy();
    expect(document.querySelector('[data-folder-card="bare"] [data-folder-apps]')).toBeNull();
  });

  it('shows the same on the Details rows', async () => {
    localStorage.setItem('liveworkspace:explorer-view-mode', 'details');
    const index = data();
    render(
      <Explorer
        app="liveplanner"
        client={index.client}
        view={{ kind: 'all' }}
        onNavigate={vi.fn()}
        itemHref={(i) => `/p/${i.id}`}
        onCreate={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(document.querySelector('[data-folder-row="f1"] [data-folder-apps]')).toBeTruthy(),
    );
    expect(
      document.querySelector('[data-folder-row="f1"] [data-folder-glyph="stack"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('[data-folder-row="bare"] [data-folder-glyph="empty"]'),
    ).toBeTruthy();
  });

  it("and on the editor panel's folder cards, Empty said on the empty one", async () => {
    const index = data();
    render(
      <ExplorerPanel
        app="liveplanner"
        client={index.client}
        itemHref={(i) => `/p/${i.id}`}
        onCreate={vi.fn()}
      />,
    );
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Explorer sections' })).getByRole('button', {
        name: 'My Work',
      }),
    );
    await waitFor(() =>
      expect(document.querySelector('[data-folder-apps]')?.getAttribute('data-folder-apps')).toBe(
        'liveplanner livediagram livedocuments',
      ),
    );
    expect(document.querySelector('[data-folder-glyph="stack"]')).toBeTruthy();
    expect(document.querySelector('[data-folder-glyph="empty"]')).toBeTruthy();
    expect(screen.getByText('Empty')).toBeTruthy();
  });
});
