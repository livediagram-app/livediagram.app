// Page links in an article's writing (docs/specs/030-knowledgebase/links-and-embeds.md "Page links"): a run that
// carries another page's tab id (`ArticleRun.page`), and what Markdown does with one. Written out, a page link is
// `[[Title]]` (article-markdown-io.ts), the form an agent hands back; read in, `[[Title]]` resolves to the page of
// that title, first match in tree order, and a title no page has stays plain text. A Markdown export to files
// writes `[Title](relative/path.md)` instead. Pure: the caller hands in the knowledgebase's pages.
import {
  pageOfRun,
  type ArticleBlock,
  type ArticleFlow,
  type ArticlePageLinkRun,
  type ArticleRun,
} from './article-flow';
import { pageParents, pageTreeRows, type TreePage } from './page-tree';

/** The run field that holds a page link's target. `@liveknowledge/knowledge` reads the same key (PAGE_LINK_KEY). */
export const ARTICLE_PAGE_LINK_KEY = 'page';
/** What a link to a page that no longer exists reads as. */
export const DELETED_PAGE_LABEL = 'Deleted Page';
/** A title between `[[` and `]]` is read up to here: as long as a tab's name may be. */
export const MAX_PAGE_LINK_TITLE = 200;

/** A page as the links need it: its id, its title and its place in the tree. */
export type LinkablePage = TreePage & { name: string };

/** A page link as Markdown. Brackets and line breaks in a title would end the link early, so they read as spaces. */
export const pageLinkMarkdown = (title: string): string =>
  `[[${title.replace(/[[\]\n]/g, ' ').trim()}]]`;

// Every run of the writing through `change`, which answers the run or runs that take its place. Blocks and rows the
// change leaves alone keep their identity, so a reader that memoises on them does not redo its work.
function mapRuns(
  blocks: readonly ArticleBlock[],
  change: (run: ArticleRun) => ArticleRun | readonly ArticleRun[],
): ArticleBlock[] {
  const runsOf = (runs: readonly ArticleRun[]): ArticleRun[] | null => {
    let next: ArticleRun[] | null = null;
    runs.forEach((run, i) => {
      const out = change(run);
      if (out === run) {
        next?.push(run);
        return;
      }
      next ??= runs.slice(0, i);
      if (Array.isArray(out)) next.push(...(out as readonly ArticleRun[]));
      else next.push(out as ArticleRun);
    });
    return next;
  };
  return blocks.map((block) => {
    if (block.type === 'paragraph' || block.type === 'list') {
      const runs = runsOf(block.runs);
      return runs ? { ...block, runs } : block;
    }
    if (block.type !== 'table') return block;
    let changed = false;
    const rows = block.rows.map((row) => {
      let rowChanged = false;
      const cells = row.cells.map((cell) => {
        const runs = runsOf(cell);
        if (runs) rowChanged = true;
        return runs ?? cell;
      });
      if (rowChanged) changed = true;
      return rowChanged ? { ...row, cells } : row;
    });
    return changed ? { ...block, rows } : block;
  });
}

/** The writing with every page link showing its page's current title; a link to a page that is gone reads
 *  "Deleted Page". `titleOf` answers undefined for a page the knowledgebase no longer holds. */
export function withPageLinkTitles<F extends Pick<ArticleFlow, 'blocks'>>(
  flow: F,
  titleOf: (tab: string) => string | undefined,
): F {
  const blocks = mapRuns(flow.blocks, (run) => {
    const page = pageOfRun(run);
    if (!page) return run;
    const title = titleOf(page) ?? DELETED_PAGE_LABEL;
    return title === run.text ? run : { ...run, text: title };
  });
  return { ...flow, blocks };
}

/** The writing for a Markdown export to files: each page link becomes a link to that page's file
 *  (`[Title](relative/path.md)`), and a link to a page with no file becomes its plain text. */
export function withPageLinksAsFiles<F extends Pick<ArticleFlow, 'blocks'>>(
  flow: F,
  hrefOf: (tab: string) => string | undefined,
): F {
  const blocks = mapRuns(flow.blocks, (run) => {
    if (!pageOfRun(run)) return run;
    const { page, ...rest } = run as ArticlePageLinkRun;
    const href = hrefOf(page);
    return href ? { ...rest, href } : rest;
  });
  return { ...flow, blocks };
}

