'use client';

// A stack of flashcards on the canvas (docs/specs/007-editor/flashcards.md "The stack", "Card
// number and speaking time"): the cards still to come peeking out below the card in front, and the
// card's footer. Views in canvas space, never elements: no presses, left out of exports.
import { lucideClock } from '@liveworkspace/icons/lucide';
import {
  flashcardSpeakingSeconds,
  pageIsDark,
  speakingTimeLabel,
  type ArticleFlow,
  type LaidOutPage,
} from '@livedocuments/document';
import { lucideGlyph } from '@livedocuments/ui';
import { GIF_OMIT_ATTR } from '@/lib/gif-export/gif-omit';
import { pageSheetStyle } from '@/lib/page-paint';
import { stackSheets, type CardStack } from '@/lib/flashcard-stack';

const ClockIcon = lucideGlyph(lucideClock, 12);

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
            className={`pointer-events-none absolute ${
              page.background?.fill ? '' : 'bg-white dark:bg-slate-900'
            }`}
            style={{
              left: sheet.rect.x,
              top: sheet.rect.y,
              width: sheet.rect.width,
              height: sheet.rect.height,
              boxShadow: '0 1px 3px rgb(15 23 42 / 0.14), 0 6px 16px rgb(15 23 42 / 0.08)',
              ...pageSheetStyle(page.background),
            }}
          >
            {/* Each card further back a little dimmer. */}
            <div className="absolute inset-0 bg-slate-900" style={{ opacity: sheet.dim }} />
          </div>
        ))}
    </>
  );
}

/** "Card 3 of 10", and the card's speaking time when it has words, in its bottom-right margin. */
export function FlashcardFooter({
  card,
  stack,
  flow,
  margin,
  font,
}: {
  card: LaidOutPage;
  stack: CardStack;
  flow: ArticleFlow | undefined;
  // The card's margin (canvas px): the footer sits in it, right-aligned to the text's edge.
  margin: number;
  font: string | undefined;
}) {
  const time = flow ? speakingTimeLabel(flashcardSpeakingSeconds(flow)) : null;
  const dark = pageIsDark(card);
  return (
    <div
      // A view: Contents' rows say the same to a screen reader.
      aria-hidden
      {...{ [GIF_OMIT_ATTR]: '' }}
      data-flashcard-footer=""
      className="pointer-events-none absolute flex items-center gap-3 whitespace-nowrap text-[13px] tabular-nums"
      style={{
        right: margin,
        bottom: Math.max(6, margin / 2 - 9),
        color: dark ? 'rgb(255 255 255 / 0.6)' : 'rgb(71 85 105 / 0.85)',
        fontFamily: font,
      }}
    >
      <span>
        Card {stack.index + 1} of {stack.count}
      </span>
      {time ? (
        <span className="flex items-center gap-1" data-speaking-time="">
          <ClockIcon />
          {time}
        </span>
      ) : null}
    </div>
  );
}
