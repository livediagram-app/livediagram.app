'use client';

// The foot of More Formatting (docs/specs/007-editor/article-pages.md "Word Count"): the length of the article the
// caret is in (and of the selection beside it), how long it takes to read and how easily it reads, the numbers
// behind that on hover. A line to read; when the article has a sentence over 30 words, picking it selects the next
// one, so the writer can split it.
import { lucideChevronRight, lucideLetterText } from '@liveworkspace/icons/lucide';
import { HoverCard, lucideGlyph } from '@liveknowledge/ui';
import { LONG_SENTENCE_WORDS, readabilityDetail } from '@liveknowledge/document';
import {
  readingParts,
  shownReadability,
  wordCountLabel,
  wordCountLine,
  type ArticleCounts,
} from '@/lib/article/article-word-count';

const CountIcon = lucideGlyph(lucideLetterText, 16);
const NextIcon = lucideGlyph(lucideChevronRight, 12);

const NEXT_LONG = 'Select the Next Long Sentence';

export function WordCountLine({
  counts,
  onNextLong,
}: {
  counts: ArticleCounts;
  // Selects the next long sentence; the line takes a press only with one in the article.
  onNextLong?: (() => void) | undefined;
}) {
  const line = wordCountLine(counts);
  const shown = shownReadability(counts);
  const rest = readingParts(counts);
  // Long sentences are the article's, whatever is selected: the pick steps through the whole article.
  const long = counts.readability?.longSentences ?? 0;
  const pickable = long > 0 && onNextLong !== undefined;
  const detail = shown ? readabilityDetail(shown) : undefined;
  const body = (
    <>
      <CountIcon aria-hidden className="mt-px shrink-0 self-start" />
      <span aria-hidden className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline gap-2">
          <span className="flex-1 whitespace-nowrap">Word Count</span>
          <span className="whitespace-nowrap text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {wordCountLabel(counts)}
          </span>
        </span>
        {rest.length > 0 || pickable ? (
          <span className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs text-slate-500 dark:text-slate-400">
            <span data-word-count-reading="">{rest.join(' · ')}</span>
            {pickable ? (
              <span
                data-word-count-long=""
                className="ml-auto flex items-center gap-0.5 whitespace-nowrap font-medium text-brand-700 dark:text-brand-300"
              >
                {long} long
                <NextIcon aria-hidden />
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
    </>
  );
  if (pickable) {
    return (
      <HoverCard
        block
        title={NEXT_LONG}
        description={[
          `${long} ${long === 1 ? 'sentence' : 'sentences'} over ${LONG_SENTENCE_WORDS} words: pick to select the next, to split it.`,
          detail,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          type="button"
          role="menuitem"
          aria-label={`Word Count: ${line}. ${NEXT_LONG}`}
          data-word-count=""
          onClick={onNextLong}
          className="flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {body}
        </button>
      </HoverCard>
    );
  }
  return (
    <HoverCard block title="Readability" description={detail}>
      <div
        role="group"
        aria-label={`Word Count: ${line}`}
        data-word-count=""
        className="flex w-full items-start gap-2 px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
      >
        {body}
      </div>
    </HoverCard>
  );
}
