// Feature illustrations for livediagram's open edges: the REST API from your own scripts, an AI
// tool building a diagram over MCP, and export that is a faithful picture of the canvas. Same
// vocabulary as ./features (panel chrome with a light and a dark half, the Default canvas, the
// fa-b-* loops); under reduced motion each shows its finished state.
//
// Split from FeatureArt.tsx; see ./shared for Frame and the colour constants.

import type { ReactNode } from 'react';
import { Arrow, MiniWindow, Node, PANEL, PanelShadow, STRONG, SUBTLE } from './features-parts';
import { Frame, PINK, SKY } from './shared';

const VIEW = '0 0 300 96';
const VIOLET = '#8b5cf6';
const EMERALD = '#10b981';

// Terminal colours: the window is a terminal in both appearances, so these are fixed.
const TERM = {
  prompt: '#94a3b8',
  text: '#e2e8f0',
  flag: '#7dd3fc',
  string: '#fcd34d',
  key: '#c4b5fd',
  dim: '#64748b',
};

/** The API: a curl call with a bearer token, and the documents it returns. */
export function ApiArt() {
  const mono = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 6.2,
  } as const;
  return (
    <Frame>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        <PanelShadow x={22} y={8} w={256} h={80} r={6} />
        <rect
          className="fill-slate-900 stroke-slate-900 dark:fill-slate-950 dark:stroke-slate-700"
          x="22"
          y="8"
          width="256"
          height="80"
          rx="6"
          strokeWidth="1"
        />
        <path
          className="fill-slate-800 dark:fill-slate-900"
          d="M22.5 21 V14 a5.5 5.5 0 0 1 5.5 -5.5 H272 a5.5 5.5 0 0 1 5.5 5.5 V21 Z"
        />
        {['#fb7185', '#fbbf24', '#34d399'].map((c, i) => (
          <circle key={c} cx={31 + i * 6} cy="14.8" r="1.9" fill={c} />
        ))}
        <text x="150" y="17" textAnchor="middle" fontSize="5.5" fontWeight="600" fill={TERM.prompt}>
          ~/scripts · zsh
        </text>

        <text x="32" y="33" {...mono}>
          <tspan fill={EMERALD}>$ </tspan>
          <tspan fill={TERM.text}>curl </tspan>
          <tspan fill={TERM.string}>https://livediagram.app/api/documents</tspan>
          <tspan fill={TERM.dim}> \</tspan>
        </text>
        <text x="42" y="43" {...mono}>
          <tspan fill={TERM.flag}>-H </tspan>
          <tspan fill={TERM.string}>&quot;Authorization: Bearer lvd_7Kq2…&quot;</tspan>
        </text>

        {/* The response, once the call returns. */}
        <g className="fa-b-late">
          <rect x="32" y="50" width="30" height="9" rx="2" fill={EMERALD} fillOpacity="0.2" />
          <text x="47" y="56.6" textAnchor="middle" fontSize="5.6" fontWeight="700" fill="#6ee7b7">
            200 OK
          </text>
          <text x="32" y="69" {...mono}>
            <tspan fill={TERM.dim}>[{'{'} </tspan>
            <tspan fill={TERM.key}>&quot;title&quot;</tspan>
            <tspan fill={TERM.dim}>: </tspan>
            <tspan fill={TERM.string}>&quot;Auth flow&quot;</tspan>
            <tspan fill={TERM.dim}>, </tspan>
            <tspan fill={TERM.key}>&quot;tabs&quot;</tspan>
            <tspan fill={TERM.dim}>: </tspan>
            <tspan fill={TERM.flag}>3</tspan>
            <tspan fill={TERM.dim}> {'}'},</tspan>
          </text>
          <text x="38" y="79" {...mono}>
            <tspan fill={TERM.dim}>{'{'} </tspan>
            <tspan fill={TERM.key}>&quot;title&quot;</tspan>
            <tspan fill={TERM.dim}>: </tspan>
            <tspan fill={TERM.string}>&quot;Q3 roadmap&quot;</tspan>
            <tspan fill={TERM.dim}>, </tspan>
            <tspan fill={TERM.key}>&quot;tabs&quot;</tspan>
            <tspan fill={TERM.dim}>: </tspan>
            <tspan fill={TERM.flag}>5</tspan>
            <tspan fill={TERM.dim}> {'}'}]</tspan>
          </text>
        </g>
        {/* The caret, waiting while the call is in flight. */}
        <rect className="fa-b-early" x="32" y="51" width="3.6" height="7" fill={TERM.text} />
      </svg>
    </Frame>
  );
}

// The four-point sparkle an AI tool's chat marks itself with.
function Sparkle({ x, y, r = 4 }: { x: number; y: number; r?: number }) {
  return (
    <path
      d={`M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z`}
      fill={VIOLET}
    />
  );
}

