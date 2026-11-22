// Whether a knowledgebase is still empty (docs/specs/030-knowledgebase/describe-to-set-up.md "The control"): at
// most three pages, none with any writing beyond a title. Read from what the editor already holds, with no request
// and no page loaded for it: a page whose writing this editor has not loaded is not known to be empty, so the
// knowledgebase is not called empty (the control then sits in the menu as Describe to Add Pages instead).
//
// It is asked on every change of the editor's state, a keystroke included, so it is bounded: a knowledgebase past
// three pages answers at once, each page's answer is remembered against the page object (a keystroke replaces only
// the page being written), and a page is read no further than EMPTY_SCAN_BLOCKS blocks.
import type { ArticleBlock, Tab } from '@liveknowledge/document';

export const EMPTY_MAX_PAGES = 3;
/** A page with more blocks than this is not untouched, whatever they hold. */
export const EMPTY_SCAN_BLOCKS = 24;

const hasWords = (block: ArticleBlock): boolean => {
  if (block.type !== 'paragraph') return true;
  if (block.style === 'title') return false;
  return (block.runs ?? []).some((run) => run.text.trim() !== '');
};

const known = new WeakMap<Tab, boolean>();

/** Whether a loaded page holds nothing but its title. */
export function pageIsUntouched(tab: Tab): boolean {
  const before = known.get(tab);
  if (before !== undefined) return before;
  let untouched = tab.elements.length === 0;
  if (untouched) {
    for (const flow of Object.values(tab.articles ?? {})) {
      if (flow.blocks.length > EMPTY_SCAN_BLOCKS || flow.blocks.some(hasWords)) {
        untouched = false;
        break;
      }
    }
  }
  known.set(tab, untouched);
  return untouched;
}

/** Whether the knowledgebase is empty. `loaded`: the pages whose writing this editor holds. */
export function knowledgebaseIsEmpty(tabs: readonly Tab[], loaded: ReadonlySet<string>): boolean {
  if (tabs.length === 0 || tabs.length > EMPTY_MAX_PAGES) return false;
  return tabs.every((tab) => loaded.has(tab.id) && pageIsUntouched(tab));
}

/** The knowledgebase's one page while it is still as it was made (a single page with only a title): the page a
 *  structure's first page takes the place of. Undefined otherwise. */
export function untouchedOnlyPage(
  tabs: readonly Tab[],
  loaded: ReadonlySet<string>,
): Tab | undefined {
  const [only] = tabs;
  return tabs.length === 1 && only && loaded.has(only.id) && pageIsUntouched(only)
    ? only
    : undefined;
}
