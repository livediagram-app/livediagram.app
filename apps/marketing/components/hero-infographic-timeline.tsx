import type { StyledPrim } from '@liveplanner/icons';
import {
  lucideFlag,
  lucideHouse,
  lucideSmile,
  lucideStar,
  lucideZap,
} from '@liveplanner/icons/lucide';
import { FONT, at } from '@/components/art-tokens';
import {
  HAIRLINE,
  INK,
  InfoFooter,
  InfoHeading,
  InfoIcon,
  InfoSheet,
  MARGIN,
  MUTED,
  SHEET,
} from './hero-infographic-parts';

// Page 3 of the hero's Infographic window, the template's timeline: the rail draws down the page,
// then each month lands on it, a coloured pill and a card with its moment and a glyph.

type Moment = {
  month: string;
  colour: string;
  title: string;
  detail: string;
  icon: readonly StyledPrim[];
};

const MOMENTS: Moment[] = [
  {
    month: 'JAN',
    colour: '#0d9488',
    title: 'Moved into Harbour Street',
    detail: 'Big windows, a proper kitchen',
    icon: lucideHouse,
  },
  {
    month: 'MAR',
    colour: '#0ea5e9',
    title: 'Won the Kestrel rebrand',
    detail: 'Our biggest pitch yet',
    icon: lucideStar,
  },
  {
    month: 'MAY',
    colour: '#8b5cf6',
    title: 'Launched Tidewater',
    detail: 'Our first app, live in May',
    icon: lucideZap,
  },
  {
    month: 'JUL',
    colour: '#f59e0b',
    title: 'Team retreat',
    detail: 'Three days in the Lakes',
    icon: lucideSmile,
  },
  {
    month: 'NOV',
    colour: '#f43f5e',
    title: 'Shipped project 42',
    detail: 'Live on the twelfth',
    icon: lucideFlag,
  },
];

// When the page starts building: after the cover and the numbers.
const T = 7.2;
const STEP = 41;

export function TimelinePage({ x, y, of }: { x: number; y: number; of: number }) {
  const left = x + MARGIN;
  const railX = left + 31;
  const firstY = y + 64;
  const cardX = railX + 9;
  const cardW = x + SHEET.w - MARGIN - cardX;
  return (
    <InfoSheet x={x} y={y} name="Timeline" n={3} of={of}>
      <g className="hm-pop" style={at(T)}>
        <InfoHeading
          x={left}
          y={y + 22}
          kicker="TIMELINE"
          title="Moments that made it"
          colour="#0d9488"
        />
      </g>

      <path
        className="hm-draw"
        style={at(T + 0.3, { '--dur': '1.2s', '--len': STEP * (MOMENTS.length - 1) + 16 })}
        d={`M${railX} ${firstY + 6} V${firstY + 22 + STEP * (MOMENTS.length - 1)}`}
        stroke={HAIRLINE}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {MOMENTS.map((m, i) => {
        const my = firstY + i * STEP;
        const mid = my + 15;
        return (
          <g key={m.month} className="hm-pop" style={at(T + 0.5 + i * 0.3)}>
            <rect x={left} y={mid - 5} width="22" height="10" rx="5" fill={m.colour} />
            <text
              x={left + 11}
              y={mid + 2.2}
              textAnchor="middle"
              fontFamily={FONT}
              fontSize="5.5"
              fontWeight="800"
              fill="white"
            >
              {m.month}
            </text>
            <circle cx={railX} cy={mid} r="3.5" fill="white" stroke={m.colour} strokeWidth="1.6" />
            <rect
              x={cardX + 1}
              y={my + 1.5}
              width={cardW}
              height="30"
              rx="5"
              fill="#0f172a"
              opacity="0.05"
            />
            <rect
              x={cardX}
              y={my}
              width={cardW}
              height="30"
              rx="5"
              fill="white"
              stroke={HAIRLINE}
              strokeWidth="0.8"
            />
            <text
              x={cardX + 7}
              y={my + 13}
              fontFamily={FONT}
              fontSize="7"
              fontWeight="700"
              fill={INK}
            >
              {m.title}
            </text>
            <text x={cardX + 7} y={my + 23} fontFamily={FONT} fontSize="5.5" fill={MUTED}>
              {m.detail}
            </text>
            <InfoIcon
              prims={m.icon}
              x={cardX + cardW - 15}
              y={my + 9.5}
              size={10}
              colour={m.colour}
              weight={2}
            />
          </g>
        );
      })}

      <InfoFooter x={x} y={y} n={3} of={of} />
    </InfoSheet>
  );
}
