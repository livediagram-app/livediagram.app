'use client';

// An answer's sources (liveworkspace/docs/specs/019-ask/ask.md "Sources"): Tools has no room for a rail, so they open
// in a popover beside it (a drawer on a phone; the host's ResponsivePopover draws the surface), every source the
// answer cites as a card, the one whose citation was pressed lit and brought into view. A card goes to its place in the item. Passages are other people's text: drawn as text, the question's
// words softly marked.
import { useEffect, useRef } from 'react';
import { DialogCloseButton } from '@liveworkspace/ui';
import { markedParts } from '../answer-parts';
import type { AskSource } from '../wire';
import { GoIcon } from './ask-icons';
import { NUMBER_CHIP } from './CitationChip';

export const ASK_SOURCES_WIDTH_PX = 400;

const CARD =
  'block w-full cursor-pointer rounded-xl border p-3 text-left outline-none motion-safe:transition-[border-color,box-shadow,background-color] motion-safe:duration-micro focus-visible:ring-2 focus-visible:ring-brand-500/60';
const CARD_OFF =
  'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600';
const CARD_LIT =
  'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30 dark:border-brand-400 dark:bg-brand-500/10';

function SourceCard({
  source,
  question,
  goWords,
  lit,
  onOpen,
}: {
  source: AskSource;
  question: string;
  goWords: string;
  lit: boolean;
  onOpen: (source: AskSource) => void;
}) {
  const card = useRef<HTMLButtonElement>(null);
  // A pressed citation brings its card into view and takes the focus there.
  useEffect(() => {
    if (!lit) return;
    card.current?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    card.current?.focus({ preventScroll: true });
  }, [lit]);
  const title = source.title || `Untitled ${source.kind || 'Element'}`;
  // The text again under the title only where it says more than the title does.
  const more = source.text.trim() !== title.trim();
  return (
    <li>
      <button
        ref={card}
        type="button"
        data-source={source.number}
        data-lit={lit ? '' : undefined}
        onClick={() => onOpen(source)}
        className={`${CARD} ${lit ? CARD_LIT : CARD_OFF}`}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden className={NUMBER_CHIP}>
            <span className="text-optical-centre">{source.number}</span>
          </span>
          <span className="sr-only">Source {source.number}:</span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </span>
          {source.kind ? (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {source.kind}
            </span>
          ) : null}
        </span>
        {source.tabName ? (
          <span className="mt-0.5 block truncate text-xs text-slate-600 dark:text-slate-400">
            {source.tabName}
          </span>
        ) : null}
        {more ? (
          <span className="mt-1.5 line-clamp-5 block whitespace-pre-wrap break-words text-[13px] leading-5 text-slate-700 dark:text-slate-300">
            {markedParts(source.text, question).map((part, at) =>
              part.marked ? (
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
        ) : null}
        <span
          className={`mt-2.5 flex items-center justify-end gap-1 border-t pt-2 text-[12.5px] font-semibold ${
            lit
              ? 'border-brand-200 text-brand-700 dark:border-brand-500/30 dark:text-brand-200'
              : 'border-slate-100 text-slate-600 dark:border-slate-800 dark:text-slate-400'
          }`}
        >
          {goWords}
          <GoIcon aria-hidden />
        </span>
      </button>
    </li>
  );
}

export function AskSources({
  question,
  sources,
  lit,
  goWords,
  titleId,
  onOpen,
  onClose,
}: {
  /** The heading's id: the popover's accessible name. */
  titleId: string;
  question: string;
  sources: readonly AskSource[];
  // The source a pressed citation names; null when the answer's Sources pill opened them all.
  lit: number | null;
  /** What going to a source is called ("Show on Canvas"). */
  goWords: string;
  onOpen: (source: AskSource) => void;
  onClose: () => void;
}) {
  const count = sources.length;
  return (
    <div data-ask-sources="" className="flex min-h-0 flex-col">
      <div className="sticky top-0 z-10 flex shrink-0 items-start gap-2 border-b border-slate-100 bg-white py-3 pl-4 pr-2.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-[15px] font-bold text-slate-900 dark:text-white">
            Sources
          </h2>
          <p className="mt-0.5 truncate text-[12.5px] text-slate-600 dark:text-slate-400">
            {count} {count === 1 ? 'place' : 'places'} for “{question}”
          </p>
        </div>
        <DialogCloseButton onClick={onClose} compact />
      </div>
      <ul className="flex flex-col gap-2 p-3">
        {sources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            question={question}
            goWords={goWords}
            lit={lit === source.number}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </div>
  );
}
