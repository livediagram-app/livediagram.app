import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';

// Group 25: the strategy and systems batch (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the Wardley
// map, Threat model, Service blueprint, Metric tree, Value Proposition Canvas, Working Backwards, Family tree and
// Value stream map, each drawn small as it opens, with a hover story of what the template does.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const INK = 'rgb(15 23 42)';
const MUTED = 'rgb(148 163 184)';
const LINE = 'rgb(100 116 139)';
const RED = 'rgb(220 38 38)';
const AMBER = 'rgb(217 119 6)';
const GREEN = 'rgb(22 163 74)';
const PAPER = 'white';

// A component chip of the Wardley map: a white pill with an ink ring and a name bar.
const Chip = ({ x, y, w }: { x: number; y: number; w: number }) => (
  <g>
    <rect
      x={x}
      y={y}
      width={w}
      height="3.4"
      rx="1.7"
      fill={PAPER}
      stroke={INK}
      strokeWidth="0.35"
    />
    <rect x={x + 1.4} y={y + 1.3} width={w - 2.8} height="0.8" rx="0.4" fill={MUTED} />
  </g>
);

// A short bar standing for a line of text.
const Bar = ({
  x,
  y,
  w,
  fill = MUTED,
  h = 1,
}: {
  x: number;
  y: number;
  w: number;
  fill?: string;
  h?: number;
}) => <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} />;

