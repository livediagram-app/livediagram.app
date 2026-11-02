import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { Pop, PopDot } from '@liveworkspace/template-previews/story-parts';

// Group 26: the board grids (docs/specs/008-canvas/canvas-and-palette.md "Templates"): PESTLE Analysis and the KWL
// Chart, each drawn small as it opens,
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
    default:
      return null;
  }
}
