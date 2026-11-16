import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from '@liveworkspace/template-previews/motion';
import { Pop, PopDot } from '@liveworkspace/template-previews/story-parts';

// Group 27: the Work Tracker 1075 batch (docs/specs/008-canvas/canvas-and-palette.md "Templates"): C4 System
// Context, C4 Container Diagram, Architecture Decision Record, Sprint Planning and Interview Synthesis, each drawn
// small as it opens, with a hover story of what the template is for. Static SVG preview tiles, one branch per
// TemplateKind; TemplatePreview chains the groups with ??. Pure drawing: no builder or data import.

const MUTED = 'rgb(148 163 184)';
const INK = 'rgb(15 23 42)';
const PAPER = 'white';
const LINE = 'rgb(100 116 139)';

// The C4 palette as the builders use it: a person, the system in focus, an external system, a store.
const C4 = {
  person: ['rgb(8 66 123)', 'rgb(5 45 86)'],
  system: ['rgb(17 104 189)', 'rgb(11 77 145)'],
  external: ['rgb(139 148 158)', 'rgb(107 114 128)'],
  store: ['rgb(56 140 220)', 'rgb(17 104 189)'],
} as const;

// The retro kit's hues: a pale panel, its border, its deep header and its sticky.
const HUE = {
  sky: ['rgb(224 242 254)', 'rgb(125 211 252)', 'rgb(3 105 161)', 'rgb(186 230 253)'],
  amber: ['rgb(254 243 199)', 'rgb(252 211 77)', 'rgb(180 83 9)', 'rgb(253 230 138)'],
  green: ['rgb(220 252 231)', 'rgb(134 239 172)', 'rgb(21 128 61)', 'rgb(187 247 208)'],
  rose: ['rgb(255 228 230)', 'rgb(253 164 175)', 'rgb(190 18 60)', 'rgb(254 205 211)'],
  violet: ['rgb(237 233 254)', 'rgb(196 181 253)', 'rgb(109 40 217)', 'rgb(233 213 255)'],
  slate: ['rgb(241 245 249)', 'rgb(148 163 184)', 'rgb(51 65 85)', 'rgb(226 232 240)'],
} as const;
type Hue = keyof typeof HUE;

// The technical kit's header: a dark bar with a title line.
const Header = ({ w = 76 }: { w?: number }) => (
  <g>
    <rect x="2" y="2" width={w} height="5" rx="1" fill="rgb(15 23 42)" />
    <rect x="4" y="3.9" width="20" height="1.2" rx="0.6" fill={PAPER} />
  </g>
);

// A C4 element card: a filled box with a name bar and a type line under it.
const C4Card = ({
  x,
  y,
  w,
  h,
  tone,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: keyof typeof C4;
}) => (
  <g>
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx="1"
      fill={C4[tone][0]}
      stroke={C4[tone][1]}
      strokeWidth="0.4"
    />
    <rect
      x={x + w / 2 - w * 0.3}
      y={y + h / 2 - 1.3}
      width={w * 0.6}
      height="1.1"
      rx="0.55"
      fill={PAPER}
    />
    <rect
      x={x + w / 2 - w * 0.2}
      y={y + h / 2 + 0.6}
      width={w * 0.4}
      height="0.8"
      rx="0.4"
      fill={PAPER}
      opacity="0.7"
    />
  </g>
);

// A C4 person: a head over a rounded body.
const Person = ({ x, y }: { x: number; y: number }) => (
  <g>
    <circle cx={x + 4} cy={y + 1.8} r="1.8" fill={C4.person[0]} />
    <rect x={x} y={y + 3.4} width="8" height="4.6" rx="1.6" fill={C4.person[0]} />
  </g>
);

// A tinted retro panel with its header bar, and a sticky in a hue.
const Panel = ({ x, y, w, h, hue }: { x: number; y: number; w: number; h: number; hue: Hue }) => (
  <g>
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx="1.2"
      fill={HUE[hue][0]}
      stroke={HUE[hue][1]}
      strokeWidth="0.5"
    />
    <rect
      x={x + 1.5}
      y={y + 1.5}
      width={Math.min(9, w - 3)}
      height="1.4"
      rx="0.7"
      fill={HUE[hue][2]}
    />
  </g>
);
const Note = ({ x, y, w, h, hue }: { x: number; y: number; w: number; h: number; hue: Hue }) => (
  <rect x={x} y={y} width={w} height={h} rx="0.4" fill={HUE[hue][3]} />
);

// A session button (the Timer or the Vote): a white tile with a coloured mark.
const SessionButton = ({ x, y, mark }: { x: number; y: number; mark: string }) => (
  <g>
    <rect x={x} y={y} width="6" height="4" rx="0.8" fill={PAPER} stroke={MUTED} strokeWidth="0.4" />
    <circle cx={x + 3} cy={y + 2} r="1.1" fill={mark} />
  </g>
);

