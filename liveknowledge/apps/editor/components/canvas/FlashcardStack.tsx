'use client';

// A stack on the canvas (docs/specs/007-editor/pages-mode.md "Stacked infographics"): the pages still to come fanned
// out behind the page in front, and its Previous and Next. Views in canvas space, never elements, left out of exports; only Previous and Next take presses.
import { lucideChevronLeft, lucideChevronRight } from '@liveworkspace/icons/lucide';
import { pageIsDark, type LaidOutPage } from '@liveknowledge/document';
import { lucideGlyph } from '@liveknowledge/ui';
import { track } from '@/lib/telemetry';
import { GIF_OMIT_ATTR } from '@/lib/gif-export/gif-omit';
import { pageSheetStyle } from '@/lib/page-paint';
import { stackSheets, type CardStack } from '@/lib/flashcard-stack';

const PrevIcon = lucideGlyph(lucideChevronLeft, 16);
const NextIcon = lucideGlyph(lucideChevronRight, 16);
// The rim round the card in front, canvas px: a hairline that still reads zoomed out.
const FRONT_RIM_PX = 1.5;

/** The cards behind the card in front, furthest first so the nearest paints over them. */
export function FlashcardStackSheets({
  card,
  behind,
}: {
  card: LaidOutPage;
  // The cards after the card in front, in order.
  behind: readonly LaidOutPage[];
}) {
  const sheets = stackSheets(card.rect, behind.length);
  return (
    <>
      {sheets
        .map((sheet, i) => ({ sheet, page: behind[i]! }))
        .reverse()
        .map(({ sheet, page }) => (
          <div
            key={page.id}
            aria-hidden
            {...{ [GIF_OMIT_ATTR]: '' }}
            data-flashcard-behind=""
            // A flip eases each card to its new place in the fan (keyed by its page, so it moves, never redraws): its
            // offset and tilt are a transform from the card in front's place, so only they ease. The stack itself
            // stands where the card in front does, which moves a whole page as the view does on every flip; easing
            // left and top slid every card in from a page away, as if the stack flickered out and back.
            className={`pointer-events-none absolute origin-center transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none [--edge:rgb(15_23_42/0.28)] dark:[--edge:rgb(255_255_255/0.26)] ${
              page.background?.fill ? '' : 'bg-white dark:bg-slate-900'
            }`}
            style={{
              left: card.rect.x,
              top: card.rect.y,
              width: sheet.rect.width,
              height: sheet.rect.height,
              transform: `translate(${sheet.rect.x - card.rect.x}px, ${sheet.rect.y - card.rect.y}px) rotate(${sheet.turn}deg)`,
              opacity: sheet.opacity,
              // An edge, not a weight: a fine line that reads on a white card over a light canvas (where a faded white
              // sheet alone vanished) and on a dark one, and a soft lift under it.
              boxShadow: '0 0 0 1px var(--edge), 0 2px 6px -2px rgb(15 23 42 / 0.16)',
              ...pageSheetStyle(page.background),
            }}
          ></div>
        ))}
      {/* The card in front lifted off the fan (pages-mode.md "Stacked infographics"): a shadow cast onto the
          cards behind and a thin rim just outside its edge, both drawn under the card so they never cover it. Its
          edge then reads on any background, the cards behind being in the same tone. */}
      {sheets.length > 0 ? (
        <div
          aria-hidden
          {...{ [GIF_OMIT_ATTR]: '' }}
          data-flashcard-lift=""
          // The rim's tone: from the card's own background, else the app's light or dark (a card with no background
          // of its own is white, or slate in dark mode).
          className={`pointer-events-none absolute ${
            card.background?.fill
              ? ''
              : '[--rim:rgb(15_23_42/0.10)] dark:[--rim:rgb(255_255_255/0.28)]'
          }`}
          style={{
            left: card.rect.x,
            top: card.rect.y,
            width: card.rect.width,
            height: card.rect.height,
            ...(card.background?.fill
              ? { '--rim': pageIsDark(card) ? 'rgb(255 255 255 / 0.28)' : 'rgb(15 23 42 / 0.10)' }
              : {}),
            boxShadow: `0 0 0 ${FRONT_RIM_PX}px var(--rim), 0 1px 4px rgb(0 0 0 / 0.12), 0 10px 28px -8px rgb(0 0 0 / 0.28)`,
          }}
        />
      ) : null}
    </>
  );
}

