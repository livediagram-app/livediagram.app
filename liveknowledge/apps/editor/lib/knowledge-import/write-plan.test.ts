// Writing an import plan (docs/specs/020-import-export/blueprints/knowledgebase-import.md "Writing the plan"), over a
// save layer that records its batches: twenty pages at a time, parents before their subpages, every link written
// once with its page, pictures three at a time, a cancel between batches, and a failed page that stops nothing.

import { KNOWLEDGEBASE_FLOW, type ArticleRun, type Tab } from '@liveknowledge/document';
import { isPageLinkRun } from '@liveknowledge/knowledge';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it, vi } from 'vitest';
import { picture, planOf, plannedPage, recordingLayer, storedPicture } from './test-plan';
import {
  IMPORT_BATCH_PAGES,
  IMPORT_PICTURE_CONCURRENCY,
  writeImportPlan,
  type ImportWriteDeps,
} from './write-plan';

function depsFor(over: Partial<ImportWriteDeps> = {}): ImportWriteDeps & {
  layer: ReturnType<typeof recordingLayer>;
  progress: number[];
} {
  const layer = recordingLayer();
  const progress: number[] = [];
  let n = 0;
  return {
    layer,
    progress,
    save: layer,
    storePicture: async (p) => storedPicture(`img-${p.path}`),
    newId: () => `tab-${++n}`,
    cancelled: () => false,
    onProgress: (p) => progress.push(p.done),
    ...over,
  };
}

// The runs as the tab was written (not as a reader normalises them).
const runsOf = (tab: Tab): ArticleRun[] =>
  tab.articles![KNOWLEDGEBASE_FLOW]!.blocks.flatMap((b) =>
    b.type === 'paragraph' || b.type === 'list' ? b.runs : [],
  );

// A chain: p1, then p2 under p1, p3 under p2 ... so every page's parent is the page before it.
const chain = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    plannedPage(`p${i + 1}`, { parentKey: i === 0 ? null : `p${i}` }),
  );

