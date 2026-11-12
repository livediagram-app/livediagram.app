// Feature illustrations for drawing on the canvas (re-exported by ./versatility): shape recognition
// in Draw mode, alignment guides and canvas backdrops. Each is drawn on the full-width 300 by 96
// card stage from the parts in ./versatility-parts with a light and a dark half, moving with the
// shared fa-* loops plus the fa-c-* ones (app/feature-art/versatility.css).

import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import {
  ArrowHead,
  Chip,
  INK,
  LINK,
  MUTED_TEXT,
  Node,
  PANEL,
  PANEL_TEXT,
  Pointer,
  Selection,
  STAGE,
  WandIcon,
  delay,
} from '@liveworkspace/marketing-site/components/feature-art/versatility-parts';

/* ──────────────── Drawing, guides, backdrops ──────────────── */

// Shape recognition in Draw mode: a rough box drawn in marker, lifted the moment the pen does and
// replaced by the clean shape it meant, beside the Shape recognition switch and a legend of what
// it knows.
export function PencilArt() {
  const rough =
    'M30 26 C 52 21, 96 20, 126 24 C 130 38, 131 56, 128 70 C 100 74, 60 75, 33 71 C 28 56, 27 40, 31 27';
  return (
    <Frame canvas>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        <path
          className={`fa-c-draw ${INK}`}
          d={rough}
          pathLength={1}
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* The marker in hand while it draws. */}
        <g className="fa-c-before" transform="translate(31 27) rotate(-35)">
          <rect
            className="fill-slate-700 dark:fill-slate-300"
            x="-2.4"
            y="-22"
            width="4.8"
            height="17"
            rx="1.4"
          />
          <path className="fill-slate-900 dark:fill-white" d="M-2.4 -5 L2.4 -5 L0 0 Z" />
        </g>
        <g className="fa-c-snap">
          <rect
            className={INK}
            x="30"
            y="24"
            width="98"
            height="48"
            rx="2"
            fill="none"
            strokeWidth="2.6"
          />
          <Selection x={30} y={24} w={98} h={48} pad={4} />
        </g>
        <path
          className="stroke-slate-400 dark:stroke-slate-500"
          d="M146 48 H162 M158 44 L162 48 L158 52"
          fill="none"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* What it recognises. */}
        <rect className={PANEL} x="174" y="30" width="116" height="56" rx="6" strokeWidth="1" />
        <text
          className={MUTED_TEXT}
          x="182"
          y="42"
          fontSize="6"
          fontWeight="700"
          letterSpacing="0.3"
        >
          RECOGNISES
        </text>
        <g
          className="stroke-slate-600 dark:stroke-slate-300"
          fill="none"
          strokeWidth="1.3"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <circle cx="190" cy="61" r="7" />
          <rect x="206" y="54" width="15" height="14" rx="1" />
          <path d="M235 53.5 L243 68 L227 68 Z" />
          <path d="M256 53 L263 61 L256 69 L249 61 Z" />
          <path d="M270 68 L283 54" />
        </g>
        <text className={MUTED_TEXT} x="232" y="80" fontSize="5.4" textAnchor="middle">
          Hold still to preview, lift to snap
        </text>
      </svg>
      <Chip className="right-2 top-2">
        <WandIcon /> Shape recognition
        <span className="ml-0.5 flex h-2.5 w-4.5 items-center rounded-full bg-emerald-500 px-px">
          <span className="ml-auto h-2 w-2 rounded-full bg-white" />
        </span>
      </Chip>
    </Frame>
  );
}

// Alignment guides: a shape dragged across the canvas settles where its left edge meets the shape
// above and its top meets the shape beside it, and the guides light up the moment it does.
export function AlignmentGuidesArt() {
  return (
    <Frame canvas>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        <Node x={30} y={14} w={64} h={24} label="Plan" tone="sky" />
        <Node x={188} y={14} w={64} h={24} label="Build" tone="violet" />
        <Node x={30} y={60} w={64} h={24} label="Ship" tone="emerald" />
        <Node x={110} y={14} w={60} h={24} label="Design" tone="pink" />

        {/* The guides, once it lands. */}
        <g
          className="fa-c-arrive stroke-pink-500 dark:stroke-pink-400"
          strokeWidth="1"
          strokeDasharray="3 2.5"
        >
          <path d="M188 6 V92" />
          <path d="M14 60 H286" />
        </g>
        <g className="fa-c-arrive stroke-pink-500 dark:stroke-pink-400" strokeWidth="1.1">
          {[
            [188, 38],
            [188, 60],
            [94, 60],
          ].map(([x, y]) => (
            <path
              key={`${x}-${y}`}
              d={`M${x! - 2} ${y! - 2} L${x! + 2} ${y! + 2} M${x! + 2} ${y! - 2} L${x! - 2} ${y! + 2}`}
            />
          ))}
        </g>

        {/* The shape being dragged, travelling onto its mark. */}
        <g className="fa-c-drag">
          <Node x={188} y={60} w={64} h={24} label="Test" tone="amber" />
          <Selection x={188} y={60} w={64} h={24} />
          <Pointer x={226} y={75} name="You" color="#0ea5e9" />
        </g>
      </svg>
    </Frame>
  );
}

