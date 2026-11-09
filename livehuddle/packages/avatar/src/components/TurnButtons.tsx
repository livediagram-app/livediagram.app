'use client';

import type { ReactNode } from 'react';
import { lucideRotateCcw, lucideRotateCw } from '@liveworkspace/icons/lucide';
import { HoverCard, lucideGlyph } from '@liveworkspace/ui';

// The Rotate Left and Rotate Right buttons of the selection toolbars (livehuddle's
// docs/specs/009-elements/furniture-facing.md "Turning a placed piece"): a quarter turn anticlockwise or clockwise of
// every piece of furniture in the selection. Always the same pair, in the same place, for a piece that turns; shown
// disabled on a locked one, so the place never moves under the pointer.

// An arrow round anticlockwise for Rotate Left, clockwise for Rotate Right.
const RotateLeftIcon = lucideGlyph(lucideRotateCcw, 16);
const RotateRightIcon = lucideGlyph(lucideRotateCw, 16);

// The single selection's toolbar has 32px buttons, the multi-selection's 28px (toolbar-buttons.ts).
const SIZE = { regular: 'h-8 w-8', compact: 'h-7 w-7' } as const;
const BUTTON =
  'flex items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
const DISABLED = 'flex items-center justify-center rounded-md text-slate-300 dark:text-slate-600';

export function TurnButtons({
  onTurn,
  locked = false,
  plural = false,
  size = 'regular',
}: {
  // +1 a quarter turn clockwise (Rotate Right), -1 anticlockwise (Rotate Left).
  onTurn: (quarters: 1 | -1) => void;
  locked?: boolean;
  // Several pieces selected: each turns about its own centre.
  plural?: boolean;
  size?: keyof typeof SIZE;
}) {
  const what = plural ? 'these pieces' : 'this piece';
  const button = (quarters: 1 | -1, label: string, way: string, icon: ReactNode) => (
    <HoverCard
      title={label}
      description={locked ? 'Locked. Unlock it to turn.' : `Turn ${what} a quarter turn ${way}.`}
    >
      <button
        type="button"
        onClick={() => onTurn(quarters)}
        disabled={locked}
        aria-label={label}
        className={`${locked ? DISABLED : BUTTON} ${SIZE[size]}`}
      >
        {icon}
      </button>
    </HoverCard>
  );
  return (
    <>
      {button(-1, 'Rotate Left', 'anticlockwise', <RotateLeftIcon />)}
      {button(1, 'Rotate Right', 'clockwise', <RotateRightIcon />)}
    </>
  );
}
