import type { ReactElement } from 'react';
import type { TemplateKind } from '@liveplanner/templates';
import { pv } from './motion';
import { Pop, popGroup } from './story-parts';

// Group 18: the redesigned process and structure diagrams (the tree mind map, the swimlane, the approval
// workflow and the system architecture), each a lane or branch per hue as the templates now draw them. Static SVG
// preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const WHITE = 'white';
const LINE = 'rgb(100 116 139)';
const INK = 'rgb(15 23 42)';
const MUTED = 'rgb(148 163 184)';
const BOLD = 'rgb(3 105 161)';

// One hue of the house's lane palette: the lane wash, its side strip, the edge its steps take, and its ink.
type Hue = { band: string; strip: string; edge: string; ink: string; fill: string };
const VIOLET: Hue = {
  band: 'rgb(250 245 255)',
  strip: 'rgb(237 233 254)',
  edge: 'rgb(167 139 250)',
  ink: 'rgb(109 40 217)',
  fill: 'rgb(139 92 246)',
};
const SKY: Hue = {
  band: 'rgb(240 249 255)',
  strip: 'rgb(224 242 254)',
  edge: 'rgb(56 189 248)',
  ink: 'rgb(3 105 161)',
  fill: 'rgb(14 165 233)',
};
const GREEN: Hue = {
  band: 'rgb(240 253 244)',
  strip: 'rgb(209 250 229)',
  edge: 'rgb(52 211 153)',
  ink: 'rgb(4 120 87)',
  fill: 'rgb(16 185 129)',
};
const AMBER: Hue = {
  band: 'rgb(255 251 235)',
  strip: 'rgb(254 243 199)',
  edge: 'rgb(251 191 36)',
  ink: 'rgb(180 83 9)',
  fill: 'rgb(245 158 11)',
};
const ROSE: Hue = {
  band: 'rgb(255 241 242)',
  strip: 'rgb(255 228 230)',
  edge: 'rgb(251 113 133)',
  ink: 'rgb(190 18 60)',
  fill: 'rgb(244 63 94)',
};

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
const Title = ({ w, cw }: { w: number; cw: number }) => (
  <g>
    <Bar x={2} y={1.6} w={w} h={1.8} />
    <Bar x={2} y={4.6} w={cw} h={0.8} fill={MUTED} />
  </g>
);

// A horizontal lane: its wash, its tinted side strip holding the role's name and glyph.
const Lane = ({ y, h, hue }: { y: number; h: number; hue: Hue }) => (
  <g>
    <rect
      x="2"
      y={y}
      width="76"
      height={h}
      rx="1"
      fill={hue.band}
      stroke={hue.edge}
      strokeWidth="0.45"
    />
    <rect x="2" y={y} width="11" height={h} rx="1" fill={hue.strip} />
    <Bar x={3.4} y={y + 1.8} w={7} h={1.1} fill={hue.ink} />
    <circle cx="4.4" cy={y + h - 2.4} r="1" fill="none" stroke={hue.ink} strokeWidth="0.5" />
  </g>
);

// A step: a white box edged in its lane's hue, a line of copy inside.
const Step = ({
  cx,
  cy,
  w = 7,
  h = 4,
  hue,
  dashed = false,
}: {
  cx: number;
  cy: number;
  w?: number;
  h?: number;
  hue: Hue;
  dashed?: boolean;
}) => (
  <g>
    <rect
      x={cx - w / 2}
      y={cy - h / 2}
      width={w}
      height={h}
      rx="0.7"
      fill={WHITE}
      stroke={hue.fill}
      strokeWidth="0.55"
      {...(dashed ? { strokeDasharray: '1 0.6' } : {})}
    />
    <Bar x={cx - w / 2 + 1.2} y={cy - 0.4} w={w - 2.4} h={0.8} fill="rgb(51 65 85)" />
  </g>
);

// A stadium (a start or a finish), filled solid or soft.
const Stadium = ({
  cx,
  cy,
  w,
  hue,
  solid,
}: {
  cx: number;
  cy: number;
  w: number;
  hue: Hue;
  solid: boolean;
}) => (
  <g>
    <rect
      x={cx - w / 2}
      y={cy - 2.2}
      width={w}
      height="4.4"
      rx="2.2"
      fill={solid ? hue.fill : hue.strip}
      stroke={hue.fill}
      strokeWidth="0.55"
    />
    <Bar x={cx - w / 2 + 1.6} y={cy - 0.4} w={w - 3.2} h={0.8} fill={solid ? WHITE : hue.ink} />
  </g>
);

// A decision diamond in a hue.
const Diamond = ({
  cx,
  cy,
  w = 8,
  h = 5.6,
  hue,
}: {
  cx: number;
  cy: number;
  w?: number;
  h?: number;
  hue: Hue;
}) => (
  <polygon
    points={`${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`}
    fill={hue.strip}
    stroke={hue.fill}
    strokeWidth="0.55"
  />
);

