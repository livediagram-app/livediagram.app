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
  type PageEdit,
} from './pages-edits';
import { pageUnits, pagesSharing } from './page-units';
import { newPageBackgroundOf } from './tab-new-page-background';
import { pagesInkFor, type InkMemory, type PageInk } from './page-ink';

type PagesTab = Pick<Tab, 'elements'> & {
  pages?: unknown;
  pageOrientation?: unknown;
  articles?: unknown;
  newPageBackground?: unknown;
};

/** Why a background cannot go onto a page: a logo page takes no picture. */
type BackgroundCopyRefusal = 'unknown_page' | 'locked' | 'picture_not_offered';

/** The patch that gives `target` this whole background, the paper included (an absent fill or
 *  pattern clears the target's), or null when the target cannot take it. A logo page takes no
 *  pattern, so its own is left alone, and no picture. */
export function backgroundPatchFor(
  target: Pick<Page, 'kind'>,
  background: PageBackground | undefined,
): Partial<PageBackground> | null {
  if (target.kind !== 'logo') return { fill: background?.fill, pattern: background?.pattern };
  if (background?.fill?.kind === 'image') return null;
  return { fill: background?.fill };
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
  const patch = backgroundPatchFor(to, from.background);
  if (!patch) return { refused: 'picture_not_offered' };
  return pageBackgroundSet(tab, toPageId, patch, memory);
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
  | { refused: 'unknown_page' | 'no_other_pages' | 'background_not_offered' };

/** A page's background onto every other page of its kind (Apply to All Logo Pages, and so on): one
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
  // Photo pages have no background to give (photo-pages.md "Background").
  if (kind === 'photo') return { refused: 'background_not_offered' };
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
    const patch = backgroundPatchFor(target, source.background);
    const edit = patch ? pageBackgroundStored(out, target.id, patch) : null;
    if (!edit || 'refused' in edit) {
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
  // The pages that now wear it, and the locked ones left as they were.
  applied: number;
  skipped: number;
};

/** Apply to Every Page: every page of the tab given its new-page background (or put back on the paper when it has
 *  none), as one edit, each re-inked for its new fill in one walk. A logo page takes the fill alone; a photo page
 *  has no background and is passed by; a locked page keeps its own and counts as skipped. */
export function pagesGivenNewPageBackground<T extends PagesTab>(
  tab: T,
  memory?: InkMemory,
): NewPageBackgroundSpread<T> {
  const background = newPageBackgroundOf(tab);
  const pages = pagesOf(tab);
  let out = tab;
  const inks: PageInk[] = [];
  let applied = 0;
  let skipped = 0;
  for (const unit of pageUnits(pages)) {
    const first = pages.find((p) => p.id === unit.pageIds[0])!;
    if (pageKindOf(first) === 'photo') continue;
    // backgroundPatchFor refuses only a picture on a logo page, and the field never holds one.
    const patch = backgroundPatchFor(first, background)!;
    const edit = pageBackgroundStored(out, first.id, patch);
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
