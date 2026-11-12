// The setup dialogs' hero art (docs/specs/026-plan/plan-board.md "Setup Board", docs/specs/029-sheets/sheet.md "Setup
// Sheet"), drawn in the dialog hero header's tokens. Setup Board is a first run, so it reads as the Start screen's
// lanes band: four soft lanes the band's full height, and in the bottom right a card mid-drag over the dashed slot it
// will drop into, bobbing twice. Setup Sheet is a grid of cells fading toward the title, a block of cells rising in
// the bottom right with its header row filled and one cell ringed in the accent with its fill handle, its ring
// spreading twice, and a row of column heads in the bottom left. Motion only where it is welcome.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';
import { BOARD_COLUMNS_GLYPH } from './configure/BoardConfigureHeroArt';

// The lanes are the band's texture, so they show at every size (a phone's compact band too), as on the Start screen.
// Every lane is soft (words never sit on the wash); alternate ones carry a hairline, so the four still read apart.
const LANES = (
  <div className="absolute inset-1.5 flex gap-1.5">
    {[0, 1, 2, 3].map((i) => (
      <span
        key={i}
        className={`min-w-0 flex-1 rounded-[10px] bg-[var(--hero-soft)] ${
          i % 2 ? 'shadow-[inset_0_0_0_1px_var(--hero-line)]' : ''
        }`}
      />
    ))}
  </div>
);

const BOARD_PIECES = (
  <>
    {LANES}
    {/* A card mid-drag, tilted, over the slot it will drop into. It bobs up past the box, so the box lets it. */}
    <svg
      {...HERO_SVG}
      width="64"
      height="30"
      viewBox="0 0 64 30"
      overflow="visible"
      className={HERO_PLACE.bottomRight}
    >
      <rect
        x="22"
        y="10"
        width="38"
        height="24"
        rx="6"
        fill="none"
        stroke="var(--hero-mark)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <g className={HERO_MOTION.float}>
        <g transform="rotate(6 24 16)">
          <rect
            x="6"
            y="5"
            width="38"
            height="24"
            rx="6"
            fill="var(--hero-plate)"
            stroke="var(--hero-line)"
          />
          <rect x="12" y="10" width="20" height="4" rx="2" fill="var(--hero-accent)" />
          <rect x="12" y="17" width="26" height="3" rx="1.5" fill="var(--hero-line)" />
          <circle cx="38" cy="23.5" r="2.75" fill="var(--hero-accent)" />
        </g>
      </g>
    </svg>
  </>
);

export const setupBoardHeroArt: HeroArt = {
  name: 'setup-board',
  glyph: BOARD_COLUMNS_GLYPH,
  pieces: BOARD_PIECES,
};

/** A sheet: a grid with its header row filled and one cell ringed. */
const SHEET_GLYPH = (
  <g>
    <rect
      x="2.5"
      y="3"
      width="15"
      height="14"
      rx="2.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.6"
    />
    <path d="M2.5 7.5h15" stroke="var(--hero-accent)" strokeWidth="1.6" />
    <path d="M7.5 7.5V17M12.5 7.5V17M2.5 12.25h15" stroke="var(--hero-accent)" strokeWidth="1.1" />
    <rect x="7.5" y="7.5" width="5" height="4.75" fill="var(--hero-accent)" />
  </g>
);

// A row of cells between two lines, from x 4, each 22 wide.
const CELL_W = 22;
const COLS = [4, 26, 48, 70];

