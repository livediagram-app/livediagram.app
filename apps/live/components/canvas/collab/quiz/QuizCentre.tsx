'use client';

import type { QuizPhase } from '@livediagram/diagram';
import { QUIZ_CORRECT_GREEN } from '@livediagram/diagram';
import type { Participant } from '@/lib/identity';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
import { CollabButton } from '../collab-chrome';

// What the disc in the middle of a Quiz says (docs/specs/012-collaboration/quiz.md), one branch per phase.
// The question itself stays hidden until the round opens, so nobody reads
// ahead while the facilitator is still talking.

// How many of the right answerers are named before the rest become "+N".
const NAMED_MAX = 3;
const AVATARS_MAX = 6;

export type QuizCentreActions = {
  start?: () => void;
  lock?: () => void;
  reveal?: () => void;
  reset?: () => void;
  edit?: () => void;
};

function Question({
  text,
  textColor,
  small,
}: {
  text: string;
  textColor: string;
  small?: boolean;
}) {
  return (
    <p
      className={`font-semibold leading-snug ${small ? 'line-clamp-2 text-[12px]' : 'line-clamp-4 text-[15px]'}`}
      style={{ color: textColor }}
    >
      {text}
    </p>
  );
}

function Meta({ children, textColor }: { children: React.ReactNode; textColor: string }) {
  return (
    <p
      className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-60"
      style={{ color: textColor }}
    >
      {children}
    </p>
  );
}

// "Sam, Priya and Lee" / "Sam, Priya, Lee +2".
export function correctNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length <= NAMED_MAX) {
    return names.length === 1
      ? names[0]!
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }
  return `${names.slice(0, NAMED_MAX).join(', ')} +${names.length - NAMED_MAX}`;
}

export function QuizCentre({
  phase,
  question,
  optionCount,
  seconds,
  secondsLeft,
  answered,
  correct,
  textColor,
  actions,
}: {
  phase: QuizPhase;
  question: string;
  optionCount: number;
  seconds: number;
  secondsLeft: number;
  answered: number;
  // Who picked the right answer, matched to the room. `unknown` counts the
  // right picks from people no longer in it, who have no name to show.
  correct: { people: Participant[]; unknown: number };
  textColor: string;
  actions: QuizCentreActions;
}) {
  if (phase === 'setup' || phase === 'ready') {
    return (
      <>
        <span
          aria-hidden
          className="text-[56px] font-black leading-none opacity-80"
          style={{ color: textColor }}
        >
          ?
        </span>
        <Meta textColor={textColor}>
          {phase === 'setup' ? 'Quiz' : `Quiz · ${optionCount} answers · ${seconds}s`}
        </Meta>
        {phase === 'setup' ? (
          actions.edit ? (
            <CollabButton tone="loud" textColor={textColor} onPress={actions.edit}>
              Set Up Question
            </CollabButton>
          ) : (
            <Meta textColor={textColor}>Waiting for a question</Meta>
          )
        ) : actions.start ? (
          <CollabButton
            tone="loud"
            textColor={textColor}
            onPress={actions.start}
            hoverCard={{
              title: 'Start the quiz',
              description: `Shows the question to everyone and gives them ${seconds} seconds to answer.`,
            }}
          >
            Start
          </CollabButton>
        ) : (
          <Meta textColor={textColor}>Waiting to start</Meta>
        )}
      </>
    );
  }

  if (phase === 'open') {
    return (
      <>
        <span
          className="text-[22px] font-black leading-none tabular-nums"
          style={{ color: textColor }}
          aria-live="off"
        >
          {secondsLeft}
        </span>
        <Question text={question} textColor={textColor} />
        <Meta textColor={textColor}>{answered} answered</Meta>
        {actions.lock ? (
          <CollabButton textColor={textColor} onPress={actions.lock}>
            Lock Now
          </CollabButton>
        ) : null}
      </>
    );
  }

  if (phase === 'locked') {
    return (
      <>
        <Meta textColor={textColor}>Time&apos;s up</Meta>
        <Question text={question} textColor={textColor} />
        <Meta textColor={textColor}>{answered} answered</Meta>
        {actions.reveal ? (
          <CollabButton
            tone="loud"
            textColor={textColor}
            onPress={actions.reveal}
            hoverCard={{
              title: 'Reveal the answer',
              description: 'Shows everyone the right answer and who picked it.',
            }}
          >
            Reveal Answer
          </CollabButton>
        ) : (
          <Meta textColor={textColor}>Waiting for the reveal</Meta>
        )}
      </>
    );
  }

  // Revealed: the payoff, which is who got it.
  const total = correct.people.length + correct.unknown;
  const names = correctNames(correct.people.map((p) => p.name));
  return (
    <>
      <Question text={question} textColor={textColor} small />
      <p className="text-[13px] font-bold" style={{ color: QUIZ_CORRECT_GREEN }}>
        {total} of {answered} correct
      </p>
      {correct.people.length ? (
        <div className="flex flex-wrap justify-center gap-2">
          {correct.people.slice(0, AVATARS_MAX).map((p) => (
            <ParticipantAvatar key={p.id} participant={p} size={20} withHoverCard />
          ))}
        </div>
      ) : null}
      {names ? (
        <p className="line-clamp-2 text-[11px] leading-snug" style={{ color: textColor }}>
          {names}
        </p>
      ) : answered > 0 ? (
        <Meta textColor={textColor}>Nobody got it</Meta>
      ) : null}
      {actions.reset ? (
        <CollabButton textColor={textColor} onPress={actions.reset}>
          Run Again
        </CollabButton>
      ) : null}
    </>
  );
}
