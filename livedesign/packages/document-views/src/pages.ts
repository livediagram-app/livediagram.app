// The `pages` view (docs/specs/024-agents/pages-for-agents.md "Reading: the pages view"): an
// Pages tab's pages in row order, each with its rectangle and the refs of what is on it, and the
// layouts each kind on the tab offers. A tab in another mode says how to
// switch it. Kept to the budget like every view: whole lines in order, then what was left out.
import { pageSummaries, type PagesView, type ViewDoor } from '@livedesign/api-schema';
import {
  elementIdsOnPage,
  pagesOf,
  layOutPages,
  opensInOf,
  PAGE_SIZES,
  type Element,
  type PageKind,
} from '@livedesign/document';
import { layoutCatalogueFor } from '@livedesign/templates';
import { fitLines, fitOf, type ViewLine, type ViewResult } from './budget';
import { headerLine, viewHeader } from './header';
import type { ViewModel } from './model';
import { isObject } from './fields';
import { outlineLine } from './outline';
import { shownFields } from './show';
import { jsonString } from './text';
import { depthFirst } from './tree';

type PagesOptions = { budget?: number; door?: ViewDoor };

const PAGE = { one: 'page line', many: 'page lines' };
const LAYOUTS = { one: 'layout line', many: 'layout lines' };
const ELEMENT = { one: 'element line', many: 'element lines' };

const KIND_ORDER: readonly PageKind[] = ['logo', 'wireframe'];

const sizeName = (size: keyof typeof PAGE_SIZES, orientation: 'portrait' | 'landscape' | null) => {
  const s = PAGE_SIZES[size];
  return orientation === 'landscape' ? s.landscape : s.portrait;
};

// The most characters one item list prints, and the items it shows (a layout's lists are short).
const ITEMS_LINE_MAX = 240;

// The text of one item of a list field: its words and numbers, in field order.
const itemText = (item: unknown): string =>
  isObject(item)
    ? Object.values(item)
        .filter(
          (v): v is string | number =>
            (typeof v === 'string' && v.trim() !== '') || typeof v === 'number',
        )
        .map(String)
        .join(' / ')
    : typeof item === 'string' || typeof item === 'number'
      ? String(item)
      : '';

/** What an element's lists hold (process steps, stats, timeline points, chart data), one line each under
 *  its outline line: the content a layout's sample is replaced in, which the outline only counts. */
export function itemLines(el: Element): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(shownFields(el).fields)) {
    if (!Array.isArray(value) || value.length === 0) continue;
    const items = value.map(itemText).filter(Boolean);
    if (items.length === 0) continue;
    const line = `    ${key}: ${items.join(' | ')}`;
    out.push(line.length > ITEMS_LINE_MAX ? `${line.slice(0, ITEMS_LINE_MAX - 1)}…` : line);
  }
  return out;
}

export function pagesView(model: ViewModel, options: PagesOptions = {}): ViewResult<PagesView> {
  const tab = model.tab;
  const header = viewHeader('pages', model.facts);
  const door = options.door ?? 'cli';
  if (opensInOf(tab) !== 'pages') {
    const how =
      door === 'mcp'
        ? 'change_pages adds pages and switches it.'
        : 'page set adds pages and switches it.';
    const fitted = fitLines({
      header: headerLine(model.facts),
      lines: [{ text: `This tab is not in Pages mode: ${how}` }],
      door,
    });
    return {
      text: fitted.text,
      json: { header, pagesMode: false, pages: [], layouts: [], elision: null },
      fit: fitOf(fitted),
    };
  }
  const laid = layOutPages(pagesOf(tab));
  const printed = new Set(model.printed.map((el) => el.id));
  const pages = pageSummaries(tab).map((p) => ({
    ...p,
    // Refs of what the views print (elements on hidden layers are counted in the header only).
    refs: [...elementIdsOnPage(tab.elements, laid, p.id)]
      .filter((id) => printed.has(id))
      .map((id) => model.refs.refOf(id)),
  }));
  const kinds = KIND_ORDER.filter((k) => pages.some((p) => p.kind === k));
  const layouts = kinds.map((kind) => ({
    kind,
    layouts: layoutCatalogueFor(kind).layouts.map((l) => ({ id: l.id, label: l.label })),
  }));

  // Every element in reading order, so a page's elements print as the outline does.
  const reading = depthFirst(model.tree.roots);
  const lines: ViewLine[] = [];
  for (const p of pages) {
    const { x, y, width, height } = p.rect;
    const on = new Set(p.refs);
    const nodes = reading.filter((node) => on.has(model.refs.refOf(node.el.id)));
    const facts = [
      `${p.kind ?? 'blank'} ${sizeName(p.size, p.orientation)}`,
      `at ${x},${y} ${width}x${height}`,
      ...(p.background ? [`background ${p.background}`] : []),
      ...(p.locked ? ['locked'] : []),
      p.refs.length ? `${p.refs.length} element${p.refs.length === 1 ? '' : 's'}` : 'empty',
    ];
    lines.push({
      text: `page ${p.place}${p.name ? ` ${jsonString(p.name)}` : ''} ${p.id} · ${facts.join(' · ')}`,
      noun: PAGE,
    });
    // What is on it, one outline line each: the refs and text a layout's sample is replaced by.
    for (const node of nodes) {
      lines.push({ text: outlineLine(model, node, 1), noun: ELEMENT });
      for (const text of itemLines(node.el)) lines.push({ text, noun: ELEMENT });
    }
  }
  // A Pages tab always has a page (pagesOf), so the note always applies.
  lines.push({
    text: "Rectangles and elements' x, y are canvas coordinates (the layout view prints positions from the content's corner).",
  });
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
    json: { header, pagesMode: true, pages, layouts, elision: fitted.elision },
    fit: fitOf(fitted),
  };
}
