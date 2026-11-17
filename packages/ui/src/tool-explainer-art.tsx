// The tools' explainer illustrations (ToolExplainer): each a 280 by 120 drawing of what the tool does, in the brand
// and slate ramps through classes so it follows light and dark. Shared parts at the top; one export per tool.
import type { ReactNode } from 'react';

const CARD = 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600';
const LINE = 'fill-slate-200 dark:fill-slate-600';
const SOFT = 'fill-brand-100 dark:fill-brand-500/25';
const BRAND = 'fill-brand-500 dark:fill-brand-400';
const STROKE_BRAND = 'stroke-brand-500 dark:stroke-brand-400';
// A gentle bob for the drawing's moving part (stopped under reduced motion by the class itself).
const FLOAT = 'animate-empty-float';
const FLOAT_STYLE = { transformBox: 'fill-box', transformOrigin: 'center' } as const;

function Art({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 280 120" fill="none" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

// A card with a coloured tag and two lines of text.
function MiniCard({
  x,
  y,
  w = 72,
  tone = BRAND,
}: {
  x: number;
  y: number;
  w?: number;
  tone?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={30} rx={6} className={CARD} strokeWidth={1.5} />
      <rect x={x + 7} y={y + 7} width={16} height={5} rx={2.5} className={tone} />
      <rect x={x + 7} y={y + 17} width={w - 22} height={4} rx={2} className={LINE} />
    </g>
  );
}

/** Email to Board: a letter flies along a dashed path into a board column and lands as a card. */
export const emailToBoardArt = (
  <Art label="An email becoming a card on a board">
    <path
      d="M70 62 C 110 30, 150 30, 182 52"
      className={STROKE_BRAND}
      strokeWidth={2}
      strokeDasharray="4 5"
      strokeLinecap="round"
    />
    <g className={FLOAT} style={FLOAT_STYLE}>
      <rect x="22" y="46" width="58" height="40" rx="7" className={CARD} strokeWidth={1.5} />
      <path
        d="M24 50 L51 70 L78 50"
        className="stroke-brand-400 dark:stroke-brand-300"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx="78" cy="48" r="7" className={BRAND} />
      <path
        d="M75 48 h6 M78 45 v6"
        className="stroke-white"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </g>
    <rect
      x="176"
      y="14"
      width="88"
      height="96"
      rx="10"
      className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
      strokeWidth={1.5}
    />
    <rect x="186" y="23" width="30" height="5" rx="2.5" className={LINE} />
    <MiniCard x={184} y={36} tone={BRAND} />
    <MiniCard x={184} y={72} tone="fill-amber-400" />
  </Art>
);

/** Webhooks: the item at the centre sends signals out to three services. */
export const webhooksArt = (
  <Art label="Changes sent out to other services">
    {[
      { y: 22, d: 'M120 60 C 160 60, 160 30, 196 30' },
      { y: 52, d: 'M120 60 L196 60' },
      { y: 82, d: 'M120 60 C 160 60, 160 90, 196 90' },
    ].map((r) => (
      <path
        key={r.y}
        d={r.d}
        className={STROKE_BRAND}
        strokeWidth={2}
        strokeDasharray="3 5"
        strokeLinecap="round"
      />
    ))}
    <g className={FLOAT} style={FLOAT_STYLE}>
      <rect x="44" y="34" width="76" height="52" rx="10" className={CARD} strokeWidth={1.5} />
      <rect x="54" y="45" width="22" height="6" rx="3" className={BRAND} />
      <rect x="54" y="57" width="52" height="4" rx="2" className={LINE} />
      <rect x="54" y="66" width="38" height="4" rx="2" className={LINE} />
    </g>
    {[
      { y: 16, tone: 'fill-emerald-400' },
      { y: 46, tone: 'fill-sky-400' },
      { y: 76, tone: 'fill-violet-400' },
    ].map((s) => (
      <g key={s.y}>
        <rect x="198" y={s.y} width="58" height="28" rx="8" className={CARD} strokeWidth={1.5} />
        <circle cx="212" cy={s.y + 14} r="6" className={s.tone} />
        <rect x="223" y={s.y + 12} width="24" height="4" rx="2" className={LINE} />
      </g>
    ))}
  </Art>
);

/** Subscribe to Calendar: the plan's dated cards land on a calendar month, kept in step. */
export const calendarFeedArt = (
  <Art label="Dated cards shown in your calendar">
    <MiniCard x={22} y={26} tone={BRAND} />
    <MiniCard x={30} y={64} tone="fill-amber-400" />
    <path
      d="M110 60 h36"
      className={STROKE_BRAND}
      strokeWidth={2}
      strokeLinecap="round"
      strokeDasharray="3 5"
    />
    <path
      d="M140 54 l7 6 -7 6"
      className={STROKE_BRAND}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <g className={FLOAT} style={FLOAT_STYLE}>
      <rect x="160" y="14" width="98" height="92" rx="10" className={CARD} strokeWidth={1.5} />
      <path d="M160 24 a10 10 0 0 1 10 -10 h78 a10 10 0 0 1 10 10 v10 h-98 z" className={BRAND} />
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3, 4].map((col) => {
          const hot = (row === 1 && col === 1) || (row === 2 && col === 3);
          return (
            <rect
              key={`${row}-${col}`}
              x={168 + col * 17}
              y={42 + row * 15}
              width="13"
              height="11"
              rx="3"
              className={hot ? (row === 1 ? BRAND : 'fill-amber-400') : SOFT}
            />
          );
        }),
      )}
    </g>
  </Art>
);

