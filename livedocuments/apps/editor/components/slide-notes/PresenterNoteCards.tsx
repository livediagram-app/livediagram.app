'use client';

// The presenter's card viewer (docs/specs/012-collaboration/speaker-note-cards.md "Presenting"): the slide's note
// cards one at a time under the HUD, the card in front with the cards still to come peeking out below it as a
// flashcard stack does, Previous Card / Next Card and a dot per card, and the flip between them. Read only: presenting
// changes nothing.
import { useLayoutEffect, useRef, useState } from 'react';
import { lucideClock } from '@liveworkspace/icons/lucide';
import { noteCardSpeakingSeconds, speakingTimeLabel, type NoteCard } from '@livedocuments/document';
import { ChevronLeftIcon, ChevronRightIcon, lucideGlyph, Tooltip } from '@livedocuments/ui';
import { FLASHCARD_FLIP_MS, motionReduced } from '@/lib/flashcard-flip';
import { FLASHCARD_STACK_INSET_X, FLASHCARD_STACK_STEP_Y } from '@/lib/flashcard-stack';

const ClockIcon = lucideGlyph(lucideClock, 11);

// Sheets behind the card in front: enough to read "more to come" without growing past the HUD's corner.
export const VIEWER_STACK_MAX = 3;
// Dots between the buttons, one a card; past this "Card n of m" says enough.
export const VIEWER_DOTS_MAX = 10;
// As a flashcard turns: deep enough to read as a card's, at the viewer's size.
const PERSPECTIVE = 'perspective(1200px)';
const TURNED = { transform: `${PERSPECTIVE} rotateX(78deg)`, opacity: 0 };
const FLAT = { transform: `${PERSPECTIVE} rotateX(0deg)`, opacity: 1 };

type Ghost = { card: NoteCard; index: number; key: number };

function CardFace({ card, index, count }: { card: NoteCard; index: number; count: number }) {
  const time = speakingTimeLabel(noteCardSpeakingSeconds(card.text));
  return (
    <>
      <div aria-hidden className="h-0.5 rounded-t-xl bg-brand-400" />
      <div className="flex items-center justify-between gap-3 px-4 pt-2.5 text-[11px] font-medium tabular-nums text-white/55">
        <span>
          Card {index + 1} of {count}
        </span>
        {time ? (
          <span className="flex items-center gap-1">
            <ClockIcon />
            {time}
          </span>
        ) : null}
      </div>
      <p className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words px-4 pb-3.5 pt-1.5 text-[15px] leading-relaxed text-white/90">
        {card.text.trim()}
      </p>
    </>
  );
}

const FACE =
  'rounded-xl bg-slate-900/95 shadow-2xl ring-1 ring-white/10 backdrop-blur [transform-origin:top_center]';