/** MCP: you ask your AI tool for a diagram; it calls livediagram and the diagram appears. */
export function McpArt() {
  return (
    <Frame>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        {/* The AI tool's chat. */}
        <PanelShadow x={12} y={8} w={150} h={80} r={6} />
        <rect className={PANEL} x="12" y="8" width="150" height="80" rx="6" strokeWidth="1" />
        <Sparkle x={22} y={18} r={3.6} />
        <text className={STRONG} x="29" y="20.2" fontSize="6.2" fontWeight="700">
          Your AI tool
        </text>
        <text className={SUBTLE} x="154" y="20.2" textAnchor="end" fontSize="5.2" fontWeight="600">
          MCP connected
        </text>
        <circle cx="104" cy="18.4" r="1.8" fill={EMERALD} />
        <path
          className="stroke-slate-100 dark:stroke-slate-800"
          d="M12 26.5 H162"
          strokeWidth="1"
        />

        {/* You ask. */}
        <rect x="74" y="32" width="80" height="14" rx="7" fill={SKY} />
        <text x="114" y="41.2" textAnchor="middle" fontSize="6" fontWeight="600" fill="#fff">
          Draw our login flow
        </text>

        {/* The tool call, running then done. */}
        <rect
          className="fill-violet-50 stroke-violet-200 dark:fill-violet-500/10 dark:stroke-violet-500/30"
          x="20"
          y="52"
          width="118"
          height="14"
          rx="4"
          strokeWidth="0.8"
        />
        <text
          className="fill-violet-700 dark:fill-violet-300"
          x="38"
          y="61.2"
          fontSize="5.8"
          fontWeight="600"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          livediagram.create_document
        </text>
        <g className="fa-b-early">
          <circle
            cx="29"
            cy="59"
            r="3"
            fill="none"
            stroke={VIOLET}
            strokeOpacity="0.25"
            strokeWidth="1.2"
          />
          <path
            d="M29 56 A3 3 0 0 1 32 59"
            fill="none"
            stroke={VIOLET}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
        <g className="fa-b-late">
          <circle cx="29" cy="59" r="3.4" fill={EMERALD} />
          <path
            d="M27.4 59 L28.6 60.2 L30.7 57.8"
            fill="none"
            stroke="#fff"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <g className="fa-b-late">
          <rect className={SUBTLE} x="20" y="72" width="96" height="3" rx="1.5" opacity="0.4" />
          <rect className={SUBTLE} x="20" y="78" width="64" height="3" rx="1.5" opacity="0.4" />
        </g>

        {/* What lands in livediagram. */}
        <MiniWindow x={176} y={8} w={112} h={80} title="Login flow">
          <g className="fa-b-late">
            <Node x={190} y={30} w={36} h={16} label="Sign in" r={8} />
            <Node x={240} y={30} w={36} h={16} label="Verify" />
            <Node x={240} y={62} w={36} h={16} label="Session" />
            <Node x={190} y={62} w={36} h={16} label="Retry" />
            <Arrow d="M226 38 H234" head={[239, 38, 0]} />
            <Arrow d="M258 46 V56" head={[258, 61, 90]} />
            <Arrow d="M240 70 H232" head={[227, 70, 180]} />
          </g>
        </MiniWindow>
      </svg>
    </Frame>
  );
}

// The diagram drawn on the canvas and again in each exported file, mark for mark.
function ExportDiagram({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Node x={0} y={0} w={30} h={13} label="Plan" r={3} />
      <Node x={44} y={0} w={30} h={13} label="Build" r={3} />
      <Node x={22} y={28} w={30} h={13} label="Ship" r={3} />
      <Arrow d="M30 6.5 H38" head={[43, 6.5, 0]} />
      <Arrow d="M59 13 L44 24" head={[48, 27, 144]} />
      <circle cx="66" cy="34" r="5" fill={PINK} fillOpacity="0.85" />
    </g>
  );
}

// An exported file: a page with a folded corner and its format on a tab.
function FileCard({
  x,
  y,
  label,
  color,
  children,
  className,
  delay,
}: {
  x: number;
  y: number;
  label: string;
  color: string;
  children?: ReactNode;
  className?: string;
  delay?: string;
}) {
  return (
    <g className={className} style={delay ? { animationDelay: delay } : undefined}>
      <PanelShadow x={x} y={y} w={66} h={54} r={4} />
      <path
        className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        d={`M${x + 4} ${y} H${x + 56} L${x + 66} ${y + 10} V${y + 50} a4 4 0 0 1 -4 4 H${x + 4} a4 4 0 0 1 -4 -4 V${y + 4} a4 4 0 0 1 4 -4 Z`}
        strokeWidth="1"
      />
      <path
        className="fill-slate-100 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
        d={`M${x + 56} ${y} V${y + 6} a4 4 0 0 0 4 4 H${x + 66}`}
        strokeWidth="1"
      />
      <rect x={x + 5} y={y + 3} width="20" height="8.5" rx="2" fill={color} />
      <text x={x + 15} y={y + 9.4} textAnchor="middle" fontSize="5.8" fontWeight="700" fill="#fff">
        {label}
      </text>
      {children}
    </g>
  );
}

/** Export: the canvas leaves as PNG, SVG or PDF, the same marks in the same places. */
export function ExportArt() {
  return (
    <Frame canvas>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        {/* On the canvas. */}
        <ExportDiagram x={24} y={26} s={1.15} />

        {/* Out. */}
        <path
          className="stroke-slate-400 dark:stroke-slate-500"
          d="M122 48 H146"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeDasharray="2.5 2.5"
        />
        <path className="fill-slate-400 dark:fill-slate-500" d="M151 48 l-5 -3 v6 z" />

        {/* The files, fanned. */}
        <FileCard x={214} y={10} label="PDF" color="#ef4444" className="fa-pop" delay="0.5s" />
        <FileCard x={188} y={23} label="SVG" color={VIOLET} className="fa-pop" delay="0.3s" />
        <FileCard x={162} y={36} label="PNG" color={SKY} className="fa-pop" delay="0.1s">
          <ExportDiagram x={168} y={52} s={0.7} />
        </FileCard>
      </svg>
    </Frame>
  );
}
