// An agent's page changes applied to a tab (docs/specs/024-agents/pages-for-agents.md
// "change_pages"), through the page panel's own edits (@livedocuments/document pages-edits) so
// an agent's edit is a person's. In order, each against the tab as the ones before it left it; the
// first refusal stops them all and nothing is written.
import type { PagesRefusal, PageBackgroundInput, PageChange } from '@livedocuments/api-schema';
import {
  articlesOf,
  elementIdsOnPage,
  flashcardWordCount,
  pagesOf,
  layOutPages,
  nextArticleFlowId,
  nextPageId,
  offersPageKindChoice,
  pageAdded,
  PAGE_GRADIENT_ANGLE,
  pageBackgroundSet,
  pageBackgroundSpread,
  pageDuplicated,
  pageKindOf,
  pageLaidOut,
  themedForTab,
  pageIsDark,
  pageLockSet,
  pageMovedTo,
  pageRemoved,
  pageRenamed,
  pageResized,
  pageSizesFor,
  pageTurned,
  pageUnits,
  tabPageKind,
  withPageKindChosen,
  type Page,
  type PageBackground,
  type PageEdit,
  type PageEditRefusal,
  type Tab,
  plural,
} from '@livedocuments/document';
import { buildPageLayout, layoutCatalogueFor } from '@livedocuments/templates';
import { enterPages, type PagesIds } from './enter';
import { pageLabel, pageSummaries, resolvePage, sizeLabel } from './summary';

export type PageChangesOutcome = { tab: Tab; lines: string[] } | { refusal: PagesRefusal };

const CODE: Record<PageEditRefusal, PagesRefusal['code']> = {
  unknown_page: 'page_unknown',
  locked: 'page_locked',
  no_orientation: 'no_orientation',
  size_not_offered: 'size_not_offered',
  page_limit: 'page_limit',
  last_page: 'last_page',
  kind_not_offered: 'kind_not_offered',
};

