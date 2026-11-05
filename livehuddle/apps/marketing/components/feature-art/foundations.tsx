// Feature illustrations for livehuddle's open edges: the REST API from your own scripts, an AI
// tool building a diagram over MCP, and export that is a faithful picture of the canvas. Same
// vocabulary as ./features (panel chrome with a light and a dark half, the Default canvas, the
// fa-b-* loops); under reduced motion each shows its finished state.
//
// Split from FeatureArt.tsx; see ./shared for Frame and the colour constants.

import { PanelShadow } from './features-parts';
import { EMERALD, Frame, MONO } from '@liveworkspace/marketing-site/components/feature-art/shared';

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

/** The API: a curl call with a bearer token, and the documents it returns. */
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
          <tspan fill={TERM.string}>https://www.livehuddle.app/api/documents</tspan>
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
