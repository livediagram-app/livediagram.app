import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { pv } from '@liveworkspace/template-previews/motion';
import { Pop } from '@liveworkspace/template-previews/story-parts';

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

export function templatePreviewGroup18(kind: TemplateKind): ReactElement | null {
  switch (kind) {
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
