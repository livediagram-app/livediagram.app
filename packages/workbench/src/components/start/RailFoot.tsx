'use client';

// The foot of a start screen's rail (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting"): the group
// pinned to the rail's very bottom under a hairline, apart from the categories, and the row each of its entries is
// drawn as. Connect File is its first entry in every app (ConnectRailEntry); an app may add its own after it
// (liveplanner's Import). On a phone, where the rail is a row of chips, the group dissolves and each entry is one more
// chip, in order.
import type { CSSProperties, ReactNode } from 'react';

export type RailFootColours = {
  // The rail's ink and hairline, and the panel's paper behind the pinned group.
  text: string;
  border: string;
  card: string;
  // The chosen row's ink and tint, and the hover tints, as the panel's other rows have them.
  chosenText: string;
  chosenTint: string;
  hoverTint: string;
  chosenHoverTint: string;
};

export function RailFoot({ colours, children }: { colours: RailFootColours; children: ReactNode }) {
  return (
    // Desktop: stuck to the rail's bottom whatever the categories' length, over the panel's paper, and flush with it
    // (-bottom-4 undoes the rail's p-4, which a sticky bottom otherwise leaves for scrolled rows to show through).
    // Phone: its entries are chips.
    <div
      className="contents sm:sticky sm:-bottom-4 sm:-mx-4 sm:-mb-4 sm:mt-auto sm:block sm:border-t sm:px-4 sm:pb-4 sm:pt-3"
      style={{ borderColor: colours.border, backgroundColor: colours.card }}
    >
      {children}
    </div>
  );
}

export function RailFootButton({
  railId,
  on = false,
  onPick,
  colours,
  icon,
  name,
  opensDialog = false,
  className = '',
}: {
  // Its `data-rail`, as a category's row has its id.
  railId: string;
  // Chosen: what it shows stands in the grid's place. An entry that opens a dialog is never chosen.
  on?: boolean;
  onPick: () => void;
  colours: RailFootColours;
  // What stands where a row's glyph goes.
  icon: ReactNode;
  name: string;
  // It opens a dialog rather than showing something in the grid.
  opensDialog?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-rail={railId}
      aria-current={on ? 'true' : undefined}
      aria-haspopup={opensDialog ? 'dialog' : undefined}
      onClick={onPick}
      className={`flex w-full shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium outline-none transition duration-micro hover:bg-[var(--start-hover)] focus-visible:ring-2 focus-visible:ring-[var(--start-accent)] motion-reduce:transition-none max-sm:w-auto${className ? ` ${className}` : ''}`}
      style={
        {
          backgroundColor: on ? colours.chosenTint : undefined,
          color: on ? colours.chosenText : colours.text,
          '--start-hover': on ? colours.chosenHoverTint : colours.hoverTint,
        } as CSSProperties
      }
    >
      {icon}
      <span className="min-w-0 flex-1 truncate leading-snug">{name}</span>
    </button>
  );
}
