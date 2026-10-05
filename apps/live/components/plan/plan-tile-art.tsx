// The Boards and Cards tiles' glyphs (docs/specs/025-plan/plan-mode.md "The palette"): a board drawn
// as a picture of its kind, and a card drawn with its item type's colour stripe, at the tile size.
import { Glyph } from '@livediagram/ui';

// One picture per board preset, so the Boards category reads at a glance (docs/specs/025-plan/
// plan-mode.md "The palette"), on a 22-unit grid like the other palette glyphs.
const BOARD_ART: Record<string, React.ReactNode> = {
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
      <rect x="3" y="5" width="3" height="12" rx="1.2" fill={color} stroke="none" />
      <path d="M9 9H16M9 13H14" />
    </Glyph>
  );
}
