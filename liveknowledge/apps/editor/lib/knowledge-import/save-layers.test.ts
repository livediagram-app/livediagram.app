// Where an import's pages are stored (docs/specs/020-import-export/blueprints/knowledgebase-import.md "Save layers").

import type { Tab } from '@liveknowledge/document';
import { describe, expect, it, vi } from 'vitest';
import { newKnowledgebaseLayer, openKnowledgebaseLayer } from './save-layers';

const tab = (id: string, parent?: string): Tab => ({
  id,
  name: id,
  elements: [],
  ...(parent ? { parent } : {}),
});

function openLayer(start: Tab[], saved: (id: string) => boolean = () => true, replaceId?: string) {
  let tabs = start;
  const loaded: string[] = [];
  const settled: string[] = [];
  const commits: number[] = [];
  const layer = openKnowledgebaseLayer({
    documentId: 'doc',
    getTabs: () => tabs,
    commitTabs: (map) => {
      tabs = map(tabs);
      commits.push(tabs.length);
    },
    markTabLoaded: (id) => loaded.push(id),
    markArticleSettle: (id) => settled.push(id),
    whenSaved: async (_doc, id) => saved(id),
    saveWaitMs: 5,
    ...(replaceId ? { replaceId } : {}),
  });
  return { layer, loaded, settled, commits, tabs: () => tabs };
}

describe('openKnowledgebaseLayer', () => {
  it('adds a batch as one edit of the page list, each page under its parent, and waits for the save', async () => {
    const open = openLayer([tab('home')]);
    const result = await open.layer.writeBatch(
      [tab('a', 'home'), tab('b', 'a'), tab('c', 'home')],
      'art-1',
    );
    expect(result).toEqual({ failed: new Map() });
    expect(open.commits).toEqual([4]);
    // Tree order: a page is followed by its subpages.
    expect(open.tabs().map((t) => [t.id, t.parent])).toEqual([
      ['home', undefined],
      ['a', 'home'],
      ['b', 'a'],
      ['c', 'home'],
    ]);
    expect(open.loaded).toEqual(['a', 'b', 'c']);
    expect(open.settled).toEqual(['a', 'b', 'c']);
  });

  it('puts a page of the same id in an existing page place, in the same edit as its batch', async () => {
    const open = openLayer(
      [tab('home'), { ...tab('start', 'home'), name: 'Start Here' }],
      undefined,
      'start',
    );
    const first = { ...tab('start'), name: 'Getting Started' };
    const result = await open.layer.writeBatch([first, tab('a', 'start'), tab('b')], 'art-1');
    expect(result).toEqual({ failed: new Map() });
    // One edit: the swap and the two new pages together.
    expect(open.commits).toEqual([4]);
    // The page keeps its place in the tree; its name and writing are the new page's.
    expect(open.tabs().map((t) => [t.id, t.name, t.parent])).toEqual([
      ['home', 'home', undefined],
      ['start', 'Getting Started', 'home'],
      ['a', 'a', 'start'],
      ['b', 'b', undefined],
    ]);
    expect(open.loaded).toEqual(['start', 'a', 'b']);
    expect(open.settled).toEqual(['start', 'a', 'b']);
  });

  it('adds the page as any other when the page to replace has gone, and waits for a replaced page to save', async () => {
    const gone = openLayer([tab('home')], undefined, 'start');
    await gone.layer.writeBatch([tab('start'), tab('a', 'start')], 'art-1');
    expect(gone.tabs().map((t) => t.id)).toEqual(['home', 'start', 'a']);
    // A later batch never holds the replaced id: nothing is swapped twice.
    const later = openLayer([tab('start')], undefined, 'start');
    await later.layer.writeBatch([tab('x')], 'art-1');
    expect(later.tabs().map((t) => t.id)).toEqual(['start', 'x']);
    const unsaved = openLayer([tab('start')], (id) => id !== 'start', 'start');
    expect(await unsaved.layer.writeBatch([tab('start')], 'art-1')).toEqual({
      failed: new Map(),
      stalled: true,
    });
  });

  it('answers the pages the tree refuses, each with why, and adds the rest', async () => {
    // 499 pages there: room for one more.
    const open = openLayer(Array.from({ length: 499 }, (_, i) => tab(`t${i}`)));
    const result = await open.layer.writeBatch([tab('a'), tab('b'), tab('c', 'nowhere')], 'art-1');
    expect([...result.failed]).toEqual([
      ['b', 'A knowledgebase holds 500 pages at most.'],
      ['c', 'A knowledgebase holds 500 pages at most.'],
    ]);
    expect(open.tabs()).toHaveLength(500);
    expect(open.commits).toEqual([500]);
  });

  it('commits nothing when every page is refused', async () => {
    const open = openLayer([tab('home')]);
    const result = await open.layer.writeBatch([tab('a', 'nowhere')], 'art-1');
    expect([...result.failed]).toEqual([['a', 'That page is no longer here.']]);
    expect(open.commits).toEqual([]);
  });

  it('says the save stalled when a page is not stored in time, keeping the pages', async () => {
    const open = openLayer([tab('home')], (id) => id !== 'b');
    const result = await open.layer.writeBatch([tab('a'), tab('b')], 'art-1');
    expect(result).toEqual({ failed: new Map(), stalled: true });
    expect(open.tabs()).toHaveLength(3);
  });
});

