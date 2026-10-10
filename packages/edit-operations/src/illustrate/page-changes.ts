// An agent's page changes applied to a tab (docs/specs/024-agents/illustrate-for-agents.md
// "change_pages"), through the page panel's own edits (@livediagram/document illustrate-edits) so
// an agent's edit is a person's. In order, each against the tab as the ones before it left it; the
// first refusal stops them all and nothing is written.
import type { IllustrateRefusal, PageBackgroundInput, PageChange } from '@livediagram/api-schema';
import {
  elementIdsOnPage,
  illustratePagesOf,
  layOutIllustratePages,
  nextArticleFlowId,
  nextIllustratePageId,
  offersPageKindChoice,
  pageAdded,
  PAGE_GRADIENT_ANGLE,
  pageBackgroundSet,
  pageDuplicated,
  pageKindOf,
  pageLaidOut,
  pageLockSet,
  pageMovedTo,
  pageRemoved,
  pageRenamed,
  pageResized,
  pageSizesFor,
  pageTurned,
  pageUnits,
  withPageKindChosen,
  type IllustratePage,
  type PageBackground,
  type PageEdit,
  type PageEditRefusal,
  type PageKind,
  type Tab,
} from '@livediagram/document';
import { buildPageLayout, layoutCatalogueFor, type PageLayoutId } from '@livediagram/templates';
import { enterIllustrate, type IllustrateIds } from './enter';
import { pageLabel, pageSummaries, resolvePage, sizeLabel } from './summary';

export type PageChangesOutcome =
  { tab: Tab; lines: string[]; switched: boolean } | { refusal: IllustrateRefusal };

const CODE: Record<PageEditRefusal, IllustrateRefusal['code']> = {
  unknown_page: 'page_unknown',
  locked: 'page_locked',
  no_orientation: 'no_orientation',
  size_not_offered: 'size_not_offered',
  pattern_not_offered: 'pattern_not_offered',
  page_limit: 'page_limit',
  last_page: 'last_page',
};

class Stop extends Error {
  readonly refusal: IllustrateRefusal;
  constructor(refusal: IllustrateRefusal) {
    super(refusal.message);
    this.refusal = refusal;
  }
}

const listPages = (tab: Tab) => pageSummaries(tab).map(pageLabel).join(', ');

/** The background patch an input means. */
export function backgroundPatch(input: PageBackgroundInput): Partial<PageBackground> {
  const patch: Partial<PageBackground> = {};
  if (input.paper) patch.fill = undefined;
  if (input.color) patch.fill = { kind: 'solid', color: input.color };
  if (input.gradient)
    patch.fill = {
      kind: 'gradient',
      from: input.gradient[0],
      to: input.gradient[1],
      angle: input.angle ?? PAGE_GRADIENT_ANGLE,
    };
  if (input.pattern) patch.pattern = input.pattern === 'none' ? undefined : input.pattern;
  return patch;
}

const describePatch = (input: PageBackgroundInput) =>
  [
    input.paper ? 'paper' : null,
    input.color ?? null,
    input.gradient ? `gradient ${input.gradient[0]} → ${input.gradient[1]}` : null,
    input.pattern ? (input.pattern === 'none' ? 'no pattern' : `${input.pattern} pattern`) : null,
  ]
    .filter(Boolean)
    .join(', ');

function messageFor(why: PageEditRefusal, tab: Tab, page: IllustratePage | undefined): string {
  const kind = page ? pageKindOf(page) : 'infographic';
  switch (why) {
    case 'unknown_page':
      return `No such page. Pages: ${listPages(tab)}.`;
    case 'locked':
      return 'That page is locked (an article: one of its pages is). Unlock it first with set { locked: false }.';
    case 'no_orientation':
      return `A ${kind} page has no orientation: it is always ${kind === 'logo' ? 'square' : 'landscape'}.`;
    case 'size_not_offered':
      return `A ${kind} page takes the sizes ${pageSizesFor(kind).join(', ')}.`;
    case 'pattern_not_offered':
      return 'A logo page takes no pattern; give it a color or gradient.';
    case 'page_limit':
      return 'A tab holds at most 100 pages: delete one first.';
    case 'last_page':
      return "That is the tab's only page (or article): add another before deleting it.";
  }
}

