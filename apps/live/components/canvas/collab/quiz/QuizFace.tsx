'use client';

import { useState } from 'react';
import {
  clampQuizSeconds,
  QUIZ_DESIGN_SIZE,
  QUIZ_DISC_RADIUS,
  quizOptionCentres,
  quizPickerKeys,
  quizPhase,
  quizRemainingMs,
  quizTally,
  responseOf,
  type ShapeElement,
} from '@livediagram/diagram';
import { participantKey, type Participant } from '@/lib/identity';
import { tint } from '@/lib/element-tint';
import { useNow } from '@/hooks/ui/useNow';
import type { QuizDraft } from '@/hooks/canvas/useQuizElements';
import {
  ElementEllipsisMenu,
  ElementMenuItem,
  ElementMenuSettingsRow,
} from '@/components/canvas/ElementEllipsisMenu';
import { QuizCentre } from './QuizCentre';
import { QuizEditDialog } from './QuizEditDialog';
import { QuizOption, type QuizOptionState } from './QuizOption';
import { QuizPickers } from './QuizPickers';

// The face of a Quiz (docs/specs/012-collaboration/quiz.md): a disc holding the
// question, with its answers fanned out on a ring around it.
//
// Laid out once on the kind's default square and scaled uniformly onto the
// element's box, the same rule as every Collaborate card (CollabScale), so a
// quiz made big for the back of the room gets bigger type rather than more
// empty ring. Centred on the shorter axis, because a circle stretched to a
// rectangle stops being one.

// The countdown ring sits just outside the disc.
const RING_RADIUS = QUIZ_DISC_RADIUS + 7;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export type QuizActions = {
  answer?: (index: number) => void;
  start?: () => void;
  lock?: () => void;
  reveal?: () => void;
  reset?: () => void;
  save?: (draft: QuizDraft) => void;
};

