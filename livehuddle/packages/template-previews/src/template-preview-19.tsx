import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { pv } from '@liveworkspace/template-previews/motion';
import { PopDot } from '@liveworkspace/template-previews/story-parts';

// Group 19: the classic retrospective, as the template now draws it: a bold title over a how-to, colour that means
// something. Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const WHITE = 'white';
const INK = 'rgb(15 23 42)';
const BODY = 'rgb(51 65 85)';
const MUTED = 'rgb(148 163 184)';
const LINE = 'rgb(71 85 105)';

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