/** A stack's Previous, its place ("Card 3 of 10", "Page 3 of 10") and Next: under the page in front, for everyone
 *  who can see the pages. A press goes to the page before or after, as Contents does, by a flip. */
export function StackNav({
  stack,
  row,
  noun,
  dark,
  onGo,
}: {
  stack: CardStack;
  // The whole row, in order: the page before and after are found in it.
  row: readonly Pick<LaidOutPage, 'id'>[];
  noun: 'Card' | 'Page' | 'Slide';
  // On a page (a card's footer sits on it): light ink on a dark one. Absent off the page, in chrome of its own.
  dark?: boolean;
  onGo: (pageId: string) => void;
}) {
  const go = (to: number) => {
    const id = row[to]?.id;
    if (!id) return;
    track('UI', 'Used', 'StackNav');
    onGo(id);
  };
  const button = `relative touch-target-y flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-35 ${
    dark === undefined
      ? 'hover:bg-slate-100 hover:text-slate-900 disabled:hover:bg-transparent dark:hover:bg-slate-800 dark:hover:text-white'
      : dark
        ? 'hover:bg-white/15 disabled:hover:bg-transparent'
        : 'hover:bg-slate-900/[0.06] disabled:hover:bg-transparent'
  }`;
  const lower = noun.toLowerCase();
  return (
    <div
      role="group"
      aria-label={`${noun} ${stack.index + 1} of ${stack.count}`}
      data-stack-nav=""
      // A press here is the nav's, never the canvas's (no marquee, no deselect, no caret in the card's writing).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="pointer-events-auto flex items-center gap-0.5"
    >
      <button
        type="button"
        aria-label={`Previous ${lower}`}
        disabled={stack.index <= 0}
        onClick={() => go(stack.index - 1)}
        className={button}
      >
        <PrevIcon />
      </button>
      <span className="px-1 tabular-nums">
        {noun} {stack.index + 1} of {stack.count}
      </span>
      <button
        type="button"
        aria-label={`Next ${lower}`}
        disabled={stack.index >= stack.count - 1}
        onClick={() => go(stack.index + 1)}
        className={button}
      >
        <NextIcon />
      </button>
    </div>
  );
}

// Screen px in from an infographic page's bottom-right corner to its nav, at any zoom. Inside the page, as a card's is:
// under it, the nav fell on the bottom-right cluster's row, which the framed page sits just above.
export const PAGE_STACK_NAV_INSET = 10;

/** An infographic (or stacked slide) page's Previous, "Page 3 of 10" ("Slide 3 of 10") and Next: inside the page in front's bottom-right corner,
 *  held at one screen size (as the title bar is) so it reads and presses alike at any zoom. */
export function PageStackNav({
  page,
  stack,
  row,
  zoom,
  onGo,
}: {
  page: LaidOutPage;
  stack: CardStack;
  row: readonly Pick<LaidOutPage, 'id'>[];
  zoom: number;
  onGo: (pageId: string) => void;
}) {
  return (
    <div
      {...{ [GIF_OMIT_ATTR]: '' }}
      data-page-stack-nav=""
      className="pointer-events-none absolute z-[2] whitespace-nowrap"
      style={{
        left: page.rect.x + page.rect.width,
        top: page.rect.y + page.rect.height,
        transform: `scale(${1 / zoom}) translate(calc(-100% - ${PAGE_STACK_NAV_INSET}px), calc(-100% - ${PAGE_STACK_NAV_INSET}px))`,
        transformOrigin: 'top left',
      }}
    >
      <div className="pointer-events-auto rounded-[10px] border border-slate-200/90 bg-white/95 p-0.5 text-xs font-medium text-slate-600 shadow-[0_1px_2px_rgb(15_23_42/0.06),0_4px_12px_-4px_rgb(15_23_42/0.12)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/95 dark:text-slate-300">
        <StackNav
          stack={stack}
          row={row}
          noun={page.kind === 'slide' ? 'Slide' : 'Page'}
          onGo={onGo}
        />
      </div>
    </div>
  );
}
