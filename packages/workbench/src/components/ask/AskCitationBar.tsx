'use client';

// The Cited by Ask bar (liveknowledge/docs/specs/030-knowledgebase/search-and-ask.md "Where a citation lands";
// liveworkspace/docs/specs/004-index/knowledge-sources.md "The place"): an item opened from a knowledgebase's answer
// says so at the top of the canvas, with the question, Back to the Answer and a close. The place itself (the tab, the
// shape, the card) is the editor's own deep link, carried in the same address. Read once, as the editor opens: the
// editor rewrites the fragment as tabs change, and the bar stays until it is closed.
import { useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { askCitationOf } from '@liveworkspace/index-client';
import { lucideArrowLeft, lucideSparkles, lucideX } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';
import { APP_ITEMS, siteOfApp, siteUrlHere } from '@liveworkspace/sites';

const AskIcon = lucideGlyph(lucideSparkles, 14);
const BackIcon = lucideGlyph(lucideArrowLeft, 14);
const CloseIcon = lucideGlyph(lucideX, 14);

/** Where Back to the Answer goes: the knowledgebase's Ask view (`origin` liveknowledge's, for tests). */
export function answerHref(
  knowledgebaseId: string,
  origin = siteUrlHere(siteOfApp('liveknowledge')),
): string {
  return `${origin}${APP_ITEMS.liveknowledge.itemPath}${encodeURIComponent(knowledgebaseId)}?view=ask`;
}

// The address as the editor opened, read once (the editor rewrites the fragment as tabs change); none on the server.
let openedHash: string | null = null;
const noSubscribe = () => () => {};
const readOpenedHash = () => (openedHash ??= window.location.hash);
const serverHash = () => '';

export function AskCitationBar({ hash }: { hash?: string } = {}) {
  const opened = useSyncExternalStore(noSubscribe, readOpenedHash, serverHash);
  const [closed, setClosed] = useState(false);
  const citation = useMemo(() => askCitationOf(hash ?? opened), [hash, opened]);
  if (closed || !citation || typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="region"
      aria-label="Cited by Ask"
      data-ask-citation-bar=""
      className="pointer-events-auto fixed left-1/2 top-16 z-50 flex w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-2 rounded-xl border border-violet-300 bg-white py-1.5 pl-3 pr-1.5 text-sm shadow-lg dark:border-violet-500/50 dark:bg-slate-900"
    >
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200"
      >
        <AskIcon />
      </span>
      <span className="line-clamp-2 min-w-0 flex-1 text-slate-700 dark:text-slate-200">
        <span className="font-semibold text-violet-800 dark:text-violet-200">Cited by Ask: </span>
        {citation.question}
      </span>
      <a
        href={answerHref(citation.from)}
        className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-violet-800 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:text-violet-200 dark:hover:bg-violet-500/15"
      >
        <BackIcon />
        <span className="phone:sr-only">Back to the Answer</span>
      </a>
      <button
        type="button"
        aria-label="Close"
        onClick={() => setClosed(true)}
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <CloseIcon />
      </button>
    </div>,
    document.body,
  );
}