// Canvas backdrop: a board whose backdrop walks through grid, dots, lines and isometric under the
// same sticky and shapes, while the Backdrop picker beside it marks each in turn.
export function CanvasBackdropArt() {
  const kinds = ['grid', 'dots', 'lines', 'iso'] as const;
  return (
    <Frame>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        <defs>
          <ArrowHead id="fac-bd-head" />
          <pattern id="fac-bd-grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path
              className="stroke-slate-300 dark:stroke-slate-700"
              d="M8 0 H0 V8"
              fill="none"
              strokeWidth="0.6"
            />
          </pattern>
          <pattern id="fac-bd-dots" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle className="fill-slate-400 dark:fill-slate-600" cx="3.5" cy="3.5" r="0.75" />
          </pattern>
          <pattern id="fac-bd-lines" width="8" height="7" patternUnits="userSpaceOnUse">
            <path
              className="stroke-sky-300/70 dark:stroke-slate-700"
              d="M0 6.5 H8"
              strokeWidth="0.6"
            />
          </pattern>
          <pattern id="fac-bd-iso" width="10" height="17.32" patternUnits="userSpaceOnUse">
            <path
              className="stroke-slate-300 dark:stroke-slate-700"
              d="M0 0 L10 17.32 M10 0 L0 17.32 M5 0 V17.32"
              fill="none"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        {/* The board. */}
        <rect
          className="fill-(--art-paper) stroke-slate-200 dark:stroke-slate-800"
          x="10"
          y="6"
          width="190"
          height="84"
          rx="5"
          strokeWidth="1"
        />
        {kinds.map((k, i) => (
          <rect
            key={k}
            className={`fa-c-quarter ${i === 0 ? 'fa-c-first' : ''}`}
            style={delay(i * 2)}
            x="11"
            y="7"
            width="188"
            height="82"
            rx="4"
            fill={`url(#fac-bd-${k})`}
          />
        ))}
        <g transform="rotate(-3 46 46)">
          <rect
            className="fill-amber-200 dark:fill-amber-400"
            x="26"
            y="26"
            width="42"
            height="40"
            rx="1.5"
          />
          <text className="fill-amber-900" fontSize="7" fontWeight="600">
            <tspan x="31" y="40">
              Fewer
            </tspan>
            <tspan x="31" y="50">
              meetings
            </tspan>
          </text>
        </g>
        <Node x={90} y={24} w={56} h={22} label="Retro" tone="sky" />
        <Node x={124} y={58} w={60} h={22} label="Actions" tone="emerald" />
        <path
          className={LINK}
          d="M118 46 V52 H140 V57"
          fill="none"
          strokeWidth="1.3"
          strokeLinejoin="round"
          markerEnd="url(#fac-bd-head)"
        />

        {/* The picker. */}
        <rect className={PANEL} x="210" y="6" width="80" height="84" rx="5" strokeWidth="1" />
        <text className={PANEL_TEXT} x="217" y="17" fontSize="6.5" fontWeight="700">
          Backdrop
        </text>
        {kinds.map((k, i) => {
          const x = 218 + (i % 2) * 34;
          const y = 23 + Math.floor(i / 2) * 33;
          return (
            <g key={k}>
              <rect
                className="fill-(--art-paper) stroke-slate-200 dark:stroke-slate-700"
                x={x}
                y={y}
                width="30"
                height="22"
                rx="3"
                strokeWidth="0.8"
              />
              <rect
                x={x + 0.5}
                y={y + 0.5}
                width="29"
                height="21"
                rx="2.5"
                fill={`url(#fac-bd-${k})`}
              />
              <rect
                className={`fa-c-quarter ${i === 0 ? 'fa-c-first ' : ''}stroke-sky-500 dark:stroke-sky-400`}
                style={delay(i * 2)}
                x={x - 1.5}
                y={y - 1.5}
                width="33"
                height="25"
                rx="4"
                fill="none"
                strokeWidth="1.5"
              />
              <text className={MUTED_TEXT} x={x + 15} y={y + 29} fontSize="5.4" textAnchor="middle">
                {k === 'iso' ? 'Isometric' : k[0]!.toUpperCase() + k.slice(1)}
              </text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}
