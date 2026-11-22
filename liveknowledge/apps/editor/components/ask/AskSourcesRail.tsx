'use client';

// The Sources rail (docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows"): a card for each passage
// the showing answer cites, then the passages it found and set aside. A card opens its page at the passage. Passages
// are other people's text: drawn as text, the matched words softly marked by the page itself.
import { memo, useEffect, useRef } from 'react';
import type { AskNotUsed, AskSource } from '@liveknowledge/api-schema';
import { parseKnowledgeFields } from '@liveknowledge/knowledge';
import { CompactEmptyState } from '@liveknowledge/ui';
import { markedParts } from '@/lib/knowledge-ask/answer-parts';
import type { AskTurnView } from '@/lib/knowledge-ask/ask-conversation';
import { pagePath, sourceTrust, type SourceTrust } from '@/lib/knowledge-ask/source-meta';
import { TrustBadge } from '@/components/knowledge/TrustBadge';
import { HealthChip } from '@/components/knowledge/HealthChip';
import { SourcesIcon } from './ask-icons';
import { NUMBER_CHIP } from './CitationChip';

export type SourcePage = { id: string; name: string; parent?: string; knowledge?: unknown };

const SECTION_LABEL =
  'text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400';
const CARD =
  'block w-full cursor-pointer rounded-xl border bg-white p-3 text-left motion-safe:transition-[border-color,box-shadow] motion-safe:duration-micro hover:border-slate-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-slate-900 dark:hover:border-slate-600';
// amber-800 on amber-100 is over 4.5:1 (TrustBadge.test.tsx holds the pair).
const STALE_PILL =
  'inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200';

