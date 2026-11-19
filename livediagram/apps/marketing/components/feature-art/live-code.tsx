// Feature illustrations for the Diagrams category: shapes wearing their service’s live status, and diagrams drawn
// from code and shown on a pull request. Split from ./process; on the 300 by 96 stage of ./canvas-parts.
import type { CSSProperties } from 'react';
import { Box, Connector, MUTED, Panel, RULE, Scene, TEXT, at } from './canvas-parts';

const INK = 'fill-(--art-ink-fill) stroke-(--art-ink-stroke)';
const INK_LINE = 'stroke-(--art-ink-stroke)';
const INK_TEXT = 'fill-(--art-ink-text)';

/** The live status badge: a white pill on the shape's bottom-right corner, a dot and the state's word. */
function StatusPill({
  x,
  y,
  word,
  tone,
  className,
  style,
}: {
  x: number;
  y: number;
  word: string;
  tone: 'up' | 'degraded';
  className?: string;
  style?: CSSProperties;
}) {
  const w = word.length * 3.6 + 12;
  const dot =
    tone === 'up' ? 'fill-emerald-500 dark:fill-emerald-400' : 'fill-amber-500 dark:fill-amber-400';
  const ink =
    tone === 'up' ? 'fill-emerald-700 dark:fill-emerald-300' : 'fill-amber-700 dark:fill-amber-300';
  return (
    <g className={className} style={style}>
      <rect
        className="fill-white stroke-slate-900/10 dark:fill-slate-800 dark:stroke-white/15"
        x={x - w}
        y={y - 5.5}
        width={w}
        height="11"
        rx="5.5"
        strokeWidth="0.8"
      />
      <circle className={dot} cx={x - w + 5} cy={y} r="1.6" />
      <text className={ink} x={x - w + 8.5} y={y + 2.1} fontSize="5.8" fontWeight="600">
        {word}
      </text>
    </g>
  );
}

/** Three services on an architecture diagram, each wearing its live status; the queue slips to Degraded. */
export function LiveStatusArt() {
  return (
    <Scene>
      <Box x={20} y={30} w={64} h={28} label="Checkout API" />
      <Connector d="M84 44 H114" head="M111 41.5 l3 2.5 l-3 2.5" />
      <Box x={116} y={30} w={64} h={28} label="Orders queue" />
      <Connector d="M180 44 H210" head="M207 41.5 l3 2.5 l-3 2.5" />
      {/* The database: a cylinder. */}
      <g>
        <path
          className={INK}
          d="M212 34 a32 5 0 0 1 64 0 v20 a32 5 0 0 1 -64 0 z"
          strokeWidth="1.75"
        />
        <path className={INK_LINE} d="M212 34 a32 5 0 0 0 64 0" fill="none" strokeWidth="1.75" />
        <text
          className={INK_TEXT}
          x="244"
          y="49"
          fontSize="7.5"
          fontWeight="600"
          textAnchor="middle"
        >
          Users DB
        </text>
      </g>

      <StatusPill className="fa-a-pop" style={at(0.3)} x={80} y={58} word="Up" tone="up" />
      <StatusPill className="fa-a-out" x={176} y={58} word="Up" tone="up" />
      <StatusPill className="fa-a-late" x={176} y={58} word="Degraded" tone="degraded" />
      <StatusPill className="fa-a-pop" style={at(0.6)} x={272} y={59} word="Up" tone="up" />

      <text className={MUTED} x="150" y="82" fontSize="5.8" textAnchor="middle">
        Checked about once a minute while the canvas is open
      </text>
    </Scene>
  );
}

