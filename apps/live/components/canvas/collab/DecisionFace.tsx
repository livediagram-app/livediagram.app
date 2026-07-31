// The face of a Decision record (spec/128): the statement, a status chip, the
// drivers, and the date.
//
// A PANEL like the other collaboration faces, not a view drawn around the
// generic label. It started as the latter — the record box (spec/120) renders
// its rows under its title that way — and the difference is that a record's
// title is a name and a decision's is a SENTENCE. A free-flowing label sized
// to the whole box ran straight under the status chip and over the drivers,
// because nothing was constraining it to a band. Owning the layout here means
// the three parts cannot collide by construction.
//
// The label is still the element's ordinary label: typed, formatted and
// exported like any other, and mid-edit this face gives way to the inline
// editor exactly as the other faces do.

import {
  DECISION_STATUS_COLORS,
  DECISION_STATUS_LABELS,
  DEFAULT_DECISION_STATUS,
  type ShapeElement,
} from '@livediagram/diagram';
import { CollabEmpty, CollabPanel } from './collab-chrome';

export function DecisionFace({
  element,
  label,
  textColor,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
}) {
  const status = element.decisionStatus ?? DEFAULT_DECISION_STATUS;
  const chip = DECISION_STATUS_COLORS[status];
  const drivers = element.decisionDrivers ?? [];

  return (
    <CollabPanel
      element={element}
      title={label.trim() || 'We will …'}
      textColor={textColor}
      // Three lines: enough for a real decision statement, bounded so a long
      // one can never squeeze the drivers off the card.
      titleLines={3}
      aside={
        // The chip tints ITSELF and never the element's fill — the theme owns
        // the box, and a card that turned green on accept would fight every
        // other element on a themed board (spec/128).
        <span
          className="rounded-full px-2 py-[3px] text-[9px] font-semibold uppercase tracking-[0.06em]"
          style={{ backgroundColor: chip.bg, color: chip.text }}
        >
          {DECISION_STATUS_LABELS[status]}
        </span>
      }
      footer={
        // An undated decision shows nothing at all: a card reading "no date"
        // is noise, and mid-discussion cards are commonly undated (spec/128).
        element.decisionDate ? (
          <span className="text-[10px] tabular-nums opacity-50" style={{ color: textColor }}>
            {element.decisionDate}
          </span>
        ) : undefined
      }
    >
      {drivers.length === 0 ? (
        <CollabEmpty textColor={textColor}>
          No drivers yet. Add what drove this from the element’s menu.
        </CollabEmpty>
      ) : (
        <ul className="flex flex-col gap-1">
          {drivers.map((driver, i) => (
            <li
              key={`${i}-${driver.slice(0, 12)}`}
              className="flex gap-1.5 text-[11px] leading-relaxed opacity-75"
              style={{ color: textColor }}
            >
              <span aria-hidden>•</span>
              <span className="min-w-0">{driver}</span>
            </li>
          ))}
        </ul>
      )}
    </CollabPanel>
  );
}
