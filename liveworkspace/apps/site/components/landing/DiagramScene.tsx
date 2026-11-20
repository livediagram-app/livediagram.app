import { SceneCursor } from './AppWindow';

// livediagram's work (liveworkspace/docs/specs/010-site/site.md "The front door"): a launch plan drawn as the
// editor draws a flowchart on its dotted canvas. Each step carries its icon, the decision loops back to research on
// a No, a sticky asks a question, a comment waits on a step, Sam has the beta step selected, and Ada is drawing a
// new arrow out to a step she has just dropped. The editor's tool rail sits on the left and its zoom on the
// bottom right. One SVG on a 640 × 400 grid (the window's 16:10), so it scales as a picture. Decorative.

const NODE = 'fill-white stroke-sky-500 dark:fill-slate-900 dark:stroke-sky-400';
const LABEL = 'fill-slate-800 dark:fill-slate-100';
const LINE = 'stroke-sky-500 dark:stroke-sky-400';
const ICON = 'stroke-sky-600 dark:stroke-sky-300';

// A step: a rounded box with its icon in a tinted well and its label beside it.
function Step({
  x,
  y,
  w,
  label,
  icon,
  className = NODE,
  ink = LABEL,
  well = 'fill-sky-50 dark:fill-sky-500/15',
  iconInk = ICON,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  icon: string;
  className?: string;
  ink?: string;
  well?: string;
  iconInk?: string;
}) {
  return (
    <g>
      <rect x={x} y={y + 3} width={w} height="44" rx="10" className="fill-slate-900/[.06]" />
      <rect x={x} y={y} width={w} height="44" rx="10" strokeWidth="1.6" className={className} />
      <rect x={x + 9} y={y + 9} width="26" height="26" rx="7" className={well} />
      <path
        d={icon}
        transform={`translate(${x + 15} ${y + 15})`}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconInk}
      />
      <text x={x + 44} y={y + 26.5} fontSize="13" fontWeight="600" className={ink}>
        {label}
      </text>
    </g>
  );
}

// Fourteen-unit icons, drawn as the editor's outline glyphs.
const FLAG = 'M2 13V1.5M2 2h8.5l-1.8 3 1.8 3H2';
const SEARCH = 'M6 10.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM9.3 9.3 13 13';
const ROCKET =
  'M5 9 2.5 8.5 4.5 5.5h3M9 5c2-2.5 4-3 4.5-3-.1 1.4-.6 3-3 5L7.5 10 4 6.5zM5 11.5c-1 .8-2.5 1-3 1 0-.5.2-2 1-3';
const MEGAPHONE = 'M1.5 5.5v3h2l6 3.5v-10l-6 3.5zM3.5 8.5 4.5 13h2l-.8-3.6M11.5 5.5a2 2 0 0 1 0 3';
const USERS =
  'M5 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM1 13c0-2.2 1.8-4 4-4s4 1.8 4 4M9.5 2.3a2.5 2.5 0 0 1 0 4.4M11 9.2c1.2.6 2 1.9 2 3.3';

// The editor's tool rail: select, shapes, connector, text, sticky and pen, select active.
const TOOLS = [
  'M4 2.5 11.5 8l-3.5.8L6.3 12z',
  'M2.5 2.5h9v9h-9z',
  'M2.5 11.5l9-9M7 2.5h4.5V7',
  'M2.5 3V2.5h9V3M7 2.5v9M5 11.5h4',
  'M2.5 2.5h9v6l-3 3h-6zM8.5 11.5v-3h3',
  'M2.5 11.5l1-3 6-6 2 2-6 6zM8.5 3.5l2 2',
];

