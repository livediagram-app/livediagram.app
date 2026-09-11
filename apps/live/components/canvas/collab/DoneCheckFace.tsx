'use client';

import { allDone, doneSplit, isDone, type ShapeElement } from '@livediagram/diagram';

import { participantKey, type Participant } from '@/lib/identity';
import { BoardClip, PunchedMargin, RuledLines } from '@/components/canvas/paper-kit';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
import { CollabButton, CollabEmpty, CollabPanel } from './collab-chrome';
import {
  ElementEllipsisMenu,
  ElementMenuItem,
  ElementMenuSettingsRow,
} from '@/components/canvas/ElementEllipsisMenu';

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
//
// Both sides of that join run on `participantKey`, never on `Participant.id`.
// The id is our owner id for ourselves and the room's per-socket presence id
// for everyone else (spec/61 §6), so it cannot match what was saved: keyed on
// it, this card showed every viewer their own mark and nobody else's.

function Roster({
  title,
  keys,
  participants,
  textColor,
  muted,
}: {
  title: string;
  // Document-write keys (see participantKey), matched back to the room below.
  keys: string[];
  participants: Participant[];
  textColor: string;
  // The waiting side is drawn back, so a glance lands on who is DONE.
  muted?: boolean;
}) {
  if (keys.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.06em] opacity-55"
        style={{ color: textColor }}
      >
        {title} · {keys.length}
      </span>
      {/* gap-3 clears the presence RING, which is a box-shadow outside each
          avatar's layout box and eats 4px of any gap beside it. */}
      <div className={`flex flex-wrap items-center gap-3 ${muted ? 'opacity-45' : ''}`}>
        {keys.map((key) => {
          const who = participants.find((p) => participantKey(p) === key);
          return who ? (
            <ParticipantAvatar key={key} participant={who} size={22} withTooltip />
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
  selfKey,
  surface,
  participants,
  onToggleMine,
  onResetAll,
  onOpenSettings,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  // How WE are recorded on this card — see CollabApi.selfKey.
  selfKey: string;
  /** The card's own fill, for the punched holes to show through. */
  surface: string;
  // The room. Includes ourselves, and is what the waiting list is derived from.
  participants: Participant[];
  // Mark or unmark MYSELF. One handler for both: `respond` already withdraws
  // when you send the value you already sent (spec/122), so there is no
  // separate un-mark path to keep in step.
  onToggleMine?: () => void;
  // Clear everyone, for the next round. Absent on a surface that can't write,
  // which renders the card readable but inert.
  onResetAll?: () => void;
  /** The way out of the round controls to the element's full menu (spec/09). */
  onOpenSettings?: () => void;
}) {
  const keys = participants.map(participantKey);
  const { done, waiting } = doneSplit(element.responses, keys);
  const mine = isDone(element.responses, selfKey);
  const everyone = allDone(element.responses, keys);

  return (
    <CollabPanel
      element={element}
      title={label.trim() || 'Everyone done?'}
      textColor={textColor}
      aside={keys.length ? `${done.length}/${keys.length}` : undefined}
      // A CLIPBOARD (spec/122). The card is the sheet: punched down the left,
      // feint-ruled behind the rosters, and held on by the clip overhanging
      // the top edge. A done check is the one thing on the board somebody
      // walks around with, and a clipboard is what they walk around with it on.
      inset={{ left: 12, top: 4 }}
      backdrop={
        <>
          <RuledLines textColor={textColor} gap={17} from={42} />
          <PunchedMargin textColor={textColor} surface={surface} />
        </>
      }
      overlay={<BoardClip textColor={textColor} />}
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
              {onOpenSettings ? (
                <ElementMenuSettingsRow
                  onOpen={() => {
                    onOpenSettings();
                    close();
                  }}
                />
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
      {keys.length === 0 ? (
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
          <Roster title="Done" keys={done} participants={participants} textColor={textColor} />
          <Roster
            title="Waiting on"
            keys={waiting}
            participants={participants}
            textColor={textColor}
            muted
          />
        </div>
      )}
    </CollabPanel>
  );
}