/** A small labelled box in a review picture. */
function Mini({ x, y, w, label }: { x: number; y: number; w: number; label: string }) {
  return (
    <g>
      <rect className={INK} x={x} y={y} width={w} height="10" rx="2" strokeWidth="0.9" />
      <text
        className={INK_TEXT}
        x={x + w / 2}
        y={y + 6.6}
        fontSize="4.4"
        fontWeight="600"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

/** One side of a tab's Before and After in the pull request comment: the Worker and its database, then, After, the
 *  Worker outlined as changed (amber dashed) and its new queue as added (green solid), as `link review` outlines them. */
function ReviewFrame({ x, after }: { x: number; after: boolean }) {
  return (
    <g>
      <rect
        className="fill-(--art-paper) stroke-slate-200 dark:stroke-slate-700"
        x={x}
        y="39"
        width="66"
        height="44"
        rx="3"
        strokeWidth="0.8"
      />
      <text className={MUTED} x={x + 4} y="45.6" fontSize="4.6" fontWeight="600">
        {after ? 'After' : 'Before'}
      </text>
      <Mini x={x + 5} y={50} w={26} label="lamp-shop" />
      <path className="stroke-(--art-arrow)" d={`M${x + 31} 55 H${x + 41}`} strokeWidth="0.9" />
      <Mini x={x + 41} y={50} w={20} label="DB" />
      {after ? (
        <>
          <rect
            className="fill-none stroke-amber-500"
            x={x + 3}
            y="48"
            width="30"
            height="14"
            rx="3"
            strokeWidth="0.9"
            strokeDasharray="2 1.4"
          />
          <path className="stroke-(--art-arrow)" d={`M${x + 18} 62 V67`} strokeWidth="0.9" />
          <Mini x={x + 5} y={68} w={26} label="JOBS" />
          <rect
            className="fill-none stroke-emerald-500"
            x={x + 3}
            y="66"
            width="30"
            height="14"
            rx="3"
            strokeWidth="1.1"
          />
        </>
      ) : null}
    </g>
  );
}

// The wrangler.toml in the pull request, its two new lines marked as a diff marks them.
const WRANGLER = [
  { line: 'name = "lamp-shop"', added: false },
  { line: '[[d1_databases]]', added: false },
  { line: 'binding = "DB"', added: false },
  { line: '[[queues.producers]]', added: true },
  { line: 'binding = "JOBS"', added: true },
];

/** A wrangler.toml drawn as a diagram, and the pull request comment showing its tab before and after. */
export function CodeReviewArt() {
  return (
    <Scene>
      {/* The file in the pull request. */}
      <Panel x={12} y={8} w={82} h={80} />
      <text className={TEXT} x="19" y="19" fontSize="6.2" fontWeight="700">
        wrangler.toml
      </text>
      <path className={RULE} d="M12 24 H94" strokeWidth="0.8" />
      {WRANGLER.map(({ line, added }, i) => (
        <g key={line}>
          {added ? (
            <rect
              className="fill-emerald-50 dark:fill-emerald-500/15"
              x="12.5"
              y={28 + i * 10.5}
              width="81"
              height="9"
            />
          ) : null}
          <text
            className={added ? 'fill-emerald-700 dark:fill-emerald-300' : MUTED}
            x="15"
            y={34.2 + i * 10.5}
            fontSize="4.6"
            fontFamily="ui-monospace, monospace"
          >
            {added ? '+' : ' '}
          </text>
          <text
            className={added ? 'fill-emerald-800 dark:fill-emerald-200' : TEXT}
            x="20"
            y={34.2 + i * 10.5}
            fontSize="4.6"
            fontFamily="ui-monospace, monospace"
          >
            {line}
          </text>
        </g>
      ))}
      <g className="fa-a-in" style={at(0.3)}>
        <Connector d="M98 48 H114" head="M111 45.5 l3 2.5 l-3 2.5" />
      </g>

      {/* The pull request comment: what changed, then each changed tab, before and after. */}
      <g className="fa-a-pop" style={at(0.5)}>
        <Panel x={118} y={8} w={170} h={80} />
        <text className={TEXT} x="125" y="19" fontSize="6.4" fontWeight="700">
          Diagram changes
        </text>
        <text className={MUTED} x="125" y="27" fontSize="4.6">
          1 tab changed in 1 document
        </text>
        <text className={TEXT} x="125" y="35" fontSize="4.6">
          <tspan fontWeight="700">Deploy</tspan> · 1 added, 1 changed, 0 removed
        </text>
        <ReviewFrame x={125} after={false} />
      </g>
      <g className="fa-a-pop" style={at(0.9)}>
        <ReviewFrame x={215} after />
      </g>
    </Scene>
  );
}
