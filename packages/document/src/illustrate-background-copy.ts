// A page's background given to other pages (docs/specs/007-editor/illustrate-pages.md "Copying a
// background"): Apply to All (every other page of its kind) and the page format painter (one page
// at a time). A page's format is its background alone, its fill and its pattern; size, content and
// lock stay each page's own. Pure, shared by the page panel, the canvas Format tool and the agents'
// page changes, so each copies the same way.
import type { Tab } from './index';
import {
  illustratePagesOf,
  pageKindOf,
  type IllustratePage,
  type PageBackground,
} from './illustrate-page';
import {
  pageBackgroundSet,
  pageBackgroundStored,
  pageLockRefuses,
  pagesSharing,
  type PageEdit,
} from './illustrate-edits';
import { pagesInkFor, type InkMemory, type PageInk } from './page-ink';

type PagesTab = Pick<Tab, 'elements'> & {
  pages?: unknown;
  pageOrientation?: unknown;
  articles?: unknown;
};

/** Why a background cannot go onto a page: a logo page takes no picture. */
type BackgroundCopyRefusal = 'unknown_page' | 'locked' | 'picture_not_offered';

/** The patch that gives `target` this whole background, the paper included (an absent fill or
 *  pattern clears the target's), or null when the target cannot take it. A logo page takes no
 *  pattern, so its own is left alone, and no picture. */
export function backgroundPatchFor(
  target: Pick<IllustratePage, 'kind'>,
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
  const pages = illustratePagesOf(tab);
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
  | { refused: 'unknown_page' | 'no_other_pages' };

/** A page's background onto every other page of its kind (Apply to All Slides, and so on): one
 *  edit, each page re-inked for it. A locked page keeps its own and is counted as skipped; a page
 *  already wearing it counts as applied. */
export function pageBackgroundSpread<T extends PagesTab>(
  tab: T,
  pageId: string,
  memory?: InkMemory,
): BackgroundSpread<T> {
  const pages = illustratePagesOf(tab);
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
