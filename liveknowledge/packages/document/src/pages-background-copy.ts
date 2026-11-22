// A page's background given to other pages (docs/specs/007-editor/pages-mode.md "Copying a
// background"): Apply to All (every other page of its kind) and the page format painter (one page
// at a time). A page's format is its background alone, its fill and its pattern; size, content and
// lock stay each page's own. Pure, shared by the page panel, the canvas Format tool and the agents'
// page changes, so each copies the same way.
import type { Tab } from './index';
import { pagesOf, pageKindOf, type Page, type PageBackground } from './page';
import {
  pageBackgroundSet,
  pageBackgroundStored,
  pageLockRefuses,
  pagesSharing,
  type PageEdit,
} from './pages-edits';
import { pagesInkFor, type InkMemory, type PageInk } from './page-ink';
import { pageUnits } from './article-pages';
import { newPageBackgroundOf, withNewPageBackground } from './tab-new-page-background';
import { isThemeOwnFill } from './page-theme-fills';
import { sameFill } from './page-paint';

type PagesTab = Pick<Tab, 'elements'> & {
  pages?: unknown;
  pageOrientation?: unknown;
  articles?: unknown;
  newPageBackground?: unknown;
};

type BackgroundCopyRefusal = 'unknown_page' | 'locked';

/** The patch that gives a page this whole background, the paper included (an absent fill or
 *  pattern clears the target's). */
function backgroundPatchFor(background: PageBackground | undefined): Partial<PageBackground> {
  return { fill: background?.fill, pattern: background?.pattern };
}

/** One page's background onto another (the page format painter): one edit, the target re-inked.
 *  The source's own page, or a page of its article, is no edit. */
export function pageBackgroundCopied<T extends PagesTab>(
  tab: T,
  fromPageId: string,
  toPageId: string,
  memory?: InkMemory,
): (PageEdit<T> & { memory?: InkMemory }) | { refused: BackgroundCopyRefusal } {
  const pages = pagesOf(tab);
  const from = pages.find((p) => p.id === fromPageId);
  const to = pages.find((p) => p.id === toPageId);
  if (!from || !to) return { refused: 'unknown_page' };
  if (pagesSharing(pages, fromPageId).has(toPageId)) return { tab };
  if (pageLockRefuses(pages, toPageId)) return { refused: 'locked' };
  return pageBackgroundSet(tab, toPageId, backgroundPatchFor(from.background), memory);
}

type BackgroundSpread<T> =
  | {
      tab: T;
      memory?: InkMemory;
      // The pages that now wear the background (not counting the source's own), and the locked
      // ones left as they were.
      applied: number;
      skipped: number;
    }
  | { refused: 'unknown_page' | 'no_other_pages' };

/** A page's background onto every other page of its kind (Apply to All Slides, and so on): one
 *  edit, each page re-inked for it. A locked page keeps its own and is counted as skipped; a page
 *  already wearing it counts as applied. */
export function pageBackgroundSpread<T extends PagesTab>(
  tab: T,
  pageId: string,
  memory?: InkMemory,
): BackgroundSpread<T> {
  const pages = pagesOf(tab);
  const source = pages.find((p) => p.id === pageId);
  if (!source) return { refused: 'unknown_page' };
  const kind = pageKindOf(source);
  const own = pagesSharing(pages, pageId);
  const targets = pages.filter((p) => pageKindOf(p) === kind && !own.has(p.id));
  if (targets.length === 0) return { refused: 'no_other_pages' };
  // Every page's background written first, then all of them re-inked in one walk (pagesInkFor):
  // inking page by page re-reads the whole tab for each, O(pages x elements) at the page cap.
  let out = tab;
  const inks: PageInk[] = [];
  let applied = 0;
  let skipped = 0;
  for (const target of targets) {
    const edit = pageBackgroundStored(out, target.id, backgroundPatchFor(source.background));
    if ('refused' in edit) {
      skipped += 1;
      continue;
    }
    out = edit.tab;
    inks.push(...edit.inks);
    applied += 1;
  }
  const inked = pagesInkFor(out, inks, memory);
  const recall = inks.length > 0 ? inked.memory : memory;
  return { tab: inked.tab, ...(recall ? { memory: recall } : {}), applied, skipped };
}

export type NewPageBackgroundSpread<T> = {
  tab: T;
  memory?: InkMemory;
  // The pages that now wear it (an article counts each of its pages), and the locked ones left as they were.
  applied: number;
  skipped: number;
};

/** Apply to Every Page: every page of the tab given its new-page background (or put back on the paper when it has
 *  none), as one edit, each re-inked for its new fill in one walk; `reaches` narrows the pages (a look's restyle
 *  reaches only the pages still on the old default). An article is one unit (its pages share one background) and
 *  keeps its own pattern (its ruled lines are its Style's); a locked page keeps its own and counts as skipped. */
export function pagesGivenNewPageBackground<T extends PagesTab>(
  tab: T,
  memory?: InkMemory,
  reaches: (page: Page) => boolean = () => true,
): NewPageBackgroundSpread<T> {
  const background = newPageBackgroundOf(tab);
  const patch: Partial<PageBackground> = { fill: background?.fill, pattern: background?.pattern };
  const pages = pagesOf(tab);
  let out = tab;
  const inks: PageInk[] = [];
  let applied = 0;
  let skipped = 0;
  for (const unit of pageUnits(pages)) {
    const first = pages.find((p) => p.id === unit.pageIds[0])!;
    if (!reaches(first)) continue;
    const article = pageKindOf(first) === 'article';
    const edit = pageBackgroundStored(out, first.id, article ? { fill: patch.fill } : patch);
    if ('refused' in edit) {
      skipped += unit.pageIds.length;
      continue;
    }
    out = edit.tab;
    inks.push(...edit.inks);
    applied += unit.pageIds.length;
  }
  const inked = pagesInkFor(out, inks, memory);
  const recall = inks.length > 0 ? inked.memory : memory;
  return { tab: inked.tab, ...(recall ? { memory: recall } : {}), applied, skipped };
}

/** A look's page background landing (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): the tab's new-page
 *  background set to it, and every page still on what new pages started on before (the old new-page background, or,
 *  with none, the paper or a fill of the theme's own) given it too; a page someone painted keeps its paint. One edit,
 *  re-inked. `theme` is the tab's theme after the look's. */
export function withLookPageBackground<T extends PagesTab>(
  tab: T,
  background: PageBackground,
  theme: Parameters<typeof isThemeOwnFill>[1],
  memory?: InkMemory,
): { tab: T; memory?: InkMemory } {
  const before = newPageBackgroundOf(tab);
  const next = withNewPageBackground(tab, null);
  const set = withNewPageBackground(next, { fill: background.fill, pattern: background.pattern });
  const onOldDefault = (page: Page) => {
    const fill = page.background?.fill;
    if (before) return sameFill(fill, before.fill);
    return !fill || isThemeOwnFill(fill, theme);
  };
  const out = pagesGivenNewPageBackground(set, memory, onOldDefault);
  return { tab: out.tab, ...(out.memory ? { memory: out.memory } : {}) };
}
