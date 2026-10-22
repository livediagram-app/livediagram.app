'use client';

import {
  QUIZ_CORRECT_GREEN,
  QUIZ_DESIGN_SIZE,
  QUIZ_OPTION_HEIGHT,
  QUIZ_OPTION_WIDTH,
  QUIZ_OPTION_LONG_TEXT,
  quizOptionGrowth,
  quizOptionLetter,
} from '@livediagram/document';
import { tint } from '@/lib/element-tint';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';

// One answer on the ring around a Quiz's disc (docs/specs/012-collaboration/quiz.md).
//
// Placed at its final spot and ANIMATED IN from the centre: the fan-out
// keyframe starts at the offset back to the disc (--lvd-quiz-dx / -dy), so the
// resting layout never depends on the animation having run, and reduced
// motion simply shows it in place.

// Stagger between one answer leaving the disc and the next.
const FAN_STAGGER_MS = 80;
// Clear air between an answer and the row of who picked it.
const PICKERS_GAP = 5;

export type QuizOptionState = 'open' | 'locked' | 'right' | 'wrong';

export function QuizOption({
  index,
  text,
  at,
  state,
  mine,
  count,
  textColor,
  stroke,
  surface,
  onPress,
  pickers,
}: {
  index: number;
  text: string;
  // The answer's centre, in design units.
  at: { x: number; y: number };
  state: QuizOptionState;
  // My own pick, which I can always see.
  mine: boolean;
  // How many picked it; shown only once the answer is out.
  count: number | null;
  textColor: string;
  // The element's stroke colour, when set: the answer's border.
  stroke?: string;
  surface: string;
  // Absent when this viewer may not pick, or the round is not open.
  onPress?: () => void;
  // Who picked it, once revealed: on the outside of the answer, away from the disc.
  pickers?: React.ReactNode;
}) {
  const press = usePressWithoutDrag(() => onPress?.());
  const c = QUIZ_DESIGN_SIZE / 2;
  const right = state === 'right';
  // A wash over the card's own colour, so the pill is opaque on the canvas and
  // still in the tab theme's palette.
  const wash = tint(textColor, mine ? 0.2 : 0.06);
  const ink = right ? '#ffffff' : textColor;
  const letterLabel = `Answer ${quizOptionLetter(index)}`;
  const growth = quizOptionGrowth(at);
  // The slot is anchored on the answer's edge nearest the disc and grows away from it, so a long answer
  // shows whole (docs/specs/012-collaboration/quiz.md "Answers"): the pill is its default size at least and
  // as tall as its text needs. Who picked it sits on the slot's outer edge, never over the text.
  const slot: React.CSSProperties = {
    left: at.x - QUIZ_OPTION_WIDTH / 2,
    width: QUIZ_OPTION_WIDTH,
    top:
      growth === 'up'
        ? at.y + QUIZ_OPTION_HEIGHT / 2
        : growth === 'down'
          ? at.y - QUIZ_OPTION_HEIGHT / 2
          : at.y,
    transform:
      growth === 'up' ? 'translateY(-100%)' : growth === 'both' ? 'translateY(-50%)' : undefined,
  };
  return (
    <div className="pointer-events-none absolute" style={slot}>
      <button
        type="button"
        {...press}
        // An answer is a vote, never a grab: the press stops here so picking
        // does not select the quiz (which would lock it to the picker for
        // everyone else) or nudge it. Only the disc selects and drags it.
        onPointerDown={(e) => {
          press.onPointerDown(e);
          e.stopPropagation();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        // aria-disabled rather than `disabled`: a disabled button fires no
        // pointer events, so a press on a locked answer would slip past the
        // stop above and select the quiz after all.
        aria-disabled={!onPress}
        aria-pressed={state === 'open' || state === 'locked' ? mine : undefined}
        aria-label={`${letterLabel}: ${text}${right ? ', correct' : ''}${
          count !== null ? `, ${count} picked` : ''
        }`}
        className={`lvd-quiz-fan pointer-events-auto relative flex w-full items-center gap-1.5 rounded-2xl border-2 px-2 py-1.5 text-left transition-[opacity,background-color,border-color] duration-150 ${
          onPress ? 'cursor-pointer hover:brightness-95' : 'cursor-default'
        } ${right ? 'lvd-quiz-correct z-10' : ''}`}
        style={
          {
            minHeight: QUIZ_OPTION_HEIGHT,
            color: ink,
            background: right
              ? QUIZ_CORRECT_GREEN
              : `linear-gradient(${wash}, ${wash}), ${surface}`,
            borderColor: right
              ? QUIZ_CORRECT_GREEN
              : stroke
                ? tint(stroke, mine ? 1 : 0.55)
                : tint(textColor, mine ? 0.75 : 0.18),
            opacity: state === 'wrong' ? 0.45 : 1,
            '--lvd-quiz-dx': `${c - at.x}px`,
            '--lvd-quiz-dy': `${c - at.y}px`,
            '--lvd-quiz-delay': `${index * FAN_STAGGER_MS}ms`,
          } as React.CSSProperties
        }
      >
        <span
          aria-hidden
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold"
          style={{
            backgroundColor: right ? 'rgb(255 255 255 / 0.25)' : tint(textColor, mine ? 0.3 : 0.1),
          }}
        >
          <span className="text-optical-centre">{right ? '✓' : quizOptionLetter(index)}</span>
        </span>
        <span
          className={`min-w-0 flex-1 font-semibold leading-tight [overflow-wrap:anywhere] ${
            text.length > QUIZ_OPTION_LONG_TEXT ? 'text-[11px]' : 'text-[12.5px]'
          }`}
        >
          {text}
        </span>
        {count !== null ? (
          <span aria-hidden className="shrink-0 text-[11px] font-bold tabular-nums opacity-80">
            {count}
          </span>
        ) : null}
        {mine ? (
          // Which one was yours, kept after the reveal so a wrong pick still
          // reads as yours rather than disappearing into the faded ones.
          <span
            aria-hidden
            className="absolute -top-2 right-2 rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide"
            style={{
              color: right ? QUIZ_CORRECT_GREEN : surface,
              backgroundColor: right ? '#ffffff' : textColor,
            }}
          >
            You
          </span>
        ) : null}
      </button>
      {pickers ? (
        <div
          className="absolute inset-x-0"
          style={
            growth === 'up'
              ? { bottom: '100%', marginBottom: PICKERS_GAP }
              : { top: '100%', marginTop: PICKERS_GAP }
          }
        >
          {pickers}
        </div>
      ) : null}
    </div>
  );
}
