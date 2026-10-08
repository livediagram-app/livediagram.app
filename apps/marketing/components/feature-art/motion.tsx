// Feature illustrations for motion (docs/specs/008-canvas/canvas-and-palette.md "Animated
// elements" and the animated background patterns). Each scene is a small working diagram whose
// motion carries meaning, a status, a direction, a mood. Motion is pure CSS (fa-* and fa-d-* in
// app/feature-art-animations.css), so it survives the static export and settles to a still frame
// under prefers-reduced-motion, as the editor's own animations do. Shared marks: ./canvas-marks.
import type { CSSProperties, ReactNode } from 'react';
import { ARROW, INK, INK_TEXT, PANEL, SHADOW, Scene, TEXT_BODY, TEXT_MUTED } from './canvas-marks';
import { Frame } from './shared';

// A chip naming the animation a shape wears, under the shape.
function Tag({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <g>
      <rect
        className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        x={x - 15}
        y={y}
        width="30"
        height="10"
        rx="5"
        strokeWidth="0.7"
      />
      <text
        className={TEXT_BODY}
        x={x}
        y={y + 6.8}
        fontSize="5.4"
        fontWeight="600"
        textAnchor="middle"
      >
        {children}
      </text>
    </g>
  );
}

// Animated shapes: a little system whose status is told by motion. The API pulses for attention,
// the queue glows while it works, and the status light blinks green.
export function AnimatedShapesArt() {
  return (
    <Frame canvas>
      <Scene>
        {/* Connectors. */}
        <g className={ARROW} strokeWidth="1.1" fill="none">
          <path d="M106 40 H130" />
          <path d="M194 40 H218" />
        </g>
        <g className="fill-(--art-arrow)">
          <path d="M135 40 l-4.5 -2.6 v5.2z" />
          <path d="M223 40 l-4.5 -2.6 v5.2z" />
        </g>
        {/* Pulse: an attention ring spreading from the API. */}
        <rect
          className="fa-ripple stroke-pink-500"
          x="54"
          y="27"
          width="52"
          height="26"
          rx="7"
          fill="none"
          strokeWidth="2"
        />
        <rect
          className="fill-(--art-ink-fill) stroke-pink-500"
          x="54"
          y="27"
          width="52"
          height="26"
          rx="7"
          strokeWidth="1.6"
        />
        <circle cx="66" cy="40" r="3" fill="#ec4899" />
        <text className={INK_TEXT} x="74" y="42.6" fontSize="7.4" fontWeight="700">
          API
        </text>
        <Tag x={80} y={62}>
          Pulse
        </Tag>
        {/* Glow: a soft halo breathing round the queue. */}
        <rect
          className="fa-glow"
          x="134"
          y="24"
          width="64"
          height="32"
          rx="10"
          fill="#8b5cf6"
          style={{ filter: 'blur(5px)' } as CSSProperties}
        />
        <rect
          className="fill-(--art-ink-fill) stroke-violet-500"
          x="138"
          y="27"
          width="56"
          height="26"
          rx="7"
          strokeWidth="1.6"
        />
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={147 + i * 7}
            y="35"
            width="5"
            height="10"
            rx="1.2"
            fill="#8b5cf6"
            fillOpacity={0.35 + i * 0.25}
          />
        ))}
        <text className={INK_TEXT} x="171" y="42.6" fontSize="7.4" fontWeight="700">
          Jobs
        </text>
        <Tag x={166} y={62}>
          Glow
        </Tag>
        {/* Blink: the status light. */}
        <rect className={INK} x="226" y="27" width="52" height="26" rx="7" strokeWidth="1.4" />
        <circle cx="239" cy="40" r="5" fill="#22c55e" fillOpacity="0.22" />
        <circle className="fa-pulse" cx="239" cy="40" r="3" fill="#22c55e" />
        <text className={INK_TEXT} x="248" y="42.6" fontSize="7.4" fontWeight="700">
          Live
        </text>
        <Tag x={252} y={62}>
          Blink
        </Tag>
      </Scene>
    </Frame>
  );
}