export function QuizFace({
  element,
  label,
  textColor,
  surface,
  selfKey,
  participants,
  actions,
  onOpenSettings,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  // The card's own colour, for the disc and the answers' backing.
  surface: string;
  // How WE are recorded on this card — see CollabApi.selfKey.
  selfKey: string;
  participants: Participant[];
  actions: QuizActions;
  onOpenSettings?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  // The element's stroke colour, when one is set, draws the outlines: the
  // disc's edge, the countdown ring and the answers' borders. Unset, they are
  // washes of the text colour, so an unstyled quiz still follows the theme.
  const stroke = element.strokeColor;
  // Ticks only while a round could be running, so an idle quiz costs nothing.
  const started = element.quizStartedAt !== undefined && element.quizRevealed !== true;
  const now = useNow(started);
  const phase = quizPhase(element, now);

  const options = element.quizOptions ?? [];
  const seconds = clampQuizSeconds(element.quizSeconds);
  const remaining = quizRemainingMs(element, now);
  const fraction = phase === 'open' ? remaining / (seconds * 1000) : 0;
  const mine = responseOf(element.responses, selfKey);
  const tally = quizTally(element);
  const answered = (element.responses ?? []).length;
  const shown = phase === 'open' || phase === 'locked' || phase === 'revealed';

  // Once revealed, who picked each answer, matched to the room. A pick from
  // somebody who has since left has no face, so it is only counted.
  const pickers =
    phase === 'revealed'
      ? quizPickerKeys(element).map((keys) => {
          const people = keys
            .map((key) => participants.find((p) => participantKey(p) === key))
            .filter((p): p is Participant => p !== undefined);
          return { people, unknown: keys.length - people.length };
        })
      : [];
  const correctCount =
    phase === 'revealed' && element.quizCorrect !== undefined
      ? (tally[element.quizCorrect] ?? 0)
      : 0;

  const scale = Math.min(element.width, element.height) / QUIZ_DESIGN_SIZE;
  const c = QUIZ_DESIGN_SIZE / 2;
  const centres = quizOptionCentres(options.length);
  const canEdit = actions.save !== undefined && phase !== 'open';

  const optionState = (i: number): QuizOptionState =>
    phase === 'revealed'
      ? i === element.quizCorrect
        ? 'right'
        : 'wrong'
      : phase === 'open'
        ? 'open'
        : 'locked';

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute"
        style={{
          width: QUIZ_DESIGN_SIZE,
          height: QUIZ_DESIGN_SIZE,
          left: (element.width - QUIZ_DESIGN_SIZE * scale) / 2,
          top: (element.height - QUIZ_DESIGN_SIZE * scale) / 2,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {/* The disc, and the countdown draining around it while open. */}
        <svg
          aria-hidden
          className="absolute inset-0 overflow-visible"
          width={QUIZ_DESIGN_SIZE}
          height={QUIZ_DESIGN_SIZE}
        >
          <circle
            cx={c}
            cy={c}
            r={QUIZ_DISC_RADIUS}
            fill={surface}
            stroke={stroke ?? tint(textColor, 0.22)}
            strokeWidth={stroke ? 3 : 2}
            style={{ filter: 'drop-shadow(0 2px 6px rgb(0 0 0 / 0.18))' }}
          />
          {phase === 'open' || phase === 'locked' ? (
            <>
              <circle
                cx={c}
                cy={c}
                r={RING_RADIUS}
                fill="none"
                stroke={tint(stroke ?? textColor, 0.14)}
                strokeWidth={5}
              />
              <circle
                className="lvd-quiz-ring"
                cx={c}
                cy={c}
                r={RING_RADIUS}
                fill="none"
                stroke={stroke ?? textColor}
                strokeOpacity={stroke ? 1 : 0.7}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
                // From 12 o'clock, draining anticlockwise like a kitchen timer.
                transform={`rotate(-90 ${c} ${c})`}
              />
            </>
          ) : null}
        </svg>

        <div
          className="absolute flex flex-col items-center justify-center gap-1.5 text-center"
          style={{
            left: c - QUIZ_DISC_RADIUS * 0.8,
            top: c - QUIZ_DISC_RADIUS * 0.8,
            width: QUIZ_DISC_RADIUS * 1.6,
            height: QUIZ_DISC_RADIUS * 1.6,
          }}
        >
          <QuizCentre
            phase={phase}
            question={label.trim() || 'Untitled question'}
            optionCount={options.length}
            seconds={seconds}
            secondsLeft={Math.ceil(remaining / 1000)}
            answered={answered}
            correctCount={correctCount}
            textColor={textColor}
            actions={{
              start: actions.start,
              lock: actions.lock,
              reveal: actions.reveal,
              reset: actions.reset,
              edit: canEdit ? () => setEditing(true) : undefined,
            }}
          />
        </div>

        {/* Keyed on the round, so every Start fans the answers out afresh and
            nothing else (a lock, a reveal) replays it. */}
        {shown ? (
          <div key={element.collabRound ?? 'first'}>
            {options.map((text, i) => (
              <QuizOption
                key={i}
                index={i}
                text={text}
                at={centres[i]!}
                state={optionState(i)}
                mine={mine === String(i)}
                count={phase === 'revealed' ? (tally[i] ?? 0) : null}
                textColor={textColor}
                stroke={stroke}
                surface={surface}
                onPress={phase === 'open' && actions.answer ? () => actions.answer!(i) : undefined}
              />
            ))}
            {pickers.map((who, i) => (
              <QuizPickers
                key={`pickers-${i}`}
                at={centres[i]!}
                // Outside the answer, away from the disc (see QuizPickers).
                side={centres[i]!.y < c - 1 ? 'above' : 'below'}
                people={who.people}
                unknown={who.unknown}
                index={i}
                textColor={textColor}
              />
            ))}
          </div>
        ) : null}

        <div className="absolute right-2 top-2">
          <ElementEllipsisMenu label="Quiz options" color={textColor}>
            {(close) => {
              const row = (text: string, fn?: () => void) =>
                fn ? (
                  <ElementMenuItem
                    onPress={() => {
                      fn();
                      close();
                    }}
                  >
                    {text}
                  </ElementMenuItem>
                ) : null;
              return (
                <>
                  {canEdit ? row('Edit Question…', () => setEditing(true)) : null}
                  {phase === 'ready' ? row('Start', actions.start) : null}
                  {phase === 'open' ? row('Lock Now', actions.lock) : null}
                  {phase === 'open' || phase === 'locked'
                    ? row('Reveal Answer', actions.reveal)
                    : null}
                  {phase === 'open' || phase === 'locked' || phase === 'revealed'
                    ? row('Reset', actions.reset)
                    : null}
                  {onOpenSettings ? (
                    <ElementMenuSettingsRow
                      onOpen={() => {
                        onOpenSettings();
                        close();
                      }}
                    />
                  ) : null}
                </>
              );
            }}
          </ElementEllipsisMenu>
        </div>
      </div>
      {editing && actions.save ? (
        <QuizEditDialog
          element={element}
          open
          onClose={() => setEditing(false)}
          onSave={actions.save}
        />
      ) : null}
    </div>
  );
}
