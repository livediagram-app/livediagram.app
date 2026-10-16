import {
  lucideDatabase,
  lucideGlobe,
  lucideMail,
  lucideSparkles,
  lucideUser,
} from '@livediagram/icons/lucide';
import type { Point } from '@/lib/hero-motion';
import { FONT, TEAMMATE, YOU, at } from '@/components/art-tokens';
import {
  Connector,
  Cursor,
  Drop,
  INK,
  NodeLabel,
  Sticky,
  head,
  type Link,
} from '@/components/hero-diagram-parts';

// The hero's Diagram window (docs/specs/019-marketing/marketing-site.md "Hero"): two people map a
// sign-up flow together in Diagram mode, under its title and a one-line caption as the editor's
// flowchart templates set them. You drop three steps from the strip (a terminator, a process step
// and a decision), each with its icon and its label typed as it lands, and they join up with
// arrows whose heads land as the line arrives; a teammate adds the "No" branch and a Retry loop
// back; you add the "Yes" step slightly off, drag it, and it snaps onto the pink alignment guide;
// you select it and pick green from the colour row; the teammate leaves a sticky question and
// wires a database in with a dashed connector. Every shape is in the Default theme's ink (the
// --art-* palette), so it looks as the editor draws it. Each piece arrives at its own --d delay
// and the two cursors ride CSS motion paths timed to the drops (hero-mode-animations.css).

type Box = { cx: number; cy: number; w: number; h: number };

// Where everything sits: the wide window's landscape layout, and a phone's portrait one, where the
// flow runs down the screen (the Yes step beside the decision, the No step below it).
type Layout = {
  title: { x: number; y: number };
  visit: Box;
  create: Box;
  verified: { cx: number; cy: number; hw: number; hh: number };
  reminder: Box;
  tour: Box;
  db: { cx: number; top: number; w: number };
  sticky: { x: number; y: number };
  guide: { x1: number; x2: number; y: number };
  links: Record<'visitCreate' | 'createVerified' | 'no' | 'retry' | 'yes' | 'writes', Link>;
  you: Point[];
  teammate: Point[];
};

const LANDSCAPE: Layout = {
  title: { x: 24, y: -30 },
  visit: { cx: 100, cy: 42, w: 130, h: 42 },
  create: { cx: 100, cy: 140, w: 144, h: 50 },
  verified: { cx: 295, cy: 140, hw: 66, hh: 40 },
  reminder: { cx: 295, cy: 255, w: 144, h: 48 },
  tour: { cx: 488, cy: 140, w: 144, h: 50 },
  db: { cx: 488, top: 228, w: 116 },
  sticky: { x: 440, y: -44 },
  guide: { x1: 28, x2: 576, y: 140 },
  links: {
    visitCreate: { d: 'M100 63 L100 106', head: head(100, 115, 'down'), len: 43 },
    createVerified: { d: 'M172 140 L220 140', head: head(229, 140, 'right'), len: 48 },
    no: {
      d: 'M295 180 L295 222',
      head: head(295, 231, 'down'),
      len: 42,
      label: { x: 295, y: 201, text: 'No' },
    },
    retry: {
      d: 'M223 255 L100 255 L100 174',
      head: head(100, 165, 'up'),
      len: 204,
      label: { x: 160, y: 255, text: 'Retry' },
    },
    yes: {
      d: 'M361 140 L407 140',
      head: head(416, 140, 'right'),
      len: 46,
      label: { x: 386, y: 140, text: 'Yes' },
    },
    writes: {
      d: 'M488 165 L488 209',
      head: head(488, 218, 'down'),
      len: 44,
      label: { x: 488, y: 190, text: 'writes' },
    },
  },
  you: [
    [300, -55],
    [100, 42],
    [100, 140],
    [295, 140],
    [488, 155],
    [488, 142],
    [490, 92],
  ],
  teammate: [
    [620, 330],
    [295, 255],
    [160, 255],
    [500, -2],
    [548, 268],
  ],
};

