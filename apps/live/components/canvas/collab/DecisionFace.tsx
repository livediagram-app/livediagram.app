// The face of a Decision record (docs/specs/012-collaboration/decision-record.md): the statement, a status
// badge, the drivers, and the date. Built in the behaviour elements' current
// look ("The face").
//
// A PANEL like the other collaboration faces, not a view drawn around the
// generic label: a decision's title is a SENTENCE, and a free-flowing label ran
// straight under the status and over the drivers. Owning the layout here means
// the parts cannot collide by construction. The label is still the element's
// ordinary label: typed, formatted and exported like any other, and mid-edit
// this face gives way to the inline editor exactly as the other faces do.
//
// The status tints the badge, the glow and the driver markers, never the
// element's fill: the theme owns the box.

import {
  DECISION_STATUS_HUES,
  DECISION_STATUS_LABELS,
  DEFAULT_DECISION_STATUS,
  type DecisionStatus,
  type ShapeElement,
} from '@livediagram/diagram';
import { Glyph } from '@livediagram/ui';
import { CollabPanel, tint } from './collab-chrome';

function StatusGlyph({ status }: { status: DecisionStatus }) {
  return (
    <Glyph size={11} units={16}>
      {status === 'accepted' ? <path d="m3.5 8.5 3 3 6-7" /> : null}
      {status === 'rejected' ? <path d="m4.5 4.5 7 7m0-7-7 7" /> : null}
      {status === 'superseded' ? <path d="M3.5 10.5a5 5 0 0 1 8.6-3.5M12.5 3.5V7H9" /> : null}
      {status === 'proposed' ? <circle cx="8" cy="8" r="4.5" strokeDasharray="2 2" /> : null}
    </Glyph>
  );
}

function CalendarGlyph() {
  return (
    <Glyph size={11} units={16}>
      <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
      <path d="M2.5 6.8h11M5.5 2v3M10.5 2v3" />
    </Glyph>
  );
}

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
  const hue = DECISION_STATUS_HUES[status];
  const ink = `color-mix(in srgb, ${hue} 70%, ${textColor})`;
  const drivers = element.decisionDrivers ?? [];

  return (
    <CollabPanel
      element={element}
      title={label.trim() || 'We will …'}
      textColor={textColor}
      // The statement is the sentence people read: larger than a panel title,
      // three lines, bounded so a long one can't squeeze the drivers off.
      titleLines={3}
      titleSize={15}
      // A soft glow of the status from the card's top corner.
      backdrop={
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(120% 80% at 0% 0%, ${tint(hue, 0.16)}, transparent 60%)`,
          }}
        />
      }
      aside={
        <span
          className="inline-flex items-center gap-1 rounded-full py-[3px] pl-1.5 pr-2 text-[10px] font-semibold"
          style={{ color: ink, backgroundColor: tint(hue, 0.16) }}
        >
          <StatusGlyph status={status} />
          {DECISION_STATUS_LABELS[status]}
        </span>
      }
      footer={
        // An undated decision shows nothing at all: a card reading "no date"
        // is noise, and mid-discussion cards are commonly undated.
        element.decisionDate ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium tabular-nums"
            style={{ color: textColor, backgroundColor: tint(textColor, 0.07) }}
          >
            <CalendarGlyph />
            {element.decisionDate}
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-1.5">
        <span
          className="text-[9.5px] font-bold uppercase tracking-[0.08em]"
          style={{ color: ink, opacity: 0.85 }}
        >
          Because
        </span>
        {drivers.length === 0 ? (
          <p className="text-[11px] leading-snug" style={{ color: textColor, opacity: 0.5 }}>
            + Add what drove this from the element’s menu.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {drivers.map((driver, i) => (
              <li
                key={`${i}-${driver.slice(0, 12)}`}
                className="flex gap-2 text-[11.5px] leading-snug"
                style={{ color: textColor }}
              >
                <span
                  aria-hidden
                  className="mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{ color: ink, backgroundColor: tint(hue, 0.16) }}
                >
                  <span className="text-optical-centre">→</span>
                </span>
                <span className="min-w-0 opacity-85">{driver}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CollabPanel>
  );
}
