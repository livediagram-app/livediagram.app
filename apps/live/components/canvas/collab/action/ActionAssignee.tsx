// Who the action is for (docs/specs/012-collaboration/action-panel.md "The card"): a soft row with the
// assignee's initials in an accent disc, "Assigned to you" or their name, and
// who handed it over, when. Green once the action is done.

import { GlyphDisc } from '@livediagram/ui';
import { initialsOf } from '@/lib/identity';
import { relativeSince, useRelativeNow } from '@/lib/relative-time';
import { tint } from '../collab-chrome';
import { QA_ACCENT, QA_ON_ACCENT } from '../qa/qa-parts';
import { ACTION_DONE } from './action-parts';

export function ActionAssignee({
  name,
  mine,
  assignerName,
  createdAt,
  textColor,
  done,
}: {
  name: string;
  mine: boolean;
  assignerName: string | null;
  createdAt: number;
  textColor: string;
  done: boolean;
}) {
  const now = useRelativeNow();
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-2 py-1.5"
      style={{ backgroundColor: tint(textColor, 0.05) }}
    >
      <GlyphDisc
        size={28}
        aria-hidden
        className="text-[10px] font-bold"
        style={{
          color: done ? '#ffffff' : QA_ON_ACCENT,
          backgroundColor: done ? ACTION_DONE : QA_ACCENT,
        }}
      >
        {initialsOf(name)}
      </GlyphDisc>
      <span className="flex min-w-0 flex-col" style={{ color: textColor }}>
        <span className="truncate text-[11.5px] font-semibold">
          {mine ? 'Assigned to you' : `Assigned to ${name}`}
        </span>
        <span className="truncate text-[10px] opacity-55">
          {assignerName ? `from ${assignerName} · ` : ''}
          {relativeSince(createdAt, now)}
        </span>
      </span>
    </div>
  );
}
