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
import { PICKER_SPIN_MS, spinReel } from '@/lib/picker';

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
  candidates: string[];
  textColor: string;
  // Rolls and returns the result to show; absent on a surface that can't roll.
  onRoll?: () => string | null;
}) {
  // The frame currently on the reel, or null when standing still.
  const [spinning, setSpinning] = useState<string | null>(null);
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
    // Frames are evenly spaced across the spin and land on the result, so the
    // last thing the eye sees is the answer.
    const reel = spinReel(candidates, landed);
    const step = PICKER_SPIN_MS / Math.max(1, reel.length);
    reel.forEach((name, i) => {
      const id = window.setTimeout(
        () => setSpinning(i === reel.length - 1 ? null : name),
        step * i,
      );
      timers.current.push(id);
    });
  };
  const press = usePressWithoutDrag(roll);

  const empty = candidates.length === 0;
  const shown = spinning ?? result ?? (empty ? 'Nothing to pick from' : '—');

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
      <span
        // The result is the content, so it gets the room. `line-clamp-2` keeps
        // a long option from pushing the button out of the card.
        className={`line-clamp-2 text-center text-[17px] font-semibold leading-tight transition-opacity ${
          spinning ? 'opacity-70' : 'opacity-100'
        } ${empty && !spinning ? 'text-[13px] font-normal opacity-60' : ''}`}
        style={{ color: textColor }}
        aria-live="polite"
      >
        {shown}
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
