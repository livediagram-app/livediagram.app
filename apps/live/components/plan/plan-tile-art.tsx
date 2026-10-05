// The Boards and Cards tiles' glyphs (docs/specs/025-plan/plan-mode.md "The palette"): a board drawn
// as a picture of its kind, and a card drawn with its item type's colour stripe, at the tile size.
import { Glyph } from '@livediagram/ui';
import type { BoardWidgetKind, CardSize } from '@livediagram/items';
import { accentVars } from './plan-palette';

// One picture per board preset, so the Boards category reads at a glance (docs/specs/025-plan/
// plan-mode.md "The palette"), on a 22-unit grid like the other palette glyphs.
const BOARD_ART: Record<string, React.ReactNode> = {
  // A box with its lid: the cards put away.
  archive: (
    <>
      <rect x="2.5" y="4" width="17" height="4.5" rx="1" />
      <path d="M4 8.5V17a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 18 17V8.5M9 12h4" />
    </>
  ),
  // Columns of stacked cards.
  kanban: (
    <>
      <rect x="1.5" y="3" width="19" height="16" rx="2" />
      <path d="M8 3v16M14 3v16" />
      <rect x="3" y="5.5" width="3.5" height="2.5" rx="0.6" />
      <rect x="3" y="9.5" width="3.5" height="2.5" rx="0.6" />
      <rect x="3" y="13.5" width="3.5" height="2.5" rx="0.6" />
      <rect x="9.25" y="5.5" width="3.5" height="2.5" rx="0.6" />
      <rect x="9.25" y="9.5" width="3.5" height="2.5" rx="0.6" />
      <rect x="15.5" y="5.5" width="3.5" height="2.5" rx="0.6" />
    </>
  ),
  // Columns crossed by swimlane rows, a dot per person.
  sprint: (
    <>
      <rect x="1.5" y="3" width="19" height="16" rx="2" />
      <path d="M1.5 11h19M9 3v16M14.75 3v16" />
      <circle cx="4.5" cy="7" r="1.3" />
      <circle cx="4.5" cy="15" r="1.3" />
      <rect x="10.25" y="5.75" width="3.25" height="2.5" rx="0.6" />
      <rect x="16" y="13.75" width="3.25" height="2.5" rx="0.6" />
    </>
  ),
  // Three columns under a smile: what went well, what to improve, what to try.
  retro: (
    <>
      <rect x="1.5" y="3" width="19" height="16" rx="2" />
      <path d="M1.5 9h19M8 9v10M14 9v10" />
      <circle cx="11" cy="6" r="1.9" />
      <path d="M10.2 6.4a1 1 0 0 0 1.6 0" />
    </>
  ),
  // Staggered bars along a timeline: now, next, later.
  roadmap: (
    <>
      <path d="M2 18.5h17.5M17.5 16.5l2 2-2 2" />
      <rect x="2" y="4" width="7" height="3" rx="1" />
      <rect x="6.5" y="8.5" width="8" height="3" rx="1" />
      <rect x="12" y="13" width="7" height="3" rx="1" />
    </>
  ),
  // A board with a bug on it.
  'bug-triage': (
    <>
      <rect x="1.5" y="3" width="19" height="16" rx="2" />
      <path d="M8.5 9h5v4.5a2.5 2.5 0 0 1-5 0ZM9 9a2 2 0 0 1 4 0M6 10.5h2.5M13.5 10.5H16M6.5 14.5l2-1M15.5 14.5l-2-1M11 9v6.5" />
    </>
  ),
  // A week's calendar: rings, a header band, five days.
  weekly: (
    <>
      <rect x="1.5" y="4" width="19" height="15" rx="2" />
      <path d="M1.5 8h19M6 2.5v3M16 2.5v3" />
      <path
        d="M5 11v0M8.5 11v0M12 11v0M15.5 11v0M19 11v0M5 15v0M8.5 15v0M12 15v0"
        strokeWidth="2.2"
      />
    </>
  ),
  // An empty board to make your own.
  blank: (
    <>
      <rect x="1.5" y="3" width="19" height="16" rx="2" strokeDasharray="2.5 2" />
      <path d="M11 8v6M8 11h6" />
    </>
  ),
};

export function PlanBoardTileArt({ size, preset }: { size: number; preset: string }) {
  return (
    <Glyph size={size} units={22}>
      {BOARD_ART[preset] ?? BOARD_ART['blank']}
    </Glyph>
  );
}

