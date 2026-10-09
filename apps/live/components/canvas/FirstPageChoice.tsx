'use client';

// The first page's own choice (docs/specs/007-editor/illustrate-pages.md "Page kinds"): while a tab's
// only page is unchosen and empty, it offers the four kinds of page inside itself, the same cards as
// the add-a-page popover. Infographic keeps the page and puts the choice away; Article makes it the
// first page of an article, the caret in its title; Slide turns it into a 16:9 landscape slide;
// Logo into the 1024 artboard. Held at one screen size, centred on the page.
import type { PageKind } from '@livediagram/document';
import { PAGE_KINDS, PageKindCard } from './page-kind-cards';

export function FirstPageChoice({
  zoom,
  onChoose,
}: {
  zoom: number;
  onChoose: (kind: PageKind) => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        role="group"
        aria-labelledby="first-page-choice-title"
        data-first-page-choice=""
        className="pointer-events-auto w-[420px] animate-fade-in rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
        style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'center' }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <p
          id="first-page-choice-title"
          className="px-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          What Is This Page For?
        </p>
        <p className="mb-2.5 mt-0.5 px-0.5 text-xs text-slate-500 dark:text-slate-400">
          Choose now: a page keeps its kind once you start.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PAGE_KINDS.map((k) => (
            <PageKindCard key={k.kind} choice={k} onChoose={() => onChoose(k.kind)} />
          ))}
        </div>
      </div>
    </div>
  );
}
