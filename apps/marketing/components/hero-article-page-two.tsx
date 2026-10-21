import { FONT, at } from '@/components/art-tokens';
import {
  BODY,
  BODY_SIZE,
  BRAND,
  BRAND_TINT,
  Heading,
  INK,
  LEFT,
  Line,
  MEASURE,
  MUTED,
  RULE,
  Sheet,
} from './hero-article-parts';

// Page 2 of the hero's Article window (hero-article-page.tsx), where the article runs on.

const CHECKLIST: [string, boolean][] = [
  ['Tests green on main', true],
  ['Flags set for the release', true],
  ['Post the notes in #releases', false],
];
const WEEKS = [26, 30, 28, 38, 44, 50, 58, 70];
const WRITING = 'go live, then we write down what we';

// Page 2: a checklist, a quote, a figure with its caption, and the paragraph you are writing.
export function PageTwo({ x, y }: { x: number; y: number }) {
  const fig = { y: 186, h: 92 };
  const plot = { x: LEFT + 12, y: fig.y + 30, w: MEASURE - 24, h: 44 };
  const step = plot.w / WEEKS.length;
  return (
    <Sheet x={x} y={y} folio={2}>
      <Heading y={34} d={5.4}>
        Friday checklist
      </Heading>
      {CHECKLIST.map(([text, done], i) => {
        const cy = 52 + i * 17;
        return (
          <g key={text}>
            <rect
              className="hm-pop"
              style={at(5.7 + i * 0.3)}
              x={LEFT}
              y={cy - 5}
              width="10"
              height="10"
              rx="2.5"
              fill={done ? BRAND : 'white'}
              stroke={done ? BRAND : '#94a3b8'}
              strokeWidth="1"
            />
            {done ? (
              <path
                className="hm-pop"
                style={at(6.0 + i * 0.3)}
                d={`M${LEFT + 2.6} ${cy} l2 2.2 l3.8 -4.4`}
                fill="none"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            <Line
              x={LEFT + 17}
              y={cy + 3.4}
              d={5.75 + i * 0.3}
              text={text}
              fill={done ? MUTED : BODY}
            />
          </g>
        );
      })}

      {/* The quote, behind its rule, with its attribution. */}
      <rect
        className="hm-grow"
        style={at(6.8)}
        x={LEFT}
        y={110}
        width="3"
        height="46"
        rx="1.5"
        fill={BRAND}
      />
      <Line
        x={LEFT + 13}
        y={126}
        d={7.0}
        text="Ship small, ship often, and"
        size={12}
        italic
        fill={INK}
      />
      <Line
        x={LEFT + 13}
        y={142}
        d={7.4}
        text="Friday takes care of itself."
        size={12}
        italic
        fill={INK}
      />
      <text
        className="hm-fade"
        style={at(7.8)}
        x={LEFT + 13}
        y={155}
        fontFamily={FONT}
        fontSize="8"
        fill={MUTED}
      >
        Maya Chen, Head of Platform
      </text>

      <Heading y={178} d={7.9}>
        What changed
      </Heading>

      {/* The figure: releases per week, the last bar called out, then its caption. */}
      <g className="hm-fade" style={at(8.1)}>
        <rect
          x={LEFT}
          y={fig.y}
          width={MEASURE}
          height={fig.h}
          rx="4"
          fill="#f8fafc"
          stroke={RULE}
          strokeWidth="1"
        />
        <text
          x={LEFT + 12}
          y={fig.y + 16}
          fontFamily={FONT}
          fontSize="8.5"
          fontWeight="700"
          fill={INK}
        >
          Releases per week
        </text>
        {[0, 0.5, 1].map((t) => (
          <path
            key={t}
            d={`M${plot.x} ${plot.y + plot.h * t}H${plot.x + plot.w}`}
            stroke={t === 1 ? '#cbd5e1' : RULE}
            strokeWidth="0.8"
            strokeDasharray={t === 1 ? undefined : '2 2'}
          />
        ))}
        {['W1', 'W8'].map((t, i) => (
          <text
            key={t}
            x={plot.x + (i ? plot.w - step / 2 : step / 2)}
            y={plot.y + plot.h + 10}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize="7"
            fill={MUTED}
          >
            {t}
          </text>
        ))}
      </g>
      {WEEKS.map((v, i) => {
        const bh = (v / 70) * plot.h;
        const last = i === WEEKS.length - 1;
        return (
          <rect
            key={i}
            className="hm-grow"
            style={at(8.3 + i * 0.07)}
            x={plot.x + i * step + step * 0.2}
            y={plot.y + plot.h - bh}
            width={step * 0.6}
            height={bh}
            rx="2"
            fill={last ? BRAND : BRAND_TINT}
          />
        );
      })}
      <g className="hm-pop" style={at(9.0)}>
        <rect
          x={plot.x + plot.w - step / 2 - 19}
          y={fig.y + 7}
          width="38"
          height="13"
          rx="6.5"
          fill="#10b981"
        />
        <text
          x={plot.x + plot.w - step / 2}
          y={fig.y + 16.3}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="7.5"
          fontWeight="800"
          fill="white"
        >
          +170%
        </text>
      </g>
      <text
        className="hm-fade"
        style={at(9.1)}
        x={LEFT}
        y={fig.y + fig.h + 13}
        fontFamily={FONT}
        fontSize="8"
        fill={MUTED}
      >
        <tspan fontWeight="700" fill={BODY}>
          Fig. 1
        </tspan>
        {'  Releases per week since Fridays began.'}
      </text>

      {/* The paragraph you are writing, and the caret at its end. */}
      <Line y={316} d={9.3} text="At five the whole team watches one thing" />
      <Line y={330} d={9.7} text={WRITING} />
      {/* The caret rides the end of the line in whatever face sets it: the line again, unpainted. */}
      <text x={LEFT} y={331} fontFamily={FONT} fontSize={BODY_SIZE} fill="none" aria-hidden>
        {WRITING}
        <tspan
          className="ha-caret"
          style={at(10.2)}
          dx="0.5"
          fontSize="12.5"
          fontWeight="300"
          fill={BRAND}
        >
          |
        </tspan>
      </text>
    </Sheet>
  );
}
