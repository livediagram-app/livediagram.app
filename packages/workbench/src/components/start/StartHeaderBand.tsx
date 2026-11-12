// A start panel header's band (each product's start spec, "The header band"): the app's Explorer hero backdrop
// (@liveworkspace/explorer's hero-theme, HeroBackdrop) drawn at a header's height, in the start palette's colours
// (start-band-colours.ts). Behind the title, the search and the corner's buttons, hidden from screen readers, taking
// no pointer events. CSS gradients and a few small inline SVGs, nothing fetched and no filter: it paints once.
//
// The texture and the corner pieces show at every size. The piece drawn in the gap between the words and the search
// shows only from `xl`, where the panel is at its widest (max-w-5xl) and the gap is wide enough that it never meets the
// line; it stands 1.5rem left of where the search starts (the search's 17rem plus the header's 6rem right padding).
//
// A dialog's header band is @liveworkspace/ui's HeroDialogHeader (liveworkspace/docs/specs/004-index/
// dialog-hero-header.md), in the brand ramp; this one keeps the start palette and the search beside it, at the same
// height, mark and title metrics.
import { memo, type CSSProperties, type ReactNode } from 'react';
import { SHEET_HANDLE_PX } from '@liveworkspace/ui';
import {
  BASELINE_PX,
  BLUEPRINT_MAJOR_PX,
  BLUEPRINT_MINOR_PX,
  DOTS_PX,
  HUDDLE_RING_PX,
  type HeroBackdropKind,
} from '@liveworkspace/explorer/hero-theme';
import type { StartBandColours } from './start-band-colours';

// One motion each, at most, and only twice or three times over: the board's card bobs as it is dragged, the
// speaker's ring spreads. Both are the empty states' shared keyframes, which reduced motion turns off.
const FLOAT = 'motion-safe:animate-empty-float [animation-iteration-count:2]';
const RING = 'motion-safe:animate-empty-ring [animation-iteration-count:3]';
// The ring scales about its own centre.
const ABOUT_CENTRE = '[transform-box:fill-box] [transform-origin:center]';

const GAP = 'absolute right-[23.5rem] top-1/2 hidden -translate-y-1/2 xl:block';

// Where the huddle's rings spread from: the corner where the help and × sit, and from `xl`, where the gap piece
// stands, the round table itself (23.5rem in, plus half its 4rem).
const HUDDLE_AT =
  '[--start-huddle-at:calc(100%_-_3rem)_1.25rem] xl:[--start-huddle-at:calc(100%_-_25.5rem)_50%]';

/** The texture under each band: CSS gradients over the paper. */
function texture(kind: HeroBackdropKind, band: StartBandColours): CSSProperties {
  if (kind === 'blueprint') {
    const major = `${BLUEPRINT_MAJOR_PX}px ${BLUEPRINT_MAJOR_PX}px`;
    const minor = `${BLUEPRINT_MINOR_PX}px ${BLUEPRINT_MINOR_PX}px`;
    return {
      backgroundImage: [
        `linear-gradient(${band.line} 1px, transparent 1px)`,
        `linear-gradient(90deg, ${band.line} 1px, transparent 1px)`,
        `linear-gradient(${band.faint} 1px, transparent 1px)`,
        `linear-gradient(90deg, ${band.faint} 1px, transparent 1px)`,
      ].join(', '),
      backgroundSize: [major, major, minor, minor].join(', '),
      backgroundPosition: '-1px -1px',
    };
  }
  if (kind === 'typesetter') {
    return {
      backgroundImage: `repeating-linear-gradient(transparent 0 ${BASELINE_PX - 1}px, ${band.faint} ${BASELINE_PX - 1}px ${BASELINE_PX}px)`,
      backgroundPosition: `0 ${BASELINE_PX / 2}px`,
    };
  }
  if (kind === 'huddle') {
    // Rings spreading from where the room speaks (HUDDLE_AT), fading into the paper as they go.
    const at = 'circle at var(--start-huddle-at)';
    const gap = HUDDLE_RING_PX / 2;
    return {
      backgroundImage: [
        `radial-gradient(${at}, transparent 0 4rem, ${band.paper} 13rem)`,
        `repeating-radial-gradient(${at}, ${band.line} 0 1px, transparent 1px ${gap}px)`,
      ].join(', '),
    };
  }
  if (kind === 'dots') {
    return {
      backgroundImage: `radial-gradient(${band.line} 1px, transparent 1px)`,
      backgroundSize: `${DOTS_PX}px ${DOTS_PX}px`,
    };
  }
  return {};
}

