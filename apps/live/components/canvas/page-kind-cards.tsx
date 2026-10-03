'use client';

// The two kinds of page as cards (docs/specs/007-editor/illustrate-pages.md "Page kinds"): a
// miniature of the page above its name and a line on what it is for. Shared by the add-a-page
// popover and the first page's own choice.
import type { PageKind } from '@livediagram/document';
import type { Ref } from 'react';

export type PageKindChoice = { kind: PageKind; name: string; line: string };

export const PAGE_KINDS: readonly PageKindChoice[] = [
  {
    kind: 'infographic',
    name: 'Infographic',
    line: 'A page to lay out: layouts, icons, charts and media.',
  },
  {
    kind: 'article',
    name: 'Article',
    line: 'A page to write on, flowing onto new pages as it grows.',
  },
];

export function PageKindCard({
  choice,
  onChoose,
  ref,
}: {
  choice: PageKindChoice;
  onChoose: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onChoose}
      className="group flex flex-col items-stretch gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-brand-400 hover:bg-brand-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-400 dark:hover:bg-brand-500/10"
    >
      <span className="flex h-24 items-center justify-center rounded-md bg-slate-50 dark:bg-slate-800/70">
        {choice.kind === 'article' ? <ArticleMiniature /> : <InfographicMiniature />}
      </span>
      <span className="px-0.5">
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
          {choice.name}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">
          {choice.line}
        </span>
      </span>
    </button>
  );
}

function InfographicMiniature() {
  return (
    <svg width="58" height="78" viewBox="0 0 58 78" aria-hidden className="drop-shadow-sm">
      <rect width="58" height="78" rx="3" className="fill-white dark:fill-slate-700" />
      <rect
        x="8"
        y="8"
        width="30"
        height="5"
        rx="2"
        className="fill-slate-700 dark:fill-slate-200"
      />
      <rect
        x="8"
        y="16"
        width="20"
        height="3"
        rx="1.5"
        className="fill-slate-300 dark:fill-slate-500"
      />
      <rect
        x="8"
        y="26"
        width="42"
        height="22"
        rx="3"
        className="fill-brand-100 dark:fill-brand-500/25"
      />
      <rect x="13" y="38" width="5" height="7" rx="1" className="fill-brand-500" />
      <rect x="21" y="33" width="5" height="12" rx="1" className="fill-brand-500" />
      <rect x="29" y="30" width="5" height="15" rx="1" className="fill-brand-500" />
      <rect x="37" y="35" width="5" height="10" rx="1" className="fill-brand-500" />
      <circle cx="14" cy="60" r="5" className="fill-amber-400" />
      <circle cx="29" cy="60" r="5" className="fill-emerald-400" />
      <circle cx="44" cy="60" r="5" className="fill-rose-400" />
      <rect
        x="8"
        y="69"
        width="42"
        height="2.5"
        rx="1.25"
        className="fill-slate-200 dark:fill-slate-500"
      />
    </svg>
  );
}

// A sheet of writing: a title, paragraphs, a list and a picture with text wrapping beside it.
function ArticleMiniature() {
  const line = 'fill-slate-300 dark:fill-slate-500';
  return (
    <svg width="58" height="78" viewBox="0 0 58 78" aria-hidden className="drop-shadow-sm">
      <rect width="58" height="78" rx="3" className="fill-white dark:fill-slate-700" />
      <rect
        x="8"
        y="8"
        width="28"
        height="5"
        rx="2"
        className="fill-slate-700 dark:fill-slate-200"
      />
      <rect x="8" y="18" width="42" height="2.5" rx="1.25" className={line} />
      <rect x="8" y="23" width="40" height="2.5" rx="1.25" className={line} />
      <rect x="8" y="28" width="30" height="2.5" rx="1.25" className={line} />
      <rect
        x="8"
        y="36"
        width="17"
        height="14"
        rx="2"
        className="fill-brand-100 dark:fill-brand-500/25"
      />
      <rect x="28" y="36" width="22" height="2.5" rx="1.25" className={line} />
      <rect x="28" y="41" width="20" height="2.5" rx="1.25" className={line} />
      <rect x="28" y="46" width="22" height="2.5" rx="1.25" className={line} />
      <circle cx="10" cy="57" r="1.5" className="fill-brand-500" />
      <rect x="14" y="56" width="30" height="2.5" rx="1.25" className={line} />
      <circle cx="10" cy="62" r="1.5" className="fill-brand-500" />
      <rect x="14" y="61" width="26" height="2.5" rx="1.25" className={line} />
      <rect x="8" y="68" width="38" height="2.5" rx="1.25" className={line} />
    </svg>
  );
}