const PORTRAIT: Layout = {
  title: { x: 18, y: -16 },
  visit: { cx: 108, cy: 48, w: 130, h: 42 },
  create: { cx: 108, cy: 138, w: 140, h: 50 },
  verified: { cx: 108, cy: 238, hw: 60, hh: 38 },
  reminder: { cx: 108, cy: 345, w: 140, h: 48 },
  tour: { cx: 272, cy: 238, w: 128, h: 50 },
  db: { cx: 272, top: 322, w: 112 },
  sticky: { x: 222, y: 36 },
  guide: { x1: 12, x2: 350, y: 238 },
  links: {
    visitCreate: { d: 'M108 69 L108 104', head: head(108, 113, 'down'), len: 35 },
    createVerified: { d: 'M108 163 L108 191', head: head(108, 200, 'down'), len: 28 },
    no: {
      d: 'M108 276 L108 312',
      head: head(108, 321, 'down'),
      len: 36,
      label: { x: 108, y: 296, text: 'No' },
    },
    retry: {
      d: 'M38 345 L20 345 L20 138 L29 138',
      head: head(38, 138, 'right'),
      len: 236,
      label: { x: 20, y: 240, text: 'Retry' },
    },
    yes: {
      d: 'M168 238 L199 238',
      head: head(208, 238, 'right'),
      len: 31,
      label: { x: 188, y: 224, text: 'Yes' },
    },
    writes: {
      d: 'M272 263 L272 303',
      head: head(272, 312, 'down'),
      len: 40,
      label: { x: 272, y: 286, text: 'writes' },
    },
  },
  you: [
    [300, -30],
    [108, 48],
    [108, 138],
    [108, 238],
    [272, 253],
    [272, 240],
    [272, 190],
  ],
  teammate: [
    [350, 470],
    [108, 345],
    [24, 240],
    [282, 62],
    [330, 352],
  ],
};

const SWATCHES = ['#f87171', '#fbbf24', '#4ade80', '#60a5fa', '#c084fc'];

function Rect({ box, round, className = INK }: { box: Box; round?: boolean; className?: string }) {
  return (
    <rect
      x={box.cx - box.w / 2}
      y={box.cy - box.h / 2}
      width={box.w}
      height={box.h}
      rx={round ? box.h / 2 : 7}
      className={className}
      strokeWidth="1.75"
    />
  );
}

