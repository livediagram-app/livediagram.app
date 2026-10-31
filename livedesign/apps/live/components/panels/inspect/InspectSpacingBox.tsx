'use client';

import { inspectNumber, type InspectSide } from '@livedesign/design';
import { HoverCard } from '@livedesign/ui';
import { kindLabel } from '@/lib/element-names';
import type { InspectLine } from '@/lib/inspect-target';

const SIDES: readonly InspectSide[] = ['top', 'right', 'bottom', 'left'];
const SIDE_NAME: Record<InspectSide, string> = {
  top: 'Top',
  right: 'Right',
  bottom: 'Bottom',
  left: 'Left',
};
// Where each side's value sits round the element in the diagram.
const SIDE_PLACE: Record<InspectSide, string> = {
  top: 'col-start-2 row-start-1',
  right: 'col-start-3 row-start-2',
  bottom: 'col-start-2 row-start-3',
  left: 'col-start-1 row-start-2',
};

// The selected element's spacing to its neighbours (docs/specs/007-editor/wireframe-pages.md "The Inspect panel"),
// drawn as the box it measures from with a value on each side, as the canvas's lines read: what each is measured
// to on hover, a press to copy it. A side with nothing to measure to reads a dash.
export function InspectSpacingBox({
  lines,
  copied,
  onCopy,
}: {
  lines: readonly InspectLine[];
  copied: string | null;
  onCopy: (side: InspectSide, value: string) => void;
}) {
  return (
    <div
      className="grid grid-cols-[1fr_auto_1fr] grid-rows-[auto_auto_auto] items-center justify-items-center gap-1 rounded-lg bg-slate-50 px-2 py-2 dark:bg-slate-800/60"
      data-inspect-spacing=""
    >
      <span
        aria-hidden
        className="col-start-2 row-start-2 flex h-8 w-16 items-center justify-center rounded border-2 border-brand-500 bg-white text-[10px] font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400"
      >
        Element
      </span>
      {SIDES.map((side) => {
        const line = lines.find((l) => l.side === side);
        if (!line) {
          return (
            <span
              key={side}
              aria-label={`${SIDE_NAME[side]}: nothing to measure to`}
              className={`${SIDE_PLACE[side]} px-2 py-1 font-mono text-xs text-slate-400 dark:text-slate-500`}
            >
              –
            </span>
          );
        }
        const value = String(inspectNumber(line.distance));
        const to = line.toElement ? kindLabel(line.toElement) : 'Screen';
        const isCopied = copied === `spacing:${side}`;
        return (
          <HoverCard
            key={side}
            className={SIDE_PLACE[side]}
            title={`${SIDE_NAME[side]}: ${value}`}
            description={`To the ${line.toElement ? to.toLowerCase() : 'screen’s edge'}. Press to copy.`}
          >
            <button
              type="button"
              onClick={() => onCopy(side, value)}
              aria-label={`${SIDE_NAME[side]}: ${value}, to ${to}. Copy`}
              className={`min-w-9 cursor-pointer rounded-md px-2 py-1 font-mono text-xs font-semibold tabular-nums transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
                isCopied
                  ? 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-100'
                  : 'text-[#c93c40] hover:bg-white dark:text-[#ff8d8f] dark:hover:bg-slate-900'
              }`}
            >
              {isCopied ? 'Copied' : value}
            </button>
          </HoverCard>
        );
      })}
    </div>
  );
}
