import type { CSSProperties, ReactNode } from 'react';

// The hero's Diagram window (docs/specs/019-marketing/marketing-site.md "Hero"): two people map a
// sign-up flow together in Diagram mode. Inside a frame, you drop three steps from the strip (each
// label typed as it lands) and they join up with arrows; a teammate adds the "No" branch and a
// Retry loop back; you add the "Yes" step slightly off, drag it, and it snaps onto the pink
// alignment guide; you select it and pick green from the colour row; the teammate leaves a sticky
// question and wires a database in with a dashed connector. Every shape is in the Default theme's
// ink (the --art-* palette), so it looks as the editor draws it. Each piece arrives at its own --d
// delay and the two cursors ride CSS motion paths timed to the drops (hero-mode-animations.css).

const FONT = 'ui-sans-serif, system-ui, sans-serif';
const INK = 'fill-(--art-ink-fill) stroke-(--art-ink-stroke)';
const LABEL = 'fill-(--art-ink-text)';
const ARROW = 'stroke-(--art-arrow)';
const YOU = '#0ea5e9';
const TEAMMATE = '#ec4899';

const at = (d: number, extra?: Record<string, string | number>) =>
  ({ '--d': `${d}s`, ...extra }) as CSSProperties;

// A label typed out over `dur` seconds once its shape lands.
function Typed({
  x,
  y,
  d,
  children,
  size = 13,
}: {
  x: number;
  y: number;
  d: number;
  children: string;
  size?: number;
}) {
  return (
    <text
      className={`hm-type ${LABEL}`}
      style={at(d, { '--steps': children.length })}
      x={x}
      y={y}
      textAnchor="middle"
      fontFamily={FONT}
      fontSize={size}
      fontWeight="600"
      stroke="none"
    >
      {children}
    </text>
  );
}

