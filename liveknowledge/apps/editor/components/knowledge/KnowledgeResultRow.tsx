'use client';

// One result of This Knowledgebase in the search panel (docs/specs/030-knowledgebase/search-and-ask.md "Search"):
// the page, where it is, its verified state and the matching lines with the matched words marked. Text and `<mark>`
// only: a snippet is never drawn as HTML.
import type { KnowledgeSearchResult } from '@liveknowledge/api-schema';
import { markedParts } from '@/lib/knowledge/knowledge-search';
import { trustMark } from '@/lib/knowledge/page-trust';
import { TrustBadge } from './TrustBadge';

const MARK =
  'rounded-sm bg-brand-100 px-0.5 text-brand-900 dark:bg-brand-500/30 dark:text-brand-100';

/** Text with its matched words marked: drawn as text and `<mark>`, never as HTML. */
export function Marked({ text }: { text: string }) {
  return (
    <>
      {markedParts(text).map((part, i) =>
        part.marked ? (
          <mark key={i} className={MARK}>
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function KnowledgeResultRow({
  result,
  place,
}: {
  result: Pick<KnowledgeSearchResult, 'title' | 'titleMarked' | 'trust' | 'isTitle' | 'snippet'>;
  // Its ancestors, and for a passage the headings it sits under, joined: where the page is.
  place: string;
}) {
  const mark = trustMark(result.trust);
  return (
    <span data-knowledge-result="" className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
      <span className="flex items-center gap-2">
        <span className="min-w-0 truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
          <Marked text={result.titleMarked || result.title || 'Untitled Page'} />
        </span>
        {mark ? <TrustBadge mark={mark} compact /> : null}
      </span>
      {place ? (
        <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">{place}</span>
      ) : null}
      {result.isTitle || !result.snippet ? null : (
        <span className="line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
          <Marked text={result.snippet} />
        </span>
      )}
    </span>
  );
}