describe('writeImportPlan', () => {
  it('writes the pages in tree order, twenty at a time, and says how far it is', async () => {
    const deps = depsFor();
    const result = await writeImportPlan(
      planOf(Array.from({ length: 45 }, (_, i) => plannedPage(`p${i + 1}`))),
      deps,
    );
    expect(deps.layer.batches.map((b) => b.length)).toEqual([IMPORT_BATCH_PAGES, 20, 5]);
    expect(deps.layer.batches.flat().map((t) => t.name)).toEqual(
      Array.from({ length: 45 }, (_, i) => `Page p${i + 1}`),
    );
    expect(deps.progress).toEqual([0, 20, 40, 45]);
    expect(result).toMatchObject({ total: 45, imported: 45, cancelled: false, stalled: false });
    expect(result.first).toEqual({ id: 'tab-1', title: 'Page p1' });
  });

  it('hands every page its parent, and never a subpage before the page above it', async () => {
    const deps = depsFor({ parent: 'landing' });
    await writeImportPlan(planOf(chain(45)), deps);
    const seen = new Set(['landing']);
    for (const batch of deps.layer.batches) {
      for (const tab of batch) {
        expect(seen.has(tab.parent!)).toBe(true);
        seen.add(tab.id);
      }
    }
    // The top page of the import lands under the chosen page.
    expect(deps.layer.batches[0]![0]!.parent).toBe('landing');
    expect(deps.layer.batches[1]![0]!.parent).toBe('tab-20');
  });

  it('writes a link to a page further down the tree with the page that holds it, in one pass', async () => {
    const deps = depsFor();
    const pages = Array.from({ length: 30 }, (_, i) => plannedPage(`p${i + 1}`));
    pages[0] = plannedPage('p1', {
      markdown: 'See [the last](knowledgebase-page:p30) and [gone](knowledgebase-page:p99).',
    });
    await writeImportPlan(planOf(pages), deps);
    // p30 is written in the second batch; its id was known when the first was written.
    const runs = runsOf(deps.layer.batches[0]![0]!);
    const link = runs.find((r) => r.text === 'the last')!;
    expect(isPageLinkRun(link) && link.page).toBe('tab-30');
    expect(link.href).toBeUndefined();
    // A target the plan does not hold reads as its words, with no address.
    const gone = runs.find((r) => r.text === 'gone')!;
    expect(isPageLinkRun(gone)).toBe(false);
    expect(gone.href).toBeUndefined();
    // Each page was handed to the save layer once: nothing is written a second time for its links.
    expect(deps.layer.batches.flat()).toHaveLength(30);
  });

  it('stores pictures three at a time, each file once, and names the ones that fail', async () => {
    let running = 0;
    let most = 0;
    const asked: string[] = [];
    const deps = depsFor({
      storePicture: async (p) => {
        asked.push(p.path);
        running += 1;
        most = Math.max(most, running);
        await new Promise((resolve) => setTimeout(resolve, 1));
        running -= 1;
        return p.path === 'img/bad.png'
          ? { ok: false, failure: 'unsupported' }
          : storedPicture(`img-${p.path}`);
      },
    });
    const pages = Array.from({ length: 12 }, (_, i) =>
      plannedPage(`p${i + 1}`, {
        markdown: 'Logo\n\n![Logo](knowledgebase-picture:0)\n\n![Own](knowledgebase-picture:1)',
        pictures: [picture('img/logo.png'), picture(i === 3 ? 'img/bad.png' : `img/${i}.png`)],
      }),
    );
    const result = await writeImportPlan(planOf(pages), deps);
    expect(most).toBe(IMPORT_PICTURE_CONCURRENCY);
    // The logo twelve pages show is stored once.
    expect(asked.filter((p) => p === 'img/logo.png')).toHaveLength(1);
    expect(asked).toHaveLength(13);
    expect(result.failedPictures).toEqual([
      { page: 'Page p4', picture: 'bad.png', reason: 'Its format is not one a picture can be.' },
    ]);
    // The page keeps the failed picture's description, and its stored picture a zone.
    const bad = deps.layer.batches[0]![3]!;
    expect(runsOf(bad).map((r) => r.text)).toContain('Own');
    expect(bad.elements).toHaveLength(1);
    expect(result.imported).toBe(12);
  });

  it('stops between batches when cancelled, keeping what was written', async () => {
    let batches = 0;
    const deps = depsFor({ cancelled: () => batches >= 2 });
    const layer = recordingLayer(() => {
      batches += 1;
      return { failed: new Map() };
    });
    const result = await writeImportPlan(
      planOf(Array.from({ length: 70 }, (_, i) => plannedPage(`p${i + 1}`))),
      { ...deps, save: layer },
    );
    expect(layer.batches).toHaveLength(2);
    expect(result).toMatchObject({ imported: 40, total: 70, cancelled: true });
  });

  it('reports a page that fails by name and carries on, its subpages moving up', async () => {
    const deps = depsFor({ parent: 'landing' });
    const pages = [
      plannedPage('p1'),
      // Longer than a page takes.
      plannedPage('p2', { parentKey: 'p1', title: 'Too Long', markdown: 'x'.repeat(400_001) }),
      plannedPage('p3', { parentKey: 'p2', markdown: 'To [its parent](knowledgebase-page:p2).' }),
    ];
    const result = await writeImportPlan(planOf(pages), deps);
    expect(result.failedPages).toEqual([
      { title: 'Too Long', reason: expect.stringContaining('longer than a page takes') },
    ]);
    expect(result.imported).toBe(2);
    const [first, third] = deps.layer.batches[0]!;
    // The page under the one that failed sits under the page above it, and its link to it is plain words.
    expect(third!.parent).toBe(first!.id);
    expect(runsOf(third!).some(isPageLinkRun)).toBe(false);
  });

  it('counts a page the save layer refuses as failed, and stops when saving stalls', async () => {
    const layer = recordingLayer((tabs, batch) =>
      batch === 0
        ? { failed: new Map([[tabs[1]!.id, 'A knowledgebase holds 500 pages at most.']]) }
        : { failed: new Map(), stalled: true },
    );
    const result = await writeImportPlan(
      planOf(Array.from({ length: 50 }, (_, i) => plannedPage(`p${i + 1}`))),
      { ...depsFor(), save: layer },
    );
    expect(layer.batches).toHaveLength(2);
    expect(result.failedPages).toEqual([
      { title: 'Page p2', reason: 'A knowledgebase holds 500 pages at most.' },
    ]);
    expect(result).toMatchObject({ imported: 39, stalled: true, cancelled: false });
  });

  it('a save layer that throws fails its batch and stops the import', async () => {
    const save = { writeBatch: vi.fn(async () => Promise.reject(new Error('gone'))) };
    const result = await writeImportPlan(planOf([plannedPage('p1')]), { ...depsFor(), save });
    expect(result).toMatchObject({ imported: 0, stalled: true });
    expect(result.failedPages).toEqual([{ title: 'Page p1', reason: 'It could not be saved.' }]);
  });

  it('converts and schedules 500 pages of 50 links each within its CPU budget', async () => {
    const pages = Array.from({ length: 500 }, (_, i) => {
      const links = Array.from(
        { length: 50 },
        (_x, k) => `[Link ${k}](knowledgebase-page:p${((i + k * 7) % 500) + 1})`,
      );
      return plannedPage(`p${i + 1}`, {
        parentKey: i === 0 ? null : `p${Math.max(1, Math.floor(i / 8))}`,
        markdown: `## Section\n\n${links.slice(0, 25).join(' and ')}.\n\n- ${links.slice(25).join('\n- ')}\n`,
      });
    });
    // Measured 2026-11-20: 152 ms CPU cold, 75 to 78 ms warm (2,000 pages: 320 ms).
    const layer = recordingLayer();
    const start = cpuNowMs();
    const result = await writeImportPlan(planOf(pages), { ...depsFor(), save: layer });
    const spent = cpuNowMs() - start;
    expect(result.imported).toBe(500);
    expect(layer.batches).toHaveLength(25);
    expect(Math.max(...layer.batches.map((b) => b.length))).toBe(IMPORT_BATCH_PAGES);
    const linked = layer.batches
      .flat()
      .reduce((sum, tab) => sum + runsOf(tab).filter(isPageLinkRun).length, 0);
    expect(linked).toBe(500 * 50);
    expect(spent).toBeLessThan(cpuBudgetMs(800));
  });
});