// A connector that draws on, its head last, with an optional label on a canvas-coloured chip.
function Connector({
  d: path,
  at: start,
  len,
  dashed = false,
  label,
}: {
  d: string;
  at: number;
  len: number;
  dashed?: boolean;
  label?: { x: number; y: number; text: string };
}) {
  return (
    <g>
      <path
        className={`${dashed ? 'hm-fade' : 'hm-draw'} ${ARROW}`}
        style={at(start, { '--dur': '0.45s', '--len': len })}
        d={path}
        fill="none"
        strokeWidth="2"
        strokeDasharray={dashed ? '6 5' : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {label ? (
        <g className="hm-pop" style={at(start + 0.35)}>
          <rect
            x={label.x - (label.text.length * 6 + 10) / 2}
            y={label.y - 10}
            width={label.text.length * 6 + 10}
            height="15"
            rx="4"
            className="fill-(--art-paper)"
          />
          <text
            x={label.x}
            y={label.y + 1}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize="10"
            fontWeight="600"
            className="fill-(--art-arrow-label)"
          >
            {label.text}
          </text>
        </g>
      ) : null}
    </g>
  );
}

// A shape that lands with a small overshoot.
function Drop({ d, children }: { d: number; children: ReactNode }) {
  return (
    <g className="hm-pop" style={at(d)}>
      {children}
    </g>
  );
}

function Cursor({ className, color, name }: { className: string; color: string; name: string }) {
  return (
    <g className={className} aria-hidden>
      <path
        d="M0 0 L12 7 L7 8 L9.5 12.5 L7.5 13.5 L5 9 L1.5 12.5 Z"
        fill={color}
        stroke="white"
        strokeWidth="1"
      />
      <rect x="10" y="12" width="22" height="13" rx="3" fill={color} />
      <text
        x="21"
        y="21.5"
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="8"
        fontWeight="700"
        fill="white"
      >
        {name}
      </text>
    </g>
  );
}

const SWATCHES = ['#f87171', '#fbbf24', '#4ade80', '#60a5fa', '#c084fc'];

export function DiagramBoard() {
  return (
    <>
      {/* The frame the flow lives in, with its name. */}
      <g className="hm-fade" style={at(0.1)}>
        <rect
          x="20"
          y="-44"
          width="560"
          height="340"
          rx="10"
          fill="none"
          className="stroke-(--art-ink-stroke)"
          strokeWidth="1.5"
          strokeDasharray="6 5"
          opacity="0.6"
        />
        <text
          x="34"
          y="-26"
          fontFamily={FONT}
          fontSize="11"
          fontWeight="700"
          className="fill-(--art-ink-text)"
        >
          Sign-up flow
        </text>
      </g>

      {/* Your three steps: dropped from the strip, labelled as they land. */}
      <Drop d={1.0}>
        <rect x="50" y="10" width="120" height="44" rx="22" className={INK} strokeWidth="2" />
      </Drop>
      <Typed x={110} y={37} d={1.1}>
        Visit site
      </Typed>
      <Drop d={1.8}>
        <rect x="50" y="110" width="120" height="50" rx="8" className={INK} strokeWidth="2" />
      </Drop>
      <Typed x={110} y={140} d={1.9}>
        Create account
      </Typed>
      <Connector d="M110 54 L110 110 M104 103 L110 110 L116 103" at={2.0} len={70} />
      <Drop d={2.6}>
        <polygon points="290,95 360,135 290,175 220,135" className={INK} strokeWidth="2" />
      </Drop>
      <Typed x={290} y={139} d={2.7} size={12}>
        Verified?
      </Typed>
      <Connector d="M170 135 L220 135 M213 129 L220 135 L213 141" at={3.2} len={60} />

      {/* The teammate's No branch and the Retry loop back. */}
      <Drop d={4.4}>
        <rect x="225" y="230" width="130" height="50" rx="8" className={INK} strokeWidth="2" />
      </Drop>
      <Typed x={290} y={260} d={4.5}>
        Send reminder
      </Typed>
      <Connector
        d="M290 175 L290 230 M284 223 L290 230 L296 223"
        at={4.8}
        len={70}
        label={{ x: 290, y: 205, text: 'No' }}
      />
      <Connector
        d="M225 255 L110 255 L110 160 M104 167 L110 160 L116 167"
        at={5.1}
        len={230}
        label={{ x: 160, y: 255, text: 'Retry' }}
      />

      {/* Your Yes step lands a little low, is dragged, and snaps onto the guide. */}
      <line
        className="hm-guide"
        x1="40"
        y1="135"
        x2="565"
        y2="135"
        stroke="#ec4899"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <g className="hm-snap">
        <Drop d={5.0}>
          <rect
            x="410"
            y="110"
            width="130"
            height="50"
            rx="8"
            className={`hm-recolour ${INK}`}
            strokeWidth="2"
          />
        </Drop>
        <Typed x={475} y={140} d={5.1}>
          Welcome tour
        </Typed>
        {/* Picked green: done. */}
        <g className="hm-pop" style={at(7.95)}>
          <circle cx="532" cy="112" r="8" fill="#16a34a" />
          <path
            d="M528 112 l3 3 l5 -6"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
      <Connector
        d="M360 135 L410 135 M403 129 L410 135 L403 141"
        at={6.5}
        len={60}
        label={{ x: 384, y: 126, text: 'Yes' }}
      />

      {/* You select it: the outline, its handles and the colour row. */}
      <g className="hm-select" style={at(7.0)}>
        <rect x="404" y="104" width="142" height="62" fill="none" stroke={YOU} strokeWidth="1.5" />
        {[
          [404, 104],
          [546, 104],
          [404, 166],
          [546, 166],
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
            strokeWidth="1.5"
          />
        ))}
        <g className="hm-pop" style={at(7.2)}>
          <rect
            x="430"
            y="68"
            width="96"
            height="26"
            rx="7"
            className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
          />
          {SWATCHES.map((c, i) => (
            <circle
              key={c}
              cx={445 + i * 16.5}
              cy="81"
              r="6"
              fill={c}
              stroke={i === 2 ? '#15803d' : 'none'}
              strokeWidth="2"
            />
          ))}
        </g>
      </g>

      {/* The teammate's sticky question, and the database wired in. */}
      <Drop d={8.4}>
        <g transform="rotate(2 470 15)">
          <rect x="412" y="-28" width="118" height="64" rx="3" fill="#0f172a" opacity="0.08" />
          <rect x="410" y="-31" width="118" height="64" rx="3" fill="#fde68a" />
          <text x="422" y="-8" fontFamily={FONT} fontSize="11" fontWeight="600" fill="#1c1917">
            Add SSO here
          </text>
          <text x="422" y="8" fontFamily={FONT} fontSize="11" fontWeight="600" fill="#1c1917">
            later? – JR
          </text>
        </g>
      </Drop>
      <Drop d={9.5}>
        <path
          d="M420 228 L420 270 A55 10 0 0 0 530 270 L530 228"
          className={INK}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <ellipse cx="475" cy="228" rx="55" ry="10" className={INK} strokeWidth="2" />
      </Drop>
      <Typed x={475} y={258} d={9.6}>
        Users DB
      </Typed>
      <Connector
        d="M475 166 L475 218 M469 211 L475 218 L481 211"
        at={9.8}
        len={60}
        dashed
        label={{ x: 498, y: 195, text: 'writes' }}
      />

      {/* The two of you, live. */}
      <Cursor className="hm-you" color={YOU} name="TM" />
      <Cursor className="hm-teammate" color={TEAMMATE} name="JR" />
    </>
  );
}
