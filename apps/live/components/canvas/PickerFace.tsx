// The face of a Picker (spec/107): the current choice, large, with a button
// that rolls a new one.
//
// The spin is local theatre over a result that was already decided when the
// button was pressed (see rollPicker) — flicking through names for ~a second
// and landing on the answer. Everyone lands on the same answer because the
// PRESSER writes it to the element.
//
// THE ROOM WATCHES THE SAME SPIN. Peers used to get only the landing: the new
// name simply appeared, which is the one moment a picker has and the only
// reason to use one over saying a name out loud. So a result arriving from
// anywhere BUT our own roll replays the reel locally, landing on what the
// element now says. Nothing extra goes over the wire — the element update the
// presser was already sending is the cue, so the animation costs no op, no
// ordering and nothing to persist. Every client runs its own reel from its own
// candidate list, and they all end on the written result.
//
// A view-role visitor still gets to roll and watch it; it simply isn't written
// back, which is why `shared` exists — see below.

import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '@/components/primitives/Tooltip';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { spinFrameDelays, spinReel, type PickerCandidate } from '@/lib/picker';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
import { ReelWindow } from '@/components/canvas/paper-kit';

export function PickerFace({
  label,
  result,
  candidates,
  textColor,
  shared = false,
  onRoll,
}: {
  // The element's own label, shown small above the result ("Who demos?").
  label: string;
  // The last result, from the element — so a reload, or joining late, still
  // shows what the room landed on.
  result: string | undefined;
  // What a roll can land on right now, resolved by the caller (presence for
  // the participants source, the written list otherwise).
  candidates: PickerCandidate[];
  textColor: string;
  // Does OUR roll get written to the element (and so reach the room)? False
  // for a view-role visitor, whose roll stays on their own screen. It decides
  // whether the result change our own press causes is ours to skip — without
  // it a visitor's private roll would arm the skip and swallow the next
  // genuine landing from somebody else.
  shared?: boolean;
  // Rolls and returns the result to show; absent on a surface that can't roll.
  onRoll?: () => PickerCandidate | null;
}) {
  // The frame currently on the reel, or null when standing still.
  const [spinning, setSpinning] = useState<PickerCandidate | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const id of pending) window.clearTimeout(id);
    };
  }, []);

  // Run the reel into `landed`. Shared by our own press and by a result
  // arriving from the room, so both watch exactly the same animation.
  const runReel = (landed: PickerCandidate) => {
    // The reel decelerates into the answer (see spinFrameDelays), so it reads
    // as a wheel slowing rather than a list being flicked.
    const reel = spinReel(candidates, landed);
    const delays = spinFrameDelays(reel.length);
    reel.forEach((candidate, i) => {
      const id = window.setTimeout(
        () => setSpinning(i === reel.length - 1 ? null : candidate),
        delays[i] ?? 0,
      );
      timers.current.push(id);
    });
  };

  // What our own last written roll landed on, so the effect below can tell our
  // press apart from the room's. Never set when `shared` is false: an unwritten
  // roll causes no result change to skip.
  const ourRoll = useRef<string | undefined>(undefined);

  // The last result we have already accounted for — either because we watched
  // it land or because it was on the element when we arrived. Seeded from the
  // first render, so joining a diagram where somebody already rolled shows the
  // answer rather than replaying a spin nobody is waiting for.
  const seenResult = useRef(result);
  useEffect(() => {
    if (result === seenResult.current) return;
    seenResult.current = result;
    // One press writes at most one result change, so the arming is spent here
    // whichever way this goes. Leaving it set would make our OWN old landing
    // silently swallow a peer rolling the same name later on.
    const ours = result !== undefined && result === ourRoll.current;
    ourRoll.current = undefined;
    // Cleared rather than rolled (an undo, a reset): there is no landing to
    // watch, and spinning to nothing would be theatre over an absence.
    if (result === undefined || ours) return;
    // Match the name back to a live person where we can, so a peer's roll
    // spins past avatars here exactly as it did on the presser's screen.
    runReel(candidates.find((c) => c.label === result) ?? { label: result });
    // Keyed on the landing alone: re-running when the candidate list changes
    // (somebody joining the room) would re-spin a result that already landed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const roll = () => {
    if (!onRoll || spinning !== null) return;
    const landed = onRoll();
    if (landed === null) return;
    if (shared) ourRoll.current = landed.label;
    runReel(landed);
  };
  const press = usePressWithoutDrag(roll);

  const empty = candidates.length === 0;
  // Standing still, the shown candidate is the stored result matched back to a
  // live person where we can — so the winner keeps their avatar after a
  // reload, and gracefully loses it once they've left the room.
  const settled: PickerCandidate | null = result
    ? (candidates.find((c) => c.label === result) ?? { label: result })
    : null;
  const shown = spinning ?? settled;
  const shownText = shown?.label ?? (empty ? 'Nothing to pick from' : '—');

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-1 px-3 py-2">
      {/* A REEL BEHIND A WINDOW (spec/122). The names do not sit on a card,
          they pass through an opening: shaded at the lip, clear in the middle,
          so a spin reads as something turning behind the element rather than
          text being swapped out. */}
      <ReelWindow textColor={textColor} />
      {label.trim() ? (
        <span
          className="max-w-full truncate text-[10px] font-medium uppercase tracking-[0.08em] opacity-60"
          style={{ color: textColor }}
        >
          {label.trim()}
        </span>
      ) : null}
      <span className="flex min-w-0 items-center gap-2" aria-live="polite">
        {/* A person spins past as themselves — their colour and initials — so
            the reel reads as the room rather than as a list of strings. */}
        {shown?.participant ? (
          <ParticipantAvatar participant={shown.participant} size={26} />
        ) : null}
        <span
          // The result is the content, so it gets the room. `line-clamp-2`
          // keeps a long option from pushing the button out of the card.
          className={`line-clamp-2 text-center text-[17px] font-semibold leading-tight transition-opacity ${
            spinning ? 'opacity-80' : 'opacity-100'
          } ${empty && !spinning ? 'text-[13px] font-normal opacity-60' : ''}`}
          style={{ color: textColor }}
        >
          {shownText}
        </span>
      </span>
      {onRoll ? (
        <Tooltip
          title={empty ? 'Nothing to pick from' : 'Pick one'}
          description={
            empty
              ? 'Add options from the Picker menu, or switch it to pick from the people in the room.'
              : 'Chooses at random and shows everyone the same answer.'
          }
        >
          <button
            type="button"
            {...press}
            disabled={empty}
            aria-label="Pick at random"
            className="pointer-events-auto mt-0.5 cursor-pointer rounded-full bg-black/[0.06] px-3 py-1 text-[11px] font-semibold transition hover:bg-black/[0.1] disabled:cursor-default disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/15"
            style={{ color: textColor }}
          >
            {spinning ? 'Picking…' : result ? 'Again' : 'Pick'}
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}