/** Walkthroughs: a canvas with a cursor, a speaker's bubble and a sound wave, ready to play back. */
export const walkthroughsArt = (
  <Art label="A recording of someone talking through the canvas">
    <rect x="40" y="12" width="200" height="96" rx="12" className={CARD} strokeWidth={1.5} />
    <rect x="58" y="30" width="46" height="26" rx="6" className={SOFT} />
    <rect x="128" y="58" width="46" height="26" rx="6" className={SOFT} />
    <path
      d="M104 43 H116 V71 H128"
      className="stroke-brand-300 dark:stroke-brand-500/60"
      strokeWidth={2}
    />
    <path
      d="M150 34 l12 30 5 -12 12 -5 z"
      className="fill-slate-800 stroke-white dark:fill-white dark:stroke-slate-900"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    <g className={FLOAT} style={FLOAT_STYLE}>
      <circle cx="206" cy="88" r="18" className={BRAND} />
      <path d="M201 80 l13 8 -13 8 z" className="fill-white" />
    </g>
    {[0, 1, 2, 3, 4, 5, 6].map((i) => {
      const h = [6, 12, 18, 10, 16, 8, 12][i]!;
      return (
        <rect
          key={i}
          x={58 + i * 7}
          y={92 - h / 2}
          width="3.5"
          height={h}
          rx="1.75"
          className={BRAND}
        />
      );
    })}
  </Art>
);

/** Slide Deck: a stack of slides drawn from parts of the canvas, the front one showing a framed shape. */
export const slideDeckArt = (
  <Art label="Slides made from parts of the canvas">
    <rect
      x="96"
      y="12"
      width="128"
      height="78"
      rx="9"
      className={`${CARD} opacity-60`}
      strokeWidth={1.5}
    />
    <rect
      x="80"
      y="20"
      width="128"
      height="78"
      rx="9"
      className={`${CARD} opacity-80`}
      strokeWidth={1.5}
    />
    <g className={FLOAT} style={FLOAT_STYLE}>
      <rect x="64" y="28" width="128" height="78" rx="9" className={CARD} strokeWidth={1.5} />
      <rect x="80" y="44" width="40" height="24" rx="5" className={SOFT} />
      <rect x="132" y="56" width="44" height="28" rx="5" className={BRAND} />
      <path d="M120 56 H132" className="stroke-brand-300" strokeWidth={2} />
      <rect x="80" y="80" width="30" height="4" rx="2" className={LINE} />
    </g>
    <rect x="16" y="40" width="34" height="48" rx="7" className={CARD} strokeWidth={1.5} />
    <path d="M28 56 l10 8 -10 8 z" className={BRAND} />
  </Art>
);