export function applyPageChanges(
  tab: Tab,
  changes: readonly PageChange[],
  ids: IllustrateIds = {},
): PageChangesOutcome {
  const entered = enterIllustrate(tab);
  if ('refusal' in entered) return entered;
  let current = entered.tab;
  const lines: string[] = entered.switched ? ['Switched the tab to Illustrate.'] : [];
  const newPageId = ids.page ?? (() => nextIllustratePageId(illustratePagesOf(current)));
  const newFlowId = ids.flow ?? (() => nextArticleFlowId());
  try {
    changes.forEach((change, i) => {
      const stop = (code: IllustrateRefusal['code'], message: string): never => {
        throw new Stop({ code, message, change: i });
      };
      const take = (out: PageEdit<Tab>, page?: IllustratePage): Tab => {
        if ('refused' in out) stop(CODE[out.refused], messageFor(out.refused, current, page));
        return (out as { tab: Tab }).tab;
      };
      const pages = () => illustratePagesOf(current);
      const pageOf = (ref: PageChange & { page: unknown }) => {
        const page = resolvePage(pages(), ref.page as string | number);
        return (
          page ??
          stop('page_unknown', `No page "${String(ref.page)}". Pages: ${listPages(current)}.`)
        );
      };
      const placeOf = (id: string) => pages().findIndex((p) => p.id === id) + 1;
      const onPage = (id: string) =>
        elementIdsOnPage(current.elements, layOutIllustratePages(pages()), id).size;
      const unitAt = (to: number) => {
        const ps = pages();
        const target = ps[Math.min(to, ps.length) - 1]!;
        return pageUnits(ps).findIndex((u) => u.pageIds.includes(target.id));
      };
      const layOut = (page: IllustratePage, layout: string): string => {
        const kind = pageKindOf(page);
        const offered = kind === 'article' ? [] : layoutCatalogueFor(kind).layouts;
        const found = offered.find((l) => l.id === layout);
        if (!found)
          stop(
            'layout_unknown',
            kind === 'article'
              ? 'An article page takes no layout: write it with write_article.'
              : `A ${kind} page takes the layouts ${offered.map((l) => l.id).join(', ')}.`,
          );
        const laid = layOutIllustratePages(pages()).find((p) => p.id === page.id)!;
        const replaced = onPage(page.id);
        current = take(
          pageLaidOut(current, page.id, buildPageLayout(found!.id as PageLayoutId, laid)),
          page,
        );
        return `${found!.label}${replaced ? ` (replaced ${replaced} elements)` : ''}`;
      };
      // name, size, orientation and background in that order, as the panel would make them.
      const setFields = (page: IllustratePage, c: Extract<PageChange, { op: 'add' | 'set' }>) => {
        const said: string[] = [];
        if (c.name !== undefined) {
          current = take(pageRenamed(current, page.id, c.name), page);
          said.push(c.name.trim() ? `name "${c.name.trim()}"` : 'no name');
        }
        if (c.size !== undefined) {
          current = take(pageResized(current, page.id, c.size), page);
          said.push(`size ${c.size}`);
        }
        if (c.orientation !== undefined) {
          current = take(pageTurned(current, page.id, c.orientation), page);
          said.push(c.orientation);
        }
        if (c.background !== undefined) {
          current = take(pageBackgroundSet(current, page.id, backgroundPatch(c.background)), page);
          said.push(`background ${describePatch(c.background)}`);
        }
        return said;
      };
      switch (change.op) {
        case 'add': {
          if (change.kind === 'article')
            stop('article_by_write', 'Article pages are made by write_article, from Markdown.');
          const ps = pages();
          const first = ps[0]!;
          let page: IllustratePage;
          if (offersPageKindChoice(ps, first.id, onPage(first.id))) {
            // The fresh tab's empty, unchosen first page becomes the page asked for.
            current = withPageKindChosen(current, first.id, change.kind as PageKind, newFlowId())!;
            page = pages()[0]!;
          } else {
            const id = newPageId();
            current = take(pageAdded(current, change.kind as PageKind, id, newFlowId()));
            page = pages().find((p) => p.id === id)!;
          }
          const said = setFields(page, change);
          if (change.at !== undefined)
            current = take(pageMovedTo(current, page.id, unitAt(change.at)), page);
          const now = pages().find((p) => p.id === page.id)!;
          const laid = change.layout ? ` from layout ${layOut(now, change.layout)}` : '';
          lines.push(
            `Added page ${placeOf(page.id)} (${change.kind}, ${sizeLabel(now)})${laid}${said.length ? `: ${said.join(', ')}` : ''}.`,
          );
          return;
        }
        case 'set': {
          const page = pageOf(change);
          // Unlocking comes first, so an unlock and an edit in one change both land.
          if (change.locked === false) current = take(pageLockSet(current, page.id, false), page);
          const said = setFields(page, change);
          if (change.locked === true) current = take(pageLockSet(current, page.id, true), page);
          if (change.locked !== undefined) said.push(change.locked ? 'locked' : 'unlocked');
          lines.push(`Set page ${placeOf(page.id)}: ${said.join(', ')}.`);
          return;
        }
        case 'layout': {
          const page = pageOf(change);
          lines.push(`Laid out page ${placeOf(page.id)} as ${layOut(page, change.layout)}.`);
          return;
        }
        case 'move': {
          const page = pageOf(change);
          current = take(pageMovedTo(current, page.id, unitAt(change.to)), page);
          lines.push(`Moved page ${page.id} to ${placeOf(page.id)}.`);
          return;
        }
        case 'duplicate': {
          const page = pageOf(change);
          const before = new Set(pages().map((p) => p.id));
          current = take(pageDuplicated(current, page.id, newPageId(), newFlowId()), page);
          const made = pages().filter((p) => !before.has(p.id));
          lines.push(
            page.flow
              ? `Duplicated the article on page ${placeOf(page.id)} (${made.length} pages, from page ${placeOf(made[0]!.id)}).`
              : `Duplicated page ${placeOf(page.id)} as page ${placeOf(made[0]!.id)}.`,
          );
          return;
        }
        case 'delete': {
          const page = pageOf(change);
          const at = placeOf(page.id);
          const count = page.flow ? pages().filter((p) => p.flow === page.flow).length : 1;
          const els = page.flow
            ? pages()
                .filter((p) => p.flow === page.flow)
                .reduce((n, p) => n + onPage(p.id), 0)
            : onPage(page.id);
          current = take(pageRemoved(current, page.id), page);
          lines.push(
            page.flow
              ? `Deleted the article on page ${at} (${count} pages, writing and ${els} elements).`
              : `Deleted page ${at} and ${els} elements on it.`,
          );
          return;
        }
      }
    });
  } catch (err) {
    if (err instanceof Stop) return { refusal: err.refusal };
    throw err;
  }
  return { tab: current, lines, switched: entered.switched };
}