// A datastore: a cylinder in the Data tier's hue.
const Cylinder = ({ cx, cy, hue }: { cx: number; cy: number; hue: Hue }) => (
  <g>
    <path
      d={`M${cx - 6} ${cy - 1.7} A6 1 0 0 1 ${cx + 6} ${cy - 1.7} V${cy + 1.9} A6 1 0 0 1 ${cx - 6} ${cy + 1.9} Z`}
      fill={WHITE}
      stroke={hue.fill}
      strokeWidth="0.55"
    />
    <path
      d={`M${cx - 6} ${cy - 1.7} A6 1 0 0 0 ${cx + 6} ${cy - 1.7}`}
      fill="none"
      stroke={hue.fill}
      strokeWidth="0.45"
    />
    <Bar x={cx - 3} y={cy + 0.3} w={6} h={0.8} fill="rgb(51 65 85)" />
  </g>
);

// The tree mind map's five branches, top to bottom (template-builders-mindmaps.ts), with how many leaves each grows.
const TREE = [
  { hue: SKY, leaves: 2 },
  { hue: VIOLET, leaves: 3 },
  { hue: AMBER, leaves: 2 },
  { hue: ROSE, leaves: 2 },
  { hue: GREEN, leaves: 2 },
];
const LEAF_Y = (i: number) => 2.4 + i * 4.5;