export function PresenterNoteCards({
  cards,
  at,
  slideId,
  onCard,
}: {
  // The slide's cards that are not blank, in order (spokenNoteCards).
  cards: readonly NoteCard[];
  // The card in front (clamped here to the cards there are).
  at: number;
  // The slide on screen: a new slide shows its first card without a flip.
  slideId: string;
  onCard: (index: number) => void;
}) {
  const count = cards.length;
  const index = Math.max(0, Math.min(count - 1, at));
  const card = cards[index];
  const front = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const shown = useRef({ index, slideId, card });
  const [ghost, setGhost] = useState<Ghost | null>(null);

  // The flip (docs/specs/007-editor/flashcards.md "Flipping"): forward, a picture of the card that was in front turns
  // up over its top edge and fades, uncovering the next; back, the earlier card comes down over the stack.
  useLayoutEffect(() => {
    const was = shown.current;
    shown.current = { index, slideId, card };
    if (was.slideId !== slideId || was.index === index || !was.card || motionReduced()) return;
    if (index > was.index) {
      setGhost({ card: was.card, index: was.index, key: Date.now() });
      return;
    }
    const anim = front.current?.animate?.([TURNED, FLAT], {
      duration: FLASHCARD_FLIP_MS,
      easing: 'ease-in-out',
    });
    return () => anim?.cancel();
  }, [index, slideId, card]);

  useLayoutEffect(() => {
    if (!ghost) return;
    const anim = ghostRef.current?.animate?.([FLAT, TURNED], {
      duration: FLASHCARD_FLIP_MS,
      easing: 'ease-in-out',
      fill: 'forwards',
    });
    if (!anim) {
      setGhost(null);
      return;
    }
    anim.onfinish = () => setGhost(null);
    return () => anim.cancel();
  }, [ghost]);

  if (!card) return null;
  const behind = Math.min(VIEWER_STACK_MAX, count - index - 1);
  return (
    <div
      role="dialog"
      aria-label="Presenter notes"
      data-presenter-note-cards=""
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto fixed right-4 top-16 z-[66] w-[22rem] max-w-[calc(100vw-2rem)]"
    >
      <div className="relative" style={{ paddingBottom: behind * FLASHCARD_STACK_STEP_Y }}>
        {/* The cards still to come, furthest first so the nearest paints over them. */}
        {Array.from({ length: behind }, (_, i) => behind - i).map((step) => (
          <div
            key={step}
            aria-hidden
            data-note-card-behind=""
            className="absolute rounded-xl bg-slate-800 ring-1 ring-white/10"
            style={{
              top: FLASHCARD_STACK_STEP_Y * step,
              bottom: -FLASHCARD_STACK_STEP_Y * step + behind * FLASHCARD_STACK_STEP_Y,
              left: FLASHCARD_STACK_INSET_X * step,
              right: FLASHCARD_STACK_INSET_X * step,
              opacity: 1 - step * 0.22,
            }}
          />
        ))}
        <div ref={front} className={`relative ${FACE}`} data-note-card-front="">
          <CardFace card={card} index={index} count={count} />
        </div>
        {ghost ? (
          <div
            key={ghost.key}
            ref={ghostRef}
            aria-hidden
            data-note-card-flip=""
            className={`pointer-events-none absolute inset-x-0 top-0 ${FACE}`}
          >
            <CardFace card={ghost.card} index={ghost.index} count={count} />
          </div>
        ) : null}
      </div>
      {count > 1 ? (
        <div className="mt-2 flex items-center justify-between gap-1 rounded-xl bg-slate-900/80 p-1 backdrop-blur">
          <ViewerButton
            label="Previous Card"
            hint="↑"
            disabled={index === 0}
            onPress={() => onCard(index - 1)}
          >
            <ChevronLeftIcon />
            <span>Previous</span>
          </ViewerButton>
          {count <= VIEWER_DOTS_MAX ? (
            <div className="flex items-center gap-1">
              {cards.map((c, i) => (
                <Tooltip key={c.id} label={`Go to Card ${i + 1}`}>
                  <button
                    type="button"
                    aria-label={`Go to Card ${i + 1}`}
                    aria-current={i === index ? 'true' : undefined}
                    onClick={() => onCard(i)}
                    className="flex h-5 w-3 cursor-pointer items-center justify-center"
                  >
                    <span
                      className={`block h-1.5 rounded-full transition-all ${
                        i === index ? 'w-3 bg-brand-300' : 'w-1.5 bg-white/30 hover:bg-white/60'
                      }`}
                    />
                  </button>
                </Tooltip>
              ))}
            </div>
          ) : null}
          <ViewerButton
            label="Next Card"
            hint="↓"
            disabled={index === count - 1}
            onPress={() => onCard(index + 1)}
          >
            <span>Next</span>
            <ChevronRightIcon />
          </ViewerButton>
        </div>
      ) : null}
      {/* The card in front, for a screen reader: its place and its words, as it changes. */}
      <div aria-live="polite" className="sr-only">
        {`Card ${index + 1} of ${count}. ${card.text.trim()}`}
      </div>
    </div>
  );
}

function ViewerButton({
  label,
  hint,
  disabled,
  onPress,
  children,
}: {
  label: string;
  hint: string;
  disabled: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={`${label} (${hint})`}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onPress}
        className="flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-white/85 transition hover:bg-white/10 disabled:cursor-default disabled:text-white/25 disabled:hover:bg-transparent [&_svg]:h-3.5 [&_svg]:w-3.5"
      >
        {children}
      </button>
    </Tooltip>
  );
}
