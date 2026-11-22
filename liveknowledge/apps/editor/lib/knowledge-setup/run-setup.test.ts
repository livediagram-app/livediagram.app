// Describe to Set Up's third step over the real write path (docs/specs/030-knowledgebase/describe-to-set-up.md "The
// flow"): batches of twenty in tree order, the untouched first page taken over, what a model sent placed as text.
import { describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { KNOWLEDGEBASE_FLOW, pageTreeRows, type Tab } from '@liveknowledge/document';
import type { KnowledgeSetupPage } from '@liveknowledge/api-schema';
import { landingDepth, runSetup, type SetupHost } from './run-setup';
import { reviewPages, withTick, withTitle } from './setup-tree';

vi.mock('@/lib/article/article-grow-store', () => ({ markArticleSettle: vi.fn() }));

const start = (): Tab =>
  ({
    id: 'start',
    name: 'Start Here',
    elements: [],
    articles: {
      [KNOWLEDGEBASE_FLOW]: {
        blocks: [{ id: 't', type: 'paragraph', style: 'title', runs: [{ text: 'Start Here' }] }],
      },
    },
  }) as unknown as Tab;

function host(initial: Tab[]) {
  let tabs = initial;
  const commits: number[] = [];
  const value: SetupHost = {
    documentId: 'd1',
    getTabs: () => tabs,
    getActiveTab: () => tabs[0],
    commitTabs: (map) => {
      tabs = map(tabs);
      commits.push(tabs.length);
    },
    markTabLoaded: () => {},
  };
  return { value, commits, tabs: () => tabs };
}

const page = (
  at: number,
  parent: string | null = null,
  depth = 1,
  over: Partial<KnowledgeSetupPage> = {},
): KnowledgeSetupPage => ({
  id: `p${at}`,
  title: `Page ${at}`,
  summary: `What page ${at} is for.`,
  headings: ['Overview', 'Details'],
  parent,
  depth,
  ...over,
});

let made = 0;
const run = (
  pages: KnowledgeSetupPage[] | ReturnType<typeof reviewPages>,
  to: ReturnType<typeof host>,
  more: { parent?: string; replaceId?: string; cancelled?: () => boolean } = {},
) => {
  const progress: [number, number][] = [];
  return runSetup({
    pages:
      'ticked' in (pages[0] ?? {}) ? (pages as ReturnType<typeof reviewPages>) : reviewPages(pages),
    host: to.value,
    cancelled: more.cancelled ?? (() => false),
    onProgress: (p) => progress.push([p.done, p.total]),
    whenSaved: async () => true,
    newId: () => `new-${++made}`,
    ...(more.parent ? { parent: more.parent } : {}),
    ...(more.replaceId ? { replaceId: more.replaceId } : {}),
  }).then((result) => ({ result, progress }));
};
const blocksOf = (tab: Tab) =>
  tab.articles![KNOWLEDGEBASE_FLOW]!.blocks as {
    type: string;
    style?: string;
    runs: { text: string; i?: boolean; href?: string }[];
  }[];

describe('creating the pages', () => {
  it('makes 30 pages in tree order in two batches, each one edit', async () => {
    const tree = [
      page(1),
      ...Array.from({ length: 14 }, (_x, at) => page(at + 2, 'p1', 2)),
      page(16),
      ...Array.from({ length: 14 }, (_x, at) => page(at + 17, 'p16', 2)),
    ];
    const to = host([start()]);
    const { result, progress } = await run(tree, to, { replaceId: 'start' });
    expect(result).toMatchObject({ total: 30, imported: 30, cancelled: false, stalled: false });
    expect(to.commits).toHaveLength(2);
    expect(progress).toEqual([
      [0, 30],
      [20, 30],
      [30, 30],
    ]);
    // The untouched Start Here page became the structure's first page: 30 pages, not 31.
    const rows = pageTreeRows(to.tabs());
    expect(rows).toHaveLength(30);
    expect(rows.map((r) => r.page.name)).toEqual(tree.map((p) => p.title));
    expect(rows[0]!.page.id).toBe('start');
    expect(result.first).toEqual({ id: 'start', title: 'Page 1' });
    expect(rows.filter((r) => r.depth === 1).map((r) => r.page.name)).toEqual([
      'Page 1',
      'Page 16',
    ]);
    expect(to.tabs().find((t) => t.name === 'Page 20')!.parent).toBe(
      to.tabs().find((t) => t.name === 'Page 16')!.id,
    );
  });

  it('gives each page its title, its line in italics and its headings with room to write', async () => {
    const to = host([start()]);
    await run([page(1)], to, { replaceId: 'start' });
    const blocks = blocksOf(to.tabs()[0]!);
    expect(blocks.map((b) => [b.style ?? 'body', b.runs.map((r) => r.text).join('')])).toEqual([
      ['title', 'Page 1'],
      ['body', 'What page 1 is for.'],
      ['h1', 'Overview'],
      ['body', ''],
      ['h1', 'Details'],
      ['body', ''],
    ]);
    expect(blocks[1]!.runs.every((r) => r.i === true)).toBe(true);
    expect(to.tabs()[0]!.name).toBe('Page 1');
  });

  it('follows the ticks and the renames, and leaves existing pages alone when there is writing', async () => {
    const written = { ...start(), id: 'home', name: 'Home' };
    const to = host([written]);
    const reviewed = withTitle(
      withTick(reviewPages([page(1), page(2, 'p1', 2), page(3)]), 'p2', false),
      'p3',
      'Renamed',
    );
    const { result } = await run(reviewed, to);
    expect(result.imported).toBe(2);
    expect(to.tabs().map((t) => t.name)).toEqual(['Home', 'Page 1', 'Renamed']);
    expect(to.tabs()[0]).toBe(written);
    expect(result.first!.title).toBe('Page 1');
  });

  it('adds under the open page, from Describe to Add Pages', async () => {
    const to = host([
      { ...start(), id: 'home' },
      { ...start(), id: 'sub', parent: 'home' },
    ]);
    await run([page(1), page(2, 'p1', 2)], to, { parent: 'sub' });
    const rows = pageTreeRows(to.tabs());
    expect(rows.map((r) => [r.page.name, r.depth])).toEqual([
      ['Start Here', 1],
      ['Start Here', 2],
      ['Page 1', 3],
      ['Page 2', 4],
    ]);
    expect(landingDepth(to.tabs(), 'sub')).toBe(2);
    expect(landingDepth(to.tabs(), undefined)).toBe(0);
    expect(landingDepth(to.tabs(), 'gone')).toBe(0);
  });

  it('places markup a model sent as the characters it was, never as a link, a picture or a tag', async () => {
    const to = host([start()]);
    await run(
      [
        page(1, null, 1, {
          title: '<img src=x onerror=alert(1)>',
          summary:
            '[click](javascript:alert(1)) ![x](https://evil.test/p.png) <script>alert(1)</script>',
          headings: ['<b>Bold</b>', '# Not Two Headings\n- nor a list'],
        }),
      ],
      to,
      { replaceId: 'start' },
    );
    const tab = to.tabs()[0]!;
    expect(tab.name).toBe('<img src=x onerror=alert(1)>');
    expect(tab.elements).toEqual([]);
    const blocks = blocksOf(tab);
    expect(blocks.every((b) => b.type === 'paragraph')).toBe(true);
    expect(blocks.flatMap((b) => b.runs).every((r) => r.href === undefined)).toBe(true);
    const text = blocks.map((b) => b.runs.map((r) => r.text).join(''));
    expect(text).toEqual([
      '<img src=x onerror=alert(1)>',
      '[click](javascript:alert(1)) ![x](https://evil.test/p.png) <script>alert(1)</script>',
      '<b>Bold</b>',
      '',
      '# Not Two Headings - nor a list',
      '',
    ]);
  });

  it('stops between batches when cancelled, keeping what was made', async () => {
    const to = host([start()]);
    let batches = 0;
    const tree = Array.from({ length: 30 }, (_x, at) => page(at + 1));
    const { result } = await run(tree, to, {
      replaceId: 'start',
      cancelled: () => batches++ > 0,
    });
    expect(result).toMatchObject({ imported: 20, cancelled: true });
    expect(to.tabs()).toHaveLength(20);
  });

  it('makes 30 pages well inside a frame budget of work', async () => {
    const tree = Array.from({ length: 30 }, (_x, at) => page(at + 1));
    const spent = await cpuMsOfAsync(() => run(tree, host([start()]), { replaceId: 'start' }));
    expect(spent).toBeLessThan(cpuBudgetMs(400));
  });
});