export function templatePreviewGroup25(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'wardley-map':
      // Four stage bands split by dashed rules, the anchor at the top, components wired by plain lines, a red
      // dashed movement to a ghost, an inertia bar and the plays card beside. Hover story: the movement draws itself
      // and Delivery scheduling slides along it to where it is heading.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[
            [4, 9, 'rgb(245 243 255)'],
            [13, 12, 'rgb(239 246 255)'],
            [25, 16, 'rgb(240 253 244)'],
            [41, 17, 'rgb(248 250 252)'],
          ].map(([x, w, fill]) => (
            <rect
              key={String(x)}
              x={x as number}
              y="4"
              width={w as number}
              height="40"
              fill={fill as string}
            />
          ))}
          {[13, 25, 41].map((x) => (
            <line
              key={x}
              x1={x}
              y1="4"
              x2={x}
              y2="44"
              stroke={MUTED}
              strokeWidth="0.3"
              strokeDasharray="0.9 0.7"
            />
          ))}
          <path d="M4 44 L4 4 M4 44 L58 44" fill="none" stroke={LINE} strokeWidth="0.45" />
          <circle cx="32" cy="6.2" r="1.1" fill="none" stroke={INK} strokeWidth="0.4" />
          <path
            d="M32 7.3 L32 9 M30.8 8 L33.2 8 M32 9 L31 10.6 M32 9 L33 10.6"
            fill="none"
            stroke={INK}
            strokeWidth="0.4"
          />
          <path
            d="M32 12 L22 18 M33 12 L36 19 M22 18 L21 27 M36 19 L38 26 M21 27 L9 33 M21 27 L27 33 M27 33 L49 38 M38 26 L52 30"
            fill="none"
            stroke={LINE}
            strokeWidth="0.3"
          />
          <Chip x={27} y={10.4} w={11} />
          <Chip x={17} y={16.4} w={9} />
          <Chip x={32} y={17.6} w={10} />
          <Chip x={34} y={24.6} w={9} />
          <Chip x={5.5} y={31.6} w={8} />
          <Chip x={23} y={31.6} w={8} />
          <Chip x={46} y={36.6} w={8} />
          <Chip x={48} y={28.6} w={7} />
          <rect x="33" y="35" width="0.9" height="4.6" fill="rgb(51 65 85)" />
          <circle
            cx="30"
            cy="27.2"
            r="1.3"
            fill="white"
            stroke={RED}
            strokeWidth="0.35"
            strokeDasharray="0.6 0.4"
          />
          <path
            className="pv-draw"
            pathLength="1"
            d="M25.8 27.2 L28.6 27.2"
            fill="none"
            stroke={RED}
            strokeWidth="0.5"
            strokeDasharray="1 0.6"
            style={pv({ '--pv-at': '700ms', '--pv-dur': '600ms' })}
          />
          <g
            className="pv-shift"
            style={pv({ '--pv-at': '1400ms', '--pv-dx': '9.2px', '--pv-dur': '800ms' })}
          >
            <Chip x={16} y={25.5} w={9.6} />
          </g>
          <circle cx="13.2" cy="31.4" r="1.1" fill={RED} />
          {/* The plays card. */}
          <rect
            x="61"
            y="4"
            width="16"
            height="9"
            rx="1"
            fill="rgb(254 242 242)"
            stroke="rgb(254 202 202)"
            strokeWidth="0.3"
          />
          <rect
            x="61"
            y="14.5"
            width="16"
            height="9"
            rx="1"
            fill="rgb(254 242 242)"
            stroke="rgb(254 202 202)"
            strokeWidth="0.3"
          />
          <rect
            x="61"
            y="25"
            width="16"
            height="9"
            rx="1"
            fill="rgb(254 242 242)"
            stroke="rgb(254 202 202)"
            strokeWidth="0.3"
          />
          {[4, 14.5, 25].map((y) => (
            <g key={y}>
              <circle cx="63.4" cy={y + 2.4} r="1.1" fill={RED} />
              <Bar x={65.6} y={y + 1.9} w={8} fill="rgb(153 27 27)" />
              <Bar x={65.6} y={y + 4.4} w={10} />
              <Bar x={65.6} y={y + 6.2} w={7} />
            </g>
          ))}
          <rect
            x="61"
            y="36"
            width="16"
            height="8"
            rx="1"
            fill="white"
            stroke={MUTED}
            strokeWidth="0.3"
          />
          {[38, 40.2, 42.4].map((y) => (
            <g key={y}>
              <rect
                x="62.2"
                y={y - 0.6}
                width="1.2"
                height="1.2"
                rx="0.2"
                fill="none"
                stroke={LINE}
                strokeWidth="0.25"
              />
              <Bar x={64.4} y={y - 0.4} w={10} h={0.8} />
            </g>
          ))}
        </svg>
      );
    case 'threat-model':
      // A data-flow diagram inside dashed red trust boundaries (entities as squares, processes as circles, stores as
      // cylinders, flows as arrows), the STRIDE key beside it and a second tab peeking out behind. Hover story: the
      // threat markers land on what they threaten, one by one, in their rating's colour.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="18"
            y="5"
            width="36"
            height="40"
            rx="1.4"
            fill="rgb(254 242 242)"
            fillOpacity="0.5"
            stroke={RED}
            strokeWidth="0.4"
            strokeDasharray="1.2 0.8"
          />
          <rect
            x="38"
            y="25"
            width="14"
            height="18"
            rx="1.2"
            fill="none"
            stroke={RED}
            strokeWidth="0.4"
            strokeDasharray="1.2 0.8"
          />
          <rect
            x="4"
            y="9"
            width="9"
            height="6"
            rx="0.6"
            fill={PAPER}
            stroke={INK}
            strokeWidth="0.4"
          />
          <rect
            x="4"
            y="32"
            width="9"
            height="6"
            rx="0.6"
            fill={PAPER}
            stroke={INK}
            strokeWidth="0.4"
          />
          <circle cx="26" cy="12" r="4" fill={PAPER} stroke={INK} strokeWidth="0.4" />
          <circle cx="42" cy="12" r="4" fill={PAPER} stroke={INK} strokeWidth="0.4" />
          <circle cx="26" cy="32" r="4" fill={PAPER} stroke={INK} strokeWidth="0.4" />
          <circle cx="45" cy="31" r="3.6" fill={PAPER} stroke={INK} strokeWidth="0.4" />
          <path
            d="M40 38.5 L40 42 A5 1.4 0 0 0 50 42 L50 38.5"
            fill={PAPER}
            stroke={INK}
            strokeWidth="0.4"
          />
          <ellipse cx="45" cy="38.5" rx="5" ry="1.4" fill={PAPER} stroke={INK} strokeWidth="0.4" />
          <path
            d="M28 21 L28 25 A4 1.2 0 0 0 36 25 L36 21"
            fill={PAPER}
            stroke={INK}
            strokeWidth="0.4"
          />
          <ellipse cx="32" cy="21" rx="4" ry="1.2" fill={PAPER} stroke={INK} strokeWidth="0.4" />
          <path
            d="M13 12 L21.6 12 M30 12 L37.6 12 M42 16 L44 27 M13 35 L21.8 33 M26 16 L26 27.8 M30 32 L41.2 31.2 M45 34.6 L45 37"
            fill="none"
            stroke={LINE}
            strokeWidth="0.4"
          />
          {[
            [23, 8, RED, 500],
            [39, 8, RED, 800],
            [48, 27, RED, 1100],
            [29, 29, AMBER, 1400],
            [10, 7, AMBER, 1700],
            [48, 36, AMBER, 2000],
          ].map(([x, y, fill, at]) => (
            <g
              key={`${x}-${y}`}
              className="pv-new"
              opacity="0"
              style={pv({ '--pv-at': `${at}ms` })}
            >
              <rect
                x={x as number}
                y={y as number}
                width="4.2"
                height="2.6"
                rx="1.3"
                fill={fill as string}
              />
            </g>
          ))}
          {/* The STRIDE key: six letter chips in their hues. */}
          {[
            'rgb(239 68 68)',
            'rgb(249 115 22)',
            'rgb(234 179 8)',
            'rgb(34 197 94)',
            'rgb(59 130 246)',
            'rgb(168 85 247)',
          ].map((fill, i) => (
            <g key={fill}>
              <rect x="59" y={6 + i * 5.2} width="3.4" height="3.4" rx="0.7" fill={fill} />
              <Bar x={63.6} y={6.6 + i * 5.2} w={12} />
              <Bar x={63.6} y={8.4 + i * 5.2} w={8} h={0.7} />
            </g>
          ))}
          <rect
            x="59"
            y="38.5"
            width="18"
            height="6"
            rx="1"
            fill="rgb(255 241 242)"
            stroke="rgb(253 164 175)"
            strokeWidth="0.3"
          />
          <rect x="60.4" y="39.8" width="16" height="1.2" rx="0.3" fill="rgb(190 18 60)" />
          <Bar x={60.4} y={42.2} w={12} h={0.7} />
        </svg>
      );
    case 'service-blueprint':
      // Five stages across, five tinted rows down (evidence, customer, frontstage, backstage, support), the three
      // lines between them, the line of visibility dashed. Hover story: the customer walks the journey and a fail
      // point flares where it goes wrong.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[
            [4, 'rgb(248 250 252)'],
            [12, 'rgb(254 243 199)'],
            [21, 'rgb(224 242 254)'],
            [30, 'rgb(237 233 254)'],
            [39, 'rgb(236 253 245)'],
          ].map(([y, fill]) => (
            <rect
              key={String(y)}
              x="3"
              y={y as number}
              width="74"
              height="8"
              rx="0.8"
              fill={fill as string}
            />
          ))}
          {[3, 12, 21, 30, 39].map((y) => (
            <rect
              key={y}
              x="4"
              y={y + 2.8}
              width="7"
              height="2.4"
              rx="0.6"
              fill={LINE}
              fillOpacity="0.5"
            />
          ))}
          <line x1="3" y1="20.5" x2="77" y2="20.5" stroke={INK} strokeWidth="0.35" />
          <line
            x1="3"
            y1="29.5"
            x2="77"
            y2="29.5"
            stroke={RED}
            strokeWidth="0.45"
            strokeDasharray="1.2 0.8"
          />
          <line
            x1="3"
            y1="38.5"
            x2="77"
            y2="38.5"
            stroke={LINE}
            strokeWidth="0.35"
            strokeDasharray="0.4 0.6"
          />
          {[14, 27, 40, 53, 66].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="5.4"
                width="9"
                height="5"
                rx="0.6"
                fill={PAPER}
                stroke={MUTED}
                strokeWidth="0.25"
              />
              <rect x={x} y="13.4" width="9" height="5.4" rx="0.8" fill="rgb(251 191 36)" />
              <rect
                x={x}
                y="22.4"
                width="9"
                height="5"
                rx="0.6"
                fill={PAPER}
                stroke="rgb(125 211 252)"
                strokeWidth="0.3"
              />
              <rect
                x={x}
                y="31.4"
                width="9"
                height="5"
                rx="0.6"
                fill={PAPER}
                stroke="rgb(196 181 253)"
                strokeWidth="0.3"
              />
              <rect
                x={x}
                y="40.4"
                width="9"
                height="5"
                rx="0.6"
                fill={PAPER}
                stroke="rgb(110 231 183)"
                strokeWidth="0.3"
              />
              <path
                d={`M${x + 4.5} 18.8 L${x + 4.5} 22.4 M${x + 4.5} 27.4 L${x + 4.5} 31.4 M${x + 4.5} 36.4 L${x + 4.5} 40.4`}
                stroke={LINE}
                strokeWidth="0.3"
              />
            </g>
          ))}
          <path
            d="M23 16.1 L27 16.1 M36 16.1 L40 16.1 M49 16.1 L53 16.1 M62 16.1 L66 16.1"
            stroke="rgb(180 83 9)"
            strokeWidth="0.45"
          />
          <circle
            cx="47.4"
            cy="22.6"
            r="1.6"
            fill={RED}
            className="pv-pulse"
            style={pv({ '--pv-at': '1500ms' })}
          />
          <circle cx="60.6" cy="31.6" r="1.4" fill={AMBER} />
          <path
            d="M71.5 12.6 L72.1 13.9 L73.5 14 L72.4 14.9 L72.8 16.3 L71.5 15.5 L70.2 16.3 L70.6 14.9 L69.5 14 L70.9 13.9 Z"
            fill="rgb(234 179 8)"
          />
          <circle
            className="pv-travel"
            opacity="0"
            cx="18.5"
            cy="16.1"
            r="1.2"
            fill={INK}
            style={pv({ '--pv-at': '400ms', '--pv-dx': '52px', '--pv-dur': '2400ms' })}
          />
        </svg>
      );
    case 'metric-tree':
      // The north star on top with its progress ring, three outputs under it joined by operators, the inputs a team
      // moves in green underneath, and the levers card. Hover story: an input grows and the north star swells.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <path
            d="M36 11 L36 14 L14 14 L14 17 M36 14 L36 17 M36 14 L58 14 L58 17 M14 25 L14 28 L7 28 L7 31 M14 28 L21 28 L21 31 M58 25 L58 28 L51 28 L51 31 M58 28 L65 28 L65 31 M7 39 L7 41 M21 39 L21 41"
            fill="none"
            stroke={LINE}
            strokeWidth="0.35"
          />
          <g className="pv-pulse" style={pv({ '--pv-at': '1500ms', '--pv-origin': '36px 7px' })}>
            <rect x="24" y="3" width="24" height="8" rx="1.2" fill="rgb(109 40 217)" />
            <Bar x={26.5} y={5} w={12} fill="white" />
            <Bar x={26.5} y={7.6} w={8} fill="rgb(221 214 254)" h={1.4} />
            <circle
              cx="44"
              cy="7"
              r="2.3"
              fill="none"
              stroke="rgb(221 214 254)"
              strokeWidth="0.8"
            />
            <path d="M44 4.7 A2.3 2.3 0 1 1 41.9 8" fill="none" stroke="white" strokeWidth="0.8" />
          </g>
          {[6, 28, 50].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="17"
                width="16"
                height="8"
                rx="1"
                fill="rgb(224 242 254)"
                stroke="rgb(125 211 252)"
                strokeWidth="0.3"
              />
              <Bar x={x + 1.6} y={18.8} w={10} fill="rgb(12 74 110)" />
              <Bar x={x + 1.6} y={21.6} w={7} fill="rgb(3 105 161)" h={1.4} />
            </g>
          ))}
          {[25, 47].map((x) => (
            <g key={x}>
              <circle cx={x - 0.5} cy="21" r="1.6" fill="white" stroke={LINE} strokeWidth="0.3" />
              <path
                d={`M${x - 1.3} 20.2 L${x + 0.3} 21.8 M${x + 0.3} 20.2 L${x - 1.3} 21.8`}
                stroke={INK}
                strokeWidth="0.3"
              />
            </g>
          ))}
          {[1, 15, 45, 59].map((x, i) => (
            <g key={x}>
              <rect
                x={x}
                y="31"
                width="12"
                height="8"
                rx="1"
                fill="rgb(220 252 231)"
                stroke="rgb(134 239 172)"
                strokeWidth="0.3"
              />
              <Bar x={x + 1.4} y={32.8} w={8} fill="rgb(20 83 45)" />
              {i === 1 ? (
                <rect
                  className="pv-grow-x"
                  x={x + 1.4}
                  y={35.4}
                  width="8.4"
                  height="1.6"
                  rx="0.8"
                  fill={GREEN}
                  style={pv({ '--pv-at': '600ms' })}
                />
              ) : (
                <rect x={x + 1.4} y={35.4} width="5.6" height="1.6" rx="0.8" fill={GREEN} />
              )}
            </g>
          ))}
          <rect
            x="1"
            y="41"
            width="26"
            height="6"
            rx="1"
            fill="white"
            stroke={MUTED}
            strokeWidth="0.3"
          />
          <Bar x={3} y={42.6} w={14} fill={INK} />
          <Bar x={3} y={44.6} w={20} h={0.7} />
          <rect
            x="73"
            y="31"
            width="5"
            height="8"
            rx="0.8"
            fill="rgb(238 242 255)"
            stroke="rgb(165 180 252)"
            strokeWidth="0.3"
          />
          <path
            d="M74 37.6 L74 35 M75.5 37.6 L75.5 33 M77 37.6 L77 34.2"
            stroke="rgb(67 56 202)"
            strokeWidth="0.7"
          />
        </svg>
      );
    case 'value-proposition-canvas':
      // The Value Map square split into products, gain creators and pain relievers, the Customer Profile circle
      // split into gains, pains and jobs, stickies in each section's hue, and the session rail. Hover story: a fit
      // line draws from a pain reliever to the pain it kills.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="2"
            y="4"
            width="10"
            height="42"
            rx="1"
            fill="rgb(248 250 252)"
            stroke={MUTED}
            strokeWidth="0.25"
          />
          {[7, 15, 23].map((y) => (
            <g key={y}>
              <circle cx="4.4" cy={y} r="1" fill="rgb(99 102 241)" />
              <Bar x={6} y={y - 0.4} w={4.4} h={0.8} />
            </g>
          ))}
          <circle cx="7" cy="33" r="3" fill="none" stroke={LINE} strokeWidth="0.5" />
          <rect x="3.5" y="39" width="7" height="4" rx="0.8" fill="rgb(245 158 11)" />
          <rect
            x="15"
            y="9"
            width="28"
            height="32"
            rx="0.6"
            fill={PAPER}
            stroke={INK}
            strokeWidth="0.5"
          />
          <line x1="29" y1="9" x2="29" y2="41" stroke={INK} strokeWidth="0.4" />
          <line x1="29" y1="25" x2="43" y2="25" stroke={INK} strokeWidth="0.4" />
          <circle cx="63" cy="25" r="15" fill={PAPER} stroke={INK} strokeWidth="0.5" />
          <path d="M68 10.9 L68 39.1 M48 25 L68 25" stroke={INK} strokeWidth="0.4" />
          {[
            [17, 12, 'rgb(199 210 254)'],
            [21, 18, 'rgb(199 210 254)'],
            [17, 28, 'rgb(199 210 254)'],
            [31, 12, 'rgb(187 247 208)'],
            [36, 17, 'rgb(187 247 208)'],
            [31, 28, 'rgb(254 205 211)'],
            [36, 33, 'rgb(254 205 211)'],
            [55, 14, 'rgb(187 247 208)'],
            [60, 18, 'rgb(187 247 208)'],
            [53, 28, 'rgb(254 205 211)'],
            [58, 32, 'rgb(254 205 211)'],
            [70, 17, 'rgb(253 230 138)'],
            [70, 24, 'rgb(253 230 138)'],
            [70, 31, 'rgb(253 230 138)'],
          ].map(([x, y, fill]) => (
            <rect
              key={`${x}-${y}`}
              x={x as number}
              y={y as number}
              width="5.4"
              height="4.4"
              rx="0.4"
              fill={fill as string}
            />
          ))}
          <path
            className="pv-draw"
            pathLength="1"
            d="M41.4 30 Q48 34 53 30.4"
            fill="none"
            stroke="rgb(190 18 60)"
            strokeWidth="0.55"
            strokeDasharray="1 0.6"
            style={pv({ '--pv-at': '700ms', '--pv-dur': '800ms' })}
          />
          <path
            className="pv-draw"
            pathLength="1"
            d="M41.4 19 Q48 14 55 16"
            fill="none"
            stroke="rgb(21 128 61)"
            strokeWidth="0.55"
            strokeDasharray="1 0.6"
            style={pv({ '--pv-at': '1500ms', '--pv-dur': '800ms' })}
          />
        </svg>
      );
    case 'family-tree':
      // Three generations on tinted bands: two couples on top, their children and partners in the middle, the
      // grandchildren underneath, each a card with a monogram in its family line's hue, partnership lines and rakes.
      // Hover story: a new grandchild arrives on the tree.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[3, 18, 33].map((y, i) => (
            <rect
              key={y}
              x="2"
              y={y}
              width="76"
              height="13"
              rx="1"
              fill={['rgb(255 247 237)', 'rgb(240 249 255)', 'rgb(240 253 244)'][i]}
            />
          ))}
          <path
            d="M17 9.5 L23 9.5 M57 9.5 L63 9.5 M20 9.5 L20 14 L14 14 L14 18 M20 14 L28 14 L28 18 M60 9.5 L60 14 L52 14 L52 18 M60 14 L68 14 L68 18 M33 24.5 L45 24.5 M39 24.5 L39 29 L33 29 L33 33 M39 29 L45 29 L45 33 M14 24.5 L14 29 L14 33"
            fill="none"
            stroke={LINE}
            strokeWidth="0.35"
          />
          <path
            d="M68 24.5 L68 29 L68 33"
            fill="none"
            stroke={LINE}
            strokeWidth="0.35"
            strokeDasharray="0.8 0.6"
          />
          {[
            [8, 5, 'rgb(234 88 12)'],
            [23, 5, 'rgb(234 88 12)'],
            [48, 5, 'rgb(2 132 199)'],
            [63, 5, 'rgb(2 132 199)'],
            [5, 20, 'rgb(234 88 12)'],
            [24, 20, 'rgb(234 88 12)'],
            [45, 20, 'rgb(2 132 199)'],
            [59, 20, 'rgb(2 132 199)'],
            [5, 35, 'rgb(22 163 74)'],
            [24, 35, 'rgb(22 163 74)'],
            [59, 35, 'rgb(22 163 74)'],
          ].map(([x, y, hue]) => (
            <g key={`${x}-${y}`}>
              <rect
                x={x as number}
                y={y as number}
                width="11"
                height="9"
                rx="1"
                fill={PAPER}
                stroke={MUTED}
                strokeWidth="0.3"
              />
              <circle
                cx={(x as number) + 2.8}
                cy={(y as number) + 4.5}
                r="1.8"
                fill={hue as string}
              />
              <Bar x={(x as number) + 5.2} y={(y as number) + 3.4} w={4.6} fill={INK} h={0.9} />
              <Bar x={(x as number) + 5.2} y={(y as number) + 5.4} w={3.6} h={0.7} />
            </g>
          ))}
          <g className="pv-new" opacity="0" style={pv({ '--pv-at': '900ms' })}>
            <rect
              x="40"
              y="35"
              width="11"
              height="9"
              rx="1"
              fill={PAPER}
              stroke={MUTED}
              strokeWidth="0.3"
            />
            <circle cx="42.8" cy="39.5" r="1.8" fill="rgb(22 163 74)" />
            <Bar x={45.2} y={38.4} w={4.6} fill={INK} h={0.9} />
            <Bar x={45.2} y={40.4} w={3.6} h={0.7} />
          </g>
        </svg>
      );
    case 'value-stream-map':
      // The information flow along the top, the customer top right, six process boxes with their data boxes, the
      // inventory triangles between them, and the timeline ladder underneath ending in its totals. Hover story: the
      // ladder draws itself step by step and a kaizen burst flares on the worst wait.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="3"
            y="3"
            width="10"
            height="5"
            rx="0.6"
            fill={PAPER}
            stroke={INK}
            strokeWidth="0.35"
          />
          <path
            d="M66 8 L66 4.4 L69 3 L72 4.4 L75 3 L77 4.4 L77 8 Z"
            fill={PAPER}
            stroke={INK}
            strokeWidth="0.35"
          />
          <path d="M13 5.5 L64 5.5" stroke={LINE} strokeWidth="0.35" strokeDasharray="1 0.7" />
          {[4, 16.4, 28.8, 41.2, 53.6, 66].map((x, i) => (
            <g key={x}>
              <rect
                x={x}
                y="13"
                width="10"
                height="5"
                rx="0.4"
                fill="rgb(204 251 241)"
                stroke="rgb(15 118 110)"
                strokeWidth="0.35"
              />
              <Bar x={x + 1.4} y={15} w={7} fill="rgb(17 94 89)" />
              <rect
                x={x}
                y="18.6"
                width="10"
                height="7"
                fill={PAPER}
                stroke={MUTED}
                strokeWidth="0.25"
              />
              {[20.2, 22, 23.8].map((y) => (
                <Bar key={y} x={x + 1.2} y={y} w={6} h={0.6} />
              ))}
              {i < 5 && (
                <path
                  d={`M${x + 10.6} 15.5 L${x + 15.8} 15.5`}
                  stroke={INK}
                  strokeWidth="0.5"
                  strokeDasharray="0.5 0.4"
                />
              )}
              {i < 5 && (
                <path
                  d={`M${x + 13.2} 27.8 L${x + 11.6} 30.6 L${x + 14.8} 30.6 Z`}
                  fill="rgb(254 243 199)"
                  stroke={AMBER}
                  strokeWidth="0.3"
                />
              )}
            </g>
          ))}
          <path
            className="pv-draw"
            pathLength="1"
            d="M3 36 L12 36 L12 40 L16 40 L16 36 L24 36 L24 40 L28 40 L28 36 L37 36 L37 40 L41 40 L41 36 L50 36 L50 40 L54 40 L54 36 L62 36 L62 40 L66 40"
            fill="none"
            stroke={INK}
            strokeWidth="0.45"
            style={pv({ '--pv-at': '400ms', '--pv-dur': '1400ms' })}
          />
          <rect
            x="68"
            y="33"
            width="10"
            height="12"
            rx="0.8"
            fill="rgb(240 253 250)"
            stroke="rgb(15 118 110)"
            strokeWidth="0.35"
          />
          {[35.4, 38.4, 41.4].map((y) => (
            <Bar key={y} x={69.4} y={y} w={7} h={0.9} fill="rgb(17 94 89)" />
          ))}
          <path
            className="pv-pulse"
            style={pv({ '--pv-at': '1900ms', '--pv-origin': '40px 30px' })}
            d="M40 26.6 L41 28.6 L43.2 28 L42.4 30 L44.2 31.4 L42 31.8 L42.2 34 L40.4 32.8 L38.8 34.4 L38.6 32.2 L36.4 31.8 L38 30.2 L37 28.2 L39.2 28.6 Z"
            fill="rgb(254 226 226)"
            stroke={RED}
            strokeWidth="0.4"
          />
        </svg>
      );
    default:
      return null;
  }
}
