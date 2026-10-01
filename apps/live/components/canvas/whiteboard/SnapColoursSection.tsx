'use client';

// The Settings flyout's Colours section (docs/specs/023-whiteboard/whiteboard.md "Snap colours"):
// shown only while the board has custom colours to snap, naming how many, with one button that
// snaps them all to stock colours. Afterwards it says what happened, until the flyout closes.

import { useState } from 'react';
import type { SnapColoursApi } from '@/hooks/canvas/useSnapColours';
import { TAB_CUSTOM_COLOURS_MAX } from '@/lib/quick-style-pen';
import { FlyoutHeading } from './WhiteboardFlyout';

const customColours = (n: number) => `${n} custom colour${n === 1 ? '' : 's'}`;

export function SnapColoursSection({ snap }: { snap: SnapColoursApi }) {
  const { colours, blocked } = snap;
  // The last snap: how many colours, and the board's colours as they were when it was pressed.
  const [done, setDone] = useState<{ count: number; from: string[] } | null>(null);
  // The board has custom colours again since the snap (an undo, a peer): offer them afresh.
  if (done && colours.length > 0 && colours !== done.from) setDone(null);
  if (colours.length === 0 && !done) return null;

  const press = () => {
    const count = snap.snap();
    if (count > 0) setDone({ count, from: colours });
  };

  return (
    <div role="group" aria-label="Colours">
      <FlyoutHeading className="mb-1.5">Colours</FlyoutHeading>
      {done ? null : (
        <div className="flex flex-col items-start gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700 dark:text-slate-200">
              {customColours(colours.length)}
            </span>
            <span className="flex gap-1">
              {colours.slice(0, TAB_CUSTOM_COLOURS_MAX).map((hex) => (
                <span
                  key={hex}
                  data-snap-swatch={hex}
                  aria-hidden
                  className="block h-4 w-4 rounded-[4px] border border-black/15 dark:border-white/20"
                  style={{ background: hex }}
                />
              ))}
            </span>
          </div>
          <button
            type="button"
            disabled={blocked}
            onClick={press}
            className="flex h-10 items-center rounded-lg px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-800"
          >
            Snap to stock colours
          </button>
        </div>
      )}
      {/* Present while the offer shows, so the confirmation is announced when it lands. */}
      <p role="status" className="text-sm text-slate-700 dark:text-slate-200">
        {done ? `${customColours(done.count)} snapped to stock colours` : ''}
      </p>
    </div>
  );
}
