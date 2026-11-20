'use client';

// Tab Style's door to an article's own Style (docs/specs/011-theme/canvas-and-theme-dialog.md "Articles"): on an
// article page or a card the tab's finish and font do not reach the writing, so the home says where its text is
// styled and opens that Style beside the page's cog. A grouped settings row, as the dialog's own rows are.
import { lucideChevronRight, lucideALargeSmall } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';
import { useTabStylePages } from './tab-style-pages';

const TileIcon = lucideGlyph(lucideALargeSmall, 15);
const ChevronIcon = lucideGlyph(lucideChevronRight, 14);

export function ArticleStyleRow() {
  const { kind, onOpenArticleStyle } = useTabStylePages();
  if (!onOpenArticleStyle) return null;
  const name = kind === 'flashcard' ? 'Card Style' : 'Article Style';
  return (
    <button
      type="button"
      onClick={onOpenArticleStyle}
      data-tab-style-article-style=""
      className="group flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10"
    >
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-700 text-white dark:bg-brand-600"
      >
        <TileIcon />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{name}</span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          The writing’s look, typeface, size and spacing
        </span>
      </span>
      <span
        aria-hidden
        className="shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200"
      >
        <ChevronIcon />
      </span>
    </button>
  );
}
