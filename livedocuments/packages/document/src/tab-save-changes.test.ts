import { describe, expect, it } from 'vitest';
import type { ArticleBlock, ArticleFlow } from './article-flow';
import type { ArticleTableBlock } from './article-table';
import type { Page } from './page';
import type { Tab } from './index';
import {
  mergeSaveOverStored,
  pageStepsOf,
  parseTabSaveChanges,
  tabSaveChanges,
  wholeArticleChanges,
  withPeerPageSteps,
  type TabSaveChanges,
} from './tab-save-changes';

// What a save merges over the stored tab (docs/specs/012-collaboration/collab-race-hardening.md "A save is merged
// with the stored tab"): two Editors' saves from one baseline, landing one after the other, keep both people's work.

const slide = (id: string, name?: string): Page => ({
  id,
  orientation: 'landscape',
  kind: 'slide',
  ...(name ? { name } : {}),
});
const articlePage = (id: string, flow: string): Page => ({
  id,
  orientation: 'portrait',
  kind: 'article',
  flow,
});
const para = (id: string, text: string): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: [{ text }],
});
const table = (cells: [string, string]): ArticleTableBlock => ({
  id: 't',
  type: 'table',
  cols: [
    { id: 'c1', w: 0.5 },
    { id: 'c2', w: 0.5 },
  ],
  rows: [{ id: 'r1', cells: cells.map((text) => [{ text }]) }],
});
const tab = (pages: Page[] | undefined, articles?: Record<string, ArticleFlow>): Tab => ({
  id: 't1',
  name: 'Deck',
  elements: [],
  ...(pages ? { pages } : {}),
  ...(articles ? { articles } : {}),
});
const pageIds = (t: Tab) => (t.pages ?? []).map((p) => p.id);
const words = (t: Tab, flow = 'f1') =>
  (t.articles?.[flow]?.blocks ?? []).map((b) =>
    b.type === 'paragraph' ? b.runs.map((r) => r.text).join('') : b.id,
  );

// One save as the api sees it: the tab and its changes as they travel (through the header's JSON).
const save = (before: Tab, after: Tab, previous?: Tab) => ({
  tab: after,
  changes: parseTabSaveChanges(
    JSON.parse(JSON.stringify(tabSaveChanges(before, after, previous))) as Record<string, unknown>,
  )!,
});
const land = (stored: Tab, s: { tab: Tab; changes: TabSaveChanges }) =>
  mergeSaveOverStored(stored, s.tab, s.changes);

describe('two Editors adding a page at once (#669)', () => {
  const base = tab([slide('s1'), slide('s2')]);
  const gwen = tab([slide('s1'), slide('s2'), slide('sA')]);
  const hugo = tab([slide('s1'), slide('s2'), slide('sB')]);

  it('stores both pages whichever save lands last, in one order', () => {
    const gwenFirst = land(land(base, save(base, gwen)), save(base, hugo));
    const hugoFirst = land(land(base, save(base, hugo)), save(base, gwen));
    expect(pageIds(gwenFirst)).toEqual(['s1', 's2', 'sA', 'sB']);
    expect(pageIds(hugoFirst)).toEqual(pageIds(gwenFirst));
  });

  it('shows both pages live, on each screen in the order the store keeps', () => {
    const atGwen = withPeerPageSteps(gwen, pageStepsOf(base, hugo), hugo.pages)!;
    const atHugo = withPeerPageSteps(hugo, pageStepsOf(base, gwen), gwen.pages)!;
    expect(atGwen.map((p) => p.id)).toEqual(['s1', 's2', 'sA', 'sB']);
    expect(atHugo.map((p) => p.id)).toEqual(['s1', 's2', 'sA', 'sB']);
  });

  it('takes an older sender whole: no readable steps, or no list', () => {
    expect(withPeerPageSteps(gwen, undefined, hugo.pages)).toBeNull();
    expect(withPeerPageSteps(gwen, 'x', hugo.pages)).toBeNull();
    expect(withPeerPageSteps(gwen, [], undefined)).toBeNull();
  });

  it('keeps the stored copy of a page the save did not change, and a removal or a rename the save made', () => {
    const stored = tab([slide('s1', 'Renamed by Hugo'), slide('s2'), slide('s3')]);
    const before = tab([slide('s1'), slide('s2'), slide('s3')]);
    const after = tab([slide('s1'), slide('s2', 'Gwen')]);
    const out = land(stored, save(before, after));
    expect(out.pages).toEqual([slide('s1', 'Renamed by Hugo'), slide('s2', 'Gwen')]);
  });

  it('removes a page a save still in flight added, when this save deleted it again', () => {
    const before = tab([slide('s1')]);
    const previous = tab([slide('s1'), slide('sX')]);
    const stored = land(before, save(before, previous));
    expect(pageIds(land(stored, save(before, before, previous)))).toEqual(['s1']);
  });

  it('stores pages as sent when the stored tab has none and the save changed none', () => {
    const legacy = tab(undefined);
    expect(land(legacy, save(legacy, legacy)).pages).toBeUndefined();
    expect(mergeSaveOverStored(legacy, gwen, {}).pages).toBe(gwen.pages);
  });
});

