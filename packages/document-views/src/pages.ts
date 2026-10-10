// The `pages` view (docs/specs/024-agents/illustrate-for-agents.md "Reading: the pages view"): an
// Illustrate tab's pages in row order, each with its rectangle and the refs of what is on it; each
// article with its writing as the Markdown write_article takes, so read, edit, write back
// round-trips; and the layouts each kind on the tab offers. A tab in another mode says how to
// switch it. Kept to the budget like every view: whole lines in order, then what was left out.
import {
  articleSummaries,
  pageSummaries,
  type PagesView,
  type ViewDoor,
} from '@livediagram/api-schema';
import {
  articlesOf,
  articleToMarkdown,
  elementIdsOnPage,
  illustratePagesOf,
  layOutIllustratePages,
  opensInOf,
  PAGE_SIZES,
  type PageKind,
} from '@livediagram/document';
import { layoutCatalogueFor } from '@livediagram/templates';
import { fitLines, fitOf, type ViewLine, type ViewResult } from './budget';
import { headerLine, viewHeader } from './header';
import type { ViewModel } from './model';
import { jsonString } from './text';

export type PagesOptions = { budget?: number; door?: ViewDoor };

const PAGE = { one: 'page line', many: 'page lines' };
const WRITING = { one: 'line of writing', many: 'lines of writing' };
const LAYOUTS = { one: 'layout line', many: 'layout lines' };

const KIND_ORDER: readonly PageKind[] = ['infographic', 'slide', 'logo', 'article'];

const sizeName = (size: keyof typeof PAGE_SIZES, orientation: 'portrait' | 'landscape' | null) => {
  const s = PAGE_SIZES[size];
  return orientation === 'landscape' ? s.landscape : s.portrait;
};

export function pagesView(model: ViewModel, options: PagesOptions = {}): ViewResult<PagesView> {
  const tab = model.tab;
  const header = viewHeader('pages', model.facts);
  const door = options.door ?? 'cli';
  if (opensInOf(tab) !== 'illustrate') {
    const how =
      door === 'mcp'
        ? 'change_pages adds pages and switches it; write_article starts an article.'
        : 'page set adds pages and switches it; article set starts an article.';
    const fitted = fitLines({
      header: headerLine(model.facts),
      lines: [{ text: `This tab is not in Illustrate mode: ${how}` }],
      door,
    });
    return {
      text: fitted.text,
      json: { header, illustrate: false, pages: [], articles: [], layouts: [], elision: null },
      fit: fitOf(fitted),
    };
  }
  const laid = layOutIllustratePages(illustratePagesOf(tab));
  const printed = new Set(model.printed.map((el) => el.id));
  const pages = pageSummaries(tab).map((p) => ({
    ...p,
    // Refs of what the views print (elements on hidden layers are counted in the header only).
    refs: [...elementIdsOnPage(tab.elements, laid, p.id)]
      .filter((id) => printed.has(id))
      .map((id) => model.refs.refOf(id)),
  }));
  const writing = articlesOf(tab);
  const articles = articleSummaries(tab).map((a) => ({
    ...a,
    markdown: articleToMarkdown(writing[a.flow]!),
  }));
  const kinds = KIND_ORDER.filter((k) => k !== 'article' && pages.some((p) => p.kind === k));
  const layouts = kinds.map((kind) => ({
    kind,
    layouts: layoutCatalogueFor(kind).layouts.map((l) => ({ id: l.id, label: l.label })),
  }));

  const lines: ViewLine[] = [];
  for (const p of pages) {
    const { x, y, width, height } = p.rect;
    const facts = [
      `${p.kind} ${sizeName(p.size, p.orientation)}`,
      `at ${x},${y} ${width}x${height}`,
      ...(p.background ? [`background ${p.background}`] : []),
      ...(p.locked ? ['locked'] : []),
      ...(p.flow ? [`article ${p.flow}`] : []),
      p.refs.length
        ? `${p.refs.length} element${p.refs.length === 1 ? '' : 's'}: ${p.refs.join(' ')}`
        : 'empty',
    ];
    lines.push({
      text: `page ${p.place}${p.name ? ` ${jsonString(p.name)}` : ''} ${p.id} · ${facts.join(' · ')}`,
      noun: PAGE,
    });
  }
  for (const a of articles) {
    const places =
      a.pages.length > 1
        ? `pages ${a.pages[0]}-${a.pages[a.pages.length - 1]}`
        : `page ${a.pages[0]}`;
    lines.push({ text: '' });
    lines.push({
      text: `article ${a.flow} ${jsonString(a.title)} · ${places} · ${a.blocks} blocks · ${a.words} words${a.look ? ` · look ${a.look}` : ''}`,
      noun: PAGE,
    });
    for (const line of a.markdown.replace(/\n$/, '').split('\n'))
      lines.push({ text: `  ${line}`, noun: WRITING });
  }
  if (layouts.length) lines.push({ text: '' });
  for (const l of layouts)
    lines.push({
      text: `layouts ${l.kind}: ${l.layouts.map((x) => x.id).join(', ')}`,
      noun: LAYOUTS,
    });
  const fitted = fitLines({
    header: headerLine(model.facts),
    lines,
    budget: options.budget,
    door,
  });
  return {
    text: fitted.text,
    json: { header, illustrate: true, pages, articles, layouts, elision: fitted.elision },
    fit: fitOf(fitted),
  };
}