export function DiagramScene() {
  return (
    <div className="relative aspect-[16/10] bg-slate-50 bg-[radial-gradient(circle,rgb(148_163_184/0.45)_1px,transparent_1.3px)] [background-size:2.4em_2.4em] dark:bg-slate-950 dark:bg-[radial-gradient(circle,rgb(71_85_105/0.7)_1px,transparent_1.3px)]">
      <svg viewBox="0 0 640 400" className="absolute inset-0 size-full" fill="none">
        <defs>
          <marker
            id="lw-dg-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 10 5 0 10z" className="fill-sky-500 dark:fill-sky-400" />
          </marker>
        </defs>

        {/* The canvas title, as the flowchart templates head a canvas. */}
        <text
          x="76"
          y="34"
          fontSize="17"
          fontWeight="700"
          className="fill-slate-900 dark:fill-white"
        >
          Beta launch
        </text>
        <text x="76" y="52" fontSize="11" className="fill-slate-500 dark:fill-slate-400">
          From kick-off to the first hundred teams
        </text>

        {/* The lines, under the steps. */}
        <g strokeWidth="1.8" className={LINE}>
          <path d="M196 102h30" markerEnd="url(#lw-dg-arrow)" />
          <path d="M374 102h40" markerEnd="url(#lw-dg-arrow)" />
          <path d="M462 148v46" markerEnd="url(#lw-dg-arrow)" />
          <path d="M462 56V40H300v38" markerEnd="url(#lw-dg-arrow)" />
          <path d="M390 238H352" strokeDasharray="5 5" className="lw-flow" />
        </g>
        {/* The decision's answers on canvas-coloured chips. */}
        <g fontSize="10.5" fontWeight="600" textAnchor="middle">
          <rect
            x="368"
            y="31"
            width="26"
            height="18"
            rx="5"
            className="fill-slate-50 dark:fill-slate-950"
          />
          <text x="381" y="44" className="fill-rose-600 dark:fill-rose-300">
            No
          </text>
          <rect
            x="448"
            y="162"
            width="28"
            height="18"
            rx="5"
            className="fill-slate-50 dark:fill-slate-950"
          />
          <text x="462" y="175" className="fill-emerald-600 dark:fill-emerald-300">
            Yes
          </text>
        </g>

        {/* Kick-off, filled as a start is. */}
        <Step
          x={76}
          y={80}
          w={120}
          label="Kick-off"
          icon={FLAG}
          className="fill-sky-500 stroke-sky-600 dark:fill-sky-500 dark:stroke-sky-400"
          ink="fill-white"
          well="fill-white/20"
          iconInk="stroke-white"
        />
        <Step x={228} y={80} w={146} label="User research" icon={SEARCH} />

        {/* The decision. */}
        <g>
          <path d="M462 59 507 104 462 149 417 104z" className="fill-slate-900/[.06]" />
          <path
            d="M462 56 506 100 462 144 418 100z"
            strokeWidth="1.6"
            className="fill-sky-50 stroke-sky-500 dark:fill-sky-950 dark:stroke-sky-400"
          />
          <text
            x="462"
            y="104.5"
            fontSize="12"
            fontWeight="600"
            textAnchor="middle"
            className={LABEL}
          >
            Ready?
          </text>
        </g>

        {/* Ship to beta, in the theme's green, selected by Sam. */}
        <Step
          x={390}
          y={196}
          w={144}
          label="Ship to beta"
          icon={ROCKET}
          className="fill-emerald-50 stroke-emerald-500 dark:fill-emerald-950 dark:stroke-emerald-400"
          well="fill-emerald-100 dark:fill-emerald-500/20"
          iconInk="stroke-emerald-600 dark:stroke-emerald-300"
        />
        <g className="stroke-violet-500" strokeWidth="1.5">
          <rect x="385" y="191" width="154" height="54" rx="13" strokeDasharray="0" />
          {[
            [385, 191],
            [539, 191],
            [385, 245],
            [539, 245],
          ].map(([cx, cy]) => (
            <rect
              key={`${cx}-${cy}`}
              x={cx! - 3.5}
              y={cy! - 3.5}
              width="7"
              height="7"
              rx="1.5"
              className="fill-white dark:fill-slate-900"
            />
          ))}
        </g>

        {/* Announce, just dropped by Ada, its arrow still being drawn. */}
        <Step
          x={206}
          y={216}
          w={146}
          label="Announce it"
          icon={MEGAPHONE}
          className="fill-white/80 stroke-sky-400 [stroke-dasharray:5_4] dark:fill-slate-900/80 dark:stroke-sky-500"
        />
        <Step x={201} y={306} w={156} label="Onboard teams" icon={USERS} />
        <path
          d="M279 260v42"
          strokeWidth="1.8"
          className={LINE}
          markerEnd="url(#lw-dg-arrow)"
          opacity="0.45"
        />

        {/* A comment waiting on User research: the pin with its count. */}
        <g>
          <path
            d="M368 64a11 11 0 1 1 0 22h-11V75a11 11 0 0 1 11-11z"
            className="fill-amber-400 stroke-white dark:stroke-slate-950"
            strokeWidth="2"
          />
          <text
            x="368"
            y="79"
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            className="fill-amber-950"
          >
            2
          </text>
        </g>

        {/* The sticky, on the editor's yellow pad with its peel shadow. */}
        <g transform="rotate(-3 132 250)">
          <path d="M70 196h124v108c-30 4-70 5-122 0z" className="fill-amber-900/15" />
          <rect x="68" y="190" width="124" height="112" rx="3" className="fill-amber-200" />
          <g fontSize="12" fontWeight="500" className="fill-amber-950">
            <text x="80" y="214">
              Brief support
            </text>
            <text x="80" y="231">
              before Friday?
            </text>
            <text x="80" y="248">
              FAQ is half done
            </text>
          </g>
          <circle cx="88" cy="281" r="9" className="fill-sky-600" />
          <text x="88" y="284.5" fontSize="8" fontWeight="700" textAnchor="middle" fill="white">
            AL
          </text>
          <text x="102" y="285" fontSize="10" className="fill-amber-900/70">
            Ada · just now
          </text>
        </g>

        {/* The tool rail. */}
        <g>
          <rect x="14" y="88" width="38" height="214" rx="11" className="fill-slate-900/[.07]" />
          <rect
            x="14"
            y="86"
            width="38"
            height="214"
            rx="11"
            className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
          />
          <rect
            x="19"
            y="92"
            width="28"
            height="28"
            rx="7"
            className="fill-sky-100 dark:fill-sky-500/20"
          />
          {TOOLS.map((d, i) => (
            <path
              key={d}
              d={d}
              transform={`translate(26 ${99 + i * 34})`}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={
                i === 0
                  ? 'stroke-sky-700 dark:stroke-sky-300'
                  : 'stroke-slate-500 dark:stroke-slate-400'
              }
            />
          ))}
        </g>

        {/* The zoom, bottom right. */}
        <g>
          <rect
            x="528"
            y="358"
            width="98"
            height="28"
            rx="8"
            className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
          />
          <g
            fontSize="11"
            fontWeight="500"
            textAnchor="middle"
            className="fill-slate-600 dark:fill-slate-300"
          >
            <text x="545" y="376">
              −
            </text>
            <text x="577" y="376">
              100%
            </text>
            <text x="609" y="376">
              +
            </text>
          </g>
        </g>
      </svg>
      <SceneCursor
        name="Ada"
        colour="#0369a1"
        className="lw-drift-a"
        style={{ left: '54.5%', top: '58%' }}
      />
      <SceneCursor
        name="Sam"
        colour="#7c3aed"
        className="lw-drift-b"
        style={{ left: '86%', top: '50%' }}
      />
    </div>
  );
}