// One stage of the pipeline: a themed box with a glyph and a name.
function Stage({ x, label, children }: { x: number; label: string; children: ReactNode }) {
  return (
    <g>
      <g className={SHADOW}>
        <rect className={INK} x={x} y="30" width="54" height="30" rx="7" strokeWidth="1.4" />
      </g>
      <g
        className="text-(--art-ink-stroke)"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </g>
      <text
        className={INK_TEXT}
        x={x + 27}
        y="54"
        fontSize="6.4"
        fontWeight="700"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

// Flowing arrows: a data pipeline that reads its own direction, three connectors in three of the
// flow styles, marching dashes, travelling dots and a signal packet racing the line.
export function FlowingArrowsArt() {
  return (
    <Frame canvas>
      <Scene>
        <Stage x={14} label="Events">
          <path d="M33 37 l3 4 3 -6 3 8 3 -4" />
        </Stage>
        <Stage x={104} label="Transform">
          <circle cx="131" cy="40" r="3.4" />
          <path d="M131 34.5v1.6M131 43.9v1.6M125.5 40h1.6M134.9 40h1.6" />
        </Stage>
        <Stage x={194} label="Warehouse">
          <ellipse cx="221" cy="36" rx="5" ry="1.8" />
          <path d="M216 36v7a5 1.8 0 0 0 10 0v-7" />
        </Stage>
        {/* Marching dashes. */}
        <path
          className="fa-flow stroke-(--art-arrow)"
          d="M68 45 H98"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <path className="fill-(--art-arrow)" d="M103 45 l-5 -3 v6z" />
        {/* Travelling dots. */}
        <path
          className="fa-d-dots stroke-sky-500 dark:stroke-sky-400"
          d="M158 45 H188"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeDasharray="0.01 6"
          fill="none"
        />
        <path className="fill-sky-500 dark:fill-sky-400" d="M193 45 l-5 -3 v6z" />
        {/* The packet, over a quiet line. */}
        <path
          className="stroke-(--art-arrow)"
          strokeOpacity="0.3"
          d="M248 45 H282"
          strokeWidth="1.6"
          fill="none"
        />
        <circle
          className="fa-d-packet fill-pink-500"
          style={{ '--dx': '30px' } as CSSProperties}
          cx="250"
          cy="45"
          r="2.8"
        />
        <path className="fill-(--art-arrow)" d="M287 45 l-5 -3 v6z" />
        <g>
          {[
            [83, 'Dashes'],
            [173, 'Dots'],
            [266, 'Signal'],
          ].map(([x, label]) => (
            <text
              key={label}
              className={TEXT_MUTED}
              x={x as number}
              y="75"
              fontSize="5.6"
              fontWeight="600"
              textAnchor="middle"
            >
              {label}
            </text>
          ))}
        </g>
      </Scene>
    </Frame>
  );
}

// Living backgrounds: the Aurora pattern, soft colour fields drifting behind a diagram, with the
// Background picker showing the pattern and its speed.
export function LivingBackgroundArt() {
  const fields = [
    { cx: 70, cy: 30, r: 46, color: '#38bdf8', ax: '26px', ay: '10px', delay: '0s' },
    { cx: 170, cy: 70, r: 50, color: '#a78bfa', ax: '-22px', ay: '-8px', delay: '-3s' },
    { cx: 250, cy: 26, r: 40, color: '#34d399', ax: '-18px', ay: '12px', delay: '-6s' },
  ];
  return (
    <Frame canvas>
      <Scene>
        <defs>
          <filter id="fa-d-aurora-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>
        <g filter="url(#fa-d-aurora-blur)" className="opacity-45 dark:opacity-35">
          {fields.map((f) => (
            <circle
              key={f.color}
              className="fa-d-aurora"
              style={{ '--ax': f.ax, '--ay': f.ay, animationDelay: f.delay } as CSSProperties}
              cx={f.cx}
              cy={f.cy}
              r={f.r}
              fill={f.color}
            />
          ))}
        </g>
        {/* A diagram on the living backdrop. */}
        <g className={SHADOW}>
          <rect className={INK} x="36" y="36" width="50" height="24" rx="6" strokeWidth="1.4" />
          <rect className={INK} x="122" y="36" width="50" height="24" rx="6" strokeWidth="1.4" />
        </g>
        <text
          className={INK_TEXT}
          x="61"
          y="50.5"
          fontSize="6.8"
          fontWeight="700"
          textAnchor="middle"
        >
          Idea
        </text>
        <text
          className={INK_TEXT}
          x="147"
          y="50.5"
          fontSize="6.8"
          fontWeight="700"
          textAnchor="middle"
        >
          Pitch
        </text>
        <path className={ARROW} d="M86 48 H117" strokeWidth="1.2" fill="none" />
        <path className="fill-(--art-arrow)" d="M122 48 l-5 -3 v6z" />
        {/* The Background picker, Aurora chosen, its speed slider. */}
        <g className={SHADOW}>
          <rect className={PANEL} x="196" y="14" width="90" height="68" rx="6" strokeWidth="0.8" />
        </g>
        <text
          className={TEXT_MUTED}
          x="204"
          y="25"
          fontSize="5.2"
          fontWeight="700"
          letterSpacing="0.5"
        >
          BACKGROUND
        </text>
        {['Flow', 'Drift', 'Aurora'].map((name, i) => {
          const x = 204 + i * 26;
          const on = name === 'Aurora';
          return (
            <g key={name}>
              <rect
                className={
                  on
                    ? 'stroke-brand-500 dark:stroke-brand-400'
                    : 'stroke-slate-200 dark:stroke-slate-700'
                }
                x={x}
                y="30"
                width="22"
                height="18"
                rx="3"
                fill={on ? 'url(#fa-d-aurora-swatch)' : 'transparent'}
                strokeWidth={on ? 1.3 : 0.7}
              />
              {name === 'Flow' ? (
                <path
                  className="stroke-slate-300 dark:stroke-slate-600"
                  d={`M${x + 3} 44 l8 -10 M${x + 9} 44 l8 -10 M${x + 15} 44 l5 -6`}
                  strokeWidth="1"
                />
              ) : null}
              {name === 'Drift' ? (
                <g className="fill-slate-300 dark:fill-slate-600">
                  <circle cx={x + 6} cy="42" r="1.4" />
                  <circle cx={x + 12} cy="36" r="1.1" />
                  <circle cx={x + 17} cy="41" r="1.6" />
                </g>
              ) : null}
              <text
                className={on ? 'fill-brand-600 dark:fill-brand-300' : TEXT_MUTED}
                x={x + 11}
                y="56"
                fontSize="5.2"
                fontWeight="600"
                textAnchor="middle"
              >
                {name}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="fa-d-aurora-swatch" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#38bdf8" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="#a78bfa" stopOpacity="0.55" />
            <stop offset="1" stopColor="#34d399" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <text className={TEXT_BODY} x="204" y="70" fontSize="5.2" fontWeight="600">
          Speed
        </text>
        <rect
          className="fill-slate-200 dark:fill-slate-700"
          x="226"
          y="67.5"
          width="52"
          height="2.5"
          rx="1.25"
        />
        <rect
          className="fill-brand-500 dark:fill-brand-400"
          x="226"
          y="67.5"
          width="22"
          height="2.5"
          rx="1.25"
        />
        <circle
          className="fill-white stroke-brand-500 dark:fill-slate-900 dark:stroke-brand-400"
          cx="248"
          cy="68.75"
          r="3"
          strokeWidth="1.2"
        />
      </Scene>
    </Frame>
  );
}

// One tile of the Animated set: its glyph moving in place, its name under it.
function IconTile({
  x,
  label,
  picked = false,
  children,
}: {
  x: number;
  label: string;
  picked?: boolean;
  children: ReactNode;
}) {
  return (
    <g>
      <rect
        className={
          picked
            ? 'fill-brand-50 stroke-brand-500 dark:fill-brand-500/15 dark:stroke-brand-400'
            : 'fill-transparent stroke-slate-200 dark:stroke-slate-700'
        }
        x={x}
        y="36"
        width="24"
        height="22"
        rx="4"
        strokeWidth={picked ? 1.2 : 0.7}
      />
      <svg x={x + 5} y="40" width="14" height="14" viewBox="0 0 24 24" overflow="visible">
        {children}
      </svg>
      <text
        className={picked ? 'fill-brand-600 dark:fill-brand-300' : TEXT_MUTED}
        x={x + 12}
        y="66"
        fontSize="5"
        fontWeight="600"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

const GLYPH = 'stroke-sky-600 dark:stroke-sky-300';

// Animated icons: the Icons picker on its Animated set, every glyph moving in place, and the gear
// dropped onto the canvas turning inside a build step.
export function AnimatedIconsArt() {
  return (
    <Frame canvas>
      <Scene>
        <g className={SHADOW}>
          <rect className={PANEL} x="12" y="12" width="148" height="64" rx="6" strokeWidth="0.8" />
        </g>
        {['All', 'Animated', 'Tech'].map((chip, i) => {
          const on = chip === 'Animated';
          const x = [20, 38, 74][i]!;
          const w = [14, 32, 20][i]!;
          return (
            <g key={chip}>
              <rect
                className={on ? 'fill-brand-500' : 'fill-slate-100 dark:fill-slate-800'}
                x={x}
                y="20"
                width={w}
                height="10"
                rx="5"
              />
              <text
                className={on ? '' : TEXT_BODY}
                fill={on ? '#fff' : undefined}
                x={x + w / 2}
                y="26.8"
                fontSize="5.4"
                fontWeight="600"
                textAnchor="middle"
              >
                {chip}
              </text>
            </g>
          );
        })}
        <IconTile x={20} label="Spinner">
          <path
            className={`fa-spin-cont ${GLYPH}`}
            d="M12 3a9 9 0 1 1-7 3.3"
            fill="none"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </IconTile>
        <IconTile x={48} label="Gear" picked>
          <g className={`fa-spin-cont ${GLYPH}`} strokeWidth="2" fill="none">
            {Array.from({ length: 8 }, (_, i) => (
              <line
                key={i}
                x1="12"
                y1="2.5"
                x2="12"
                y2="5.5"
                transform={`rotate(${i * 45} 12 12)`}
              />
            ))}
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2.4" />
          </g>
        </IconTile>
        <IconTile x={76} label="Heart">
          <path
            className="fa-beat"
            d="M12 20.5S4 14.5 4 9a3.6 3.6 0 0 1 8-2.6A3.6 3.6 0 0 1 20 9c0 5.5-8 11.5-8 11.5Z"
            fill="#f43f5e"
          />
        </IconTile>
        <IconTile x={104} label="Signal">
          <g className={GLYPH} fill="none" strokeWidth="2.2" strokeLinecap="round">
            <circle
              cx="12"
              cy="18"
              r="1.8"
              className="fill-sky-600 dark:fill-sky-300"
              stroke="none"
            />
            <path className="fa-pulse" d="M7.5 14a6 6 0 0 1 9 0" />
            <path
              className="fa-pulse"
              style={{ animationDelay: '0.4s' }}
              d="M4.5 10.5a10.5 10.5 0 0 1 15 0"
            />
          </g>
        </IconTile>
        <IconTile x={132} label="Bell">
          <g className={GLYPH} fill="none" strokeWidth="2" strokeLinejoin="round">
            <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
            <path className="fa-pulse" d="M10 20.5a2 2 0 0 0 4 0" />
            <path
              className="fa-pulse"
              style={{ animationDelay: '0.5s' }}
              d="M20.5 6.5a5 5 0 0 1 1.5 3.5M3.5 6.5A5 5 0 0 0 2 10"
              strokeLinecap="round"
            />
          </g>
        </IconTile>
        {/* On the canvas: the gear turning inside the build step. */}
        <path
          className={ARROW}
          d="M164 44 H186"
          strokeWidth="1.1"
          strokeDasharray="2.5 2.5"
          fill="none"
        />
        <path className="fill-(--art-arrow)" d="M191 44 l-5 -3 v6z" />
        <g className={SHADOW}>
          <rect className={INK} x="196" y="28" width="88" height="32" rx="7" strokeWidth="1.4" />
        </g>
        <svg x="204" y="35" width="18" height="18" viewBox="0 0 24 24" overflow="visible">
          <g className="fa-spin-cont stroke-(--art-ink-stroke)" strokeWidth="2" fill="none">
            {Array.from({ length: 8 }, (_, i) => (
              <line
                key={i}
                x1="12"
                y1="2.5"
                x2="12"
                y2="5.5"
                transform={`rotate(${i * 45} 12 12)`}
              />
            ))}
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2.4" />
          </g>
        </svg>
        <text className={INK_TEXT} x="227" y="42" fontSize="6.8" fontWeight="700">
          Build
        </text>
        <text className={INK_TEXT} opacity="0.6" x="227" y="50.5" fontSize="5.4" fontWeight="500">
          running · 2m
        </text>
      </Scene>
    </Frame>
  );
}