const SHEET_PIECES = (
  <>
    {/* Column heads: the sheet's first row, each a soft tab with its name drawn as a bar. */}
    <svg {...HERO_SVG} width="72" height="30" viewBox="0 0 72 30" className={HERO_PLACE.bottomLeft}>
      {[4, 26, 48].map((x, i) => (
        <g key={x}>
          <rect
            x={x}
            y="14"
            width={CELL_W - 2}
            height="20"
            rx="4"
            fill="var(--hero-wash)"
            stroke="var(--hero-line)"
          />
          <rect
            x={x + 4}
            y="19"
            width={i === 1 ? 8 : 11}
            height="2.5"
            rx="1.25"
            fill="var(--hero-mark)"
          />
        </g>
      ))}
    </svg>
    {/* A block of cells, one ringed with its fill handle. */}
    <svg
      {...HERO_SVG}
      width="96"
      height="30"
      viewBox="0 0 96 30"
      overflow="visible"
      className={HERO_PLACE.bottomRight}
    >
      <rect
        x="4"
        y="4"
        width="88"
        height="32"
        rx="5"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <path d="M4.5 12h87V8.5a4 4 0 0 0-4-4h-79a4 4 0 0 0-4 4Z" fill="var(--hero-wash)" />
      <path
        d={`M4 12H92M4 20H92M4 28H92${COLS.slice(1)
          .map((x) => `M${x} 4V30`)
          .join('')}`}
        stroke="var(--hero-faint)"
      />
      <rect x="30" y="14.5" width="12" height="3" rx="1.5" fill="var(--hero-line)" />
      <rect x="8" y="22.5" width="14" height="3" rx="1.5" fill="var(--hero-line)" />
      {/* The ringed cell and its handle; the ring spreads twice. */}
      <rect
        x="48"
        y="20"
        width={CELL_W}
        height="8"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.25"
        className={HERO_MOTION.ring}
      />
      <rect
        x="48"
        y="20"
        width={CELL_W}
        height="8"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.75"
      />
      <rect x="52" y="22.5" width="10" height="3" rx="1.5" fill="var(--hero-accent)" />
      <rect
        x="67.5"
        y="25.5"
        width="5"
        height="5"
        fill="var(--hero-accent)"
        stroke="var(--hero-plate)"
      />
    </svg>
    {/* Where the dialog is wide (Setup Sheet is 60 rem on a wide screen): a sheet as it will look once styled, its
        header row filled, banded rows, a column of figures and a total under them. */}
    <svg
      {...HERO_SVG}
      width="168"
      height="64"
      viewBox="0 0 168 64"
      className={HERO_PLACE.centre}
      data-setup-sheet-table=""
    >
      <rect
        x="1"
        y="1"
        width="166"
        height="62"
        rx="7"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <path
        d="M1.5 14H166.5V8a6.5 6.5 0 0 0-6.5-6.5H8A6.5 6.5 0 0 0 1.5 8Z"
        fill="var(--hero-wash)"
      />
      {[24, 44].map((y) => (
        <rect key={y} x="1.5" y={y - 2} width="165" height="10" fill="var(--hero-soft)" />
      ))}
      <path d="M1 14H167M60 1V63M112 1V63M1 52H167" stroke="var(--hero-faint)" />
      {/* The heads, then a row a line. */}
      {[8, 67, 119].map((x, i) => (
        <rect key={x} x={x} y="6" width={i ? 22 : 30} height="3" rx="1.5" fill="var(--hero-mark)" />
      ))}
      {[18, 28, 38, 48].map((y, i) => (
        <g key={y}>
          <rect
            x="8"
            y={y - 1}
            width={[34, 26, 38, 22][i]}
            height="2.5"
            rx="1.25"
            fill="var(--hero-line)"
          />
          <rect
            x="67"
            y={y - 1}
            width={[18, 26, 14, 22][i]}
            height="2.5"
            rx="1.25"
            fill="var(--hero-line)"
          />
          <rect
            x={160 - [20, 14, 24, 16][i]!}
            y={y - 1}
            width={[20, 14, 24, 16][i]}
            height="2.5"
            rx="1.25"
            fill="var(--hero-mark)"
          />
        </g>
      ))}
      {/* The total, in the accent. */}
      <rect x="8" y="56" width="20" height="3" rx="1.5" fill="var(--hero-mark)" />
      <rect x="132" y="55.5" width="28" height="4" rx="2" fill="var(--hero-accent)" />
    </svg>
  </>
);

export const setupSheetHeroArt: HeroArt = {
  name: 'setup-sheet',
  glyph: SHEET_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: SHEET_PIECES,
  centre: true,
};
