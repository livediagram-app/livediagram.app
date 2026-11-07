'use client';

// Connect File in a start screen's sidebar (liveworkspace/docs/specs/004-index/connected-tabs.md
// "Connecting"): the last entry, pinned to the very bottom of the rail under a hairline, apart from the categories
// (it brings a file from another app, not a way to start this one). On a phone, where the rail is a row of chips, it is
// the last chip. Drawn like a rail row, in the start panel's own colours, on one line: every app's logo fanned where a row's
// icon goes, to say where the files come from (the host's too: its other files connect as well), then its name.
import type { CSSProperties } from 'react';
import { BrandMark } from '@liveworkspace/brand';
import type { App } from '@liveworkspace/index-client';

// Every app's logo in the row's icon slot, in the same order in every app.
const FAN: readonly App[] = [
  'livediagram',
  'liveplanner',
  'livedocuments',
  'livedesign',
  'livehuddle',
];

export const CONNECT_RAIL_ID = 'connect';
// The entry's name, the owner's words (Work Tracker #569): short enough for one line in a 240px rail.
export const CONNECT_RAIL_NAME = 'Connect File';

export type ConnectRailColours = {
  // The rail's ink and hairline, and the panel's paper behind the pinned row.
  text: string;
  border: string;
  card: string;
  // The chosen row's ink and tint, and the hover tints, as the panel's other rows have them.
  chosenText: string;
  chosenTint: string;
  hoverTint: string;
  chosenHoverTint: string;
};

export function ConnectRailEntry({
  on,
  onPick,
  colours,
}: {
  on: boolean;
  onPick: () => void;
  colours: ConnectRailColours;
}) {
  return (
    // Desktop: stuck to the rail's bottom whatever the categories' length, over the panel's paper, and flush with it
    // (-bottom-4 undoes the rail's p-4, which a sticky bottom otherwise leaves for scrolled rows to show through).
    // Phone: one more chip.
    <div
      className="contents sm:sticky sm:-bottom-4 sm:-mx-4 sm:-mb-4 sm:mt-auto sm:block sm:border-t sm:px-4 sm:pb-4 sm:pt-3"
      style={{ borderColor: colours.border, backgroundColor: colours.card }}
    >
      <button
        type="button"
        data-rail={CONNECT_RAIL_ID}
        aria-current={on ? 'true' : undefined}
        onClick={onPick}
        className="flex w-full shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium outline-none transition duration-micro hover:bg-[var(--start-hover)] focus-visible:ring-2 focus-visible:ring-[var(--start-accent)] motion-reduce:transition-none max-sm:w-auto"
        style={
          {
            backgroundColor: on ? colours.chosenTint : undefined,
            color: on ? colours.chosenText : colours.text,
            '--start-hover': on ? colours.chosenHoverTint : colours.hoverTint,
          } as CSSProperties
        }
      >
        {/* The logos stand where a row's icon goes, each on a disc of the panel's paper: barely overlapping in the
            desktop rail, which has room, and fanned tighter in a phone's chip. */}
        <span aria-hidden className="flex shrink-0 items-center">
          {FAN.map((app, i) => (
            <span
              key={app}
              className={`flex size-[18px] items-center justify-center rounded-full ring-2 ${i === 0 ? '' : '-ml-1.5 sm:-ml-0.5'}`}
              style={
                {
                  backgroundColor: colours.card,
                  '--tw-ring-color': colours.card,
                  zIndex: FAN.length - i,
                } as CSSProperties
              }
            >
              <BrandMark app={app} className="size-3" />
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1 truncate leading-snug">{CONNECT_RAIL_NAME}</span>
      </button>
    </div>
  );
}
