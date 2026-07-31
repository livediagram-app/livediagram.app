'use client';

import {
  DECISION_STATUS_COLORS,
  DECISION_STATUS_LABELS,
  DEFAULT_DECISION_STATUS,
  type ShapeElement,
} from '@livediagram/diagram';

// A decision record (spec/128): a status chip, the drivers, and the date drawn
// AROUND the element's ordinary label — which is the decision statement, so it
// edits, formats and exports like every other label. Same shape as the record
// box (spec/120), which draws its rows under its title the same way.

export function DecisionView({
  element,
  textColor,
  fontFamily,
}: {
  element: ShapeElement;
  textColor: string;
  fontFamily: string | undefined;
}) {
  const status = element.decisionStatus ?? DEFAULT_DECISION_STATUS;
  const chip = DECISION_STATUS_COLORS[status];
  const drivers = element.decisionDrivers ?? [];

  return (
    // Inert: nothing here is a control. The status, date and drivers are all
    // set from the context menu.
    <div
      className="pointer-events-none absolute inset-0 flex flex-col overflow-hidden rounded-[inherit]"
      style={{ fontFamily }}
    >
      {/* The chip floats top-right, clear of the statement. It tints ITSELF
          and never the element's fill — the theme owns the box, and a card
          that turned green on accept would fight every other element on a
          themed board (spec/128). */}
      <span
        className="absolute right-2 top-2 rounded-full px-1.5 py-[2px] text-[9px] font-semibold uppercase tracking-[0.06em]"
        style={{ backgroundColor: chip.bg, color: chip.text }}
      >
        {DECISION_STATUS_LABELS[status]}
      </span>
      {/* Reserves the band the label writes into, so the drivers start below
          the statement rather than under it. */}
      <div className="shrink-0" style={{ height: 58 }} />
      <div className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-hidden px-2.5">
        {drivers.map((driver, i) => (
          <span
            key={`${i}-${driver.slice(0, 12)}`}
            className="flex gap-1.5 truncate text-[10px] leading-snug opacity-70"
            style={{ color: textColor }}
          >
            <span aria-hidden>•</span>
            <span className="truncate">{driver}</span>
          </span>
        ))}
      </div>
      {/* An undated decision shows nothing at all: a card reading "no date" is
          noise, and mid-discussion cards are commonly undated (spec/128). */}
      {element.decisionDate ? (
        <span
          className="shrink-0 px-2.5 pb-1.5 text-[10px] tabular-nums opacity-50"
          style={{ color: textColor }}
        >
          {element.decisionDate}
        </span>
      ) : null}
    </div>
  );
}
