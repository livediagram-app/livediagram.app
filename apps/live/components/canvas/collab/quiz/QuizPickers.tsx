'use client';

import type { Participant } from '@/lib/identity';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
import { tint } from '@/lib/element-tint';

// Who picked one answer, shown beside it once the Quiz is revealed
// (docs/specs/012-collaboration/quiz.md). On the OUTSIDE of the answer, away
// from the disc: above an answer in the top half of the ring, below the rest,
// so a row never runs into the circle or into the answer next to it.
//
// A sibling of the answer rather than a child, because the answer is a
// <button> and an avatar with a hover card inside one is invalid markup.

const AVATAR_PX = 20;
// Past this many the rest become "+N", so a big room cannot run a row off the
// edge of the card.
const SHOWN_MAX = 5;

export function QuizPickers({
  people,
  unknown,
  index,
  textColor,
}: {
  // Who picked it, matched to the room.
  people: Participant[];
  // Picks from people no longer in the room: counted, with no face to show.
  unknown: number;
  // The answer's place in the ring, so the rows arrive in the same order the
  // answers fanned out.
  index: number;
  textColor: string;
}) {
  const extra = Math.max(0, people.length - SHOWN_MAX) + unknown;
  if (people.length === 0 && unknown === 0) return null;
  return (
    <div
      className="lvd-quiz-pickers pointer-events-auto flex items-center justify-center gap-2"
      style={
        {
          height: AVATAR_PX,
          '--lvd-quiz-delay': `${250 + index * 60}ms`,
        } as React.CSSProperties
      }
      aria-label={`Picked by ${[...people.map((p) => p.name), ...(unknown ? [`${unknown} who left`] : [])].join(', ')}`}
    >
      {people.slice(0, SHOWN_MAX).map((p) => (
        <ParticipantAvatar key={p.id} participant={p} size={AVATAR_PX} withHoverCard />
      ))}
      {extra > 0 ? (
        <span
          className="flex h-5 items-center rounded-full px-1.5 text-[10px] font-bold tabular-nums"
          style={{ color: textColor, backgroundColor: tint(textColor, 0.12) }}
        >
          <span className="text-optical-centre">+{extra}</span>
        </span>
      ) : null}
    </div>
  );
}
