import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from '@liveworkspace/template-previews/motion';
import { FILL_BOX, Pop, PopDot, popGroup } from '@liveworkspace/template-previews/story-parts';

// Group 19: the redesigned single-picture templates (the timeline, the pyramid, the Venn diagram, the fishbone) and
// the classic retrospective, as the templates now draw them: a bold title over a how-to, colour that means
// something. Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const WHITE = 'white';
const INK = 'rgb(15 23 42)';
const BODY = 'rgb(51 65 85)';
const MUTED = 'rgb(148 163 184)';
const LINE = 'rgb(71 85 105)';
const BOLD = 'rgb(3 105 161)';

// Text as a bar, the way every preview draws a line of copy.
const Bar = ({
  x,
  y,
  w,
  fill = INK,
  h = 0.9,
}: {
  x: number;
  y: number;
  w: number;
  fill?: string;
  h?: number;
}) => <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} />;

// The bold title and the muted how-to caption every redesigned template opens with.
const Title = ({ w, cw, x = 2 }: { w: number; cw: number; x?: number }) => (
  <g>
    <Bar x={x} y={1.6} w={w} h={1.8} />
    <Bar x={x} y={4.6} w={cw} h={0.8} fill={MUTED} />
  </g>
);

// The timeline's statuses (template-builders-timelines.ts): done, in progress, up next.
const DONE = { fill: 'rgb(34 197 94)', edge: 'rgb(21 128 61)' };
const NOW = { fill: 'rgb(59 130 246)', edge: 'rgb(29 78 216)' };
const NEXT = { fill: WHITE, edge: 'rgb(148 163 184)' };
const MILESTONES = [
  { x: 8, s: DONE },
  { x: 19.5, s: DONE },
  { x: 31, s: DONE },
  { x: 42.5, s: NOW },
  { x: 59, s: NEXT },
  { x: 70.5, s: NEXT },
];

// The pyramid's tiers, top to bottom: fill, the rail card's tint and the tier's ink.
const TIERS = [
  { fill: 'rgb(167 139 250)', tint: 'rgb(245 243 255)', ink: 'rgb(109 40 217)' },
  { fill: 'rgb(129 140 248)', tint: 'rgb(238 242 255)', ink: 'rgb(67 56 202)' },
  { fill: 'rgb(96 165 250)', tint: 'rgb(239 246 255)', ink: 'rgb(29 78 216)' },
  { fill: 'rgb(94 234 212)', tint: 'rgb(240 253 250)', ink: 'rgb(15 118 110)' },
  { fill: 'rgb(134 239 172)', tint: 'rgb(240 253 244)', ink: 'rgb(21 128 61)' },
];

// The fishbone's six cause families: where the bone meets the spine, above or below, and its hue.
const BONES = [
  { j: 21, up: true, edge: 'rgb(225 29 72)', fill: 'rgb(255 228 230)' },
  { j: 37, up: true, edge: 'rgb(217 119 6)', fill: 'rgb(254 243 199)' },
  { j: 53, up: true, edge: 'rgb(37 99 235)', fill: 'rgb(219 234 254)' },
  { j: 21, up: false, edge: 'rgb(22 163 74)', fill: 'rgb(220 252 231)' },
  { j: 37, up: false, edge: 'rgb(124 58 237)', fill: 'rgb(237 233 254)' },
  { j: 53, up: false, edge: 'rgb(71 85 105)', fill: 'rgb(226 232 240)' },
];
const ROOT = 'rgb(225 29 72)';

// The retrospective's three note columns, left to right.
const RETRO = [
  {
    x: 17,
    band: 'rgb(240 253 244)',
    edge: 'rgb(134 239 172)',
    note: 'rgb(187 247 208)',
    ink: 'rgb(21 128 61)',
  },
  {
    x: 32,
    band: 'rgb(255 241 242)',
    edge: 'rgb(253 164 175)',
    note: 'rgb(254 205 211)',
    ink: 'rgb(190 18 60)',
  },
  {
    x: 47,
    band: 'rgb(250 245 255)',
    edge: 'rgb(196 181 253)',
    note: 'rgb(233 213 255)',
    ink: 'rgb(109 40 217)',
  },
];