describe('two Editors writing in one article at once (#670)', () => {
  const pages = [articlePage('p1', 'f1')];
  const base = tab(pages, { f1: { blocks: [para('b1', 'Intro'), para('b2', 'Body')] } });

  it("keeps both people's words in different paragraphs, whichever save lands last", () => {
    const gwen = tab(pages, {
      f1: { blocks: [para('b1', 'Intro AAA from Gwen'), para('b2', 'Body')] },
    });
    const hugo = tab(pages, {
      f1: { blocks: [para('b1', 'Intro'), para('b2', 'Body'), para('b3', 'New line A')] },
    });
    const out = land(land(base, save(base, gwen)), save(base, hugo));
    expect(words(out)).toEqual(['Intro AAA from Gwen', 'Body', 'New line A']);
    expect(words(land(land(base, save(base, hugo)), save(base, gwen)))).toEqual(words(out));
  });

  it("keeps both people's cells of one table, and a style the save changed", () => {
    const start = tab(pages, { f1: { blocks: [table(['', ''])] } });
    const gwen = tab(pages, { f1: { blocks: [table(['Gwen', ''])] } });
    const hugo = tab(pages, {
      f1: { blocks: [table(['', 'Hugo'])], style: { accent: '#ff0000' } },
    });
    const out = land(land(start, save(start, gwen)), save(start, hugo));
    const t = out.articles!.f1!.blocks[0] as ArticleTableBlock;
    expect(t.rows[0]!.cells.map((c) => c[0]!.text)).toEqual(['Gwen', 'Hugo']);
    expect(out.articles!.f1!.style).toEqual({ accent: '#ff0000' });
  });

  it('removes a block the save removed, and one a save in flight added that this one lacks', () => {
    const previous = tab(pages, {
      f1: { blocks: [para('b1', 'Intro'), para('b2', 'Body'), para('bX', 'gone soon')] },
    });
    const stored = land(base, save(base, previous));
    const after = tab(pages, { f1: { blocks: [para('b1', 'Intro')] } });
    expect(words(land(stored, save(base, after, previous)))).toEqual(['Intro']);
  });

  it('takes a new article whole, removes a deleted one, and keeps a peer article the save never saw', () => {
    const stored = tab([...pages, articlePage('p2', 'f2')], {
      ...base.articles,
      f2: { blocks: [para('c1', "Hugo's")] },
    });
    const after = tab([articlePage('p3', 'f3')], { f3: { blocks: [para('d1', 'Fresh')] } });
    const out = land(stored, save(base, after));
    expect(Object.keys(out.articles!).sort()).toEqual(['f2', 'f3']);
    expect(pageIds(out)).toEqual(['p2', 'p3']);
  });

  it('drops writing for an article a peer deleted, unless a page still shows it', () => {
    const edited = tab(pages, {
      f1: { blocks: [para('b1', 'Intro'), para('b2', 'Body edited')] },
    });
    const gone = tab([articlePage('p9', 'f9')]);
    expect(land(gone, save(base, edited)).articles).toBeUndefined();
    const stillShown = tab([articlePage('p1', 'f1')]);
    expect(words(land(stillShown, save(base, edited)))).toEqual(['Intro', 'Body edited']);
  });

  it('keeps the stored writing as it is when the save changed none, and an untouched article as stored', () => {
    const stored = tab(pages, { f1: { blocks: [para('b1', 'Newer')] }, f2: { blocks: [] } });
    const out = land(stored, save(base, base));
    expect(words(out)).toEqual(['Newer']);
    expect(out.articles!.f2).toBe(stored.articles!.f2);
  });

  it('takes an article whole when told to, and the stored one when the save lacks it', () => {
    const stored = tab(pages, { f1: { blocks: [para('b1', 'Stored')] } });
    const saved = tab(pages, { f1: { blocks: [para('b1', 'Saved')] } });
    expect(words(mergeSaveOverStored(stored, saved, { articles: { f1: 'whole' } }))).toEqual([
      'Saved',
    ]);
    expect(words(mergeSaveOverStored(stored, tab(pages), { articles: { f1: 'whole' } }))).toEqual([
      'Stored',
    ]);
  });

  it('drops a step whose block, table or cell the saved article lacks', () => {
    const stored = tab(pages, { f1: { blocks: [table(['a', 'b'])] } });
    const saved = tab(pages, { f1: { blocks: [table(['x', 'y'])] } });
    const out = mergeSaveOverStored(stored, saved, {
      articles: {
        f1: [
          { kind: 'put', id: 'nope' },
          { kind: 'put', id: 't', after: null, before: null },
          { kind: 'cell', block: 'nope', row: 'r1', col: 'c1' },
          { kind: 'cell', block: 't', row: 'r9', col: 'c1' },
          { kind: 'cell', block: 't', row: 'r1', col: 'c9' },
          { kind: 'style' },
        ],
      },
    });
    const t = out.articles!.f1!.blocks[0] as ArticleTableBlock;
    expect(t.rows[0]!.cells.map((c) => c[0]!.text)).toEqual(['x', 'y']);
    expect(out.articles!.f1!.style).toBeUndefined();
    // A style step for an article the save lacks changes nothing.
    const noFlow = mergeSaveOverStored(stored, tab(pages), {
      articles: { f1: [{ kind: 'style' }] },
    });
    expect(noFlow.articles!.f1!.blocks[0]!.id).toBe('t');
  });
});

