'use client';

// The Too long marker at a card's foot (docs/specs/007-editor/flashcards.md "Never flows"): the
// card's writing runs past its foot, cut off there and kept. For someone who may change the pages,
// it carries Split Onto a New Card. A floating warning callout (liveworkspace/docs/specs/016-notifications/callouts.md)
// just below the card's foot, in canvas space, held at one screen size.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { LaidOutPage } from '@liveknowledge/document';
import { Callout } from '@liveworkspace/ui/callout';
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
  // The pages' clip (PageClip) cuts everything off at the card's edge, so the marker, below the foot, is drawn in
  // the clip's parent: the same canvas space, unclipped. Outside a clip it stays where it is.
  const [host, setHost] = useState<HTMLElement | null>(null);
  const anchor = (
    <span
      hidden
      ref={(el) => {
        const next = (el?.closest('[data-page-clip]')?.parentElement as HTMLElement | null) ?? null;
        if (el && next !== host) setHost(next);
      }}
    />
  );
  const marker = (
    <div
      {...{ [GIF_OMIT_ATTR]: '' }}
      data-flashcard-too-long=""
      className="pointer-events-none absolute z-10 flex items-start justify-center"
      style={{
        left: page.rect.x,
        top: page.rect.y + page.rect.height,
        width: page.rect.width,
        height: 0,
      }}
    >
      {/* Below the card's foot, never over the line it warns about; held at one screen size. */}
      <div
        data-article-keep-active=""
        className="pointer-events-auto whitespace-nowrap"
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          transform: `translateY(${6 / zoom}px) scale(${1 / zoom})`,
          transformOrigin: 'top center',
        }}
      >
        <Callout
          tone="warning"
          role="status"
          floating
          {...(onSplit
            ? { action: { label: 'Split Onto a New Card', onSelect: onSplit, reason } }
            : {})}
        >
          Too long for this card
        </Callout>
      </div>
    </div>
  );
  return (
    <>
      {anchor}
      {host ? createPortal(marker, host) : marker}
    </>
  );
}