export function PlanCardTileArt({ size, color }: { size: number; color: string }) {
  return (
    <Glyph size={size} units={22}>
      <rect x="3" y="5" width="16" height="12" rx="2" />
      <rect
        x="3"
        y="5"
        width="3"
        height="12"
        rx="1.2"
        stroke="none"
        className="fill-[var(--accent)] dark:fill-[var(--accent-lift)]"
        style={accentVars(color)}
      />
      <path d="M9 9H16M9 13H14" />
    </Glyph>
  );
}

// A card at each size, drawn small (the board's Card Size tiles): a title bar alone, one line led by a
// dot, or a title over a line and two chips.
const SIZE_ART: Record<CardSize, React.ReactNode> = {
  minimal: (
    <>
      <rect x="2" y="4" width="18" height="14" rx="2.5" />
      <path d="M6 11h10" />
    </>
  ),
  compact: (
    <>
      <rect x="2" y="4" width="18" height="14" rx="2.5" />
      <circle cx="6.5" cy="11" r="1" />
      <path d="M10 11h6" />
    </>
  ),
  detailed: (
    <>
      <rect x="2" y="4" width="18" height="14" rx="2.5" />
      <path d="M6 8h10M6 11h6M6 14.5h3M11 14.5h3" />
    </>
  ),
};

export function CardSizeArt({ size }: { size: CardSize }) {
  return (
    <Glyph size={18} units={22}>
      {SIZE_ART[size]}
    </Glyph>
  );
}

// A picture per board widget (docs/specs/025-plan/board-widgets.md), for the palette's Widgets tiles.
const WIDGET_ART: Record<BoardWidgetKind, React.ReactNode> = {
  count: <path d="M8.5 4.5 7 17.5M15 4.5l-1.5 13M4.5 8.5h14M3.5 13.5h14" />,
  progress: (
    <>
      <rect x="2.5" y="8" width="17" height="6" rx="3" />
      <path d="M5.5 11h6" />
    </>
  ),
  filter: <path d="M3.5 5h15l-5.75 6.75v4.75l-3.5 1.75v-6.5z" />,
  mine: (
    <>
      <circle cx="11" cy="7.5" r="3" />
      <path d="M5 18.5a6 6 0 0 1 12 0" />
    </>
  ),
  people: (
    <>
      <circle cx="8" cy="8" r="2.6" />
      <path d="M3 17.5a5 5 0 0 1 10 0" />
      <circle cx="15.5" cy="8.5" r="2.1" />
      <path d="M14.5 13.2a4.3 4.3 0 0 1 5 4.3" />
    </>
  ),
  unplaced: (
    <>
      <rect x="4" y="5" width="14" height="12" rx="2" strokeDasharray="2.6 2.2" />
      <path d="M8 11h6" />
    </>
  ),
  types: (
    <>
      <rect x="2.5" y="7" width="5" height="8" rx="1.2" />
      <rect x="8.5" y="7" width="5" height="8" rx="1.2" />
      <rect x="14.5" y="7" width="5" height="8" rx="1.2" />
    </>
  ),
  wip: <path d="M11 3.5 19.5 18h-17zM11 9v4.25M11 15.75v.25" />,
  due: (
    <>
      <circle cx="11" cy="11" r="7.5" />
      <path d="M11 6.75V11l3 2" />
    </>
  ),
  votes: <path d="M11 4.5 17.5 13h-4v5h-5v-5h-4z" />,
  // A stack of points rising.
  points: <path d="M3 18h16M5 18v-4M9.5 18V10M14 18v-6M18.5 18V5" />,
  // Three flags, tallest first.
  priorities: <path d="M5 18V5h7l-1.5 2.5L12 10H5M14 18V9" />,
  // A person with a question: nobody yet.
  unassigned: (
    <>
      <circle cx="11" cy="7.5" r="3" strokeDasharray="2.4 1.8" />
      <path d="M5 18.5a6 6 0 0 1 12 0" strokeDasharray="2.4 1.8" />
    </>
  ),
  // A trophy.
  'top-voted': (
    <>
      <path d="M7 4h8v4a4 4 0 0 1-8 0zM7 6H4.5a2.5 2.5 0 0 0 2.6 3M15 6h2.5a2.5 2.5 0 0 1-2.6 3" />
      <path d="M11 12v3M8 18h6M9 15h4" />
    </>
  ),
  // An hourglass.
  stale: (
    <path d="M6 3.5h10M6 18.5h10M7 3.5c0 4 8 4 8 7.5S7 14.5 7 18.5M15 3.5c0 4-8 4-8 7.5s8 3.5 8 7.5" />
  ),
};

export function BoardWidgetArt({ kind, size = 18 }: { kind: BoardWidgetKind; size?: number }) {
  return (
    <Glyph size={size} units={22}>
      {WIDGET_ART[kind]}
    </Glyph>
  );
}