export function templatePreviewGroup19(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'timeline':
      // Title, how-to and the status legend; a heavy green spine up to the red Today marker, slate after it to the
      // arrowhead; six status discs (the one in progress larger), labels alternating above and below. Hover story:
      // the next milestone lands, its disc turns green and Today moves on past it.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          <Title w={30} cw={46} />
          {[DONE, NOW, NEXT].map((s, i) => (
            <g key={s.edge}>
              <circle
                cx={3 + i * 10}
                cy="9.4"
                r="1"
                fill={s.fill}
                stroke={s.edge}
                strokeWidth="0.45"
              />
              <Bar x={4.8 + i * 10} y={9} w={5} h={0.8} fill={MUTED} />
            </g>
          ))}
          <line x1="2" y1="30" x2="51" y2="30" stroke={DONE.fill} strokeWidth="1.5" />
          <line x1="51" y1="30" x2="75" y2="30" stroke={MUTED} strokeWidth="1" />
          <polygon points="75,28.2 78.5,30 75,31.8" fill={MUTED} />
          {MILESTONES.map(({ x, s }, i) => {
            const up = i % 2 === 0;
            const top = up ? 18.5 : 35.5;
            return (
              <g key={x}>
                <circle
                  cx={x}
                  cy="30"
                  r={s === NOW ? 3.4 : 2.6}
                  fill={s.fill}
                  stroke={s.edge}
                  strokeWidth="0.6"
                />
                <circle
                  cx={x}
                  cy="30"
                  r="0.8"
                  fill="none"
                  stroke={s === NEXT ? s.edge : WHITE}
                  strokeWidth="0.45"
                />
                <Bar x={x - 2} y={top} w={4} h={0.7} fill={s.edge} />
                <Bar x={x - 4} y={top + 2} w={8} h={1.1} fill={s === NOW ? INK : BODY} />
                <Bar x={x - 4.5} y={top + 4.3} w={9} h={0.6} fill={MUTED} />
              </g>
            );
          })}
          <g className="pv-shift" style={pv({ '--pv-dx': '13px', '--pv-at': '1500ms' })}>
            <line
              x1="51"
              y1="16.5"
              x2="51"
              y2="34"
              stroke={ROOT}
              strokeWidth="0.55"
              strokeDasharray="1 0.7"
            />
            <rect x="47.5" y="13" width="7" height="3.2" rx="1.6" fill={ROOT} />
            <Bar x={49} y={14.2} w={4} h={0.8} fill={WHITE} />
          </g>
          <Pop at={1100} x={51} y={29.25} width={13} height={1.5} fill={DONE.fill} />
          <PopDot
            at={1300}
            cx={59}
            cy={30}
            r={2.6}
            fill={DONE.fill}
            stroke={DONE.edge}
            strokeWidth={0.6}
          />
        </svg>
      );
    case 'pyramid':
      // Title and how-to; five tiers graded violet to green, each named, and down the right a tinted card per tier
      // (glyph, the question in the tier's ink, the answer) joined to its band by a dotted leader in the same ink.
      // Hover story: read up for how, each card lights in turn from the base.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          <Title w={28} cw={44} />
          {TIERS.map((t, i) => {
            const y0 = 9 + i * 7.6;
            const y1 = y0 + 7.6;
            const half = (y: number) => (21 * (y - 9)) / 38;
            const cy = (y0 + y1) / 2;
            return (
              <g key={t.fill}>
                <polygon
                  points={`${24 - half(y0)},${y0} ${24 + half(y0)},${y0} ${24 + half(y1)},${y1} ${24 - half(y1)},${y1}`}
                  fill={t.fill}
                  stroke={WHITE}
                  strokeWidth="0.4"
                />
                {/* The name, narrower in the apex where the tier is thin. */}
                <Bar
                  x={i === 0 ? 22.4 : 21}
                  y={cy - 0.2 + (i === 0 ? 1.4 : 0)}
                  w={i === 0 ? 3.2 : 6}
                  h={1}
                  fill={INK}
                />
                <line
                  x1={24 + half(cy) + 1.5}
                  y1={cy}
                  x2="50"
                  y2={cy}
                  stroke={t.ink}
                  strokeWidth="0.45"
                  strokeDasharray="0.4 0.8"
                />
                <g
                  className="pv-pulse"
                  style={{ ...pv({ '--pv-at': `${900 + (4 - i) * 220}ms` }), ...FILL_BOX }}
                >
                  <rect
                    x="51"
                    y={cy - 3}
                    width="27"
                    height="6"
                    rx="0.8"
                    fill={t.tint}
                    stroke={t.ink}
                    strokeWidth="0.55"
                  />
                  <circle cx="53.4" cy={cy} r="1" fill="none" stroke={t.ink} strokeWidth="0.45" />
                  <Bar x={55.6} y={cy - 1.6} w={14} h={1.1} fill={t.ink} />
                  <Bar x={55.6} y={cy + 0.8} w={18} h={0.6} fill={BODY} />
                </g>
              </g>
            );
          })}
        </svg>
      );
    case 'venn':
      // Title and how-to; three translucent lenses on a white sheet (Desirable, Feasible, Viable) with the Sweet spot
      // pill at their heart, and an Ideas we tested rail, each idea with a chip naming where it landed. Hover story:
      // a new idea is tested and lands in the sweet spot.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          <Title w={32} cw={46} />
          <rect
            x="2"
            y="8"
            width="49"
            height="40"
            rx="1"
            fill={WHITE}
            stroke="rgb(226 232 240)"
            strokeWidth="0.6"
          />
          <circle
            cx="26.5"
            cy="21"
            r="11"
            fill="rgb(251 207 232)"
            fillOpacity="0.75"
            stroke="rgb(244 114 182)"
            strokeWidth="0.5"
          />
          <circle
            cx="20"
            cy="32.5"
            r="11"
            fill="rgb(191 219 254)"
            fillOpacity="0.65"
            stroke="rgb(96 165 250)"
            strokeWidth="0.5"
          />
          <circle
            cx="33"
            cy="32.5"
            r="11"
            fill="rgb(167 243 208)"
            fillOpacity="0.6"
            stroke="rgb(52 211 153)"
            strokeWidth="0.5"
          />
          <Bar x={22.5} y={14} w={8} h={1.3} fill="rgb(190 18 60)" />
          <Bar x={12} y={35} w={8} h={1.3} fill="rgb(29 78 216)" />
          <Bar x={33} y={35} w={8} h={1.3} fill="rgb(4 120 87)" />
          <g className="pv-pulse" style={{ ...pv({ '--pv-at': '2200ms' }), ...FILL_BOX }}>
            <rect
              x="21.5"
              y="26.4"
              width="10"
              height="3.6"
              rx="1.8"
              fill={BOLD}
              stroke="rgb(7 89 133)"
              strokeWidth="0.5"
            />
            <Bar x={23.5} y={27.8} w={6} h={0.8} fill={WHITE} />
          </g>
          <Bar x={55} y={13.5} w={14} h={1.2} />
          {[
            { y: 16.5, chip: BOLD, solid: true },
            { y: 24, chip: 'rgb(217 119 6)', solid: false },
            { y: 31.5, chip: 'rgb(124 58 237)', solid: false },
            { y: 39, chip: 'rgb(13 148 136)', solid: false },
          ].map((c) => (
            <g key={c.y}>
              <rect
                x="55"
                y={c.y}
                width="23"
                height="6"
                rx="0.8"
                fill={WHITE}
                stroke="rgb(203 213 225)"
                strokeWidth="0.5"
              />
              <Bar x={56.4} y={c.y + 1.3} w={10} h={1} />
              <Bar x={56.4} y={c.y + 3.6} w={8} h={0.6} fill={MUTED} />
              <rect
                x="68.6"
                y={c.y + 2}
                width="8"
                height="2.4"
                rx="1.2"
                fill={c.solid ? c.chip : 'rgb(248 250 252)'}
                stroke={c.chip}
                strokeWidth="0.45"
              />
            </g>
          ))}
          <PopDot
            at={1500}
            cx={26.5}
            cy={24.5}
            r={1.1}
            fill="rgb(251 191 36)"
            stroke="rgb(180 83 9)"
            strokeWidth={0.4}
          />
        </svg>
      );
    case 'fishbone':
      // Title and how-to; the spine from a chevron tail into the bold problem head, six cause bones each under its
      // tinted family pill, two ribs a bone, and the two likely root causes in red. Hover story: asking why lights the
      // root causes in turn, then the problem.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          <Title w={30} cw={50} />
          <path d="M2.5 24.5 L7 29 L2.5 33.5" fill="none" stroke={LINE} strokeWidth="0.9" />
          <line x1="7" y1="29" x2="60" y2="29" stroke={LINE} strokeWidth="1" />
          <polygon points="60,27.4 62.8,29 60,30.6" fill={LINE} />
          {BONES.map(({ j, up, edge, fill }) => {
            const tip = up ? 14 : 44;
            const ribs = up ? [19, 24] : [39, 34];
            return (
              <g key={`${j}-${up}`}>
                <line x1={j - 9} y1={tip} x2={j} y2="29" stroke={LINE} strokeWidth="0.6" />
                {ribs.map((ry) => {
                  const rx = j - (9 * Math.abs(29 - ry)) / 15;
                  const root = (j === 37 && up && ry === 19) || (j === 53 && !up && ry === 34);
                  return (
                    <g key={ry}>
                      <line
                        x1={rx - 9}
                        y1={ry}
                        x2={rx}
                        y2={ry}
                        stroke={root ? ROOT : MUTED}
                        strokeWidth={root ? 0.8 : 0.5}
                      />
                      <Bar x={rx - 9} y={ry - 1.6} w={8} h={0.7} fill={root ? ROOT : BODY} />
                    </g>
                  );
                })}
                <rect
                  x={j - 15}
                  y={up ? 9.5 : 44}
                  width="12"
                  height="4.4"
                  rx="2.2"
                  fill={fill}
                  stroke={edge}
                  strokeWidth="0.6"
                />
                <Bar x={j - 12.5} y={up ? 11.3 : 45.8} w={7} h={0.9} fill={edge} />
              </g>
            );
          })}
          <rect
            x="63"
            y="23"
            width="15"
            height="12"
            rx="1"
            fill={BOLD}
            stroke="rgb(7 89 133)"
            strokeWidth="0.8"
          />
          <Bar x={65} y={27} w={11} h={1.3} fill={WHITE} />
          <Bar x={67} y={30} w={7} h={1.3} fill={WHITE} />
          <Pop
            at={900}
            x={21.5}
            y={16.6}
            width={10.5}
            height={3.4}
            rx={1.1}
            fill="none"
            stroke={ROOT}
            strokeWidth={0.5}
          />
          <Pop
            at={1400}
            x={40.5}
            y={31.6}
            width={10.5}
            height={3.4}
            rx={1.1}
            fill="none"
            stroke={ROOT}
            strokeWidth={0.5}
          />
          <g className="pv-new" opacity="0" style={popGroup(2000)}>
            <rect
              x="63"
              y="23"
              width="15"
              height="12"
              rx="1"
              fill="none"
              stroke={ROOT}
              strokeWidth="0.7"
            />
          </g>
        </svg>
      );
    case 'retrospective':
      // Title and how-to; the opening rail (mood check, timer and vote, the sprint in numbers), three note columns in
      // their hues each a two-by-four grid of notes, and the Action items column: this sprint's checklist, last
      // sprint's, and a shout-out. Hover story: the room answers the mood check, dots pile on a To improve note and
      // last sprint's carried action gets ticked.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          <Title w={18} cw={40} />
          <rect
            x="2"
            y="8"
            width="13"
            height="17"
            rx="1.2"
            fill="rgb(240 249 255)"
            stroke="rgb(56 189 248)"
            strokeWidth="0.6"
          />
          {[4.2, 6.4, 8.6, 10.8, 13].map((fx) => (
            <circle
              key={fx}
              cx={fx}
              cy="10.8"
              r="0.85"
              fill={WHITE}
              stroke="rgb(100 116 139)"
              strokeWidth="0.4"
            />
          ))}
          {[4.2, 6.4, 8.6, 10.8, 13].map((fx) => (
            <rect
              key={`t${fx}`}
              x={fx - 0.7}
              y="13.5"
              width="1.4"
              height="9"
              rx="0.7"
              fill="rgb(224 242 254)"
            />
          ))}
          <rect
            x="2"
            y="26.5"
            width="6"
            height="5"
            rx="1"
            fill={WHITE}
            stroke={MUTED}
            strokeWidth="0.5"
          />
          <rect
            x="9"
            y="26.5"
            width="6"
            height="5"
            rx="1"
            fill={WHITE}
            stroke={MUTED}
            strokeWidth="0.5"
          />
          <Bar x={2} y={34} w={10} h={1} />
          {[2, 6.5, 11].map((tx) => (
            <g key={tx}>
              <rect
                x={tx}
                y="36"
                width="4"
                height="5"
                rx="0.6"
                fill={WHITE}
                stroke="rgb(56 189 248)"
                strokeWidth="0.5"
              />
              <Bar x={tx + 1} y={37.6} w={2} h={1.2} fill="rgb(14 165 233)" />
            </g>
          ))}
          {RETRO.map((c) => (
            <g key={c.x}>
              <rect
                x={c.x}
                y="8"
                width="13.5"
                height="40"
                rx="1.2"
                fill={c.band}
                stroke={c.edge}
                strokeWidth="0.6"
              />
              <Bar x={c.x + 1.2} y={9.8} w={7} h={1.3} fill={c.ink} />
              <circle
                cx={c.x + 11.6}
                cy="10.4"
                r="0.9"
                fill="none"
                stroke={c.ink}
                strokeWidth="0.45"
              />
              {[13.5, 22, 30.5, 39].map((ny) =>
                [c.x + 1, c.x + 7].map((nx) => (
                  <g key={`${nx}-${ny}`}>
                    <rect x={nx} y={ny} width="5.5" height="7.5" rx="0.3" fill={c.note} />
                    <Bar x={nx + 0.7} y={ny + 1.2} w={4} h={0.6} fill={BODY} />
                  </g>
                )),
              )}
            </g>
          ))}
          <rect
            x="62.5"
            y="8"
            width="15.5"
            height="40"
            rx="1.2"
            fill="rgb(248 250 252)"
            stroke={MUTED}
            strokeWidth="1"
          />
          <Bar x={64} y={9.8} w={9} h={1.3} />
          {[
            { y: 13, rows: 3, h: 8.5 },
            { y: 26, rows: 2, h: 6 },
          ].map((box) => (
            <g key={box.y}>
              <rect
                x="64"
                y={box.y}
                width="12.5"
                height={box.h}
                rx="0.6"
                fill={WHITE}
                stroke="rgb(56 189 248)"
                strokeWidth="0.45"
              />
              {Array.from({ length: box.rows }, (_, r) => (
                <g key={r}>
                  <rect
                    x="65"
                    y={box.y + 1.2 + r * 2.3}
                    width="1.5"
                    height="1.5"
                    rx="0.3"
                    fill={WHITE}
                    stroke={LINE}
                    strokeWidth="0.35"
                  />
                  <Bar x={67.3} y={box.y + 1.6 + r * 2.3} w={8} h={0.6} fill={MUTED} />
                </g>
              ))}
            </g>
          ))}
          <Bar x={64} y={24} w={8} h={0.9} />
          <Bar x={64} y={34.2} w={8} h={0.9} />
          <rect x="64" y="36" width="12.5" height="10" rx="0.4" fill="rgb(253 230 138)" />
          <Bar x={65} y={37.5} w={9} h={0.6} fill={BODY} />
          {[
            { x: 6.4, h: 5, at: 700 },
            { x: 8.6, h: 7.5, at: 800 },
            { x: 10.8, h: 5.5, at: 900 },
          ].map((b) => (
            <rect
              key={b.x}
              className="pv-grow-y"
              opacity="0"
              x={b.x - 0.7}
              y={22.5 - b.h}
              width="1.4"
              height={b.h}
              rx="0.7"
              fill="rgb(56 189 248)"
              style={pv({ '--pv-at': `${b.at}ms` })}
            />
          ))}
          {[1500, 1700, 1900].map((at, i) => (
            <PopDot key={at} at={at} cx={34.4 + i * 1.6} cy={19.6} r={0.7} fill="rgb(79 70 229)" />
          ))}
          <path
            className="pv-new"
            opacity="0"
            d="M65.2 30.3 L65.8 30.9 L66.4 29.7"
            fill="none"
            stroke="rgb(22 163 74)"
            strokeWidth="0.5"
            style={pv({ '--pv-at': '2400ms' })}
          />
        </svg>
      );
    default:
      return null;
  }
}
