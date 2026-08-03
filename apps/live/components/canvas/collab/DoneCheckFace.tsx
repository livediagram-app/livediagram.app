'use client';

import { allDone, doneSplit, isDone, type ShapeElement } from '@livediagram/diagram';

import type { Participant } from '@/lib/identity';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
import { CollabButton, CollabEmpty, CollabPanel } from './collab-chrome';
import { ElementEllipsisMenu, ElementMenuItem } from '@/components/canvas/ElementEllipsisMenu';

// The face of a Done check (spec/137): everyone marks themselves finished, and
// the card shows who has and who has not.
//
// Built on the shared per-participant `responses` field (spec/122), the same
// primitive under the estimate card and the temperature check, with one fixed
// value — being done is a flag, not a scale. Pressing again withdraws it, so
// nobody is stuck marked finished on a card they misread.
//
// The waiting-on list is LIVE: it comes from who is in the room now, not from
// everyone who was ever in it. A card that waited on somebody who closed their
// tab would never complete, and completing is the entire point.

function Roster({
  title,
  ids,
  participants,
  textColor,
  muted,
}: {
  title: string;
  ids: string[];
  participants: Participant[];
  textColor: string;
  // The waiting side is drawn back, so a glance lands on who is DONE.
  muted?: boolean;
}) {
  if (ids.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.06em] opacity-55"
        style={{ color: textColor }}
      >
        {title} · {ids.length}
      </span>
      {/* gap-3 clears the presence RING, which is a box-shadow outside each
          avatar's layout box and eats 4px of any gap beside it. */}
      <div className={`flex flex-wrap items-center gap-3 ${muted ? 'opacity-45' : ''}`}>
        {ids.map((id) => {
          const who = participants.find((p) => p.id === id);
          return who ? (
            <ParticipantAvatar key={id} participant={who} size={22} withTooltip />
          ) : null;
        })}
      </div>
    </div>
  );
}

export function DoneCheckFace({
  element,
  label,
  textColor,
  selfId,
  participants,
  onToggleMine,
  onResetAll,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  selfId: string;
  // The room. Includes ourselves, and is what the waiting list is derived from.
  participants: Participant[];
  // Mark or unmark MYSELF. One handler for both: `respond` already withdraws
  // when you send the value you already sent (spec/122), so there is no
  // separate un-mark path to keep in step.
  onToggleMine?: () => void;
  // Clear everyone, for the next round. Absent on a surface that can't write,
  // which renders the card readable but inert.
  onResetAll?: () => void;
}) {
  const ids = participants.map((p) => p.id);
  const { done, waiting } = doneSplit(element.responses, ids);
  const mine = isDone(element.responses, selfId);
  const everyone = allDone(element.responses, ids);

  return (
    <CollabPanel
      element={element}
      title={label.trim() || 'Everyone done?'}
      textColor={textColor}
      aside={ids.length ? `${done.length}/${ids.length}` : undefined}
      // The flash is the card's whole payoff: the facilitator does not have to
      // watch it, the board tells them. Driven by a class rather than inline
      // styles so the reduced-motion override in globals.css can reach it.
      className={everyone ? 'lvd-done-complete' : undefined}
      headerExtra={
        // The shared element menu (spec/105), not a second one: it was written
        // here first, and the Timer needed the same thing.
        <ElementEllipsisMenu label="Done check options" color={textColor}>
          {(close) => (
            <>
              {mine && onToggleMine ? (
                <ElementMenuItem
                  onPress={() => {
                    onToggleMine();
                    close();
                  }}
                >
                  Clear my mark
                </ElementMenuItem>
              ) : null}
              {onResetAll ? (
                <ElementMenuItem
                  onPress={() => {
                    onResetAll();
                    close();
                  }}
                >
                  Reset everyone
                </ElementMenuItem>
              ) : null}
            </>
          )}
        </ElementEllipsisMenu>
      }
      footer={
        <CollabButton
          tone={mine ? 'quiet' : 'loud'}
          textColor={textColor}
          onPress={onToggleMine}
          tooltip={{
            title: mine ? "Say you're not done after all" : 'Mark yourself done',
            description: mine
              ? 'Takes your mark off. Nobody is stuck finished on a card they misread.'
              : 'Adds you to the done list. Everyone in the room sees it straight away.',
          }}
        >
          {mine ? "I'm not done" : "I'm done"}
        </CollabButton>
      }
    >
      {ids.length === 0 ? (
        <CollabEmpty textColor={textColor}>
          Nobody is in the room yet. Share the diagram and the card fills itself in.
        </CollabEmpty>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
          {everyone ? (
            <p className="text-[13px] font-semibold" style={{ color: textColor }}>
              Everyone&apos;s done.
            </p>
          ) : null}
          <Roster title="Done" ids={done} participants={participants} textColor={textColor} />
          <Roster
            title="Waiting on"
            ids={waiting}
            participants={participants}
            textColor={textColor}
            muted
          />
        </div>
      )}
    </CollabPanel>
  );
}
