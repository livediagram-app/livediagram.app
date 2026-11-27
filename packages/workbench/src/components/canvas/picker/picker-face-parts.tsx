'use client';

// The Picker face's controls and labels (docs/specs/012-collaboration/picker.md "The look"): the Spin pill,
// the Reset button and the names already drawn. Coloured from the face's
// CSS variables (--picker-accent and friends, set by PickerFace), never fixed colours, so they follow
// the tab theme in light and dark.

import { Tooltip } from '@liveworkspace/ui';
import { usePressWithoutDrag } from '../../../hooks/ui/usePressWithoutDrag';

function ShuffleGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-[1.1em] w-[1.1em] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" />
      <path d="m18 2 4 4-4 4" />
      <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
      <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
      <path d="m18 14 4 4-4 4" />
    </svg>
  );
}

function ResetGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

// The one big control: an accent pill. "Spin", "Spin Again" once there is a result, "Spinning…"
// while it turns. Disabled with nothing left to pick from.
export function SpinButton({
  spinning,
  hasResult,
  disabled,
  onSpin,
}: {
  spinning: boolean;
  hasResult: boolean;
  disabled: boolean;
  onSpin: () => void;
}) {
  const press = usePressWithoutDrag(onSpin);
  return (
    <button
      type="button"
      {...press}
      disabled={disabled || spinning}
      aria-label={spinning ? 'Spinning' : 'Pick at random'}
      className="picker-spin pointer-events-auto inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 disabled:cursor-default disabled:opacity-60 disabled:hover:brightness-100 disabled:active:scale-100"
      style={{
        backgroundColor: 'var(--picker-accent)',
        color: 'var(--picker-on-accent)',
        outlineColor: 'var(--picker-accent)',
      }}
    >
      <ShuffleGlyph />
      <span className="text-optical-line">
        {spinning ? 'Spinning…' : hasResult ? 'Spin Again' : 'Spin'}
      </span>
    </button>
  );
}

// Puts every drawn name back. As a pill when the round is over (it is the only thing to do), as a
// quiet round button beside Spin otherwise.
export function ResetButton({ onReset, prominent }: { onReset: () => void; prominent: boolean }) {
  const press = usePressWithoutDrag(onReset);
  if (prominent) {
    return (
      <button
        type="button"
        {...press}
        aria-label="Reset the draw"
        className="pointer-events-auto inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95"
        style={{
          backgroundColor: 'var(--picker-accent)',
          color: 'var(--picker-on-accent)',
          outlineColor: 'var(--picker-accent)',
        }}
      >
        <ResetGlyph />
        <span className="text-optical-line">Reset</span>
      </button>
    );
  }
  return (
    <Tooltip label="Reset the draw">
      <button
        type="button"
        {...press}
        aria-label="Reset the draw"
        className="pointer-events-auto inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition hover:bg-[var(--picker-wash-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-90"
        style={{
          color: 'var(--picker-ink)',
          backgroundColor: 'var(--picker-wash)',
          outlineColor: 'var(--picker-accent)',
        }}
      >
        <ResetGlyph />
      </button>
    </Tooltip>
  );
}

// Names already drawn this round, struck through, so the room can see who has had a turn. A long
// list folds into "+N more" rather than wrapping off the card.
const DRAWN_SHOWN = 6;
export function DrawnNames({ names }: { names: readonly string[] }) {
  const shown = names.slice(-DRAWN_SHOWN);
  const more = names.length - shown.length;
  return (
    <ul
      aria-label="Already drawn"
      className="flex max-w-full flex-wrap justify-center gap-1 overflow-hidden px-1"
      style={{ maxHeight: 44 }}
    >
      {more > 0 ? (
        <li
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ color: 'var(--picker-muted)', backgroundColor: 'var(--picker-wash)' }}
        >
          +{more} more
        </li>
      ) : null}
      {shown.map((name) => (
        <li
          key={name}
          className="max-w-[9rem] truncate rounded-full px-2 py-0.5 text-[10px] font-medium line-through"
          style={{ color: 'var(--picker-muted)', backgroundColor: 'var(--picker-wash)' }}
        >
          {name}
        </li>
      ))}
    </ul>
  );
}
