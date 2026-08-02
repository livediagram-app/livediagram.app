'use client';

import { useEffect, useRef, useState } from 'react';

import { allDone, doneSplit, isDone, type ShapeElement } from '@livediagram/diagram';

import type { Participant } from '@/lib/identity';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
import { CollabButton, CollabEmpty, CollabPanel, tint } from './collab-chrome';

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

// The card's ellipsis menu. Inline rather than a portal: the card is already a
// pointer-active surface, and a portalled menu would have to track a canvas
// element through pan, zoom and the isometric transform to sit beside it.
function DoneMenu({
  textColor,
  onResetAll,
  onClearMine,
  canClearMine,
}: {
  textColor: string;
  onResetAll?: () => void;
  onClearMine?: () => void;
  canClearMine: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    // Capture phase: the canvas swallows pointerdown on its own surface, so a
    // bubbling listener never hears the click that should dismiss this.
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [open]);

  if (!onResetAll && !onClearMine) return null;

  return (
    <div ref={box} className="pointer-events-auto relative">
      <button
        type="button"
        aria-label="Done check options"
        aria-expanded={open}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[13px] leading-none transition hover:bg-black/10 dark:hover:bg-white/10"
        style={{ color: textColor }}
      >
        …
      </button>
      {open ? (
        <div
          className="absolute right-0 top-6 z-20 min-w-[9.5rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          role="menu"
        >
          {canClearMine && onClearMine ? (
            <button
              type="button"
              role="menuitem"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onClearMine();
                setOpen(false);
              }}
              className="block w-full cursor-pointer px-3 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Clear my mark
            </button>
          ) : null}
          {onResetAll ? (
            <button
              type="button"
              role="menuitem"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onResetAll();
                setOpen(false);
              }}
              className="block w-full cursor-pointer px-3 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Reset everyone
            </button>
          ) : null}
        </div>
      ) : null}
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
        <DoneMenu
          textColor={textColor}
          canClearMine={mine}
          onClearMine={mine ? onToggleMine : undefined}
          onResetAll={onResetAll}
        />
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
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
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
          {/* A hairline under the rosters, tinted from the card's own text
              colour so a recoloured card keeps it in the family. */}
          <span
            className="h-px w-full shrink-0"
            style={{ backgroundColor: tint(textColor, 0.12) }}
            aria-hidden
          />
        </div>
      )}
    </CollabPanel>
  );
}
