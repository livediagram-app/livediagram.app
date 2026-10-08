// Feature illustrations for the breadth of the canvas: shapes, notes, borders, arrows, shape
// recognition, alignment guides and backdrops (the AI assistant, rotation and sizing, Zen mode,
// fonts, and Markdown and Mermaid live in ./versatility-more, re-exported here). Each is a small
// mock of the editor surface its card describes, drawn on the full-width 300 by 96 card stage from
// the parts in ./versatility-parts with a light and a dark half, and moving with the shared fa-*
// loops plus the fa-c-* ones (app/feature-art-animations.css), which settle to the finished frame
// under reduced motion.

import { Frame } from './shared';
import {
  ArrowHead,
  Chip,
  HAIRLINE,
  INK,
  LINK,
  MUTED_TEXT,
  Node,
  PANEL,
  PANEL_TEXT,
  Pointer,
  SELECT,
  Selection,
  STAGE,
  TONE_SHAPE,
  TONE_TEXT,
  WandIcon,
  delay,
} from './versatility-parts';

export {
  AiAssistArt,
  FontsArt,
  MarkdownImportArt,
  MermaidArt,
  RotateArt,
  ZenModeArt,
} from './versatility-more';

/* ──────────────── Shapes, notes, borders, arrows ──────────────── */

// The shape library: the Shapes panel on the left with its tiles, the brand highlight walking the
// tiles, and on the canvas the shapes they make landing one after another: a cloud, a phone frame,
// a star, a speech bubble, an actor and a browser frame.
export function ShapesArt() {
  const tiles = [
    'rect',
    'circle',
    'diamond',
    'cloud',
    'star',
    'bubble',
    'phone',
    'browser',
    'actor',
  ];
  return (
    <Frame canvas>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        <rect className={PANEL} x="10" y="6" width="72" height="84" rx="5" strokeWidth="1" />
        <text className={PANEL_TEXT} x="17" y="17" fontSize="6.5" fontWeight="700">
          Shapes
        </text>
        {tiles.map((t, i) => {
          const x = 16 + (i % 3) * 21;
          const y = 23 + Math.floor(i / 3) * 21;
          return (
            <g key={t}>
              <rect
                className="fill-slate-50 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
                x={x}
                y={y}
                width="18"
                height="17"
                rx="3"
                strokeWidth="0.8"
              />
              <rect
                className="fa-hl fill-sky-500/10 stroke-sky-500 dark:stroke-sky-400"
                style={delay(i * 0.66)}
                x={x}
                y={y}
                width="18"
                height="17"
                rx="3"
                strokeWidth="1.2"
              />
              <TileGlyph kind={t} x={x + 9} y={y + 8.5} />
            </g>
          );
        })}

        {/* The canvas: what the tiles drop, landing one after another. */}
        <g className="fa-pop" style={delay(0)}>
          <path
            className={TONE_SHAPE.sky}
            transform="translate(104 10) scale(1.15)"
            d="M7 24 C1 24 0 15 7 14.5 C7 7 16 4 21 9.5 C24 3 34 4 35 12 C41 12 42 24 35 24 Z"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </g>
        <g className="fa-pop" style={delay(0.35)}>
          <rect
            className="fill-slate-800 stroke-slate-800 dark:fill-slate-950 dark:stroke-slate-500"
            x="176"
            y="8"
            width="24"
            height="44"
            rx="5"
            strokeWidth="1"
          />
          <rect
            className="fill-sky-100 dark:fill-sky-500/30"
            x="178.5"
            y="12"
            width="19"
            height="36"
            rx="2"
          />
          <rect className="fill-sky-400" x="181" y="16" width="14" height="3" rx="1.5" />
          <rect
            className="fill-white/80 dark:fill-sky-200/40"
            x="181"
            y="22"
            width="10"
            height="2"
            rx="1"
          />
          <rect
            className="fill-white/80 dark:fill-sky-200/40"
            x="181"
            y="26"
            width="12"
            height="2"
            rx="1"
          />
          <rect className="fill-sky-500" x="181" y="40" width="14" height="4" rx="2" />
          <rect
            className="fill-slate-800 dark:fill-slate-500"
            x="184.5"
            y="9.2"
            width="7"
            height="1.6"
            rx="0.8"
          />
        </g>
        <g className="fa-pop" style={delay(0.7)}>
          <path
            className={TONE_SHAPE.violet}
            d={starPath(254, 28, 15, 6.4)}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </g>
        <g className="fa-pop" style={delay(1.05)}>
          <path
            className={TONE_SHAPE.emerald}
            transform="translate(104 54)"
            d="M0 5 a5 5 0 0 1 5-5 h40 a5 5 0 0 1 5 5 v13 a5 5 0 0 1-5 5 h-30 l-7 7 v-7 h-3 a5 5 0 0 1-5-5 z"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <text
            className={TONE_TEXT.emerald}
            x="129"
            y="68.5"
            fontSize="7.5"
            fontWeight="700"
            textAnchor="middle"
          >
            Ship it!
          </text>
        </g>
        <g className="fa-pop" style={delay(1.4)}>
          <g
            className="stroke-amber-500 dark:stroke-amber-400"
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle className="fill-amber-50 dark:fill-amber-500/15" cx="188" cy="62" r="5.5" />
            <path d="M188 67.5 V80 M179 71.5 H197 M188 80 L181 90 M188 80 L195 90" />
          </g>
        </g>
        <g className="fa-pop" style={delay(1.75)}>
          <rect
            className={TONE_SHAPE.slate}
            x="226"
            y="56"
            width="64"
            height="34"
            rx="3"
            strokeWidth="1.2"
          />
          <path className={HAIRLINE} d="M226 63 H290" strokeWidth="1" />
          <circle className="fill-rose-400" cx="230.5" cy="59.5" r="1.2" />
          <circle className="fill-amber-400" cx="234.5" cy="59.5" r="1.2" />
          <circle className="fill-emerald-400" cx="238.5" cy="59.5" r="1.2" />
          <rect className="fill-sky-400" x="231" y="67" width="28" height="3.2" rx="1.6" />
          <rect
            className="fill-slate-200 dark:fill-slate-700"
            x="231"
            y="73.5"
            width="52"
            height="2"
            rx="1"
          />
          <rect
            className="fill-slate-200 dark:fill-slate-700"
            x="231"
            y="77.5"
            width="42"
            height="2"
            rx="1"
          />
          <rect className="fill-sky-500" x="231" y="82" width="16" height="4.5" rx="2.25" />
        </g>
      </svg>
    </Frame>
  );
}

