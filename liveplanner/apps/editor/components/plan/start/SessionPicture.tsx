'use client';

// Start Planning's session card pictures (docs/specs/026-plan/session-tabs.md "Making one", "Sprint Planning"): a
// Session tab drawn small in the tab's own colours, the queue on the left (two rows ticked and greyed, the room's card
// lit) and the card on the right with its fill button. Sprint Planning's rows carry estimate pills and its card a
// filling capacity meter.
import type { SessionKindId } from '@liveplanner/items';
import type { PlanPalette } from '../plan-palette';

const W = 120;
const H = 72;

export function SessionPicture({
  palette,
  sessionKind = 'refinement',
}: {
  palette: PlanPalette;
  sessionKind?: SessionKindId;
}) {
  const rows = [0, 1, 2, 3, 4];
  const planning = sessionKind === 'planning';
  return (
    <span
      aria-hidden
      className="flex h-16 w-full items-center justify-center rounded-lg border sm:h-24"
      style={{ backgroundColor: palette.card, borderColor: palette.border }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full p-1.5">
        <rect
          x="4"
          y="4"
          width="38"
          height="64"
          rx="3"
          fill={palette.column}
          stroke={palette.border}
        />
        {rows.map((r) => {
          const y = 9 + r * 11.5;
          const done = r < 2;
          const lit = r === 2;
          return (
            <g key={r} opacity={done ? 0.55 : 1}>
              <rect
                x="7"
                y={y}
                width="32"
                height="9"
                rx="2"
                fill={lit ? palette.focus : palette.card}
                fillOpacity={lit ? 0.22 : 1}
                stroke={lit ? palette.focus : palette.border}
              />
              <circle
                cx="11.5"
                cy={y + 4.5}
                r="2"
                fill={lit || done ? palette.focus : palette.border}
              />
              <rect
                x="16"
                y={y + 3.5}
                width={done ? 16 : planning ? 13 : 19}
                height="2"
                rx="1"
                fill={palette.muted}
              />
              {planning ? (
                <rect
                  x="31"
                  y={y + 2.5}
                  width="5"
                  height="4"
                  rx="2"
                  fill={palette.column}
                  stroke={palette.border}
                  strokeWidth="0.5"
                />
              ) : null}
            </g>
          );
        })}
        <rect
          x="46"
          y="4"
          width="70"
          height="64"
          rx="3"
          fill={palette.card}
          stroke={palette.border}
        />
        <rect x="51" y="10" width="40" height="4" rx="2" fill={palette.muted} />
        <rect x="51" y="19" width="58" height="2.5" rx="1.25" fill={palette.border} />
        <rect x="51" y="25" width="52" height="2.5" rx="1.25" fill={palette.border} />
        <rect x="51" y="31" width="56" height="2.5" rx="1.25" fill={palette.border} />
        {planning ? (
          <>
            <rect x="51" y="42" width="60" height="4" rx="2" fill={palette.column} />
            <rect x="51" y="42" width="34" height="4" rx="2" fill={palette.focus} />
            <rect x="85" y="42" width="9" height="4" fill={palette.focus} fillOpacity="0.35" />
          </>
        ) : null}
        <rect x="84" y="55" width="27" height="8" rx="2" fill={palette.focus} />
        <rect x="84" y="55" width="15" height="8" rx="2" fill="#fff" fillOpacity="0.3" />
        <rect
          x="51"
          y="55"
          width="12"
          height="8"
          rx="2"
          fill={palette.column}
          stroke={palette.border}
        />
      </svg>
    </span>
  );
}
