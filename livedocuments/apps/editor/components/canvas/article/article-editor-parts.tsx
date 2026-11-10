import type { EditorView } from 'prosemirror-view';
import { MAX_PAGES, type ArticleBlock, type LaidOutPage } from '@livedocuments/document';
import { replaceContentTr } from '@/lib/article/article-replace';

// The editor's content made `blocks` (article-replace): only what differs is replaced.
export function replaceContent(
  view: EditorView,
  blocks: readonly ArticleBlock[],
  takeCaret: boolean,
): void {
  const tr = replaceContentTr(view.state, blocks, takeCaret);
  if (tr) view.dispatch(tr);
}

// The foot of an article's last page when the tab is at its page limit and the writing runs past it
// (docs/specs/007-editor/article-pages.md "Flowing onto pages", Limit). In canvas space, on the page.
export function PageLimitNotice({ page }: { page: LaidOutPage }) {
  return (
    <div
      role="status"
      data-page-limit-notice=""
      className="pointer-events-none absolute flex items-end justify-center"
      style={{
        left: page.rect.x,
        top: page.rect.y + page.rect.height - 40,
        width: page.rect.width,
        height: 32,
      }}
    >
      <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
        This tab has reached {MAX_PAGES} pages: the writing below this line is hidden
      </span>
    </div>
  );
}