export function DiagramBoard({ portrait = false }: { portrait?: boolean }) {
  const L = portrait ? PORTRAIT : LANDSCAPE;
  const { tour, verified: v } = L;
  const dbBottom = L.db.top + 44;
  const dbLeft = L.db.cx - L.db.w / 2;
  const dbRight = L.db.cx + L.db.w / 2;
  const sel = {
    x: tour.cx - tour.w / 2 - 6,
    y: tour.cy - tour.h / 2 - 6,
    w: tour.w + 12,
    h: tour.h + 12,
  };
  return (
    // A phone's portrait layout sits a little lower, so the flow centres in its tall canvas.
    <g transform={portrait ? 'translate(0 24)' : undefined}>
      {/* The canvas title and its caption, as the flowchart templates open. */}
      <g className="hm-fade" style={at(0.1)}>
        <text
          x={L.title.x}
          y={L.title.y}
          fontFamily={FONT}
          fontSize="17"
          fontWeight="700"
          className="fill-(--art-text)"
        >
          Sign-up flow
        </text>
        <text
          x={L.title.x}
          y={L.title.y + 15}
          fontFamily={FONT}
          fontSize="9.5"
          className="fill-(--art-arrow-label)"
          opacity="0.85"
        >
          From first visit to a welcome tour.
        </text>
      </g>

      {/* Your three steps: dropped from the strip, labelled as they land. */}
      <Drop d={1.0}>
        <Rect box={L.visit} round />
      </Drop>
      <NodeLabel cx={L.visit.cx} cy={L.visit.cy} d={1.05} icon={lucideGlobe}>
        Visit site
      </NodeLabel>
      <Drop d={1.8}>
        <Rect box={L.create} />
      </Drop>
      <NodeLabel cx={L.create.cx} cy={L.create.cy} d={1.85} icon={lucideUser}>
        Create account
      </NodeLabel>
      <Connector {...L.links.visitCreate} at={2.0} />
      <Drop d={2.6}>
        <polygon
          points={`${v.cx},${v.cy - v.hh} ${v.cx + v.hw},${v.cy} ${v.cx},${v.cy + v.hh} ${v.cx - v.hw},${v.cy}`}
          className={INK}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </Drop>
      <NodeLabel cx={v.cx} cy={v.cy} d={2.65} size={12}>
        Verified?
      </NodeLabel>
      <Connector {...L.links.createVerified} at={3.2} />

      {/* The teammate's No branch and the Retry loop back. */}
      <Drop d={4.4}>
        <Rect box={L.reminder} />
      </Drop>
      <NodeLabel cx={L.reminder.cx} cy={L.reminder.cy} d={4.45} icon={lucideMail}>
        Send reminder
      </NodeLabel>
      <Connector {...L.links.no} at={4.8} />
      <Connector {...L.links.retry} at={5.1} />

      {/* Your Yes step lands a little low, is dragged, and snaps onto the guide. */}
      <line
        className="hm-guide"
        x1={L.guide.x1}
        y1={L.guide.y}
        x2={L.guide.x2}
        y2={L.guide.y}
        stroke="#ec4899"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <g className="hm-snap">
        <Drop d={5.0}>
          <Rect box={tour} className={`hm-recolour ${INK}`} />
        </Drop>
        {/* Its icon and label take the green's ink with it (hero-scenes/diagram.css). */}
        <g className="hd-pick">
          <NodeLabel cx={tour.cx} cy={tour.cy} d={5.05} icon={lucideSparkles}>
            Welcome tour
          </NodeLabel>
        </g>
        {/* Picked green: done. */}
        <g className="hm-pop" style={at(7.95)}>
          <circle
            cx={tour.cx + tour.w / 2 - 2}
            cy={tour.cy - tour.h / 2 + 2}
            r="8"
            fill="#16a34a"
          />
          <path
            d={`M${tour.cx + tour.w / 2 - 6} ${tour.cy - tour.h / 2 + 2} l3 3 l5 -6`}
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
      <Connector {...L.links.yes} at={6.5} />

      {/* You select it: the outline, its handles and the colour row. */}
      <g className="hm-select" style={at(7.0)}>
        <rect
          x={sel.x}
          y={sel.y}
          width={sel.w}
          height={sel.h}
          rx="3"
          fill="none"
          stroke={YOU}
          strokeWidth="1.25"
        />
        {[
          [sel.x, sel.y],
          [sel.x + sel.w, sel.y],
          [sel.x, sel.y + sel.h],
          [sel.x + sel.w, sel.y + sel.h],
        ].map(([hx, hy]) => (
          <rect
            key={`${hx}-${hy}`}
            x={hx! - 3.5}
            y={hy! - 3.5}
            width="7"
            height="7"
            rx="1.5"
            fill="white"
            stroke={YOU}
            strokeWidth="1.25"
          />
        ))}
        <g className="hm-pop" style={at(7.2)}>
          <rect
            x={tour.cx - 47}
            y={tour.cy - 64}
            width="94"
            height="26"
            rx="8"
            fill="#0f172a"
            opacity="0.08"
            transform="translate(0 2)"
          />
          <rect
            x={tour.cx - 47}
            y={tour.cy - 64}
            width="94"
            height="26"
            rx="8"
            className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
          />
          {SWATCHES.map((c, i) => (
            <circle
              key={c}
              cx={tour.cx - 33 + i * 16.5}
              cy={tour.cy - 51}
              r="5.5"
              fill={c}
              stroke={i === 2 ? '#15803d' : 'none'}
              strokeWidth="2"
            />
          ))}
        </g>
      </g>

      {/* The teammate's sticky question, and the database wired in. */}
      <Drop d={8.4}>
        <Sticky x={L.sticky.x} y={L.sticky.y} lines={['Add SSO here', 'later?']} author="JR" />
      </Drop>
      <Drop d={9.5}>
        <path
          d={`M${dbLeft} ${L.db.top} L${dbLeft} ${dbBottom} A${L.db.w / 2} 10 0 0 0 ${dbRight} ${dbBottom} L${dbRight} ${L.db.top}`}
          className={INK}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <ellipse
          cx={L.db.cx}
          cy={L.db.top}
          rx={L.db.w / 2}
          ry="10"
          className={INK}
          strokeWidth="1.75"
        />
      </Drop>
      <NodeLabel cx={L.db.cx} cy={L.db.top + 28} d={9.55} icon={lucideDatabase}>
        Users DB
      </NodeLabel>
      <Connector {...L.links.writes} at={9.8} dashed />

      {/* The two of you, live. */}
      <Cursor className="hm-you" color={YOU} name="TM" ride={L.you} />
      <Cursor className="hm-teammate" color={TEAMMATE} name="JR" ride={L.teammate} />
    </g>
  );
}
