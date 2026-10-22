// An agent's page changes applied to a tab (docs/specs/024-agents/pages-for-agents.md
// "change_pages"), through the page panel's own edits (@livedesign/document pages-edits) so
// an agent's edit is a person's. In order, each against the tab as the ones before it left it; the
// first refusal stops them all and nothing is written.
import type { PagesRefusal, PageBackgroundInput, PageChange } from '@livedesign/api-schema';
import {
  elementIdsOnPage,
  pagesOf,
  layOutPages,
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
  pageDeviceSet,
  pageDeviceClass,
  pageUnits,
  withPageKindChosen,
  type Page,
  type PageBackground,
  type PageEdit,
  type PageEditRefusal,
  type PageKind,
  type Tab,
  plural,
} from '@livedesign/document';
import { buildPageLayout, layoutCatalogueFor } from '@livedesign/templates';
import { enterPages, type PagesIds } from './enter';
import { pageLabel, pageSummaries, resolvePage, sizeLabel } from './summary';

export type PageChangesOutcome =
  { tab: Tab; lines: string[]; switched: boolean } | { refusal: PagesRefusal };

const CODE: Record<PageEditRefusal, PagesRefusal['code']> = {
  unknown_page: 'page_unknown',
  locked: 'page_locked',
  no_orientation: 'no_orientation',
  size_not_offered: 'size_not_offered',
  pattern_not_offered: 'pattern_not_offered',
  page_limit: 'page_limit',
  last_page: 'last_page',
  not_a_wireframe: 'not_a_wireframe',
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

// A page's kind in words: a page whose kind is not chosen yet is a blank page.
const kindWord = (kind: PageKind | null): string => kind ?? 'blank';

function messageFor(why: PageEditRefusal, tab: Tab, page: Pick<Page, 'kind'> | undefined): string {
  const kind = page ? pageKindOf(page) : null;
  // "A logo page", "A blank page" (one whose kind is not chosen yet).
  const aKind = `A ${kindWord(kind)}`;
  // Every reason in words; the page is found before an edit, so `unknown_page` is only a fallback.
  const words: Record<PageEditRefusal, string> = {
    unknown_page: `No such page. Pages: ${listPages(tab)}.`,
    locked: 'That page is locked. Unlock it first with set { locked: false }.',
    no_orientation: `${aKind} page has no orientation: it is always the shape its size is.`,
    size_not_offered: `${aKind} page takes the sizes ${pageSizesFor(kind).join(', ')}.`,
    pattern_not_offered: 'A logo page takes no pattern; give it a color or gradient.',
    page_limit: 'A tab holds at most 100 pages: delete one first.',
    last_page: "That is the tab's only page: add another before deleting it.",
    not_a_wireframe: `${aKind} page has no device: device, frameLook and systemBars are a wireframe page's.`,
  };
  return words[why];
}

export function applyPageChanges(
  tab: Tab,
  changes: readonly PageChange[],
  ids: PagesIds = {},
): PageChangesOutcome {
  const entered = enterPages(tab);
  if ('refusal' in entered) return entered;
  let current = entered.tab;
  const lines: string[] = entered.switched ? ['Switched the tab to Pages.'] : [];
  const newPageId = ids.page ?? (() => nextPageId(pagesOf(current)));
  // The pages an earlier delete in this change took, as they were, so a later delete
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
      const take = (out: PageEdit<Tab>, page?: Page): Tab => {
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
      const unitAt = (to: number) => {
        const ps = pages();
        const target = ps[Math.min(to, ps.length) - 1]!;
        return pageUnits(ps).findIndex((u) => u.pageIds.includes(target.id));
      };
      const layOut = (page: Page, layout: string): string => {
        const kind = pageKindOf(page);
        const offered = layoutCatalogueFor(kind, pageDeviceClass(page)).layouts;
        const found = offered.find((l) => l.id === layout);
        if (!found)
          stop(
            'layout_unknown',
            offered.length
              ? `A ${kindWord(kind)} page takes the layouts ${offered.map((l) => l.id).join(', ')}.`
              : 'A blank page takes no layouts: add a logo or wireframe page for one.',
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
        // A wireframe page's frame look and system bars (wireframe-pages.md); its device was chosen as
        // it was added (pageAdded) and is never changed.
        if (c.op === 'add' && c.device !== undefined) said.push(`device ${c.device}`);
        if (c.frameLook !== undefined || c.systemBars !== undefined) {
          current = take(
            pageDeviceSet(current, page.id, {
              ...(c.frameLook !== undefined ? { frameLook: c.frameLook } : {}),
              ...(c.systemBars !== undefined ? { systemBars: c.systemBars } : {}),
            }),
            page,
          );
          if (c.frameLook !== undefined) said.push(`frame ${c.frameLook}`);
          if (c.systemBars !== undefined)
            said.push(c.systemBars ? 'system bars' : 'no system bars');
        }
        return said;
      };
      switch (change.op) {
        case 'add': {
          // A device is a wireframe page's alone (docs/specs/007-editor/wireframe-pages.md).
          if (change.device !== undefined && change.kind !== 'wireframe')
            stop('not_a_wireframe', messageFor('not_a_wireframe', current, { kind: change.kind }));
          const ps = pages();
          const first = ps[0]!;
          let page: Page;
          if (offersPageKindChoice(ps, first.id, onPage(first.id))) {
            // The fresh tab's empty, unchosen first page becomes the page asked for.
            current = withPageKindChosen(current, first.id, change.kind, change.device)!;
            page = pages()[0]!;
            tookBlank.set(page.id, i + 1);
          } else if (
            ps.length === 1 &&
            !madeHere.has(first.id) &&
            first.kind === change.kind &&
            !first.name?.trim() &&
            onPage(first.id) === 0
          ) {
            // A blank of that kind (the Blank Logo's one empty artboard) becomes the page asked for, so a design made
            // from it does not open on an empty page.
            page = first;
            tookBlank.set(page.id, i + 1);
          } else {
            const id = newPageId();
            current = take(pageAdded(current, change.kind, id, change.device));
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
          current = take(pageDuplicated(current, page.id, newPageId()), page);
          const made = pages().filter((p) => !before.has(p.id));
          lines.push(`Duplicated page ${placeOf(page.id)} as page ${placeOf(made[0]!.id)}.`);
          return;
        }
        case 'apply_background_to_all': {
          const page = pageOf(change);
          const out = pageBackgroundSpread(current, page.id);
          // The page was found above, so the one refusal left is a page with no other of its kind.
          if ('refused' in out)
            stop(
              'no_other_pages',
              `Page ${placeOf(page.id)} is the only ${kindWord(pageKindOf(page))} page: there is no other to give its background.`,
            );
          const done = out as Extract<typeof out, { tab: Tab }>;
          current = done.tab;
          const kept = done.skipped ? `; ${done.skipped} locked kept their own` : '';
          lines.push(
            `Gave ${done.applied} other ${kindWord(pageKindOf(page))} page${done.applied === 1 ? '' : 's'} the background of page ${placeOf(page.id)}${kept}.`,
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
          const at = placeOf(page.id);
          const els = onPage(page.id);
          current = take(pageRemoved(current, page.id), page);
          removed.push(page);
          lines.push(`Deleted page ${at} and ${plural(els, 'element')} on it.`);
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