// A dot that travels from (x, y) by (dx, dy), hidden at rest.
const Travel = ({
  x,
  y,
  dx,
  dy,
  at,
  fill = 'rgb(225 29 72)',
}: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  at: number;
  fill?: string;
}) => (
  <circle
    className="pv-travel"
    opacity="0"
    cx={x}
    cy={y}
    r="0.9"
    fill={fill}
    style={pv({
      '--pv-dx': `${dx}px`,
      '--pv-dy': `${dy}px`,
      '--pv-at': `${at}ms`,
      '--pv-dur': '1200ms',
    })}
  />
);

export function templatePreviewGroup27(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'c4-context': {
      // Two people over the system in focus (blue), three grey external systems under it, each link a line, and
      // the key's swatches at the foot. Hover story: an order travels from a customer into the system and out to
      // the payments provider.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Header />
          <Person x={14} y={10} />
          <Person x={58} y={10} />
          <path
            d="M18 18 L30 23 M62 18 L50 23 M40 31 L14 37 M40 31 L40 37 M40 31 L66 37"
            stroke={LINE}
            strokeWidth="0.45"
            fill="none"
          />
          <C4Card x={24} y={22} w={32} h={9} tone="system" />
          <C4Card x={4} y={37} w={20} h={7} tone="external" />
          <C4Card x={30} y={37} w={20} h={7} tone="external" />
          <C4Card x={56} y={37} w={20} h={7} tone="external" />
          {(['person', 'system', 'external'] as const).map((t, i) => (
            <rect key={t} x={4 + i * 6} y="46" width="4" height="2" rx="0.4" fill={C4[t][0]} />
          ))}
          <Travel x={18} y={18} dx={12} dy={5} at={300} />
          <Travel x={40} y={31} dx={-26} dy={6} at={1500} />
          <Pop
            at={2500}
            x={2.5}
            y={35.5}
            width="23"
            height="10"
            rx="1.4"
            fill="none"
            stroke="rgb(225 29 72)"
            strokeWidth="0.5"
          />
        </svg>
      );
    }
    case 'c4-container': {
      // A person outside the dashed system boundary; inside it the web app, the mobile app and the API over two
      // services and their stores; a grey external system outside. Hover story: an order runs from the app through
      // the API to the orders service and its store, the dots moving along each line.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Header />
          <Person x={4} y={12} />
          <rect
            x="16"
            y="9"
            width="50"
            height="38"
            rx="1.4"
            fill="none"
            stroke={LINE}
            strokeWidth="0.5"
            strokeDasharray="1.4 0.8"
          />
          <rect x="18" y="10.6" width="14" height="1" rx="0.5" fill={LINE} />
          <C4Card x={19} y={14} w={13} h={7} tone="system" />
          <C4Card x={35} y={14} w={13} h={7} tone="system" />
          <C4Card x={27} y={25} w={14} h={7} tone="system" />
          <C4Card x={19} y={37} w={13} h={7} tone="store" />
          <C4Card x={45} y={37} w={13} h={7} tone="store" />
          <C4Card x={69} y={25} w={9} h={7} tone="external" />
          <path
            d="M12 16 L19 17.5 M25.5 21 L31 25 M41.5 21 L37 25 M34 32 L25.5 37 M34 32 L51.5 37 M41 28.5 L69 28.5"
            stroke={LINE}
            strokeWidth="0.45"
            fill="none"
          />
          <Travel x={12} y={16} dx={7} dy={1.5} at={200} fill="rgb(37 99 235)" />
          <Travel x={25.5} y={21} dx={5.5} dy={4} at={900} fill="rgb(37 99 235)" />
          <Travel x={34} y={32} dx={-8.5} dy={5} at={1600} fill="rgb(37 99 235)" />
          <Travel x={41} y={28.5} dx={28} dy={0} at={2300} fill="rgb(37 99 235)" />
        </svg>
      );
    }
    case 'architecture-decision-record': {
      // The record's header with its status chip, the Context and Drivers panels, the options table with the chosen
      // row tinted, the decision card, and the consequences on stickies with the follow-ups list. Hover story: the
      // chosen row lights, the Accepted chip lands and the first follow-ups tick off.
      const rows = [0, 1, 2];
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Header />
          <rect
            x="4"
            y="10"
            width="22"
            height="9"
            rx="1"
            fill="rgb(248 250 252)"
            stroke={MUTED}
            strokeWidth="0.4"
          />
          <rect
            x="4"
            y="21"
            width="22"
            height="9"
            rx="1"
            fill="rgb(248 250 252)"
            stroke={MUTED}
            strokeWidth="0.4"
          />
          {[12, 14.5, 23, 25.5].map((y) => (
            <rect key={y} x="6" y={y} width="16" height="0.9" rx="0.45" fill={MUTED} />
          ))}
          <rect
            x="29"
            y="10"
            width="26"
            height="20"
            rx="0.8"
            fill={PAPER}
            stroke={MUTED}
            strokeWidth="0.4"
          />
          <rect x="29" y="10" width="26" height="4" rx="0.8" fill="rgb(226 232 240)" />
          {rows.map((r) => (
            <g key={r}>
              <rect
                x="29"
                y={15 + r * 5}
                width="26"
                height="4.6"
                fill={r === 1 ? 'rgb(220 252 231)' : PAPER}
                stroke="rgb(226 232 240)"
                strokeWidth="0.3"
              />
              <rect
                x="31"
                y={16.8 + r * 5}
                width="12"
                height="0.9"
                rx="0.45"
                fill={r === 1 ? 'rgb(21 128 61)' : MUTED}
              />
            </g>
          ))}
          <rect
            x="58"
            y="10"
            width="18"
            height="20"
            rx="1"
            fill="rgb(240 253 244)"
            stroke="rgb(22 163 74)"
            strokeWidth="0.6"
          />
          <rect x="60" y="13" width="12" height="1.2" rx="0.6" fill="rgb(20 83 45)" />
          <rect x="60" y="16" width="14" height="0.9" rx="0.45" fill="rgb(74 222 128)" />
          <rect x="60" y="18.4" width="10" height="0.9" rx="0.45" fill="rgb(74 222 128)" />
          <Note x={4} y={34} w={14} h={11} hue="green" />
          <Note x={20} y={34} w={14} h={11} hue="amber" />
          <Note x={36} y={34} w={14} h={11} hue="rose" />
          <rect
            x="54"
            y="34"
            width="22"
            height="11"
            rx="1"
            fill={PAPER}
            stroke={MUTED}
            strokeWidth="0.4"
          />
          {[36, 39, 42].map((y) => (
            <g key={y}>
              <rect
                x="56"
                y={y}
                width="1.6"
                height="1.6"
                rx="0.3"
                fill={PAPER}
                stroke="rgb(14 165 233)"
                strokeWidth="0.35"
              />
              <rect x="59" y={y + 0.4} width="14" height="0.9" rx="0.45" fill={MUTED} />
            </g>
          ))}
          <Pop
            at={300}
            x={29}
            y={20}
            width="26"
            height="4.6"
            fill="none"
            stroke="rgb(22 163 74)"
            strokeWidth="0.6"
          />
          <Pop at={1000} x={60} y={2.8} width="14" height="3.4" rx="1.7" fill="rgb(22 163 74)" />
          <Pop at={1800} x={56} y={36} width="1.6" height="1.6" rx="0.3" fill="rgb(14 165 233)" />
          <Pop at={2300} x={56} y={39} width="1.6" height="1.6" rx="0.3" fill="rgb(14 165 233)" />
        </svg>
      );
    }
    case 'sprint-planning': {
      // The rail (goal panel, the three capacity figures, the mood check and the Timer and Vote) beside the Ready,
      // Committed and Stretch columns and the risks and done list. Hover story: a story moves from Ready into
      // Committed and the capacity bar fills.
      const col = (x: number, hue: Hue, notes: number) => (
        <g>
          <Panel x={x} y={9} w={15} h={38} hue={hue} />
          {Array.from({ length: notes }, (_, i) => (
            <Note key={i} x={x + 1.5} y={13 + i * 7} w={12} h={6} hue={hue} />
          ))}
        </g>
      );
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect x="2" y="2" width="30" height="2" rx="1" fill={INK} />
          <rect x="2" y="5.4" width="44" height="1" rx="0.5" fill={MUTED} />
          <rect
            x="2"
            y="9"
            width="14"
            height="10"
            rx="1"
            fill="rgb(248 250 252)"
            stroke={MUTED}
            strokeWidth="0.4"
          />
          <rect x="3.5" y="11" width="10" height="1.2" rx="0.6" fill={INK} />
          <rect x="3.5" y="13.6" width="8" height="0.9" rx="0.45" fill={MUTED} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect
                x={2 + i * 5}
                y="21"
                width="4"
                height="5"
                rx="0.6"
                fill={PAPER}
                stroke={MUTED}
                strokeWidth="0.35"
              />
              <rect x={2.8 + i * 5} y="22.4" width="2.4" height="1.4" rx="0.3" fill={INK} />
            </g>
          ))}
          <rect x="2" y="28" width="14" height="5" rx="1" fill="rgb(254 249 195)" />
          <SessionButton x={2} y={35} mark="rgb(14 165 233)" />
          <SessionButton x={10} y={35} mark="rgb(225 29 72)" />
          {col(18, 'slate', 5)}
          {col(35, 'sky', 3)}
          {col(52, 'violet', 2)}
          <rect
            x="69"
            y="9"
            width="9"
            height="38"
            rx="1.2"
            fill="rgb(248 250 252)"
            stroke={MUTED}
            strokeWidth="0.5"
          />
          {[14, 18, 22, 26].map((y) => (
            <rect key={y} x="70.5" y={y} width="6" height="0.9" rx="0.45" fill={MUTED} />
          ))}
          <rect x="2" y="45" width="14" height="1.6" rx="0.8" fill="rgb(226 232 240)" />
          <rect
            className="pv-grow-x"
            opacity="0"
            x="2"
            y="45"
            width="10"
            height="1.6"
            rx="0.8"
            fill="rgb(14 165 233)"
            style={pv({ '--pv-at': '1500ms' })}
          />
          <g
            className="pv-travel"
            opacity="0"
            style={pv({
              '--pv-dx': '17px',
              '--pv-dy': '-14px',
              '--pv-at': '400ms',
              '--pv-dur': '1100ms',
            })}
          >
            <rect
              x="19.5"
              y="41"
              width="12"
              height="6"
              rx="0.4"
              fill="rgb(254 240 138)"
              stroke="rgb(202 138 4)"
              strokeWidth="0.35"
            />
          </g>
        </svg>
      );
    }
    case 'interview-synthesis': {
      // The rail (research question, five participants each in their own colour, the Timer and Vote) beside three
      // theme columns: quotes tinted by who said them, a white insight box and a lime "How might we" sticky.
      // Hover story: three dots land on the question the team chases first.
      const people: Hue[] = ['amber', 'sky', 'green', 'rose', 'violet'];
      const themes: { hue: Hue; quotes: Hue[] }[] = [
        { hue: 'sky', quotes: ['sky', 'green', 'violet'] },
        { hue: 'amber', quotes: ['amber', 'rose', 'violet'] },
        { hue: 'green', quotes: ['sky', 'rose', 'amber'] },
      ];
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect x="2" y="2" width="34" height="2" rx="1" fill={INK} />
          <rect x="2" y="5.4" width="50" height="1" rx="0.5" fill={MUTED} />
          <rect
            x="2"
            y="9"
            width="15"
            height="7"
            rx="1"
            fill="rgb(248 250 252)"
            stroke={MUTED}
            strokeWidth="0.4"
          />
          <rect x="3.5" y="11.4" width="11" height="1.1" rx="0.55" fill={INK} />
          {people.map((h, i) => (
            <g key={h}>
              <rect
                x="2"
                y={18 + i * 4}
                width="15"
                height="3.4"
                rx="0.6"
                fill={HUE[h][3]}
                stroke={HUE[h][2]}
                strokeWidth="0.3"
              />
              <circle cx="3.9" cy={19.7 + i * 4} r="1.1" fill={HUE[h][2]} />
              <rect
                x="5.8"
                y={19.2 + i * 4}
                width="8"
                height="0.9"
                rx="0.45"
                fill={INK}
                opacity="0.6"
              />
            </g>
          ))}
          <SessionButton x={2} y={39} mark="rgb(14 165 233)" />
          <SessionButton x={10} y={39} mark="rgb(225 29 72)" />
          {themes.map((t, i) => {
            const x = 19 + i * 20;
            return (
              <g key={t.hue}>
                <Panel x={x} y={9} w={19} h={39} hue={t.hue} />
                {t.quotes.map((q, j) => (
                  <Note key={j} x={x + 1.5} y={13 + j * 5.4} w={16} h={4.6} hue={q} />
                ))}
                <rect
                  x={x + 1.5}
                  y="30"
                  width="16"
                  height="7"
                  rx="0.6"
                  fill={PAPER}
                  stroke={HUE[t.hue][2]}
                  strokeWidth="0.6"
                />
                <rect x={x + 3} y="32.8" width="12" height="1" rx="0.5" fill={INK} />
                <rect x={x + 1.5} y="39" width="16" height="7" rx="0.4" fill="rgb(217 249 157)" />
              </g>
            );
          })}
          <PopDot at={600} cx={56} cy={44} r="1" fill="rgb(225 29 72)" />
          <PopDot at={1100} cx={59} cy={44} r="1" fill="rgb(225 29 72)" />
          <PopDot at={1600} cx={62} cy={44} r="1" fill="rgb(225 29 72)" />
          <PopDot at={2100} cx={22.5} cy={44} r="1" fill="rgb(225 29 72)" />
        </svg>
      );
    }
    default:
      return null;
  }
}
