'use client';

// The first page's own choice (docs/specs/007-editor/pages-mode.md "Page kinds"): while a tab's
// only page is unchosen and empty, it offers the kinds of page inside itself. Infographic keeps the
// page and puts the choice away; Article makes it the first page of an article, the caret in its
// title; Slide turns it into a 16:9 landscape slide; Flashcards makes it the first card of a stack
// (docs/specs/007-editor/flashcards.md "Making flashcards").
// Held at one screen size, centred on the page, never wider than the screen less a 16 px gutter a
// side (a 375 px phone would otherwise cut both edges off).
import type { PageKind } from '@livedocuments/document';
import { useRef } from 'react';
import { kindCardIsWide, moveBetweenKindCards, PAGE_KINDS, PageKindCard } from './page-kind-cards';
import { GIF_OMIT_ATTR } from '@/lib/gif-export/gif-omit';

export function FirstPageChoice({
  zoom,
  onChoose,
}: {
  zoom: number;
  onChoose: (kind: PageKind) => void;
}) {
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    // Above the canvas's + after the page (AddPageButton, later in the same layer): on a phone the page is
    // narrower than the card, and the + sat over the Article card, taking its press.
    <div
      {...{ [GIF_OMIT_ATTR]: '' }}
      className="absolute inset-0 z-10 flex items-center justify-center"
    >
      <div
        role="group"
        aria-labelledby="first-page-choice-title"
        data-first-page-choice=""
        className="pointer-events-auto w-[min(420px,calc(100vw-32px))] animate-fade-in rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
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
          Choose now: every page of this tab will be this kind.
        </p>
        <div
          className="grid grid-cols-2 gap-2"
          // Arrow keys move between the cards, as in the Add a Page popover.
          onKeyDown={(e) => moveBetweenKindCards(e, cards.current)}
        >
          {PAGE_KINDS.map((k, i) => (
            <PageKindCard
              key={k.kind}
              choice={k}
              wide={kindCardIsWide(i)}
              ref={(el) => {
                cards.current[i] = el;
              }}
              onChoose={() => onChoose(k.kind)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