class Stop extends Error {
  readonly refusal: PagesRefusal;
  constructor(refusal: PagesRefusal) {
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

function messageFor(why: PageEditRefusal, tab: Tab, page: Pick<Page, 'kind'>): string {
  const kind = pageKindOf(page);
  // "An infographic page", "An article page", "A slide page".
  const aKind = `${/^[aeiou]/.test(kind) ? 'An' : 'A'} ${kind}`;
  // Every reason in words; the page is found before an edit, so `unknown_page` is only a fallback.
  const words: Record<PageEditRefusal, string> = {
    unknown_page: `No such page. Pages: ${listPages(tab)}.`,
    locked:
      'That page is locked (an article: one of its pages is). Unlock it first with set { locked: false }.',
    no_orientation: `${aKind} page has no orientation: it is always the shape its size is.`,
    size_not_offered: `${aKind} page takes the sizes ${pageSizesFor(kind).join(', ')}.`,
    page_limit: 'A tab holds at most 100 pages: delete one first.',
    last_page: "That is the tab's only page (or article): add another before deleting it.",
    kind_not_offered: kindNotOffered(tab, kind),
  };
  return words[why];
}

/** Why a page of `kind` cannot join the tab (docs/specs/007-editor/pages-mode.md "One kind a tab"). */
export function kindNotOffered(tab: Tab, kind: string): string {
  return `This tab holds ${tabPageKind(pagesOf(tab))} pages: every page of a tab is one kind. Put ${kind} pages in a tab of their own (add_tab).`;
}

export function applyPageChanges(
  tab: Tab,
  changes: readonly PageChange[],
  ids: PagesIds = {},
): PageChangesOutcome {
  const locked = enterPages(tab);
  if (locked) return locked;
  let current = tab;
  const lines: string[] = [];
  const newPageId = ids.page ?? (() => nextPageId(pagesOf(current)));
  const newFlowId = ids.flow ?? (() => nextArticleFlowId());
  // The pages a delete in this change took, an article's whole flow among them: a later delete naming one by id is
  // already done, never a missing page that undoes the change.
  // The pages an earlier delete in this change took (an article's pages go together), as they were, so a later delete
  // naming one by its id or its name is answered rather than refused.
  const removed: Page[] = [];
  try {
    // The pages this call has added, which a later add never takes as a blank.
    const madeHere = new Set<string>();
    // The pages an add took as its blank (the fresh tab's empty first page, a blank deck's one slide), each to that
    // change's number: a later delete naming one means the empty page, which is gone already.
    const tookBlank = new Map<string, number>();
    changes.forEach((change, i) => {
      const stop = (code: PagesRefusal['code'], message: string): never => {
        throw new Stop({ code, message, change: i });
      };
      const take = (out: PageEdit<Tab>, page: Pick<Page, 'kind'>): Tab => {
        if ('refused' in out) stop(CODE[out.refused], messageFor(out.refused, current, page));
        return (out as { tab: Tab }).tab;
      };
      const pages = () => pagesOf(current);
      const pageOf = (ref: PageChange & { page: unknown }) => {
        const page = resolvePage(pages(), ref.page as string | number);
        return (
          page ??
          stop('page_unknown', `No page "${String(ref.page)}". Pages: ${listPages(current)}.`)
        );
      };
      const placeOf = (id: string) => pages().findIndex((p) => p.id === id) + 1;
      const onPage = (id: string) =>
        elementIdsOnPage(current.elements, layOutPages(pages()), id).size;
      // Whether a card holds any words: a card with writing is never a blank.
      const written = (page: Page) => {
        const doc = page.flow ? articlesOf(current)[page.flow] : undefined;
        return doc !== undefined && flashcardWordCount(doc) > 0;
      };
      const unitAt = (to: number) => {
        const ps = pages();
        const target = ps[Math.min(to, ps.length) - 1]!;
        return pageUnits(ps).findIndex((u) => u.pageIds.includes(target.id));
      };
      const layOut = (page: Page, layout: string): string => {
        const kind = pageKindOf(page);
        const written = kind === 'article' || kind === 'flashcard';
        const offered = written ? [] : layoutCatalogueFor(kind).layouts;
        const found = offered.find((l) => l.id === layout);
        if (!found)
          stop(
            'layout_unknown',
            kind === 'article'
              ? 'An article page takes no layout: write it with write_article.'
              : kind === 'flashcard'
                ? 'A flashcard takes no layout: write it with write_article.'
                : `A ${kind} page takes the layouts ${offered.map((l) => l.id).join(', ')}.`,
          );
        const laid = layOutPages(pages()).find((p) => p.id === page.id)!;
        const replaced = onPage(page.id);
        current = take(
          pageLaidOut(
            current,
            page.id,
            themedForTab(buildPageLayout(found!.id, laid), current.theme, {
              dark: pageIsDark(laid),
            }),
          ),
          page,
        );
        return `${found!.label}${replaced ? ` (replaced ${plural(replaced, 'element')})` : ''}`;
      };
      // name, size, orientation and background in that order, as the panel would make them.
      const setFields = (page: Page, c: Extract<PageChange, { op: 'add' | 'set' }>) => {
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
          let page: Page;
          if (offersPageKindChoice(ps, first.id, onPage(first.id))) {
            // The fresh tab's empty, unchosen first page becomes the page asked for.
            current = withPageKindChosen(current, first.id, change.kind, newFlowId())!;
            page = pages()[0]!;
            tookBlank.set(page.id, i + 1);
          } else if (
            ps.length === 1 &&
            !madeHere.has(first.id) &&
            first.kind === change.kind &&
            !first.name?.trim() &&
            onPage(first.id) === 0 &&
            !written(first)
          ) {
            // A blank of that kind (the Blank Slide Deck's one empty slide, the Blank Flashcards' one empty card)
            // becomes the page asked for, so a deck made from it does not open on an empty slide.
            page = first;
            tookBlank.set(page.id, i + 1);
          } else {
            const id = newPageId();
            current = take(pageAdded(current, change.kind, id, newFlowId()), { kind: change.kind });
            page = pages().find((p) => p.id === id)!;
          }
          madeHere.add(page.id);
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
              ? `Duplicated the article on page ${placeOf(page.id)} (${plural(made.length, 'page')}, from page ${placeOf(made[0]!.id)}).`
              : `Duplicated page ${placeOf(page.id)} as page ${placeOf(made[0]!.id)}.`,
          );
          return;
        }
        case 'apply_background_to_all': {
          const page = pageOf(change);
          const out = pageBackgroundSpread(current, page.id);
          // The page was found above, so the one refusal left is a page with no other of its kind.
          if ('refused' in out)
            stop(
              'no_other_pages',
              `Page ${placeOf(page.id)} is the only ${pageKindOf(page)} page (or article): there is no other to give its background.`,
            );
          const done = out as Extract<typeof out, { tab: Tab }>;
          current = done.tab;
          const kept = done.skipped ? `; ${done.skipped} locked kept their own` : '';
          lines.push(
            `Gave ${done.applied} other ${pageKindOf(page)} page${done.applied === 1 ? '' : 's'} the background of page ${placeOf(page.id)}${kept}.`,
          );
          return;
        }
        case 'delete': {
          if (
            typeof change.page === 'string' &&
            !resolvePage(pages(), change.page) &&
            resolvePage(removed, change.page)
          ) {
            lines.push(`Page ${change.page} went with what an earlier delete in this change took.`);
            return;
          }
          const page = pageOf(change);
          const took = tookBlank.get(page.id);
          if (took !== undefined) {
            lines.push(
              `Page ${placeOf(page.id)} was the empty first page, which change ${took} made the page it added; nothing deleted.`,
            );
            return;
          }
          // An article's pages go together.
          const gone = page.flow ? pages().filter((p) => p.flow === page.flow) : [page];
          const at = placeOf(page.id);
          const count = gone.length;
          const els = gone.reduce((n, p) => n + onPage(p.id), 0);
          current = take(pageRemoved(current, page.id), page);
          removed.push(...gone);
          lines.push(
            page.flow
              ? `Deleted the article on page ${at} (${plural(count, 'page')}, writing and ${plural(els, 'element')}).`
              : `Deleted page ${at} and ${plural(els, 'element')} on it.`,
          );
          return;
        }
      }
    });
  } catch (err) {
    if (err instanceof Stop) return { refusal: err.refusal };
    throw err;
  }
  return { tab: current, lines };
}
