import { FONT, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';
import { CARD_H, CardFace, Sliders, type CardDef } from './hero-plan-card';

// The pieces a board scene moves with (hero-plan-board.tsx, hero-automations-board.tsx): a column's count
// lane with its grey head, its count ticking over, and a card someone carries from one column to another.

// How long a carry takes, pick-up to drop.
export const CARRY = 0.6;

// A count that ticks over: each value lands at its `from` and gives way at the next one's.
export function Count({
  x,
  y,
  values,
}: {
  x: number;
  y: number;
  values: { text: string; from: number }[];
}) {
  return (
    <>
      {values.map((v, i) => {
        const next = values[i + 1];
        const label = (
          <text
            className="hm-pop fill-slate-500 dark:fill-slate-400"
            style={at(v.from)}
            x={x}
            y={y}
            textAnchor="end"
            fontFamily={FONT}
            fontSize="8.5"
            fontWeight="600"
          >
            {v.text}
          </text>
        );
        return next ? (
          <g key={v.text + v.from} className="hm-out" style={at(next.from - 0.05)}>
            {label}
          </g>
        ) : (
          <g key={v.text + v.from}>{label}</g>
        );
      })}
    </>
  );
}

// A card someone carries: their pointer arrives on it, then card and pointer travel together to the
// new column, the card lifted and tilted and ringed in their colour while held, and a dashed slot
// waits where it will drop.
export function Carried({
  w,
  narrow,
  card,
  from,
  to,
  colour,
  name,
  arrive,
  carry,
  appear,
}: {
  w: number;
  narrow: boolean;
  card: CardDef;
  from: { x: number; y: number };
  to: { x: number; y: number };
  colour: string;
  name: string;
  arrive: number;
  carry: number;
  appear: number;
}) {
  const grab = { x: from.x + w * 0.55, y: from.y + CARD_H * 0.58 };
  return (
    <>
      <g className="hm-out" style={at(carry + CARRY)}>
        <rect
          className="hm-fade"
          style={at(carry - 0.1)}
          x={to.x}
          y={to.y}
          width={w}
          height={CARD_H}
          rx="7"
          fill={colour}
          fillOpacity="0.06"
          stroke={colour}
          strokeOpacity="0.55"
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />
      </g>
      <g
        className="hm-move"
        style={at(carry, { '--dx': `${to.x - from.x}px`, '--dy': `${to.y - from.y}px` })}
      >
        <g className="hp-lift" style={at(carry - 0.2)}>
          <g className="hm-pop" style={at(appear)}>
            <CardFace card={card} x={from.x} y={from.y} w={w} narrow={narrow} />
          </g>
          {/* Held: their colour rings the card from pick-up until it is dropped. */}
          <g className="hm-out" style={at(carry + CARRY + 0.15)}>
            <rect
              className="hm-fade"
              style={at(arrive + 0.6)}
              x={from.x - 2}
              y={from.y - 2}
              width={w + 4}
              height={CARD_H + 4}
              rx="8.5"
              fill="none"
              stroke={colour}
              strokeWidth="2"
            />
          </g>
        </g>
        <g
          className="hm-cursor hm-carrier"
          style={at(arrive, {
            '--sx': `${grab.x + 90}px`,
            '--sy': `${grab.y + 80}px`,
            '--cx': `${grab.x}px`,
            '--cy': `${grab.y}px`,
          })}
          aria-hidden
        >
          <CursorMark colour={colour} label={name} badge="name" />
        </g>
      </g>
    </>
  );
}

// A column: a grey head (name and sliders; the count is drawn over it by Count) over a lane that runs on
// below the window.
export function ColumnLane({
  x,
  y,
  w,
  name,
  d,
  small = false,
}: {
  x: number;
  y: number;
  w: number;
  name: string;
  d: number;
  small?: boolean;
}) {
  return (
    <g className="hm-fade" style={at(d)}>
      <rect
        x={x}
        y={y}
        width={w}
        height="22"
        rx="6"
        className="fill-slate-100 dark:fill-slate-800"
      />
      <rect
        x={x + 8}
        y={y + 2.5}
        width={w - 16}
        height="2"
        rx="1"
        className="fill-slate-300 dark:fill-slate-600"
      />
      <text
        x={x + 9}
        y={y + 15.5}
        fontFamily={FONT}
        fontSize={small ? 9 : 9.5}
        fontWeight="700"
        className="fill-(--art-text) dark:fill-slate-100"
      >
        {name}
      </text>
      <Sliders x={x + w - 17} y={y + 12.5} />
      <rect
        x={x}
        y={y + 26}
        width={w}
        height="700"
        rx="6"
        className="fill-slate-100/70 dark:fill-slate-800/45"
      />
    </g>
  );
}

// "+ Add card" at a column's foot (its centre line at `y`), sliding down `dy` from `d` to make room as a
// card is carried in.
export function AddCardRow({ x, y, dy = 0, d }: { x: number; y: number; dy?: number; d?: number }) {
  const row = (
    <g className="fill-slate-400 dark:fill-slate-500">
      <path
        d={`M${x + 6} ${y - 3.5}v7M${x + 2.5} ${y}h7`}
        className="stroke-slate-400 dark:stroke-slate-500"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <text x={x + 15} y={y + 3} fontFamily={FONT} fontSize="8.5" fontWeight="500">
        Add card
      </text>
    </g>
  );
  return dy && d !== undefined ? (
    <g className="hm-move" style={at(d, { '--dy': `${dy}px` })}>
      {row}
    </g>
  ) : (
    row
  );
}
