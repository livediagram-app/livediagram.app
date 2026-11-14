'use client';

// The foot of More Formatting (docs/specs/007-editor/article-pages.md "Word Count"): the length of the article the
// caret is in, and of the selection beside it. A line to read, not a choice: nothing in it takes a press.
import { lucideLetterText } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedocuments/ui';
import { wordCountLabel, type ArticleCounts } from '@/lib/article/article-word-count';

const CountIcon = lucideGlyph(lucideLetterText, 16);

export function WordCountLine({ counts }: { counts: ArticleCounts }) {
  const label = wordCountLabel(counts);
  return (
    <div
      role="group"
      aria-label={`Word Count: ${label}`}
      data-word-count=""
      className="flex items-center gap-2 px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
    >
      <CountIcon aria-hidden />
      <span aria-hidden className="flex-1">
        Word Count
      </span>
      <span
        aria-hidden
        className="whitespace-nowrap text-xs tabular-nums text-slate-500 dark:text-slate-400"
      >
        {label}
      </span>
    </div>
  );
}