// Memoised: the panel re-renders on every keystroke in its search, and the band's props (its kind and the theme's
// memoised colours) only change with the palette.
export const StartHeaderBand = memo(function StartHeaderBand({
  kind,
  band,
  underHandle = false,
}: {
  kind: HeroBackdropKind;
  band: StartBandColours;
  // On a phone the panel is a sheet with a grab handle over its header: the band runs up under it, so the sheet's
  // top is the band's colour, not a strip of plain card. The handle stands over it (`relative z-10`).
  underHandle?: boolean;
}) {
  return (
    <div
      aria-hidden
      data-start-band={kind}
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${
        underHandle ? 'max-sm:top-[calc(var(--start-band-lift)*-1)]' : ''
      } ${kind === 'huddle' ? HUDDLE_AT : ''}`}
      style={
        {
          backgroundColor: band.paper,
          '--start-band-lift': `${SHEET_HANDLE_PX}px`,
          ...texture(kind, band),
        } as CSSProperties
      }
    >
      {pieces(kind, band)}
    </div>
  );
});

function pieces(kind: HeroBackdropKind, band: StartBandColours): ReactNode {
  if (kind === 'lanes') return <Lanes band={band} />;
  if (kind === 'blueprint') return <Blueprint band={band} />;
  if (kind === 'typesetter') return <Typesetter band={band} />;
  if (kind === 'shapes') return <Shapes band={band} />;
  if (kind === 'huddle') return <Huddle band={band} />;
  return null;
}

// Board lanes: four lanes the band's full height, alternate ones a shade deeper; in the gap a card mid-drag, tilted,
// over the dashed slot it will drop into.
function Lanes({ band }: { band: StartBandColours }) {
  return (
    <>
      <div className="absolute inset-1.5 flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="min-w-0 flex-1 rounded-[10px]"
            style={{ backgroundColor: i % 2 ? band.wash : band.soft }}
          />
        ))}
      </div>
      <svg width="64" height="56" viewBox="0 0 64 56" className={GAP}>
        <rect
          x="22"
          y="24"
          width="38"
          height="26"
          rx="6"
          fill="none"
          stroke={band.mark}
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <g className={FLOAT}>
          <g transform="rotate(6 26 19)">
            <rect x="6" y="6" width="40" height="26" rx="6" fill={band.plate} stroke={band.line} />
            <rect x="12" y="12" width="22" height="4" rx="2" fill={band.accent} />
            <rect x="12" y="19" width="28" height="3" rx="1.5" fill={band.line} />
            <circle cx="40" cy="26" r="3" fill={band.accent} />
          </g>
        </g>
      </svg>
    </>
  );
}

const CROP = 'absolute size-2.5';

// Blueprint: engineering paper, crop marks in the left corners, a dimension line in the gap and a drawing's scale box
// under the corner's buttons.
function Blueprint({ band }: { band: StartBandColours }) {
  const crop = (d: string, place: string) => (
    <svg viewBox="0 0 10 10" className={`${CROP} ${place}`}>
      <path d={d} fill="none" stroke={band.mark} strokeWidth="1.25" />
    </svg>
  );
  return (
    <>
      {crop('M0 7V0H7', 'left-1.5 top-1.5')}
      {crop('M0 3V10H7', 'bottom-1.5 left-1.5')}
      <svg width="12" height="64" viewBox="0 0 12 64" className={GAP}>
        <path
          d="M6 2V62M2 2h8M2 62h8M3.5 9L6 2l2.5 7M3.5 55L6 62l2.5-7"
          fill="none"
          stroke={band.mark}
          strokeWidth="1"
        />
      </svg>
      <span
        className="absolute bottom-2 right-3 flex h-4 items-center border px-1 font-mono text-[9px] leading-none tracking-[0.08em] max-sm:hidden"
        style={{ borderColor: band.mark, color: band.mark, backgroundColor: band.paper }}
      >
        1:1
      </span>
    </>
  );
}

// Typesetter: the 8px baseline grid, a margin rule down the left edge, and a pilcrow in the gap.
function Typesetter({ band }: { band: StartBandColours }) {
  return (
    <>
      <span
        className="absolute inset-y-0 left-2.5 w-[4px] border-x"
        style={{ borderColor: band.line }}
      />
      <span className={`${GAP} font-serif text-[72px] leading-none`} style={{ color: band.line }}>
        ¶
      </span>
    </>
  );
}

// Shape kit: a quarter disc in the bottom left, a ring rising from the bottom right, and in the gap a circle,
// selected, with its handles, and a triangle beside it.
function Shapes({ band }: { band: StartBandColours }) {
  const handle = (x: number, y: number) => (
    <rect
      key={`${x}-${y}`}
      x={x - 3}
      y={y - 3}
      width="6"
      height="6"
      fill={band.plate}
      stroke={band.accent}
      strokeWidth="1.25"
    />
  );
  return (
    <>
      <svg viewBox="0 0 24 24" className="absolute bottom-0 left-0 size-6">
        <path d="M0 24V0A24 24 0 0 1 24 24Z" fill={band.wash} />
      </svg>
      <svg
        width="52"
        height="26"
        viewBox="0 0 52 26"
        className="absolute bottom-0 right-2 max-sm:hidden"
      >
        <circle cx="26" cy="28" r="17" fill="none" stroke={band.line} strokeWidth="5" />
      </svg>
      <svg width="64" height="56" viewBox="0 0 64 56" className={GAP}>
        <path d="M52 4L62 18H42Z" fill={band.mark} />
        <circle cx="24" cy="32" r="16" fill={band.wash} />
        <rect
          x="8"
          y="16"
          width="32"
          height="32"
          fill="none"
          stroke={band.accent}
          strokeWidth="1.25"
        />
        {[
          [8, 16],
          [40, 16],
          [8, 48],
          [40, 48],
        ].map(([x, y]) => handle(x!, y!))}
      </svg>
    </>
  );
}

// Huddle: rings spreading from the corner, or from `xl` from the table (the texture), and in the gap a round table
// seen from above, its seats taken, the one speaking ringed.
const SEATS: readonly [number, number, 'speaker' | 'deep' | 'soft' | 'open'][] = [
  [32, 9, 'speaker'],
  [50, 19, 'soft'],
  [50, 39, 'deep'],
  [32, 49, 'open'],
  [14, 39, 'soft'],
  [14, 19, 'deep'],
];

function Huddle({ band }: { band: StartBandColours }) {
  const fill = { speaker: band.accent, deep: band.mark, soft: band.line, open: band.plate };
  return (
    <svg width="64" height="58" viewBox="0 0 64 58" className={GAP}>
      <circle cx="32" cy="29" r="12" fill={band.wash} stroke={band.line} />
      <circle
        cx="32"
        cy="9"
        r="7"
        fill="none"
        stroke={band.accent}
        strokeWidth="1.5"
        className={`${RING} ${ABOUT_CENTRE}`}
      />
      {SEATS.map(([x, y, tone]) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r="5"
          fill={fill[tone]}
          stroke={tone === 'open' ? band.mark : 'none'}
        />
      ))}
    </svg>
  );
}