export function templatePreviewGroup18(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'mindmap-tree': {
      // A bold root on the left, five branches each in its own hue with a glyph, and their leaves edged in the
      // branch's hue down the right; connectors carry the hue too. Hover story: Tab on the last branch grows a leaf.
      let n = 0;
      const branches = TREE.map((b) => {
        const ys = Array.from({ length: b.leaves }, () => LEAF_Y(n++));
        return { ...b, ys, cy: ys.reduce((s, y) => s + y, 0) / ys.length };
      });
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {branches.map(({ hue, ys, cy }) => (
            <g key={cy}>
              <path
                d={`M19 25 C24 25 23 ${cy} 28 ${cy}`}
                fill="none"
                stroke={hue.fill}
                strokeWidth="0.9"
              />
              {ys.map((ly) => (
                <g key={ly}>
                  <path
                    d={`M42 ${cy} C47 ${cy} 46 ${ly} 51 ${ly}`}
                    fill="none"
                    stroke={hue.edge}
                    strokeWidth="0.55"
                  />
                  <rect
                    x="51"
                    y={ly - 1.7}
                    width="26"
                    height="3.4"
                    rx="0.8"
                    fill={WHITE}
                    stroke={hue.edge}
                    strokeWidth="0.55"
                  />
                  <Bar x={56} y={ly - 0.4} w={16} h={0.8} fill="rgb(51 65 85)" />
                </g>
              ))}
              <rect
                x="28"
                y={cy - 3}
                width="14"
                height="6"
                rx="1"
                fill={hue.strip}
                stroke={hue.fill}
                strokeWidth="0.9"
              />
              <circle cx="31" cy={cy} r="0.9" fill="none" stroke={hue.ink} strokeWidth="0.5" />
              <Bar x={33} y={cy - 0.55} w={6.5} h={1.1} fill={hue.ink} />
            </g>
          ))}
          <rect
            x="2"
            y="19.5"
            width="17"
            height="11"
            rx="1.4"
            fill={BOLD}
            stroke="rgb(7 89 133)"
            strokeWidth="0.8"
          />
          <Bar x={4.5} y={23} w={12} h={1.6} fill={WHITE} />
          <Bar x={6} y={26.4} w={9} h={0.8} fill="rgb(186 230 253)" />
          {/* Hover story: Tab on Video grows a third leaf under it. */}
          <path
            className="pv-new"
            opacity="0"
            d="M42 45.15 C47 45.15 46 46.6 51 46.6"
            fill="none"
            stroke={GREEN.edge}
            strokeWidth="0.55"
            style={pv({ '--pv-at': '1300ms' })}
          />
          <rect
            className="pv-arrive"
            opacity="0"
            x="51"
            y="45.6"
            width="26"
            height="3.4"
            rx="0.8"
            fill={GREEN.strip}
            stroke={GREEN.fill}
            strokeWidth="0.6"
            style={pv({ '--pv-from-x': '-10px', '--pv-at': '900ms' })}
          />
        </svg>
      );
    }
    case 'swimlane':
      // Four role lanes, each its own hue with a glyph in its side strip; steps edged in their lane's hue, a solid
      // start, a decision, a dashed exception and a dashed notification climbing to the customer. Hover story: a
      // parcel rides the courier lane and the finish lights up.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          <Title w={30} cw={44} />
          {[VIOLET, SKY, AMBER, GREEN].map((hue, i) => (
            <Lane key={hue.fill} y={8 + i * 10.5} h={9} hue={hue} />
          ))}
          <g fill="none" stroke={LINE} strokeWidth="0.55">
            <path d="M18 14.7 V23 H22.5" />
            <path d="M29.5 23 H30" />
            <path d="M38 23 H42 V31.5" />
            <path d="M34 25.8 V31.5" />
            <path d="M37.5 33.5 H38.5 M45.5 33.5 H46.5" />
            <path d="M53.5 33.5 H58 V42" />
            <path d="M61.5 44 H62.5" />
            <path d="M69.5 44 H74 V14.7" />
            <path d="M53.5 12.5 H69" />
            <path d="M50 31.5 V14.5" strokeDasharray="1 0.7" />
          </g>
          <Stadium cx={18} cy={12.5} w={9} hue={VIOLET} solid />
          <Step cx={50} cy={12.5} hue={VIOLET} />
          <Stadium cx={74} cy={12.5} w={9} hue={VIOLET} solid={false} />
          <Step cx={26} cy={23} hue={SKY} />
          <Diamond cx={34} cy={23} hue={SKY} />
          <Step cx={34} cy={33.5} hue={AMBER} dashed />
          <Step cx={42} cy={33.5} hue={AMBER} />
          <Step cx={50} cy={33.5} hue={AMBER} />
          <Step cx={58} cy={44} hue={GREEN} />
          <Step cx={66} cy={44} hue={GREEN} />
          <circle
            className="pv-travel"
            opacity="0"
            cx="58"
            cy="40.3"
            r="1.1"
            fill={GREEN.fill}
            style={pv({ '--pv-dx': '8px', '--pv-at': '900ms', '--pv-dur': '1400ms' })}
          />
          <g className="pv-new" opacity="0" style={popGroup(2300)}>
            <rect
              x="69.5"
              y="10.3"
              width="9"
              height="4.4"
              rx="2.2"
              fill="none"
              stroke={VIOLET.fill}
              strokeWidth="0.8"
            />
          </g>
        </svg>
      );
    case 'approval-workflow':
      // Three desks as tinted columns (Requester, Manager, Finance), each with its glyph and name in the header band;
      // the request flows DOWN through them, a live flowchart (docs/specs/009-elements/flowchart.md): a solid start,
      // two decisions whose Yes and No leave by their corners, a soft finish, the usual-wait chips on the reviews' corners,
      // and the two ways a No goes (a dashed revise step that loops back to the start, a dashed final decline).
      // Hover story: the manager says Yes, the request crosses to Finance, the finish pulses.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          <Title w={34} cw={46} />
          {[
            { x: 2, w: 16, hue: VIOLET },
            { x: 18, w: 20, hue: SKY },
            { x: 38, w: 40, hue: GREEN },
          ].map(({ x, w, hue }) => (
            <g key={x}>
              <rect
                x={x}
                y="8"
                width={w}
                height="41"
                rx="1"
                fill={hue.band}
                stroke={hue.edge}
                strokeWidth="0.45"
              />
              <rect x={x} y="8" width={w} height="5" rx="1" fill={hue.strip} />
              <circle
                cx={x + w / 2 - 3}
                cy="10.5"
                r="0.9"
                fill="none"
                stroke={hue.ink}
                strokeWidth="0.5"
              />
              <Bar x={x + w / 2 - 1.5} y={9.95} w={5} h={1.1} fill={hue.ink} />
            </g>
          ))}
          <g fill="none" stroke={LINE} strokeWidth="0.55">
            <path d="M10 18.2 V19.6 H28 V21" />
            <path d="M28 25 V26.2" />
            <path d="M32 29 H58 V32.5" />
            <path d="M24 29 H10 V32.5" />
            <path d="M5 34.5 H3.5 V16 H4.5" />
            <path d="M58 36.5 V37.2" />
            <path d="M54 40 H49 V43.6" />
            <path d="M62 40 H67 V43.6" />
          </g>
          <Stadium cx={10} cy={16} w={11} hue={VIOLET} solid />
          <Step cx={28} cy={23} w={13} hue={SKY} />
          <Diamond cx={28} cy={29} hue={SKY} />
          <Step cx={58} cy={34.5} w={13} hue={GREEN} />
          <Diamond cx={58} cy={40} hue={GREEN} />
          <Stadium cx={49} cy={45.8} w={12} hue={GREEN} solid={false} />
          <Step cx={10} cy={34.5} w={11} hue={VIOLET} dashed />
          <rect
            x="61"
            y="43.6"
            width="12"
            height="4.4"
            rx="2.2"
            fill={WHITE}
            stroke={GREEN.fill}
            strokeWidth="0.55"
            strokeDasharray="1 0.6"
          />
          <Bar x={63.5} y={45.4} w={7} h={0.8} fill="rgb(51 65 85)" />
          {/* The usual wait at each desk, on its review's corner. */}
          <rect
            x="31"
            y="19.9"
            width="6"
            height="2.2"
            rx="1.1"
            fill={SKY.strip}
            stroke={SKY.edge}
            strokeWidth="0.4"
          />
          <rect
            x="61"
            y="31.4"
            width="6"
            height="2.2"
            rx="1.1"
            fill={GREEN.strip}
            stroke={GREEN.edge}
            strokeWidth="0.4"
          />
          {/* Hover story: the manager's Yes crosses to Finance; the purchase is approved. */}
          <circle
            className="pv-travel"
            opacity="0"
            cx="32"
            cy="29"
            r="1.1"
            fill={BOLD}
            style={pv({ '--pv-dx': '26px', '--pv-at': '900ms', '--pv-dur': '1400ms' })}
          />
          <g className="pv-new" opacity="0" style={popGroup(2300)}>
            <rect
              x="42.6"
              y="43.2"
              width="12.8"
              height="5.2"
              rx="2.6"
              fill="none"
              stroke={GREEN.fill}
              strokeWidth="0.8"
            />
          </g>
        </svg>
      );
    case 'system-architecture':
      // Four tiers as tinted lanes (Clients, Edge, Services, Data), each with its name, a muted line and a glyph in
      // its side strip; the API gateway the one solid node, the event bus tinted, the stores as cylinders; solid
      // lines wait for a reply, dashed ones are events. Hover story: a request falls through the tiers to the orders
      // database while an event slides along the bus.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          <Title w={28} cw={48} />
          {[VIOLET, SKY, GREEN, AMBER].map((hue, i) => (
            <Lane key={hue.fill} y={8 + i * 10.5} h={9} hue={hue} />
          ))}
          <g fill="none" stroke={LINE} strokeWidth="0.5">
            <path d="M22 15 V20.5 M38 15 V20.5 M54 15 V23 H44 M28 23 H32" />
            <path d="M36 25.5 V28 H22 V31 M38 25.5 V31" />
            <path d="M22 36 V40.2 M38 36 V40.2 M70 36 V40.2" />
            <path
              d="M44 33.5 H48 M60 33.5 H64 M70 31 V25.5 M70 20.5 V15 M54 36 V40.2"
              strokeDasharray="1 0.7"
            />
          </g>
          {[22, 38, 54, 70].map((cx) => (
            <Step key={`c${cx}`} cx={cx} cy={12.5} w={12} h={5} hue={VIOLET} />
          ))}
          <Step cx={22} cy={23} w={12} h={5} hue={SKY} />
          <rect
            x="32"
            y="20.5"
            width="12"
            height="5"
            rx="0.7"
            fill={BOLD}
            stroke="rgb(7 89 133)"
            strokeWidth="0.7"
          />
          <Bar x={34.5} y={22.6} w={7} h={0.8} fill={WHITE} />
          <Step cx={70} cy={23} w={12} h={5} hue={SKY} />
          <Step cx={22} cy={33.5} w={12} h={5} hue={GREEN} />
          <Step cx={38} cy={33.5} w={12} h={5} hue={GREEN} />
          <rect
            x="48"
            y="31"
            width="12"
            height="5"
            rx="0.7"
            fill={GREEN.strip}
            stroke={GREEN.fill}
            strokeWidth="0.55"
          />
          <Bar x={50.5} y={33.1} w={7} h={0.8} fill={GREEN.ink} />
          <Step cx={70} cy={33.5} w={12} h={5} hue={GREEN} />
          {[22, 38, 54, 70].map((cx) => (
            <Cylinder key={`d${cx}`} cx={cx} cy={44} hue={AMBER} />
          ))}
          <circle
            className="pv-travel"
            opacity="0"
            cx="38"
            cy="16.5"
            r="1.1"
            fill={BOLD}
            style={pv({ '--pv-dy': '23px', '--pv-at': '1100ms', '--pv-dur': '1800ms' })}
          />
          <circle
            className="pv-travel"
            opacity="0"
            cx="45"
            cy="33.5"
            r="0.9"
            fill={GREEN.fill}
            style={pv({ '--pv-dx': '17px', '--pv-at': '1700ms', '--pv-dur': '1500ms' })}
          />
          <Pop
            at={2600}
            x={32}
            y={20.5}
            width={12}
            height={5}
            rx={0.7}
            fill="none"
            stroke={SKY.fill}
            strokeWidth={0.8}
          />
        </svg>
      );
    default:
      return null;
  }
}
