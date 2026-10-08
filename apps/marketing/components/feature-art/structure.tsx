// Feature illustrations for the structural elements (docs/specs/009-elements/mind-node.md,
// lane.md, entity.md, embed-providers.md) and the Explorer's Timeline: the mind map, swimlanes,
// entity boxes, embeds, and the activity feed. Shared marks live in ./canvas-marks.
import type { CSSProperties } from 'react';
import {
  ARROW,
  Caret,
  HAIRLINE,
  INK,
  INK_SHADE,
  INK_TEXT,
  PANEL,
  SHADOW,
  Scene,
  Selection,
  TEXT_BODY,
  TEXT_MUTED,
  TEXT_STRONG,
} from './canvas-marks';
import { Frame } from './shared';

// A branch colour of a multi-colour theme, tinted for the node behind its words.
const BRANCHES = [
  { hue: '#0ea5e9', text: 'fill-sky-700 dark:fill-sky-200' },
  { hue: '#8b5cf6', text: 'fill-violet-700 dark:fill-violet-200' },
  { hue: '#f59e0b', text: 'fill-amber-700 dark:fill-amber-200' },
  { hue: '#10b981', text: 'fill-emerald-700 dark:fill-emerald-200' },
];

// Mind map: a root with four colour-coded branches on tapered curves, ideas on each, and the
// newest idea being typed in, the Tab key that grew it shown beside.
export function MindMapArt() {
  const root = { x: 150, y: 48 };
  const nodes = [
    { label: 'Research', x: 64, y: 22, b: 0 },
    { label: 'Pricing', x: 64, y: 74, b: 1 },
    { label: 'Launch', x: 236, y: 22, b: 2 },
    { label: 'Press kit', x: 236, y: 74, b: 3, typing: true },
  ];
  return (
    <Frame canvas>
      <Scene>
        {nodes.map((n) => {
          const dir = n.x < root.x ? -1 : 1;
          const sx = root.x + dir * 26;
          const ex = n.x - dir * 28;
          return (
            <path
              key={n.label}
              d={`M${sx} ${root.y} C ${sx + dir * 18} ${root.y}, ${ex - dir * 18} ${n.y}, ${ex} ${n.y}`}
              fill="none"
              stroke={BRANCHES[n.b]!.hue}
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
        {/* The root. */}
        <g className={SHADOW}>
          <rect
            className="fill-(--art-ink-stroke)"
            x={root.x - 26}
            y={root.y - 11}
            width="52"
            height="22"
            rx="11"
          />
        </g>
        <text
          x={root.x}
          y={root.y + 3}
          fontSize="8"
          fontWeight="700"
          fill="#fff"
          textAnchor="middle"
        >
          Q3 launch
        </text>
        {nodes.map((n) => {
          const b = BRANCHES[n.b]!;
          return (
            <g key={n.label} className={n.typing ? 'fa-d-land' : undefined}>
              <rect
                x={n.x - 28}
                y={n.y - 9}
                width="56"
                height="18"
                rx="9"
                fill={b.hue}
                fillOpacity="0.14"
                stroke={b.hue}
                strokeWidth="1.3"
              />
              <text
                className={b.text}
                x={n.x}
                y={n.y + 2.6}
                fontSize="7"
                fontWeight="600"
                textAnchor="middle"
              >
                {n.label}
              </text>
            </g>
          );
        })}
        <Caret x={259} y={69.5} h={9} />
        {/* The key that grew it. */}
        <g className="fa-d-ring">
          <rect
            className="fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600"
            x="270"
            y="50"
            width="20"
            height="12"
            rx="2.5"
            strokeWidth="0.8"
          />
          <text
            className={TEXT_STRONG}
            x="280"
            y="58.2"
            fontSize="6"
            fontWeight="600"
            textAnchor="middle"
          >
            Tab
          </text>
        </g>
      </Scene>
    </Frame>
  );
}

// Swimlanes: three lanes, their titles in a gutter, a process crossing them (a step, a decision,
// a hand-off); one lane mid-drag, its steps riding along inside it.
export function LanesArt() {
  const lanes = ['Customer', 'Support', 'Engineering'];
  const laneH = 25;
  const y0 = 10;
  const x0 = 12;
  const w = 276;
  const gutter = 54;
  const mid = (i: number) => y0 + i * laneH + laneH / 2;
  const step = (label: string, cx: number, lane: number) => (
    <g key={label}>
      <rect
        className="fill-(--art-paper) stroke-(--art-ink-stroke)"
        x={cx - 21}
        y={mid(lane) - 7.5}
        width="42"
        height="15"
        rx="4"
        strokeWidth="1.2"
      />
      <text
        className={INK_TEXT}
        x={cx}
        y={mid(lane) + 2.3}
        fontSize="6.2"
        fontWeight="600"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
  const right = (x1: number, x2: number, y: number) => (
    <g key={`${x1}-${y}`}>
      <path className={ARROW} d={`M${x1} ${y} H${x2 - 4}`} strokeWidth="1" fill="none" />
      <path className="fill-(--art-arrow)" d={`M${x2} ${y} l-4.5 -2.6 v5.2z`} />
    </g>
  );
  const down = (x: number, y1: number, y2: number) => (
    <g key={`${x}-${y1}`}>
      <path className={ARROW} d={`M${x} ${y1} V${y2 - 4}`} strokeWidth="1" fill="none" />
      <path className="fill-(--art-arrow)" d={`M${x} ${y2} l-2.6 -4.5 h5.2z`} />
    </g>
  );
  return (
    <Frame canvas>
      <Scene>
        {lanes.map((lane, i) => (
          <g key={lane}>
            <rect
              className={INK}
              x={x0}
              y={y0 + i * laneH}
              width={w}
              height={laneH}
              strokeWidth="1"
            />
            <rect
              className={`${INK_SHADE} stroke-(--art-ink-stroke)`}
              x={x0}
              y={y0 + i * laneH}
              width={gutter}
              height={laneH}
              strokeWidth="1"
            />
            <text className={INK_TEXT} x={x0 + 6} y={mid(i) + 2.3} fontSize="6.2" fontWeight="700">
              {lane}
            </text>
          </g>
        ))}
        {/* The process, crossing lanes: a request, triage, a decision, a fix, a release. */}
        {step('Request', 100, 0)}
        {right(121, 141, mid(0))}
        {step('Triage', 162, 0)}
        {down(162, mid(0) + 7.5, mid(1) - 9.5)}
        <path
          className="fill-(--art-paper) stroke-(--art-ink-stroke)"
          d={`M162 ${mid(1) - 9.5} l14 9.5 -14 9.5 -14 -9.5z`}
          strokeWidth="1.2"
        />
        <text
          className={INK_TEXT}
          x="162"
          y={mid(1) + 2.2}
          fontSize="6"
          fontWeight="700"
          textAnchor="middle"
        >
          Bug?
        </text>
        {right(176, 200, mid(1))}
        {step('Fix', 221, 1)}
        {down(221, mid(1) + 7.5, mid(2) - 7.5)}
        {step('Release', 221, 2)}
        {right(242, 258, mid(2))}
        <circle cx="266" cy={mid(2)} r="7" className="fill-(--art-ink-stroke)" />
        <path
          d={`M262.8 ${mid(2)} l2.2 2.2 4.2 -4.4`}
          stroke="#fff"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Selection x={x0} y={y0 + 2 * laneH} w={w} h={laneH} className="fa-d-ring" />
      </Scene>
    </Frame>
  );
}

// One entity box: a title bar over name and type rows, the key marked.
function Entity({
  x,
  y,
  title,
  rows,
  w = 86,
}: {
  x: number;
  y: number;
  title: string;
  rows: [string, string, 'pk' | 'fk' | ''][];
  w?: number;
}) {
  const h = 15 + rows.length * 12 + 3;
  return (
    <g>
      <g className={SHADOW}>
        <rect className={INK} x={x} y={y} width={w} height={h} rx="4" strokeWidth="1.2" />
      </g>
      <path
        className="fill-(--art-ink-stroke)"
        d={`M${x} ${y + 15} V${y + 4} a4 4 0 0 1 4 -4 H${x + w - 4} a4 4 0 0 1 4 4 V${y + 15}Z`}
      />
      <text x={x + 7} y={y + 10.2} fontSize="7" fontWeight="700" fill="#fff">
        {title}
      </text>
      {rows.map(([name, type, key], i) => {
        const ry = y + 15 + i * 12 + 9.5;
        return (
          <g key={name}>
            {i > 0 ? (
              <path
                className="stroke-(--art-ink-stroke)"
                d={`M${x + 4} ${ry - 9} H${x + w - 4}`}
                strokeOpacity="0.25"
                strokeWidth="0.7"
              />
            ) : null}
            {key ? (
              <text
                x={x + 6}
                y={ry}
                fontSize="5"
                fontWeight="800"
                className={
                  key === 'pk'
                    ? 'fill-amber-600 dark:fill-amber-400'
                    : 'fill-violet-600 dark:fill-violet-300'
                }
              >
                {key.toUpperCase()}
              </text>
            ) : null}
            <text
              className={INK_TEXT}
              x={x + 19}
              y={ry}
              fontSize="6.4"
              fontWeight={key === 'pk' ? 700 : 500}
            >
              {name}
            </text>
            <text
              className={INK_TEXT}
              opacity="0.55"
              x={x + w - 6}
              y={ry}
              fontSize="5.8"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              textAnchor="end"
            >
              {type}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// Entity boxes: a User and a Team joined by an association with its multiplicities, the hollow
// diamond UML asks for at the whole's end, and one field selected for editing.
export function EntityArt() {
  return (
    <Frame canvas>
      <Scene>
        <Entity
          x={36}
          y={12}
          title="User"
          rows={[
            ['id', 'uuid', 'pk'],
            ['email', 'text', ''],
            ['name', 'text', ''],
            ['team_id', 'uuid', 'fk'],
          ]}
        />
        <Entity
          x={180}
          y={22}
          title="Team"
          rows={[
            ['id', 'uuid', 'pk'],
            ['name', 'text', ''],
            ['plan', 'enum', ''],
          ]}
        />
        {/* The association: Team (the whole, hollow diamond) to its Users. */}
        <path className={ARROW} d="M122 70.5 H150 V47 H170" strokeWidth="1.1" fill="none" />
        <path
          className="fill-(--art-paper) stroke-(--art-arrow)"
          d="M180 47 l-5 -3.4 -5 3.4 5 3.4z"
          strokeWidth="1.1"
        />
        <text className={TEXT_BODY} x="126" y="67.5" fontSize="5.8" fontWeight="700">
          0..*
        </text>
        <text className={TEXT_BODY} x="163" y="43.5" fontSize="5.8" fontWeight="700">
          1
        </text>
        <rect
          className="fa-d-ring fill-brand-500/10 stroke-brand-500 dark:stroke-brand-400"
          x="37.5"
          y="39.5"
          width="83"
          height="11"
          rx="1.5"
          strokeWidth="1"
        />
      </Scene>
    </Frame>
  );
}

// Embeds on the canvas: a video, unplayed (nothing loads until someone presses play), beside a
// Figma file and a Google Doc, and a sticky pointing at the moment that matters.
export function EmbedArt() {
  return (
    <Frame canvas>
      <Scene>
        <defs>
          <linearGradient id="fa-d-embed-poster" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1e3a8a" />
            <stop offset="0.55" stopColor="#6d28d9" />
            <stop offset="1" stopColor="#db2777" />
          </linearGradient>
          <clipPath id="fa-d-embed-clip">
            <rect x="20" y="10" width="128" height="76" rx="5" />
          </clipPath>
        </defs>
        {/* The video. */}
        <g className={SHADOW}>
          <rect x="20" y="10" width="128" height="76" rx="5" fill="#0f172a" />
        </g>
        <g clipPath="url(#fa-d-embed-clip)">
          <rect x="20" y="10" width="128" height="64" fill="url(#fa-d-embed-poster)" />
          <circle cx="118" cy="30" r="22" fill="#fff" opacity="0.08" />
          <path d="M20 66 L52 42 L74 58 L96 44 L148 70 V74 H20Z" fill="#0f172a" opacity="0.35" />
          <text x="28" y="22" fontSize="6.4" fontWeight="700" fill="#fff">
            Sprint 14 demo
          </text>
          <text x="28" y="30" fontSize="5.4" fill="#fff" opacity="0.7">
            Loom · 4:12
          </text>
          <rect x="20" y="74" width="128" height="12" fill="#0f172a" />
          <rect x="27" y="79" width="94" height="2" rx="1" fill="#fff" opacity="0.2" />
          <rect x="27" y="79" width="30" height="2" rx="1" fill="#f472b6" />
          <text x="126" y="81.8" fontSize="5" fill="#fff" opacity="0.7">
            1:20
          </text>
        </g>
        <circle
          className="fa-ripple"
          cx="84"
          cy="44"
          r="12"
          fill="none"
          stroke="#fff"
          strokeWidth="1.5"
        />
        <g>
          <circle cx="84" cy="44" r="12" fill="#fff" opacity="0.95" />
          <path d="M80.5 38.5 L90 44 L80.5 49.5Z" fill="#0f172a" />
        </g>
        {/* A Figma file and a Google Doc. */}
        {[
          { y: 12, title: 'Checkout flow', host: 'Figma', color: '#a259ff' },
          { y: 50, title: 'Launch brief', host: 'Google Docs', color: '#4285f4' },
        ].map((e) => (
          <g key={e.title}>
            <g className={SHADOW}>
              <rect
                x="160"
                y={e.y}
                width="72"
                height="34"
                rx="4"
                fill="#fff"
                stroke="#e2e8f0"
                strokeWidth="0.8"
              />
            </g>
            <rect x="160" y={e.y} width="72" height="18" rx="4" fill={e.color} fillOpacity="0.12" />
            <rect
              x="166"
              y={e.y + 5}
              width="22"
              height="3"
              rx="1.5"
              fill={e.color}
              fillOpacity="0.55"
            />
            <rect
              x="166"
              y={e.y + 10}
              width="34"
              height="2.5"
              rx="1.25"
              fill={e.color}
              fillOpacity="0.3"
            />
            <rect x="166" y={e.y + 22} width="6" height="6" rx="1.5" fill={e.color} />
            <text x="175" y={e.y + 26.6} fontSize="5.8" fontWeight="700" fill="#0f172a">
              {e.title}
            </text>
            <text x="175" y={e.y + 31.8} fontSize="4.8" fill="#64748b">
              {e.host}
            </text>
          </g>
        ))}
        {/* The sticky. */}
        <g>
          <g className="[filter:drop-shadow(0_2px_2px_rgb(15_23_42/0.18))]">
            <rect
              x="240"
              y="26"
              width="48"
              height="40"
              rx="1.5"
              fill="#fde68a"
              transform="rotate(3 264 46)"
            />
          </g>
          <text
            x="246"
            y="40"
            fontSize="6.2"
            fontWeight="600"
            fill="#422006"
            transform="rotate(3 264 46)"
          >
            <tspan x="246">Watch from</tspan>
            <tspan x="246" dy="8.5">
              1:20 for the
            </tspan>
            <tspan x="246" dy="8.5">
              pay step
            </tspan>
          </text>
        </g>
      </Scene>
    </Frame>
  );
}

// The Explorer's Timeline (docs/specs/013-workspace/timeline.md): a day of activity on a spine,
// each event with who did it and what, colour saying what happened; the newest is marked New.
export function TimelineFeedArt() {
  const rows = [
    {
      who: 'AK',
      color: '#8b5cf6',
      kind: '#16a34a',
      verb: 'commented on',
      doc: 'Roadmap',
      time: 'now',
      fresh: true,
    },
    {
      who: 'SM',
      color: '#0ea5e9',
      kind: '#f59e0b',
      verb: 'assigned you',
      doc: 'Billing v2',
      time: '11:02',
    },
    {
      who: 'JR',
      color: '#ec4899',
      kind: '#0ea5e9',
      verb: 'edited',
      doc: 'Onboarding',
      time: '09:24',
    },
  ];
  return (
    <Frame>
      <Scene>
        <g className={SHADOW}>
          <rect className={PANEL} x="24" y="7" width="252" height="82" rx="6" strokeWidth="0.8" />
        </g>
        <text className={TEXT_STRONG} x="34" y="20" fontSize="7" fontWeight="700">
          Today
        </text>
        <rect className="fill-brand-500" x="58" y="13.6" width="28" height="9" rx="4.5" />
        <text x="72" y="19.8" fontSize="5.4" fontWeight="700" fill="#fff" textAnchor="middle">
          3 new
        </text>
        <path className={HAIRLINE} d="M43 29 V83" strokeWidth="1" />
        {rows.map((r, i) => {
          const y = 34 + i * 18;
          return (
            <g
              key={r.doc}
              className={r.fresh ? 'fa-d-land' : undefined}
              style={r.fresh ? ({ animationDelay: '0.1s' } as CSSProperties) : undefined}
            >
              <circle
                cx="43"
                cy={y + 5}
                r="3"
                fill={r.kind}
                className="stroke-white dark:stroke-slate-900"
                strokeWidth="1.2"
              />
              <rect
                className={
                  r.fresh
                    ? 'fill-brand-50 stroke-brand-200 dark:fill-brand-500/10 dark:stroke-brand-500/40'
                    : 'fill-slate-50 stroke-slate-100 dark:fill-slate-800/60 dark:stroke-slate-800'
                }
                x="52"
                y={y - 2.5}
                width="214"
                height="15"
                rx="3.5"
                strokeWidth="0.7"
              />
              <circle cx="61" cy={y + 5} r="5.2" fill={r.color} />
              <text
                x="61"
                y={y + 6.8}
                fontSize="4.4"
                fontWeight="700"
                fill="#fff"
                textAnchor="middle"
              >
                {r.who}
              </text>
              <text className={TEXT_BODY} x="71" y={y + 7.2} fontSize="6.4">
                {r.verb}{' '}
                <tspan className={TEXT_STRONG} fontWeight="600">
                  {r.doc}
                </tspan>
              </text>
              {r.fresh ? (
                <g>
                  <rect
                    className="fill-brand-500"
                    x="240"
                    y={y + 0.5}
                    width="20"
                    height="9"
                    rx="4.5"
                  />
                  <text
                    x="250"
                    y={y + 6.6}
                    fontSize="5.2"
                    fontWeight="700"
                    fill="#fff"
                    textAnchor="middle"
                  >
                    New
                  </text>
                </g>
              ) : (
                <text className={TEXT_MUTED} x="260" y={y + 7} fontSize="5.6" textAnchor="end">
                  {r.time}
                </text>
              )}
            </g>
          );
        })}
      </Scene>
    </Frame>
  );
}