// `[[Title]]`: no bracket or line break inside, at most MAX_PAGE_LINK_TITLE characters. One alternative, bounded, so
// it cannot backtrack over a long line of brackets.
const PAGE_LINK = new RegExp(`\\[\\[([^\\[\\]\\n]{1,${MAX_PAGE_LINK_TITLE}})\\]\\]`, 'g');

/** Blocks read from Markdown with each `[[Title]]` made a link to the page `pageByTitle` names. A title no page
 *  has stays as it was written; code, footnotes and text that is already a link are left alone. */
export function withPageLinksResolved(
  blocks: readonly ArticleBlock[],
  pageByTitle: (title: string) => string | undefined,
): ArticleBlock[] {
  return mapRuns(blocks, (run) => {
    if (run.code || run.fn !== undefined || run.href || pageOfRun(run) || !run.text.includes('[['))
      return run;
    const out: ArticleRun[] = [];
    let from = 0;
    let found = false;
    for (const match of run.text.matchAll(PAGE_LINK)) {
      const title = match[1]!.trim();
      const page = title ? pageByTitle(title) : undefined;
      if (!page) continue;
      found = true;
      if (match.index > from) out.push({ ...run, text: run.text.slice(from, match.index) });
      out.push({ ...run, text: title, page } as ArticlePageLinkRun);
      from = match.index + match[0].length;
    }
    if (!found) return run;
    if (from < run.text.length) out.push({ ...run, text: run.text.slice(from) });
    return out;
  });
}

const titleKey = (title: string) => title.trim().toLowerCase();

/** The lookup `withPageLinksResolved` takes: a title's page, the first match in tree order, letter case ignored. */
export function pageByTitleIn(
  pages: readonly LinkablePage[],
): (title: string) => string | undefined {
  const byTitle = new Map<string, string>();
  for (const { page } of pageTreeRows(pages)) {
    const key = titleKey(page.name);
    if (key && !byTitle.has(key)) byTitle.set(key, page.id);
  }
  return (title) => byTitle.get(titleKey(title));
}

/** The lookup `withPageLinkTitles` takes: a page's current title. */
export function pageTitleIn(pages: readonly LinkablePage[]): (tab: string) => string | undefined {
  const titles = new Map(pages.map((p) => [p.id, p.name]));
  return (tab) => titles.get(tab);
}

// A title as a file or folder name: lower case, words joined by hyphens, never empty.
const slug = (title: string): string =>
  title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'page';

/** Each page's file in a Markdown export of the knowledgebase, from its root: a page's subpages sit in a folder of
 *  its name (`runbooks.md`, `runbooks/deploys.md`). Two siblings of one title take `-2`, `-3` in tree order. */
export function pageFilePaths(pages: readonly LinkablePage[]): Map<string, string> {
  const stems = new Map<string, string>();
  const taken = new Set<string>();
  // Read once: tree order puts a parent before its subpages, so its stem is there when they ask.
  const parents = pageParents(pages);
  for (const { page } of pageTreeRows(pages)) {
    const parent = parents.get(page.id);
    const folder = parent === undefined ? '' : `${stems.get(parent) ?? 'page'}/`;
    const base = folder + slug(page.name);
    let stem = base;
    for (let n = 2; taken.has(stem); n++) stem = `${base}-${n}`;
    taken.add(stem);
    stems.set(page.id, stem);
  }
  return new Map([...stems].map(([id, stem]) => [id, `${stem}.md`]));
}

/** The path from one exported file to another, as a Markdown link writes it (`../guides/setup.md`). */
export function relativePagePath(from: string, to: string): string {
  const fromDir = from.split('/').slice(0, -1);
  const toParts = to.split('/');
  let shared = 0;
  while (
    shared < fromDir.length &&
    shared < toParts.length - 1 &&
    fromDir[shared] === toParts[shared]
  )
    shared++;
  return [...fromDir.slice(shared).map(() => '..'), ...toParts.slice(shared)].join('/');
}
