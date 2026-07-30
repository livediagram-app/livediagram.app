// The face of a Picker (spec/107): the current choice, large, with a button
// that rolls a new one.
//
// The spin is local theatre over a result that was already decided when the
// button was pressed (see rollPicker) — flicking through names for ~a second
// and landing on the answer. Everyone lands on the same answer because the
// PRESSER writes it to the element; peers see the result arrive the way any
// other edit does. A view-role visitor still gets to roll and watch it; it
// simply isn't written back.

import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '@/components/primitives/Tooltip';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { spinFrameDelays, spinReel, type PickerCandidate } from '@/lib/picker';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';

export function PickerFace({
  label,
  result,
  candidates,
  textColor,
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

  const roll = () => {
    if (!onRoll || spinning !== null) return;
    const landed = onRoll();
    if (landed === null) return;
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
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-3 py-2">
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
              ? 'Add options from Tools › Picker, or switch it to pick from the people in the room.'
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