describe('newKnowledgebaseLayer', () => {
  function fresh(fails: (id: string) => boolean = () => false) {
    const calls: string[] = [];
    let running = 0;
    let most = 0;
    const layer = newKnowledgebaseLayer({
      create: async (pages) => void calls.push(`create:${pages.map((p) => p.id).join(',')}`),
      saveTab: async (page) => {
        running += 1;
        most = Math.max(most, running);
        await new Promise((resolve) => setTimeout(resolve, 1));
        running -= 1;
        if (fails(page.id)) throw new Error('refused');
        calls.push(`save:${page.id}`);
      },
      saveOrder: async (pages) => void calls.push(`order:${pages.map((p) => p.id).join(',')}`),
    });
    return { layer, calls, most: () => most };
  }

  it('creates the knowledgebase with the first batch, then saves parents before their subpages', async () => {
    const { layer, calls, most } = fresh();
    await layer.writeBatch([tab('a'), tab('b', 'a')], 'art-1');
    expect(calls).toEqual(['create:a,b']);
    const batch = [
      tab('c', 'a'),
      tab('d', 'c'),
      tab('e', 'd'),
      ...Array.from({ length: 9 }, (_, i) => tab(`x${i}`, 'a')),
    ];
    const result = await layer.writeBatch(batch, 'art-1');
    expect(result).toEqual({ failed: new Map() });
    const at = (id: string) => calls.indexOf(`save:${id}`);
    expect(at('c')).toBeLessThan(at('d'));
    expect(at('d')).toBeLessThan(at('e'));
    expect(most()).toBe(4);
    // The order is written once the batch is stored, in tree order, with every page stored so far.
    expect(calls.at(-1)).toBe(`order:a,b,${batch.map((p) => p.id).join(',')}`);
  });

  it('fails the subpages of a page that could not be saved, and keeps the rest', async () => {
    const { layer, calls } = fresh((id) => id === 'c');
    await layer.writeBatch([tab('a')], 'art-1');
    const result = await layer.writeBatch([tab('c', 'a'), tab('d', 'c'), tab('e', 'a')], 'art-1');
    expect([...result.failed]).toEqual([
      ['c', 'It could not be saved.'],
      ['d', 'The page it sits under could not be saved.'],
    ]);
    expect(result.stalled).toBeUndefined();
    expect(calls.at(-1)).toBe('order:a,e');
  });

  it('stalls when nothing of a batch is stored, or its order cannot be written', async () => {
    const none = fresh(() => true);
    await none.layer.writeBatch([tab('a')], 'art-1');
    expect(await none.layer.writeBatch([tab('b')], 'art-1')).toMatchObject({ stalled: true });

    const saveOrder = vi.fn(async () => Promise.reject(new Error('down')));
    const layer = newKnowledgebaseLayer({
      create: async () => {},
      saveTab: async () => {},
      saveOrder,
    });
    await layer.writeBatch([tab('a')], 'art-1');
    expect(await layer.writeBatch([tab('b')], 'art-1')).toEqual({
      failed: new Map(),
      stalled: true,
    });
  });

  it('lets a create that fails reject, so the import stops', async () => {
    const layer = newKnowledgebaseLayer({
      create: async () => Promise.reject(new Error('no')),
      saveTab: async () => {},
      saveOrder: async () => {},
    });
    await expect(layer.writeBatch([tab('a')], 'art-1')).rejects.toThrow('no');
  });
});