function Passage({ text, question }: { text: string; question: string }) {
  return (
    <span className="mt-1.5 line-clamp-6 block break-words text-[13px] leading-5 text-slate-700 dark:text-slate-300">
      {markedParts(text, question).map((part, at) =>
        part.marked ? (
          // The page's own mark over a matched word: a soft brand wash, the words still text.
          <mark
            key={at}
            className="rounded-[3px] bg-brand-100 px-0.5 text-inherit dark:bg-brand-500/25"
          >
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </span>
  );
}

// Where the page sits, on its own line: the parents shorten first, the page's own name always shows; the headings
// above the passage follow, on a line of their own.
function Breadcrumb({
  path,
  title,
  headings,
}: {
  path: { parents: string[]; name: string };
  title: string;
  headings: string;
}) {
  // A top-level page's path is its name alone, already the card's title.
  const showPath = path.parents.length > 0 || path.name !== title;
  return (
    <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400" data-source-path="">
      {showPath ? (
        <span className="flex min-w-0 items-center gap-1">
          {path.parents.length > 0 ? (
            <>
              <span className="min-w-0 truncate">{path.parents.join(' / ')}</span>
              <span aria-hidden className="shrink-0 text-slate-400 dark:text-slate-600">
                /
              </span>
            </>
          ) : null}
          <span className="max-w-full shrink-0 truncate font-medium text-slate-700 dark:text-slate-300">
            {path.name}
          </span>
        </span>
      ) : null}
      {headings ? <span className="block truncate">{headings}</span> : null}
    </span>
  );
}

// The source's trust at a glance, in the page's own badges: Verified with its tick, Review Due amber, Never Verified
// quiet with no tick. The words beside it wrap whole to a second line rather than cut a name.
function SourceTrustLine({ trust, health }: { trust: SourceTrust; health: AskSource['health'] }) {
  return (
    <span
      data-source-trust={trust.mark}
      className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-slate-100 pt-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-400"
    >
      {trust.mark === 'never' ? (
        <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {trust.label}
        </span>
      ) : (
        <span className="[&>span]:text-[12px]">
          <TrustBadge mark={trust.mark} />
        </span>
      )}
      {trust.pieces.map((piece) => (
        <span key={piece} className="min-w-0">
          {piece}
        </span>
      ))}
      {/* The page's Health Score after its trust (search-and-ask.md "Sources"); an older answer has none. */}
      {health ? <HealthChip score={health.score} label={health.label} prefix /> : null}
    </span>
  );
}

function SourceCard({
  source,
  question,
  pages,
  nameOf,
  now,
  lit,
  stale,
  onOpen,
}: {
  source: AskSource | AskNotUsed;
  question: string;
  pages: readonly SourcePage[];
  nameOf: (id: string | undefined) => string | undefined;
  now: number;
  lit: boolean;
  stale: boolean;
  onOpen: (source: AskSource) => void;
}) {
  const card = useRef<HTMLButtonElement>(null);
  // A pressed citation brings its card into view and takes the focus there.
  useEffect(() => {
    if (!lit) return;
    card.current?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    card.current?.focus({ preventScroll: true });
  }, [lit]);
  const page = pages.find((p) => p.id === source.tab);
  const verifier = nameOf(parseKnowledgeFields(page?.knowledge).verifiedBy);
  // The card's title is the page's: a top-level page's path, or a heading that only repeats it, would say it twice.
  const title = source.title || 'Untitled Page';
  const headings = source.headings.filter((h) => h !== title).join(' › ');
  const path = pagePath(pages, source.tab, source.title);
  return (
    <li>
      <button
        ref={card}
        type="button"
        data-source={source.number}
        data-lit={lit ? '' : undefined}
        onClick={() => onOpen(source)}
        className={`${CARD} ${
          lit
            ? 'border-brand-500 ring-2 ring-brand-500/30'
            : stale
              ? 'border-amber-300 dark:border-amber-500/40'
              : 'border-slate-200 dark:border-slate-800'
        }`}
      >
        <span className="flex items-center gap-2">
          {stale ? null : (
            <>
              <span aria-hidden className={NUMBER_CHIP}>
                <span className="text-optical-centre">{source.number}</span>
              </span>
              <span className="sr-only">Source {source.number}:</span>
            </>
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </span>
          {stale ? <span className={STALE_PILL}>Older Passage</span> : null}
        </span>
        {path.parents.length > 0 || path.name !== title || headings ? (
          <Breadcrumb path={path} title={title} headings={headings} />
        ) : null}
        <Passage text={source.text} question={question} />
        {'reason' in source && source.reason ? (
          <span className="mt-1.5 block break-words text-[13px] leading-5 text-amber-900 dark:text-amber-200">
            {source.reason}
          </span>
        ) : null}
        <SourceTrustLine
          trust={sourceTrust(source.trust, source.verifiedAt, verifier, now)}
          health={source.health}
        />
      </button>
    </li>
  );
}

export const AskSourcesRail = memo(function AskSourcesRail({
  turn,
  pages,
  nameOf,
  now,
  lit,
  onOpen,
}: {
  // The answer whose sources show: the newest, or the one a citation was pressed in.
  turn: AskTurnView | null;
  pages: readonly SourcePage[];
  nameOf: (id: string | undefined) => string | undefined;
  now: number;
  // The source a pressed citation names.
  lit: number | null;
  onOpen: (source: AskSource) => void;
}) {
  const sources = turn?.sources ?? [];
  // A set-aside always says why (search-and-ask.md "It does not guess"); one kept from before the parser required
  // that, with no reason, is not shown: an unexplained Older Passage beside the same page's citation reads wrong.
  const notUsed = (turn?.notUsed ?? []).filter((n) => n.reason.trim() !== '');
  const shared = { question: turn?.question ?? '', pages, nameOf, now, onOpen };
  return (
    <div data-ask-sources="" className="flex flex-col gap-3 p-4">
      <h2 className={SECTION_LABEL}>Sources</h2>
      {sources.length === 0 ? (
        <CompactEmptyState
          icon={<SourcesIcon />}
          title="No Sources Yet"
          description={
            turn?.status === 'done'
              ? 'This answer cites no passage.'
              : 'The passages an answer cites show here, each with its page and who verified it.'
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {sources.map((source) => (
            <SourceCard
              key={source.passageId}
              source={source}
              lit={lit === source.number}
              stale={false}
              {...shared}
            />
          ))}
        </ul>
      )}
      {notUsed.length > 0 ? (
        <>
          <h2 className={`${SECTION_LABEL} mt-2`}>Found but Not Used</h2>
          <ul className="flex flex-col gap-2">
            {notUsed.map((source) => (
              <SourceCard key={source.passageId} source={source} lit={false} stale {...shared} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
});
