import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from '@liveworkspace/template-previews/motion';
import { Pop, PopDot } from '@liveworkspace/template-previews/story-parts';

// Group 26: the use-case batch (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the Eisenhower Matrix,
// PESTLE Analysis, KWL Chart, 30-60-90 Day Plan, Concept Map and Network Diagram, each drawn small as it opens,
// with a hover story of what the template is for. Static SVG preview tiles, one branch per TemplateKind;
// TemplatePreview chains the groups with ??. Pure drawing: no builder or data import, so the landing page's bundle
// never carries a builder.

const MUTED = 'rgb(148 163 184)';
const INK = 'rgb(15 23 42)';
const PAPER = 'white';

// The retro kit's hues as the builders use them: a pale panel, its border, its deep header and its sticky.
const HUE = {
  rose: ['rgb(255 228 230)', 'rgb(253 164 175)', 'rgb(190 18 60)', 'rgb(254 205 211)'],
  blue: ['rgb(219 234 254)', 'rgb(147 197 253)', 'rgb(29 78 216)', 'rgb(191 219 254)'],
  amber: ['rgb(254 243 199)', 'rgb(252 211 77)', 'rgb(180 83 9)', 'rgb(253 230 138)'],
  slate: ['rgb(226 232 240)', 'rgb(148 163 184)', 'rgb(51 65 85)', 'rgb(203 213 225)'],
  violet: ['rgb(237 233 254)', 'rgb(196 181 253)', 'rgb(109 40 217)', 'rgb(233 213 255)'],
  sky: ['rgb(224 242 254)', 'rgb(125 211 252)', 'rgb(3 105 161)', 'rgb(186 230 253)'],
  green: ['rgb(220 252 231)', 'rgb(134 239 172)', 'rgb(21 128 61)', 'rgb(187 247 208)'],
} as const;
type Hue = keyof typeof HUE;

// A tinted panel with its header bar, as the board grid draws one.
const Panel = ({ x, y, w, h, hue }: { x: number; y: number; w: number; h: number; hue: Hue }) => {
  const [fill, stroke, ink] = HUE[hue];
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="1.4"
        fill={fill}
        stroke={stroke}
        strokeWidth="0.6"
      />
      <rect x={x + 1.6} y={y + 1.6} width={Math.min(10, w - 4)} height="1.6" rx="0.8" fill={ink} />
    </g>
  );
};

// A sticky in its panel's hue.
const Note = ({ x, y, w, h, hue }: { x: number; y: number; w: number; h: number; hue: Hue }) => (
  <rect x={x} y={y} width={w} height={h} rx="0.5" fill={HUE[hue][3]} />
);

// The neutral closing panel and its checklist rows: a box and a line each.
const Closing = ({ x, y, w, rows }: { x: number; y: number; w: number; rows: number }) => (
  <g>
    <rect
      x={x}
      y={y}
      width={w}
      height={3.4 + rows * 2.6}
      rx="1.4"
      fill="rgb(248 250 252)"
      stroke={MUTED}
      strokeWidth="0.9"
    />
    {Array.from({ length: rows }, (_, i) => (
      <g key={i}>
        <rect
          x={x + 2}
          y={y + 1.8 + i * 2.6}
          width="1.6"
          height="1.6"
          rx="0.3"
          fill={PAPER}
          stroke="rgb(14 165 233)"
          strokeWidth="0.35"
        />
        <rect
          x={x + 4.6}
          y={y + 2.2 + i * 2.6}
          width={w * 0.35}
          height="0.8"
          rx="0.4"
          fill={MUTED}
        />
      </g>
    ))}
  </g>
);

// A tick that lands in a closing row's box.
const Tick = ({ x, y, at }: { x: number; y: number; at: number }) => (
  <Pop at={at} x={x} y={y} width="1.6" height="1.6" rx="0.3" fill="rgb(14 165 233)" />
);