describe('the changes a save sends', () => {
  it('names nothing when nothing changed, and a removed article as removed', () => {
    const base = tab([slide('s1')], { f1: { blocks: [para('b1', 'x')] } });
    expect(tabSaveChanges(base, base)).toEqual({ pages: [], articles: {} });
    const gone = tab([slide('s1')]);
    expect(tabSaveChanges(base, gone).articles).toEqual({ f1: 'removed' });
    // An article a save in flight made and this one lacks is removed too.
    const previous = tab([slide('s1')], { ...base.articles, f2: { blocks: [para('c', 'y')] } });
    expect(tabSaveChanges(base, base, previous).articles).toEqual({ f2: 'removed' });
  });

  it('takes every stepped article whole when asked for less detail', () => {
    const changes: TabSaveChanges = {
      pages: [],
      articles: { f1: [{ kind: 'style' }], f2: 'removed', f3: 'whole' },
    };
    expect(wholeArticleChanges(changes)).toEqual({
      pages: [],
      articles: { f1: 'whole', f2: 'removed', f3: 'whole' },
    });
    expect(wholeArticleChanges({}).articles).toEqual({});
  });

  it('reads a request defensively', () => {
    expect(parseTabSaveChanges(null)).toBeNull();
    expect(parseTabSaveChanges({})).toBeNull();
    expect(parseTabSaveChanges({ pages: 'x', articles: [] })).toBeNull();
    expect(
      parseTabSaveChanges({
        articles: {
          f1: [
            { kind: 'style' },
            { kind: 'remove', id: 'b1' },
            { kind: 'cell', block: 't', row: 'r', col: 'c' },
            { kind: 'cell', block: 't', row: 5, col: 'c' },
            { kind: 'put', id: 'b2', after: 'b1', before: null },
            { kind: 'put', id: 'b3', after: 7 },
            { kind: 'put', id: 'b4' },
            { kind: 'what', id: 'b5' },
            null,
          ],
          f2: 'whole',
          f3: 'removed',
        },
      }),
    ).toEqual({
      articles: {
        f1: [
          { kind: 'style' },
          { kind: 'remove', id: 'b1' },
          { kind: 'cell', block: 't', row: 'r', col: 'c' },
          { kind: 'put', id: 'b2', after: 'b1', before: null },
          { kind: 'put', id: 'b4' },
        ],
        f2: 'whole',
        f3: 'removed',
      },
    });
    // One malformed article, or too many, leaves the writing to be stored as sent.
    expect(parseTabSaveChanges({ articles: { f1: 'everything' } })).toBeNull();
    expect(parseTabSaveChanges({ articles: { ['x'.repeat(65)]: 'whole' } })).toBeNull();
    const many = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`f${i}`, 'whole']));
    expect(parseTabSaveChanges({ articles: many })).toBeNull();
  });
});

// collab-race-hardening.md "At the page cap": two Editors one slide short of the cap each add one (#717).
describe('two Editors at the page cap', () => {
  it('keeps 100 pages: the first add to land, and the rest of the later save', () => {
    const pages = Array.from({ length: 99 }, (_, i) => slide(`s${String(i).padStart(3, '0')}`));
    const base = tab(pages);
    const gwen = tab([...pages, slide('sA')]);
    const hugo = tab([slide('s000', 'Cover'), ...pages.slice(1), slide('sB')]);
    const stored = mergeSaveOverStored(
      mergeSaveOverStored(base, gwen, save(base, gwen).changes),
      hugo,
      save(base, hugo).changes,
    );
    expect(stored.pages).toHaveLength(100);
    expect(pageIds(stored)).toContain('sA');
    expect(pageIds(stored)).not.toContain('sB');
    expect(stored.pages![0]).toEqual(slide('s000', 'Cover'));
    expect(withPeerPageSteps(gwen, pageStepsOf(base, hugo), hugo.pages)).toHaveLength(100);
  });
});
