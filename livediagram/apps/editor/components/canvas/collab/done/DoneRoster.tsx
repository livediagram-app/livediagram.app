// One side of the Done check's room (docs/specs/012-collaboration/done-check.md "Reading the card"): the label
// with its count as a badge, and the avatars. Done wears a small green check on
// each avatar at full strength; Waiting is drawn back and breathes, so a glance
// lands on who is finished.

import { participantKey, type Participant } from '@/lib/identity';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
import { tint } from '../collab-chrome';
import { CheckGlyph } from '../qa/qa-parts';

export function DoneRoster({
  title,
  keys,
  participants,
  textColor,
  waiting,
}: {
  title: string;
  // Document-write keys (see participantKey), matched back to the room.
  keys: string[];
  participants: Participant[];
  textColor: string;
  waiting?: boolean;
}) {
  if (keys.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-center gap-1.5">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.06em] opacity-60"
          style={{ color: textColor }}
        >
          {title}
        </span>
        <span
          className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums"
          style={{ color: textColor, backgroundColor: tint(textColor, 0.1) }}
        >
          <span className="text-optical-centre">{keys.length}</span>
        </span>
      </span>
      {/* gap-3 clears the presence RING, which is a box-shadow outside each
          avatar's layout box and eats 4px of any gap beside it. */}
      <div className={`flex flex-wrap items-center gap-3 ${waiting ? 'qa-ghost' : ''}`}>
        {keys.map((key) => {
          const who = participants.find((p) => participantKey(p) === key);
          if (!who) return null;
          return (
            <span key={key} className="relative inline-flex">
              <ParticipantAvatar participant={who} size={22} withHoverCard />
              {waiting ? null : (
                <span
                  aria-hidden
                  className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2"
                  style={{ ['--tw-ring-color' as string]: 'var(--qa-card)' }}
                >
                  <CheckGlyph size={9} />
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
