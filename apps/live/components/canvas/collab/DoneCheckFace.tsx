'use client';

import { allDone, doneSplit, isDone, type ShapeElement } from '@livediagram/document';

import { participantKey, type Participant } from '@/lib/identity';
import { CollabPanel } from './collab-chrome';
import { CollabAccentScope } from './collab-accent';
import { DoneButton } from './done/DoneButton';
import { DoneRing } from './done/DoneRing';
import { DoneRoster } from './done/DoneRoster';
import { EmptyRows } from './qa/qa-parts';
import {
  ElementEllipsisMenu,
  ElementMenuItem,
  ElementMenuSettingsRow,
} from '@/components/canvas/ElementEllipsisMenu';

// The face of a Done check (docs/specs/012-collaboration/done-check.md): everyone marks themselves finished, and
// the card shows who has and who has not.
//
// Built on the shared per-participant `responses` field (docs/specs/012-collaboration/participant-responses.md), the same
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
// for everyone else (docs/specs/015-api/public-api-and-tokens.md §6), so it cannot match what was saved: keyed on
// it, this card showed every viewer their own mark and nobody else's.

export function DoneCheckFace({
  element,
  label,
  textColor,
  surface,
  selfKey,
  participants,
  onToggleMine,
  onResetAll,
  onOpenSettings,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  // The card's own fill, for the accent scope.
  surface: string;
  // How WE are recorded on this card — see CollabApi.selfKey.
  selfKey: string;
  // The room. Includes ourselves, and is what the waiting list is derived from.
  participants: Participant[];
  // Mark or unmark MYSELF. One handler for both: `respond` already withdraws
  // when you send the value you already sent (docs/specs/012-collaboration/participant-responses.md), so there is no
  // separate un-mark path to keep in step.
  onToggleMine?: () => void;
  // Clear everyone, for the next round. Absent on a surface that can't write,
  // which renders the card readable but inert.
  onResetAll?: () => void;
  /** The way out of the round controls to the element's full menu (docs/specs/008-canvas/canvas-and-palette.md). */
  onOpenSettings?: () => void;
}) {
  const keys = participants.map(participantKey);
  const { done, waiting } = doneSplit(element.responses, keys);
  const mine = isDone(element.responses, selfKey);
  const everyone = allDone(element.responses, keys);

  return (
    <CollabAccentScope element={element} textColor={textColor} surface={surface}>
      <CollabPanel
        element={element}
        title={label.trim() || 'Everyone done?'}
        textColor={textColor}
        aside={keys.length ? `${done.length}/${keys.length}` : undefined}
        // The flash is the card's payoff: the facilitator does not have to
        // watch it, the canvas tells them. A class rather than inline styles so
        // the reduced-motion override in canvas-motion.css can reach it.
        className={everyone ? 'lvd-done-complete' : undefined}
        headerExtra={
          <ElementEllipsisMenu label="Done check options" color={textColor} align="left">
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
          keys.length ? (
            <DoneButton mine={mine} textColor={textColor} onToggle={onToggleMine} />
          ) : undefined
        }
      >
        {keys.length === 0 ? (
          <EmptyRows textColor={textColor} title="Nobody here yet" rows={0}>
            Share the document and the card fills itself in.
          </EmptyRows>
        ) : (
          <div className="flex min-h-0 flex-1 items-center gap-4">
            <DoneRing done={done.length} total={keys.length} textColor={textColor} />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              {everyone ? (
                <p className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">
                  Everyone&apos;s done!
                </p>
              ) : null}
              <DoneRoster
                title="Done"
                keys={done}
                participants={participants}
                textColor={textColor}
              />
              <DoneRoster
                title="Waiting"
                keys={waiting}
                participants={participants}
                textColor={textColor}
                waiting
              />
            </div>
          </div>
        )}
      </CollabPanel>
    </CollabAccentScope>
  );
}
