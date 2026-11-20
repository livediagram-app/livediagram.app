// Opening a page at one of its blocks (a search result's passage, docs/specs/030-knowledgebase/search-and-ask.md
// "Search"): the page opens with no reload, the block is brought into view once the writing has drawn it, and it is
// lit for a moment so the eye finds it.
import type { EditorContextValue } from '@/app/document/[id]/EditorContext';
import { selectPage } from '@/components/page-tree/select-page';
import { articleHandleOf } from '@/lib/article/article-editor-store';

/** How long a found block stays lit (ms). */
export const BLOCK_HIT_MS = 1600;
const HIT_CLASS = 'article-search-hit';
// A page not opened this session loads first: the block is looked for every 50 ms, for 4 s at most.
const TRY_EVERY_MS = 50;
const TRIES = 80;

export function goToBlock(editor: () => EditorContextValue, tab: string, block: string): void {
  selectPage(editor(), tab);
  if (!block) return;
  const attempt = (left: number) => {
    const el = document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(block)}"]`);
    const now = editor();
    const flow = Object.keys(now.activeTab.articles ?? {})[0];
    const rect =
      el && now.activeId === tab && flow ? articleHandleOf(flow)?.rangeRect(block, 0, 0) : null;
    if (!el || !rect) {
      if (left > 0) window.setTimeout(() => attempt(left - 1), TRY_EVERY_MS);
      return;
    }
    now.scrollIntoView(rect.x, rect.y, rect.w, rect.h);
    el.classList.add(HIT_CLASS);
    window.setTimeout(() => el.classList.remove(HIT_CLASS), BLOCK_HIT_MS);
  };
  attempt(TRIES);
}