// A five-point star centred on (cx, cy).
function starPath(cx: number, cy: number, r: number, inner: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : inner;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

// The glyph on a Shapes panel tile, centred on (x, y), in the panel's ink.
function TileGlyph({ kind, x, y }: { kind: string; x: number; y: number }) {
  const s = 'stroke-slate-500 dark:stroke-slate-300';
  const g = (d: string) => (
    <path
      className={s}
      d={d}
      fill="none"
      strokeWidth="1"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
  return (
    <g transform={`translate(${x - 6} ${y - 6})`}>
      {kind === 'rect' &&
        g(
          'M1.5 2.5 h9 a1.5 1.5 0 0 1 1.5 1.5 v5 a1.5 1.5 0 0 1-1.5 1.5 h-9 a1.5 1.5 0 0 1-1.5-1.5 v-5 a1.5 1.5 0 0 1 1.5-1.5z',
        )}
      {kind === 'circle' && (
        <circle className={s} cx="6" cy="6" r="5" fill="none" strokeWidth="1" />
      )}
      {kind === 'diamond' && g('M6 1 L11 6 L6 11 L1 6 Z')}
      {kind === 'cloud' &&
        g('M3 9.5 C0.5 9.5 0.5 6 3 6 C3 3 7 2 8.5 4.5 C10 3 12 4 11.5 6.5 C13 7 12.5 9.5 11 9.5 Z')}
      {kind === 'star' && g(starPath(6, 6.4, 5.4, 2.3))}
      {kind === 'bubble' && g('M1 2.5 h10 v6 h-6 l-3 2.5 v-2.5 h-1 z')}
      {kind === 'phone' &&
        g(
          'M3.5 0.5 h5 a1 1 0 0 1 1 1 v9 a1 1 0 0 1-1 1 h-5 a1 1 0 0 1-1-1 v-9 a1 1 0 0 1 1-1z M5 9.5 h2',
        )}
      {kind === 'browser' && g('M0.5 2 h11 v8 h-11 z M0.5 4.5 h11')}
      {kind === 'actor' &&
        g(
          'M6 1 a1.8 1.8 0 1 1 0 3.6 a1.8 1.8 0 1 1 0-3.6 M6 4.6 v3.6 M3 6 h6 M6 8.2 l-2.5 3.3 M6 8.2 l2.5 3.3',
        )}
    </g>
  );
}

// Per-element notes: a note's badge on the corner of a shape, its ring pulsing, and the note it
// opens: who wrote it and what it says, out of the way of the diagram.
export function NotesArt() {
  return (
    <Frame canvas>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        <defs>
          <ArrowHead id="fac-notes-head" />
        </defs>
        <Node x={10} y={18} w={58} h={22} label="Checkout" tone="sky" />
        <path className={LINK} d="M39 40 V58" strokeWidth="1.3" markerEnd="url(#fac-notes-head)" />
        <Node x={20} y={60} w={86} h={26} label="Payment API" tone="violet" />
        <Selection x={20} y={60} w={86} h={26} />
        {/* The note's badge, top right of the shape. */}
        <circle className="fa-pulse fill-amber-400/40" cx="106" cy="60" r="8" />
        <circle
          className="fill-amber-400 stroke-white dark:stroke-slate-900"
          cx="106"
          cy="60"
          r="5.5"
          strokeWidth="1.2"
        />
        <path
          d="M103.7 58 H108.3 M103.7 60 H108.3 M103.7 62 H106.5"
          stroke="#fff"
          strokeWidth="0.9"
          strokeLinecap="round"
        />

        {/* The note it opens. */}
        <g className="fa-fade">
          <path
            className="fill-amber-50 stroke-amber-300 dark:fill-amber-950 dark:stroke-amber-500/50"
            d="M134 10 h146 a6 6 0 0 1 6 6 v58 a6 6 0 0 1-6 6 h-146 a6 6 0 0 1-6-6 v-8 l-8-6 8-6 v-38 a6 6 0 0 1 6-6 z"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <circle className="fill-pink-500" cx="142" cy="22" r="4.6" />
          <text x="142" y="24" fontSize="4.4" fontWeight="700" fill="#fff" textAnchor="middle">
            JR
          </text>
          <text
            className="fill-amber-900 dark:fill-amber-100"
            x="150.5"
            y="24.3"
            fontSize="7"
            fontWeight="700"
          >
            Jo Reyes
          </text>
          <text
            className="fill-amber-700/80 dark:fill-amber-300/70"
            x="278"
            y="24.3"
            fontSize="6"
            textAnchor="end"
          >
            Note · 2m ago
          </text>
          <path
            className="stroke-amber-200 dark:stroke-amber-500/30"
            d="M136 31 H280"
            strokeWidth="0.8"
          />
          <text className="fill-amber-900 dark:fill-amber-50" fontSize="7">
            <tspan x="137" y="43">
              Retries three times, then pages
            </tspan>
            <tspan x="137" y="53">
              the on-call. Keep the timeout at 30s.
            </tspan>
          </text>
          <rect
            className="fill-amber-200/70 dark:fill-amber-500/20"
            x="136"
            y="61"
            width="42"
            height="11"
            rx="5.5"
          />
          <text
            className="fill-amber-800 dark:fill-amber-200"
            x="157"
            y="68.6"
            fontSize="6.2"
            fontWeight="700"
            textAnchor="middle"
          >
            #payments
          </text>
        </g>
      </svg>
    </Frame>
  );
}

// Border styling: the Quick Style strip's border row (solid, dashed, dotted), the chosen option
// lighting in turn, and the selected shape below wearing each: a heavier line and rounder corners
// as it goes.
export function BorderStyleArt() {
  const styles = [
    { dash: undefined as string | undefined, rx: 4, w: 1.6, mini: undefined as string | undefined },
    { dash: '5 3.5', rx: 11, w: 2.2, mini: '3 2' },
    { dash: '0.1 4.4', rx: 20, w: 2.8, mini: '0.1 2.6' },
  ];
  return (
    <Frame canvas>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        {/* The strip: three border styles, three weights, the corner radius. */}
        <rect className={PANEL} x="10" y="18" width="84" height="60" rx="6" strokeWidth="1" />
        <text
          className={MUTED_TEXT}
          x="17"
          y="29"
          fontSize="5.8"
          fontWeight="700"
          letterSpacing="0.3"
        >
          BORDER
        </text>
        {styles.map((s, i) => (
          <g key={i}>
            <rect
              className={`fa-c-third ${i === 0 ? 'fa-c-first ' : ''}fill-sky-500/15 stroke-sky-500 dark:stroke-sky-400`}
              style={delay(i * 2)}
              x={16 + i * 24}
              y="34"
              width="21"
              height="14"
              rx="3"
              strokeWidth="0.9"
            />
            <path
              className="stroke-slate-600 dark:stroke-slate-300"
              d={`M${20.5 + i * 24} 41 H${32.5 + i * 24}`}
              strokeWidth="1.6"
              strokeDasharray={s.mini}
              strokeLinecap="round"
            />
          </g>
        ))}
        <path className={HAIRLINE} d="M16 54 H88" strokeWidth="0.8" />
        {[1, 2, 3].map((w, i) => (
          <rect
            key={w}
            className="fill-slate-500 dark:fill-slate-300"
            x={19 + i * 24}
            y={65 - w / 2}
            width="15"
            height={w}
            rx={w / 2}
          />
        ))}

        {/* The selected shapes, wearing each style in step with the strip. */}
        {styles.map((s, i) => (
          <g key={i} className={`fa-c-third ${i === 0 ? 'fa-c-first' : ''}`} style={delay(i * 2)}>
            <rect
              className={TONE_SHAPE.violet}
              x="124"
              y="22"
              width="76"
              height="52"
              rx={s.rx}
              strokeWidth={s.w}
              strokeDasharray={s.dash}
              strokeLinecap="round"
            />
            <text
              className={TONE_TEXT.violet}
              x="162"
              y="50.5"
              fontSize="8"
              fontWeight="700"
              textAnchor="middle"
            >
              Review
            </text>
            <rect
              className={TONE_SHAPE.emerald}
              x="214"
              y="22"
              width="76"
              height="52"
              rx={s.rx}
              strokeWidth={s.w}
              strokeDasharray={s.dash}
              strokeLinecap="round"
            />
            <text
              className={TONE_TEXT.emerald}
              x="252"
              y="50.5"
              fontSize="8"
              fontWeight="700"
              textAnchor="middle"
            >
              Approve
            </text>
          </g>
        ))}
        <Selection x={124} y={22} w={166} h={52} pad={4} />
      </svg>
    </Frame>
  );
}

// Arrows: a curved arrow and an elbow arrow from one box to two others, with the handle that
// bends each. A teammate drags the curve's handle and the bow follows; the elbow wears the hollow
// UML head; both carry a label.
export function ArrowsArt() {
  return (
    <Frame canvas>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        <defs>
          <ArrowHead id="fac-arrows-solid" />
          <ArrowHead id="fac-arrows-hollow" hollow />
        </defs>
        <Node x={10} y={37} w={56} h={24} label="Client" tone="sky" />
        <Node x={228} y={8} w={62} h={24} label="Orders API" tone="violet" />
        <Node x={228} y={64} w={62} h={24} label="Cache" tone="emerald" />

        {/* The curve, before and after the drag, its handle at the bow. */}
        {[
          { c: 2, cls: 'fa-c-before', hy: 14.5 },
          { c: 34, cls: 'fa-c-after', hy: 30.5 },
        ].map(({ c, cls, hy }) => (
          <g key={c} className={cls}>
            <path
              className={LINK}
              d={`M66 44 Q 147 ${c} 227 20`}
              fill="none"
              strokeWidth="1.6"
              markerEnd="url(#fac-arrows-solid)"
            />
            <circle className="fa-pulse fill-sky-400/25" cx="146.5" cy={hy} r="6.5" />
            <circle
              className={`fill-white dark:fill-slate-900 ${SELECT}`}
              cx="146.5"
              cy={hy}
              r="3.2"
              strokeWidth="1.4"
            />
            <Pointer x={148.5} y={hy + 2} name="JR" />
          </g>
        ))}
        <rect className="fill-(--art-paper)" x="96" y="21" width="22" height="9" rx="2" />
        <text
          className={MUTED_TEXT}
          x="107"
          y="27.6"
          fontSize="6.2"
          fontWeight="600"
          textAnchor="middle"
        >
          calls
        </text>

        {/* The elbow, its bend handle mid-way down, a hollow head at the end. */}
        <path
          className={LINK}
          d="M66 54 H150 V76 H227"
          fill="none"
          strokeWidth="1.6"
          strokeLinejoin="round"
          markerEnd="url(#fac-arrows-hollow)"
        />
        <rect
          className={`fill-white dark:fill-slate-900 ${SELECT}`}
          x="147.5"
          y="62.5"
          width="5"
          height="5"
          rx="1"
          strokeWidth="1.3"
        />
        <rect className="fill-(--art-paper)" x="174" y="71.5" width="26" height="9" rx="2" />
        <text
          className={MUTED_TEXT}
          x="187"
          y="78.1"
          fontSize="6.2"
          fontWeight="600"
          textAnchor="middle"
        >
          reads
        </text>
      </svg>
    </Frame>
  );
}

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
