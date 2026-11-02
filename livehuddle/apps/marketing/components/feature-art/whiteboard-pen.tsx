// Feature art for the Whiteboard category's pen cards (docs/specs/023-draw-mode/draw-mode.md): the Path
// tool and palm rejection. Split from ./whiteboard, whose palette it shares.

import { at, INK, Keycap, MUTED, Pill, Stage, SURFACE, ToolStrip } from './mode-parts';
import { PINK } from '@liveworkspace/marketing-site/components/feature-art/shared';

/** The Path tool (P): a clean curve of anchor points, the chosen one mirrored with its handles. */
export function PathToolArt() {
  const anchors: [number, number][] = [
    [34, 72],
    [214, 66],
    [262, 36],
  ];
  return (
    <Stage>
      {/* The Path tool in hand, with its key. */}
      <ToolStrip x={10} y={6} w={58}>
        <rect
          className="fill-sky-100 dark:fill-sky-500/25"
          x={13}
          y={8}
          width="13"
          height="11"
          rx="2.5"
          fill="#e0f2fe"
        />
        <path
          className="stroke-sky-600 dark:stroke-sky-300"
          d="M19.5 10 L23 15.5 L19.5 17.4 L16 15.5 Z M19.5 10 V14"
          fill="none"
          stroke="#0284c7"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <Keycap x={30} y={8.5} label="P" />
        <text className={MUTED} x={43} y={15.4} fontSize="6" fontWeight="600" fill="#64748b">
          Path
        </text>
      </ToolStrip>

      {/* Corner, Mirrored, Aligned: how the chosen point joins its two sides. */}
      <g className="fa-f-in" style={at(1.6)}>
        <rect className={SURFACE} x={196} y={6} width="96" height="15" rx="4" strokeWidth="0.8" />
        {['Corner', 'Mirrored', 'Aligned'].map((label, i) => (
          <g key={label}>
            {i === 1 ? (
              <rect
                className="fill-sky-100 dark:fill-sky-500/25"
                x={198 + i * 30.5}
                y={8}
                width="30"
                height="11"
                rx="2.5"
                fill="#e0f2fe"
              />
            ) : null}
            <text
              className={i === 1 ? 'fill-sky-700 dark:fill-sky-200' : MUTED}
              x={213 + i * 30.5}
              y={15.4}
              textAnchor="middle"
              fontSize="6"
              fontWeight="600"
              fill={i === 1 ? '#0369a1' : '#64748b'}
            >
              {label}
            </text>
          </g>
        ))}
      </g>

      <path
        className="fa-f-draw stroke-sky-500 dark:stroke-sky-400"
        pathLength={1}
        d="M34 72 C 64 72, 92 40, 130 40 S 186 72, 214 66 S 250 40, 262 36"
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* The chosen point: filled, its two handles mirrored either side. */}
      <g className="fa-f-in" style={at(1.2)}>
        <path
          className="stroke-sky-500/70 dark:stroke-sky-300/70"
          d="M100 40 H160"
          stroke="#0ea5e9"
          strokeWidth="0.8"
        />
        {[100, 160].map((x) => (
          <circle
            key={x}
            className="fill-white stroke-sky-500 dark:fill-slate-800"
            cx={x}
            cy={40}
            r="2.6"
            fill="#fff"
            stroke="#0ea5e9"
            strokeWidth="1"
          />
        ))}
        <rect x="126.5" y="36.5" width="7" height="7" rx="1" fill="#0ea5e9" />
        <rect
          className="fa-f-ring"
          x="123.5"
          y="33.5"
          width="13"
          height="13"
          rx="2.5"
          fill="none"
          stroke="#0ea5e9"
          strokeWidth="0.8"
        />
      </g>
      {anchors.map(([x, y]) => (
        <rect
          key={x}
          className="fill-white stroke-sky-500 dark:fill-slate-800"
          x={x - 3}
          y={y - 3}
          width="6"
          height="6"
          rx="1"
          fill="#fff"
          stroke="#0ea5e9"
          strokeWidth="1.1"
        />
      ))}

      {/* The next segment, waiting for the click that places it. */}
      <path
        className="fa-f-in stroke-sky-500/60"
        style={at(2)}
        d="M262 36 Q 274 40, 282 54"
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="1"
        strokeDasharray="2.4 2"
      />
      <g transform="translate(282 54)">
        <g className="fa-f-in" style={at(2)}>
          <path
            className="fill-slate-800 dark:fill-slate-100"
            d="M0 0 L5 9 L0 12 L-5 9 Z"
            fill="#1e293b"
          />
          <circle className="fill-white dark:fill-slate-900" cx="0" cy="7" r="1.2" fill="#fff" />
        </g>
      </g>
    </Stage>
  );
}

/** Palm rejection: the stylus writes, the hand resting on the glass leaves no mark. */
export function PalmRejectionArt() {
  return (
    <Stage canvas={false}>
      <defs>
        <radialGradient id="fa-f-palm-touch">
          <stop offset="0" stopColor="#10b981" stopOpacity="0.28" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fa-f-palm-pen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#475569" />
          <stop offset="1" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      {/* The tablet: a dark bezel round the board. */}
      <rect
        x="38"
        y="6"
        width="226"
        height="96"
        rx="9"
        fill="#1e293b"
        className="dark:fill-black"
      />
      <rect
        className="fill-(--art-paper)"
        x="44"
        y="12"
        width="214"
        height="90"
        rx="4"
        fill="#fbfaf7"
      />
      <circle cx="151" cy="9" r="1" fill="#475569" />

      <text className={INK} x={58} y={32} fontSize="9" fontWeight="800" fill="#1e293b">
        Notes
      </text>
      <path
        className="fa-f-draw"
        pathLength={1}
        d="M58 56 C 64 44, 72 44, 74 54 S 82 66, 90 52 S 104 42, 108 54 S 120 66, 128 50 S 142 42, 150 54 C 154 60, 160 60, 166 54"
        fill="none"
        stroke={PINK}
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* The stylus, its nib on the end of the line it is writing. */}
      <g transform="translate(166 54) rotate(32)">
        <path d="M0 0 L3 -7 L-3 -7 Z" fill="#94a3b8" />
        <path d="M0 0 L1 -2.4 L-1 -2.4 Z" fill="#0f172a" />
        <rect x="-3.4" y="-62" width="6.8" height="55.5" rx="3" fill="url(#fa-f-palm-pen)" />
      </g>
      {/* Where the palm rests on the glass: a soft contact the board ignores, so no mark lands. */}
      <ellipse cx="222" cy="76" rx="26" ry="14" fill="url(#fa-f-palm-touch)" />
      <ellipse
        className="fa-f-ring"
        cx="222"
        cy="76"
        rx="27"
        ry="15"
        fill="none"
        stroke="#10b981"
        strokeWidth="1"
        strokeDasharray="3 2.4"
      />
      <g
        transform="translate(213 67) scale(0.75)"
        fill="none"
        stroke="#059669"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="dark:stroke-emerald-300"
      >
        <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2 M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2 M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8 M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
      </g>
      <g className="fa-f-in" style={at(1.4)}>
        <Pill x={238} y={18} text="Palm ignored" tone="emerald" />
      </g>
    </Stage>
  );
}
