'use client';

// The Too long marker at a card's foot (docs/specs/007-editor/flashcards.md "Never flows"): the
// card's writing runs past its foot, cut off there and kept. For someone who may change the pages,
// it carries Split Onto a New Card. In canvas space over the card, the marker held at one screen size.
import type { LaidOutPage } from '@livedocuments/document';
import { Button, Tooltip } from '@livedocuments/ui';
import { GIF_OMIT_ATTR } from '@/lib/gif-export/gif-omit';
import { useCardOverflow } from '@/lib/flashcard-overflow-store';
import { CARD_SPLIT_REASON, type CardSplit } from '@/lib/flashcard-split';

export function FlashcardTooLong({
  page,
  zoom,
  split,
}: {
  page: LaidOutPage;
  zoom: number;
  // Absent for a Participant, a Viewer or a locked card: the marker alone.
  split?: CardSplit | undefined;
}) {
  // Read again whenever the first block past the foot changes.
  useCardOverflow(page.flow);
  const state = split?.state(page.id) ?? 'fits';
  const onSplit = split && state !== 'fits' ? () => split.run(page.id) : undefined;
  const reason = state === 'ready' || state === 'fits' ? null : CARD_SPLIT_REASON[state];
  return (
    <div
      {...{ [GIF_OMIT_ATTR]: '' }}
      data-flashcard-too-long=""
      className="pointer-events-none absolute z-10 flex items-end justify-center"
      style={{
        left: page.rect.x,
        top: page.rect.y + page.rect.height,
        width: page.rect.width,
        height: 0,
      }}
    >
      <div
        role="status"
        className="flex items-center gap-2 whitespace-nowrap rounded-full bg-amber-50 py-1 pl-3 pr-1 text-xs font-medium text-amber-900 shadow-sm ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-500/40"
        style={{
          transform: `translateY(calc(-100% - ${6 / zoom}px)) scale(${1 / zoom})`,
          transformOrigin: 'bottom center',
          paddingRight: onSplit ? undefined : '0.75rem',
        }}
      >
        <span>Too long for this card</span>
        {onSplit ? (
          <Tooltip
            label={reason ?? 'Move the writing that does not fit onto a new card after this one'}
          >
            <Button
              variant="secondary"
              size="xs"
              data-article-keep-active=""
              aria-disabled={reason ? true : undefined}
              className="pointer-events-auto cursor-pointer rounded-full"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={reason ? undefined : onSplit}
            >
              Split Onto a New Card
            </Button>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
