// Feature illustrations for the structural elements (docs/specs/009-elements/mind-node.md,
// lane.md, entity.md, embed-providers.md) and the Explorer's Timeline: the mind map, swimlanes,
// and entity boxes (embeds and the activity feed are in ./embeds-timeline). Shared marks live in ./canvas-marks.
import {
  ARROW,
  Caret,
  INK,
  INK_SHADE,
  INK_TEXT,
  SHADOW,
  Scene,
  Selection,
  TEXT_BODY,
  TEXT_STRONG,
} from './canvas-marks';
import { Frame, MONO } from './shared';

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
              fontFamily={MONO}
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
