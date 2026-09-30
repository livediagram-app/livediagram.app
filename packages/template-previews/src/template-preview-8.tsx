import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';
import { FILL_BOX, Pop, popGroup } from './story-parts';

// Group 8: the discovery and strategy starters built together, the
// opportunity solution tree and the stakeholder map. Static SVG preview
// tiles, one branch per TemplateKind; TemplatePreview chains the groups
// with ??.

const WHITE = 'white';
const LINE = 'rgb(100 116 139)';

// One level of the opportunity tree: the row's wash, its rail tile, and the
// hue its cards are edged in (./template-opportunity-tree-data LEVELS).
const LEVELS = [
  { y: 2, h: 9.5, band: 'rgb(250 245 255)', tile: 'rgb(221 214 254)', edge: 'rgb(124 58 237)' },
  { y: 12.5, h: 18, band: 'rgb(240 249 255)', tile: 'rgb(186 230 253)', edge: 'rgb(2 132 199)' },
  { y: 31.5, h: 7, band: 'rgb(240 253 244)', tile: 'rgb(187 247 208)', edge: 'rgb(22 163 74)' },
  { y: 39.5, h: 9, band: 'rgb(255 251 235)', tile: 'rgb(253 230 138)', edge: 'rgb(217 119 6)' },
];

// The assumption tests' verdicts, left to right, as the chips land.
const VERDICTS = [
  'rgb(21 128 61)',
  'rgb(37 99 235)',
  'rgb(190 18 60)',
  'rgb(21 128 61)',
  'rgb(37 99 235)',
  'rgb(190 18 60)',
];

// A white card edged in its level's hue.
const Card = ({
  x,
  y,
  w,
  h,
  edge,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  edge: string;
}) => (
  <rect x={x} y={y} width={w} height={h} rx="0.8" fill={WHITE} stroke={edge} strokeWidth="0.5" />
);

// Text as a muted bar, the way every preview draws a line of copy.
const Bar = ({
  x,
  y,
  w,
  fill = 'rgb(51 65 85)',
}: {
  x: number;
  y: number;
  w: number;
  fill?: string;
}) => <rect x={x} y={y} width={w} height="0.9" rx="0.4" fill={fill} />;

// The stakeholder map's quadrants, in reading order (TL, TR, BL, BR).
const QUADS = [
  { x: 10, y: 3, fill: 'rgb(219 234 254)', ink: 'rgb(29 78 216)' },
  { x: 29.5, y: 3, fill: 'rgb(237 233 254)', ink: 'rgb(109 40 217)' },
  { x: 10, y: 22.5, fill: 'rgb(254 243 199)', ink: 'rgb(180 83 9)' },
  { x: 29.5, y: 22.5, fill: 'rgb(204 251 241)', ink: 'rgb(15 118 110)' },
];
const CHAMPION = 'rgb(22 163 74)';
const NEUTRAL = 'rgb(100 116 139)';
const SCEPTIC = 'rgb(225 29 72)';

// A stakeholder: a white card with a person glyph, edged by stance.
const Person = ({ x, y, edge }: { x: number; y: number; edge: string }) => (
  <g>
    <rect x={x} y={y} width="9" height="4" rx="0.7" fill={WHITE} stroke={edge} strokeWidth="0.6" />
    <circle cx={x + 1.8} cy={y + 1.5} r="0.6" fill={LINE} />
    <rect x={x + 3.3} y={y + 1.2} width="4.6" height="0.8" rx="0.3" fill="rgb(15 23 42)" />
    <rect x={x + 3.3} y={y + 2.4} width="3.4" height="0.6" rx="0.3" fill="rgb(148 163 184)" />
  </g>
);

