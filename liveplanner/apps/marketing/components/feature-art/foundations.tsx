// Feature illustrations for liveplanner's open edges: the REST API from your own scripts, and an AI
// tool adding cards to a board over MCP. Panel chrome with a light and a dark half (./features-parts),
// the fa-b-* loops; under reduced motion each shows its finished state.
//
// Split from FeatureArt.tsx; see ./shared for Frame and the colour constants.

import { MiniWindow, Node, PANEL, PanelShadow, STRONG, SUBTLE } from './features-parts';
import {
  EMERALD,
  Frame,
  MONO,
  VIOLET,
} from '@liveworkspace/marketing-site/components/feature-art/shared';

const VIEW = '0 0 300 96';

// Terminal colours: the window is a terminal in both appearances, so these are fixed.
const TERM = {
  prompt: '#94a3b8',
  text: '#e2e8f0',
  flag: '#7dd3fc',
  string: '#fcd34d',
  key: '#c4b5fd',
  dim: '#64748b',
};

/** The API: a curl call with a bearer token, and the projects it returns. */
export function ApiArt() {
  const mono = {
    fontFamily: MONO,
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
          <tspan fill={TERM.string}>https://www.liveplanner.app/api/projects</tspan>
          <tspan fill={TERM.dim}> \</tspan>
        </text>
        <text x="42" y="43" {...mono}>
          <tspan fill={TERM.flag}>-H </tspan>
          <tspan fill={TERM.string}>&quot;Authorization: Bearer lwt_7Kq2…&quot;</tspan>
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
            <tspan fill={TERM.string}>&quot;Launch plan&quot;</tspan>
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

/** MCP: you ask your AI tool to add cards; it calls liveplanner and they land on the board. */
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
        <rect x="62" y="32" width="92" height="14" rx="7" fill={VIOLET} />
        <text x="108" y="41.2" textAnchor="middle" fontSize="6" fontWeight="600" fill="#fff">
          Add the launch tasks
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
          fontFamily={MONO}
        >
          liveplanner.change_items
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

        {/* What lands in liveplanner: three new cards in the board's To do column. */}
        <MiniWindow x={176} y={8} w={112} h={80} title="Launch board">
          {[
            [182, 'To do'],
            [218, 'Doing'],
            [254, 'Done'],
          ].map(([x, name]) => (
            <g key={name}>
              <rect
                className="fill-slate-100 dark:fill-slate-800/70"
                x={x as number}
                y="26"
                width="30"
                height="56"
                rx="3"
              />
              <text className={SUBTLE} x={(x as number) + 3} y="33" fontSize="4.6" fontWeight="700">
                {name}
              </text>
            </g>
          ))}
          <Node x={221} y={37} w={24} h={11} r={2} />
          <Node x={257} y={37} w={24} h={11} r={2} />
          <g className="fa-b-late">
            <Node x={185} y={37} w={24} h={11} r={2} />
            <Node x={185} y={51} w={24} h={11} r={2} />
            <Node x={185} y={65} w={24} h={11} r={2} />
          </g>
        </MiniWindow>
      </svg>
    </Frame>
  );
}