// The session rail: the question card over a timer and a vote, then the steps.
const Rail = ({ x, y }: { x: number; y: number }) => (
  <g>
    <rect x={x} y={y} width="11" height="8" rx="1" fill={PAPER} stroke={MUTED} strokeWidth="0.5" />
    <rect x={x + 2} y={y + 3.2} width="7" height="1" rx="0.5" fill={INK} />
    <rect
      x={x}
      y={y + 9.5}
      width="5.2"
      height="4.5"
      rx="1.2"
      fill={PAPER}
      stroke={MUTED}
      strokeWidth="0.4"
    />
    <rect
      x={x + 5.8}
      y={y + 9.5}
      width="5.2"
      height="4.5"
      rx="1.2"
      fill={PAPER}
      stroke={MUTED}
      strokeWidth="0.4"
    />
    {[0, 1, 2].map((i) => (
      <rect key={i} x={x} y={y + 16 + i * 2.2} width={9 - i} height="0.8" rx="0.4" fill={MUTED} />
    ))}
  </g>
);

export function templatePreviewGroup26(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'eisenhower-matrix': {
      // Urgent / Not urgent over the columns, Important / Not important down the rows, the four boxes (Do First
      // rose, Schedule blue, Delegate amber, Drop slate) with their notes, and Today's three beneath. Hover story: a
      // new task lands in Delegate, a dropped one fades from Drop, and today's three are ticked off in turn.
      const quads: { x: number; y: number; hue: Hue }[] = [
        { x: 9, y: 4, hue: 'rose' },
        { x: 43.5, y: 4, hue: 'blue' },
        { x: 9, y: 19.5, hue: 'amber' },
        { x: 43.5, y: 19.5, hue: 'slate' },
      ];
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[9, 43.5].map((x) => (
            <rect key={x} x={x + 11} y="1" width="11" height="1.3" rx="0.65" fill={MUTED} />
          ))}
          {[4, 19.5].map((y) => (
            <rect key={y} x="5" y={y + 3.5} width="1.3" height="7" rx="0.65" fill={MUTED} />
          ))}
          {quads.map((q) => (
            <g key={`${q.x}-${q.y}`}>
              <Panel x={q.x} y={q.y} w={33} h={14} hue={q.hue} />
              {[0, 1].map((r) =>
                [0, 1].map((c) =>
                  // Delegate keeps a slot for the task that lands; Drop's last note is the one that fades.
                  r === 1 && c === 1 && (q.hue === 'amber' || q.hue === 'slate') ? null : (
                    <Note
                      key={`${r}-${c}`}
                      x={q.x + 2 + c * 15}
                      y={q.y + 4.6 + r * 4.6}
                      w={14}
                      h={3.8}
                      hue={q.hue}
                    />
                  ),
                ),
              )}
            </g>
          ))}
          {/* The task that is handed off: it starts on the line between the boxes and lands in Delegate. */}
          <rect
            className="pv-shift"
            x="33"
            y="16.2"
            width="14"
            height="3.8"
            rx="0.5"
            fill="rgb(253 230 138)"
            stroke="rgb(180 83 9)"
            strokeWidth="0.5"
            style={pv({
              '--pv-dx': '-7px',
              '--pv-dy': '12.5px',
              '--pv-at': '900ms',
              '--pv-dur': '700ms',
            })}
          />
          <rect
            className="pv-leave"
            x="60.5"
            y="28.7"
            width="14"
            height="3.8"
            rx="0.5"
            fill={HUE.slate[3]}
            style={pv({ '--pv-at': '1500ms' })}
          />
          <Closing x={9} y={36} w={68} rows={3} />
          {[0, 1, 2].map((i) => (
            <Tick key={i} x={11} y={37.8 + i * 2.6} at={1900 + i * 300} />
          ))}
        </svg>
      );
    }
    case 'pestle-analysis': {
      // The rail (the question, timer and vote, the steps), the six lenses in a 3 x 2 grid, each a tinted panel
      // with three notes, and Into the SWOT beneath. Hover story: the room spends its dots on three notes, then the
      // three winners are carried into the SWOT list.
      const lenses: Hue[] = ['violet', 'blue', 'rose', 'sky', 'amber', 'green'];
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Rail x={3} y={3} />
          {lenses.map((hue, i) => {
            const x = 17 + (i % 3) * 20.5;
            const y = 3 + Math.floor(i / 3) * 16.5;
            return (
              <g key={hue}>
                <Panel x={x} y={y} w={19.5} h={15.5} hue={hue} />
                {[0, 1, 2].map((n) => (
                  <Note key={n} x={x + 1.6} y={y + 4.4 + n * 3.6} w={16.3} h={3} hue={hue} />
                ))}
              </g>
            );
          })}
          {[
            [33.6, 7.4],
            [67.6, 24.0],
            [44.6, 27.6],
          ].map(([x, y], i) => (
            <PopDot key={i} at={900 + i * 250} cx={x} cy={y! + 1.5} r="1.1" fill={INK} />
          ))}
          <Closing x={17} y={37} w={60.5} rows={3} />
          {[0, 1, 2].map((i) => (
            <Pop
              key={i}
              at={1800 + i * 250}
              x={21.6}
              y={39.2 + i * 2.6}
              width="16"
              height="0.8"
              rx="0.4"
              fill="rgb(3 105 161)"
            />
          ))}
        </svg>
      );
    }
    case 'kwl-chart': {
      // The rail, then Know (sky), Want to Know (violet) and Learned (green), four notes down each of the first
      // two. Hover story: at the end of the topic the Learned notes arrive one by one, each answering a question.
      const cols: Hue[] = ['sky', 'violet', 'green'];
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Rail x={3} y={4} />
          {cols.map((hue, i) => {
            const x = 17 + i * 20.5;
            return (
              <g key={hue}>
                <Panel x={x} y={4} w={19.5} h={42} hue={hue} />
                {[0, 1, 2, 3].map((n) =>
                  hue === 'green' ? (
                    <Pop
                      key={n}
                      at={900 + n * 300}
                      x={x + 1.6}
                      y={9 + n * 9}
                      width="16.3"
                      height="7.6"
                      rx="0.5"
                      fill={HUE.green[3]}
                    />
                  ) : (
                    <Note key={n} x={x + 1.6} y={9 + n * 9} w={16.3} h={7.6} hue={hue} />
                  ),
                )}
              </g>
            );
          })}
          {[0, 1, 2, 3].map((n) => (
            <PopDot
              key={n}
              at={1100 + n * 300}
              cx={54.2}
              cy={10.6 + n * 9}
              r="0.9"
              fill="rgb(21 128 61)"
            />
          ))}
        </svg>
      );
    }
    case 'onboarding-plan': {
      // Learn (sky), Contribute (violet) and Lead (green), four goals down each, and the Check-ins beneath. Hover
      // story: the You Are Here marker moves on from Learn to Contribute, and the next check-ins are ticked.
      const stages: Hue[] = ['sky', 'violet', 'green'];
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {stages.map((hue, i) => {
            const x = 4 + i * 24.5;
            return (
              <g key={hue}>
                <Panel x={x} y={3} w={23.5} h={31} hue={hue} />
                {[0, 1, 2, 3].map((n) => (
                  <Note key={n} x={x + 1.6} y={7.4 + n * 6.4} w={20.3} h={5.4} hue={hue} />
                ))}
              </g>
            );
          })}
          <rect
            className="pv-shift"
            x="20"
            y="2"
            width="5"
            height="2"
            rx="1"
            fill="rgb(225 29 72)"
            style={pv({ '--pv-dx': '24.5px', '--pv-at': '900ms', '--pv-dur': '800ms' })}
          />
          <Closing x={4} y={35.5} w={72.5} rows={4} />
          <rect x="6" y="37.3" width="1.6" height="1.6" rx="0.3" fill="rgb(14 165 233)" />
          {[1, 2].map((i) => (
            <Tick key={i} x={6} y={37.3 + i * 2.6} at={1500 + i * 300} />
          ))}
        </svg>
      );
    }
    case 'concept-map': {
      // The focus question over Plants and Photosynthesis (solid green), what it needs (blue) and produces (amber),
      // then the parts and uses below, each link with its words and a dashed cross-link between two of them. Hover
      // story: the reader adds Stomata under Leaves and links it with a dashed cross-link.
      const box = (x: number, y: number, fill: string, stroke: string, w = 12) => (
        <rect
          x={x}
          y={y}
          width={w}
          height="4"
          rx="1"
          fill={fill}
          stroke={stroke}
          strokeWidth="0.5"
        />
      );
      const need = ['rgb(224 242 254)', 'rgb(56 189 248)'] as const;
      const made = ['rgb(254 243 199)', 'rgb(245 158 11)'] as const;
      const row2 = [
        [3, need],
        [17, need],
        [31, need],
        [48, made],
        [63, made],
      ] as const;
      const violet = 'rgb(139 92 246)';
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="3"
            y="1.5"
            width="72"
            height="3.6"
            rx="1"
            fill="rgb(240 253 244)"
            stroke="rgb(134 239 172)"
            strokeWidth="0.4"
          />
          <rect x="27" y="2.8" width="24" height="1" rx="0.5" fill="rgb(20 83 45)" />
          {box(32, 7, 'rgb(21 128 61)', 'rgb(20 83 45)', 14)}
          {box(31, 14, 'rgb(21 128 61)', 'rgb(20 83 45)', 16)}
          <path
            d="M39 11 L39 14 M39 18 L9 24 M39 18 L23 24 M39 18 L37 24 M39 18 L54 24 M39 18 L69 24 M9 28 L9 33 M23 28 L23 33 M37 28 L37 33 M54 28 L54 33 M69 28 L69 33"
            stroke="rgb(71 85 105)"
            strokeWidth="0.45"
            fill="none"
          />
          {[
            [19, 20.4],
            [29.5, 20.6],
            [46, 20.4],
            [57, 20.4],
          ].map(([x, y]) => (
            <rect key={x} x={x} y={y} width="5" height="0.9" rx="0.45" fill={MUTED} />
          ))}
          {row2.map(([x, [fill, stroke]]) => (
            <g key={x}>{box(x, 24, fill, stroke)}</g>
          ))}
          {[3, 17, 31, 48, 63].map((x) => (
            <g key={x}>{box(x, 33, PAPER, MUTED)}</g>
          ))}
          <path
            d="M29 35 L31 35"
            stroke={violet}
            strokeWidth="0.5"
            strokeDasharray="0.8 0.6"
            fill="none"
          />
          {/* The reader's own concept and its cross-link, added by the story. */}
          <path
            className="pv-new"
            opacity="0"
            d="M23 37 L23 42"
            stroke={violet}
            strokeWidth="0.5"
            strokeDasharray="0.8 0.6"
            fill="none"
            style={pv({ '--pv-at': '1300ms' })}
          />
          <Pop
            at={900}
            x={17}
            y={42}
            width="12"
            height="4"
            rx="1"
            fill={PAPER}
            stroke={violet}
            strokeWidth="0.5"
          />
          <Pop at={1500} x={24.5} y={39} width="5" height="0.9" rx="0.45" fill={violet} />
        </svg>
      );
    }
    case 'network-diagram': {
      // Four tier lanes (Internet, Edge, Core, Access), a card per device, the red firewall, the core switch fanning
      // out to three VLAN boundaries, the dotted VPN from remote staff, and the key and IP plan beneath. Hover story:
      // a packet comes in from the internet through the router and the firewall to the core and on to the guest
      // Wi-Fi, whose waves pulse.
      const lanes = [
        {
          y: 2,
          h: 8,
          fill: 'rgb(248 250 252)',
          head: 'rgb(241 245 249)',
          line: 'rgb(203 213 225)',
        },
        {
          y: 11.5,
          h: 8,
          fill: 'rgb(255 241 242)',
          head: 'rgb(255 228 230)',
          line: 'rgb(254 205 211)',
        },
        {
          y: 21,
          h: 8,
          fill: 'rgb(239 246 255)',
          head: 'rgb(219 234 254)',
          line: 'rgb(191 219 254)',
        },
        {
          y: 30.5,
          h: 11,
          fill: 'rgb(240 253 244)',
          head: 'rgb(220 252 231)',
          line: 'rgb(187 247 208)',
        },
      ];
      const card = (x: number, y: number, edge: string, fill = PAPER, w = 10) => (
        <g>
          <rect
            x={x}
            y={y}
            width={w}
            height="4.4"
            rx="0.8"
            fill={fill}
            stroke={edge}
            strokeWidth="0.45"
          />
          <rect x={x + 1} y={y + 1.4} width="1.6" height="1.6" rx="0.3" fill="rgb(226 232 240)" />
        </g>
      );
      const vlans = [
        { x: 12.5, stroke: 'rgb(22 163 74)' },
        { x: 34.5, stroke: 'rgb(8 145 178)' },
        { x: 56.5, stroke: 'rgb(124 58 237)' },
      ];
      const packet = (cx: number, cy: number, move: { dx?: number; dy?: number }, at: number) => (
        <circle
          className="pv-travel"
          opacity="0"
          cx={cx}
          cy={cy}
          r="0.9"
          fill="rgb(225 29 72)"
          style={pv({
            '--pv-dx': `${move.dx ?? 0}px`,
            '--pv-dy': `${move.dy ?? 0}px`,
            '--pv-at': `${at}ms`,
            '--pv-dur': '1600ms',
          })}
        />
      );
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {lanes.map((l) => (
            <g key={l.y}>
              <rect
                x="2"
                y={l.y}
                width="76"
                height={l.h}
                rx="0.8"
                fill={l.fill}
                stroke={l.line}
                strokeWidth="0.4"
              />
              <rect x="2" y={l.y} width="9" height={l.h} rx="0.8" fill={l.head} />
            </g>
          ))}
          <path
            d="M33 8.4 L33 13.6 M38 15.8 L42 15.8 M47 18 L47 23 M42 25.2 L28 25.2 M52 25.2 L62 25.2 M47 27.4 L47 29 M47 29 L23 29 L23 31.5 M45 29 L45 31.5 M47 29 L67 29 L67 31.5 M28 6.2 L24 6.2"
            stroke="rgb(71 85 105)"
            strokeWidth="0.45"
            fill="none"
          />
          <path
            d="M69 8.4 L69 15.8 L52 15.8"
            stroke="rgb(71 85 105)"
            strokeWidth="0.45"
            strokeDasharray="0.4 0.7"
            fill="none"
          />
          {vlans.map((v) => (
            <rect
              key={v.x}
              x={v.x}
              y="31.5"
              width="21"
              height="9.4"
              rx="0.8"
              fill="none"
              stroke={v.stroke}
              strokeWidth="0.45"
              strokeDasharray="1 0.6"
            />
          ))}
          {card(14, 4, 'rgb(100 116 139)')}
          {card(28, 4, 'rgb(100 116 139)')}
          {card(64, 4, 'rgb(100 116 139)')}
          {card(28, 13.6, 'rgb(244 63 94)')}
          {card(42, 13.6, 'rgb(159 18 57)', 'rgb(225 29 72)')}
          {card(18, 23, 'rgb(59 130 246)')}
          {card(42, 23, 'rgb(59 130 246)')}
          {card(62, 23, 'rgb(59 130 246)')}
          {[13.6, 23.4, 35.6, 45.4, 57.6, 67.4].map((x) => (
            <g key={x}>{card(x, 35, 'rgb(34 197 94)', PAPER, 9)}</g>
          ))}
          <path
            className="pv-pulse"
            d="M38.4 34.2 Q40 32.9 41.6 34.2"
            stroke="rgb(8 145 178)"
            strokeWidth="0.45"
            fill="none"
            style={pv({ '--pv-at': '2300ms' })}
          />
          <rect
            x="2"
            y="43.5"
            width="18"
            height="5"
            rx="0.8"
            fill="rgb(240 249 255)"
            stroke="rgb(56 189 248)"
            strokeWidth="0.4"
          />
          <rect
            x="22"
            y="43.5"
            width="56"
            height="5"
            rx="0.4"
            fill={PAPER}
            stroke={MUTED}
            strokeWidth="0.4"
          />
          <rect x="22" y="43.5" width="56" height="1.6" fill="rgb(226 232 240)" />
          {/* The packet, hop by hop: internet to router, router to firewall, firewall to core, core to Wi-Fi. */}
          {packet(33, 9, { dy: 4.2 }, 900)}
          {packet(38.5, 15.8, { dx: 3.2 }, 1250)}
          {packet(47, 18.6, { dy: 4 }, 1600)}
          {packet(45, 29.4, { dy: 5 }, 1950)}
        </svg>
      );
    }
    default:
      return null;
  }
}