export function templatePreviewGroup8(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'opportunity-solution-tree':
      // Four level bands, each named by a rail tile in its hue: a violet
      // outcome card with its progress ring, three opportunities with the
      // middle one broken down and its target (solid, starred), three
      // solutions under the target and two tests under each. Hover story:
      // the tests report back, one verdict chip at a time, the target's
      // star pulses, and the outcome ring fills a little further.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {LEVELS.map((l) => (
            <g key={l.y}>
              <rect x="1.5" y={l.y} width="77" height={l.h} rx="1.4" fill={l.band} />
              <rect x="1.5" y={l.y} width="8.5" height={l.h} rx="1.4" fill={l.tile} />
              <circle cx="4" cy={l.y + 2.3} r="1" fill="none" stroke={l.edge} strokeWidth="0.5" />
              <rect x="3" y={l.y + 4.2} width="5.5" height="0.8" rx="0.4" fill={l.edge} />
            </g>
          ))}
          {/* The rake: outcome to opportunities, the middle one to its
              breakdown, the target to the solutions, each solution to its
              two tests. */}
          <path
            d="M45 9.5 V11.9 M20 11.9 H70 M20 11.9 V14 M45 11.9 V14 M70 11.9 V14 M45 19.5 V21.2 M28 21.2 H62 M28 21.2 V23 M45 21.2 V23 M62 21.2 V23 M45 28.5 V30.4 M23 30.4 H67 M23 30.4 V32.5 M45 30.4 V32.5 M67 30.4 V32.5"
            fill="none"
            stroke={LINE}
            strokeWidth="0.45"
          />
          <path
            d="M18 37 V40.5 M28 37 V40.5 M40 37 V40.5 M50 37 V40.5 M62 37 V40.5 M72 37 V40.5"
            fill="none"
            stroke={LINE}
            strokeWidth="0.45"
          />
          {/* The outcome: a solid violet card, its ring and metric. */}
          <rect x="31" y="3.5" width="28" height="6" rx="0.9" fill="rgb(91 33 182)" />
          <circle
            cx="34.6"
            cy="6.5"
            r="1.9"
            fill="none"
            stroke="rgb(124 58 237)"
            strokeWidth="0.8"
          />
          <path
            d="M34.6 4.6 A1.9 1.9 0 0 1 36.5 6.5"
            fill="none"
            stroke="rgb(221 214 254)"
            strokeWidth="0.8"
          />
          <g className="pv-new" opacity="0" style={popGroup(2900)}>
            <path
              className="pv-draw"
              pathLength="1"
              d="M36.5 6.5 A1.9 1.9 0 0 1 35.9 7.9"
              fill="none"
              stroke="rgb(221 214 254)"
              strokeWidth="0.8"
              style={pv({ '--pv-at': '2900ms', '--pv-dur': '500ms' })}
            />
          </g>
          <Bar x={38} y={5} w={18} fill={WHITE} />
          <Bar x={38} y={7.2} w={12} fill="rgb(221 214 254)" />
          {/* Opportunities in the customer's words, each with its evidence. */}
          {[13, 38, 63].map((x) => (
            <g key={x}>
              <Card x={x} y={14} w={14} h={5.5} edge={LEVELS[1]!.edge} />
              <Bar x={x + 1.2} y={15.3} w={10} />
              <rect x={x + 1.2} y={17.3} width="7" height="1.2" rx="0.6" fill="rgb(224 242 254)" />
            </g>
          ))}
          {[21, 55].map((x) => (
            <g key={x}>
              <Card x={x} y={23} w={14} h={5.5} edge={LEVELS[1]!.edge} />
              <Bar x={x + 1.2} y={24.3} w={9} />
              <rect x={x + 1.2} y={26.3} width="7" height="1.2" rx="0.6" fill="rgb(224 242 254)" />
            </g>
          ))}
          {/* The target: solid, with its star ribbon. */}
          <rect
            x="38"
            y="23"
            width="14"
            height="5.5"
            rx="0.8"
            fill="rgb(2 132 199)"
            stroke="rgb(7 89 133)"
            strokeWidth="0.7"
          />
          <Bar x={39.4} y={24.6} w={9} fill={WHITE} />
          <rect x="39.4" y="26.3" width="7" height="1.2" rx="0.6" fill={WHITE} />
          <g className="pv-pulse" style={{ ...pv({ '--pv-at': '2500ms' }), ...FILL_BOX }}>
            <rect x="47" y="21.6" width="5.6" height="2.4" rx="1.2" fill="rgb(251 191 36)" />
            <circle cx="48.4" cy="22.8" r="0.55" fill="rgb(69 26 3)" />
          </g>
          {/* Three solutions compared under the target. */}
          {[13, 35, 57].map((x) => (
            <g key={x}>
              <Card x={x} y={32.5} w={20} h={4.5} edge={LEVELS[2]!.edge} />
              <circle
                cx={x + 2}
                cy="34.75"
                r="0.9"
                fill="none"
                stroke={LEVELS[2]!.edge}
                strokeWidth="0.45"
              />
              <Bar x={x + 3.8} y={34.3} w={11} fill="rgb(22 101 52)" />
            </g>
          ))}
          {/* Two assumption tests per solution, each awaiting its verdict. */}
          {[13.5, 23.5, 35.5, 45.5, 57.5, 67.5].map((x, i) => (
            <g key={x}>
              <Card x={x} y={40.5} w={9} h={7} edge={LEVELS[3]!.edge} />
              <Bar x={x + 1} y={41.8} w={6.5} fill="rgb(15 23 42)" />
              <Bar x={x + 1} y={43.2} w={5} fill="rgb(148 163 184)" />
              <Pop
                at={1200 + i * 220}
                x={x + 1}
                y={45}
                width="5.5"
                height="1.5"
                rx="0.75"
                fill={VERDICTS[i]}
              />
            </g>
          ))}
        </svg>
      );
    case 'stakeholder-map':
      // Four tinted quadrants on power / interest axes, stakeholders edged
      // by stance, a dashed arrow from the powerful sceptic to where the
      // team wants her, and the engagement plan table beside the grid.
      // Hover story: the sceptic moves along the arrow into Manage
      // closely, turns champion there, and her plan row lights up.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {QUADS.map((q) => (
            <g key={`${q.x}-${q.y}`}>
              <rect x={q.x} y={q.y} width="19" height="19" rx="1" fill={q.fill} />
              <circle
                cx={q.x + 2.3}
                cy={q.y + 2.4}
                r="1"
                fill="none"
                stroke={q.ink}
                strokeWidth="0.5"
              />
              <rect x={q.x + 4} y={q.y + 1.8} width="9" height="1.3" rx="0.4" fill={q.ink} />
            </g>
          ))}
          {/* Axes: power up the left, interest along the bottom. */}
          <path d="M7 42 V4.5 M10 45 H47.5" fill="none" stroke={LINE} strokeWidth="0.7" />
          <path d="M5.8 5.5 L7 3.2 L8.2 5.5 Z M46.5 43.8 L48.8 45 L46.5 46.2 Z" fill={LINE} />
          {/* Where each person sits, edged by stance. */}
          <Person x={20} y={15} edge={NEUTRAL} />
          <Person x={39.3} y={7.5} edge={CHAMPION} />
          <Person x={39.3} y={12.8} edge={CHAMPION} />
          <Person x={30} y={17.3} edge={NEUTRAL} />
          <Person x={12} y={35} edge={NEUTRAL} />
          <Person x={38.5} y={27} edge={CHAMPION} />
          <Person x={32} y={35} edge={SCEPTIC} />
          {/* The move: the ghost where she should end up, the dashed arrow. */}
          <rect
            x="30"
            y="8"
            width="9"
            height="4"
            rx="0.7"
            fill="none"
            stroke={SCEPTIC}
            strokeWidth="0.5"
            strokeDasharray="1 0.7"
            opacity="0.8"
          />
          <path
            d="M20.8 10 H28.6"
            fill="none"
            stroke={SCEPTIC}
            strokeWidth="0.5"
            strokeDasharray="1 0.7"
          />
          <path d="M28.3 9 L30 10 L28.3 11 Z" fill={SCEPTIC} />
          <g
            className="pv-shift"
            style={{
              ...pv({ '--pv-at': '1500ms', '--pv-dx': '18.8px', '--pv-dur': '900ms' }),
              ...FILL_BOX,
            }}
          >
            <Person x={11.2} y={8} edge={SCEPTIC} />
          </g>
          <g className="pv-new" opacity="0" style={popGroup(2500)}>
            <Person x={30} y={8} edge={CHAMPION} />
          </g>
          {/* The engagement plan: a header, then a row per key person, the
              name cell tinted by stance. */}
          <rect x="52" y="4" width="26" height="3" rx="0.5" fill="rgb(226 232 240)" />
          {[CHAMPION, SCEPTIC, CHAMPION, NEUTRAL, NEUTRAL, SCEPTIC].map((c, i) => (
            <g key={i}>
              <rect
                x="52"
                y={7.5 + i * 4.2}
                width="26"
                height="3.8"
                fill={WHITE}
                stroke="rgb(203 213 225)"
                strokeWidth="0.3"
              />
              <rect
                x="52"
                y={7.5 + i * 4.2}
                width="6.5"
                height="3.8"
                fill={
                  c === CHAMPION
                    ? 'rgb(220 252 231)'
                    : c === SCEPTIC
                      ? 'rgb(255 228 230)'
                      : 'rgb(241 245 249)'
                }
              />
              <rect x="53" y={9 + i * 4.2} width="4.2" height="0.8" rx="0.3" fill={c} />
              <Bar x={60} y={9 + i * 4.2} w={9} fill="rgb(100 116 139)" />
              <Bar x={70.5} y={9 + i * 4.2} w={6} fill="rgb(148 163 184)" />
            </g>
          ))}
          <Pop at={2900} x="52" y="11.7" width="6.5" height="3.8" fill="rgb(220 252 231)" />
          <Pop at={2900} x="53" y="13.2" width="4.2" height="0.8" rx="0.3" fill={CHAMPION} />
          {/* The pinned next step and the stance key. */}
          <rect
            x="52"
            y="34.5"
            width="14"
            height="11.5"
            rx="0.6"
            fill="rgb(253 230 138)"
            transform="rotate(-2 59 40)"
          />
          {[CHAMPION, NEUTRAL, SCEPTIC].map((c, i) => (
            <rect
              key={c}
              x="68.5"
              y={35 + i * 3.6}
              width="9"
              height="2.6"
              rx="0.6"
              fill={WHITE}
              stroke={c}
              strokeWidth="0.6"
            />
          ))}
        </svg>
      );
    default:
      return null;
  }
}
