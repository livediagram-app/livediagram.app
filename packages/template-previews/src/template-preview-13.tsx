import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';

// Group 13: the infographic Illustrate templates (docs/specs/007-editor/templates-by-mode.md
// "Illustrate templates"): Data Story, How It Works, Versus and Social Carousel. Like group 12,
// each draws its pages as sheets in their own proportions (A4, Story 9:16, Portrait post 4:5,
// Square) with the designed content sketched in, in the template's own colours. Static SVG
// preview tiles (one branch per TemplateKind; see template-preview.tsx for who renders them);
// TemplatePreview chains the groups with ??.

const INK = 'rgb(15 23 42)';
const SLATE = 'rgb(148 163 184)';
const NAVY = 'rgb(30 27 75)';
const VIOLET = 'rgb(124 58 237)';

export function templatePreviewGroup13(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'data-story':
      // An A4 infographic: the kicker and headline, a deep teal band with the big number and a
      // sticker, a row of ten people with seven in coral, then a then-and-now card beside a bar
      // chart, and the source line. Hover story: the card holders light up one by one and the
      // bars grow.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect x="25" y="4" width="30" height="42" rx="1.2" fill="rgb(240 253 250)" />
          <rect x="27.5" y="6.5" width="12" height="0.9" rx="0.3" fill="rgb(13 148 136)" />
          <rect x="27.5" y="8.4" width="21" height="2.2" rx="0.5" fill={INK} />
          <rect x="27.5" y="12.2" width="25" height="10" rx="1.2" fill="rgb(19 78 74)" />
          <rect x="29.5" y="14" width="13" height="3.6" rx="0.6" fill="white" />
          <rect x="29.5" y="18.6" width="10" height="0.9" rx="0.3" fill="rgb(204 251 241)" />
          <rect x="45.5" y="13.8" width="5" height="5" rx="1" fill="white" />
          <rect x="46.5" y="15" width="3" height="1" rx="0.2" fill="rgb(22 163 74)" />
          <rect x="46.5" y="16.2" width="3" height="1" rx="0.2" fill="rgb(220 38 38)" />
          <rect x="44.5" y="19.8" width="7" height="1.6" rx="0.8" fill="rgb(254 215 170)" />
          <rect x="27.5" y="24" width="14" height="0.9" rx="0.3" fill={INK} />
          {Array.from({ length: 10 }, (_, i) => (
            <circle
              key={i}
              className={i < 7 ? 'pv-pulse' : undefined}
              cx={28.7 + i * 2.53}
              cy="27"
              r="1.05"
              fill={i < 7 ? 'rgb(249 115 22)' : 'rgb(226 232 240)'}
              style={i < 7 ? pv({ '--pv-at': `${600 + i * 110}ms` }) : undefined}
            />
          ))}
          <rect x="27.5" y="30.5" width="12" height="11" rx="1" fill="white" />
          <rect x="28.6" y="31.6" width="6" height="0.9" rx="0.3" fill={INK} />
          {[34, 36.2, 38.4].map((y) => (
            <g key={y}>
              <rect x="28.6" y={y} width="4.6" height="0.7" rx="0.3" fill={SLATE} />
              <rect x="35.6" y={y - 0.1} width="2.8" height="0.9" rx="0.3" fill="rgb(249 115 22)" />
            </g>
          ))}
          <rect x="40.5" y="30.5" width="12" height="11" rx="1" fill="white" />
          <rect x="41.6" y="31.6" width="6" height="0.9" rx="0.3" fill={INK} />
          {[
            [42.2, 6, 'rgb(15 118 110)'],
            [44.8, 3.6, 'rgb(20 184 166)'],
            [47.4, 2, 'rgb(94 234 212)'],
            [50, 1.2, 'rgb(249 115 22)'],
          ].map(([x, h, c], i) => (
            <rect
              key={x as number}
              className="pv-grow-y"
              x={x as number}
              y={40.2 - (h as number)}
              width="1.8"
              height={h as number}
              rx="0.3"
              fill={c as string}
              style={pv({ '--pv-at': `${1500 + i * 130}ms` })}
            />
          ))}
          <rect x="27.5" y="43" width="25" height="0.3" fill="rgb(203 213 225)" />
          <rect x="27.5" y="44" width="15" height="0.7" rx="0.3" fill={SLATE} />
        </svg>
      );
    case 'how-it-works':
      // A Story (9:16) explainer: the kicker and the two-line promise, five coloured discs
      // swapping sides down a dashed winding path, a line beside each, and the navy call to
      // action at the foot. Hover story: the path draws itself from the first step to the last.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect x="27.6" y="3" width="24.8" height="44" rx="1.2" fill="rgb(255 247 237)" />
          <rect x="29.6" y="5" width="9" height="0.8" rx="0.3" fill="rgb(244 63 94)" />
          <rect x="29.6" y="6.6" width="12" height="2" rx="0.5" fill={NAVY} />
          <rect x="29.6" y="9.2" width="14" height="2" rx="0.5" fill="rgb(99 102 241)" />
          <path
            className="pv-draw"
            pathLength="1"
            d="M31.5 15 C31.5 17.5 48.5 17.5 48.5 20 C48.5 22.5 31.5 22.5 31.5 25 C31.5 27.5 48.5 27.5 48.5 30 C48.5 32.5 31.5 32.5 31.5 35"
            fill="none"
            stroke="rgb(165 180 252)"
            strokeWidth="0.7"
            strokeDasharray="1 0.8"
            style={pv({ '--pv-at': '500ms', '--pv-dur': '1400ms' })}
          />
          {[
            'rgb(14 165 233)',
            'rgb(139 92 246)',
            'rgb(244 63 94)',
            'rgb(245 158 11)',
            'rgb(16 185 129)',
          ].map((c, i) => {
            const left = i % 2 === 0;
            const cy = 15 + i * 5;
            const tx = left ? 34.4 : 35.4;
            return (
              <g key={c}>
                <circle cx={left ? 31.5 : 48.5} cy={cy} r="1.9" fill={c} />
                <rect x={tx} y={cy - 1} width="10" height="0.9" rx="0.3" fill={NAVY} />
                <rect
                  x={left ? tx : tx + 2.5}
                  y={cy + 0.5}
                  width="7.5"
                  height="0.6"
                  rx="0.3"
                  fill={SLATE}
                />
              </g>
            );
          })}
          <rect x="29.6" y="39.5" width="20.8" height="5.5" rx="1" fill={NAVY} />
          <rect x="31" y="41" width="8" height="0.9" rx="0.3" fill="white" />
          <rect x="31" y="42.6" width="6" height="0.6" rx="0.3" fill="rgb(199 210 254)" />
          <rect x="42.5" y="41" width="6.5" height="2.4" rx="1.2" fill="rgb(244 63 94)" />
        </svg>
      );
    case 'versus':
      // A Portrait post (4:5) split down the middle, mint for tea and roast for coffee: a
      // sticker and a name over each half, the dark VS badge on the seam, five topic pills with a
      // point on each side, and the dark verdict card. Hover story: the VS badge throws its
      // punch.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect x="22.4" y="3" width="17.6" height="44" rx="1.2" fill="rgb(220 252 231)" />
          <rect x="40" y="3" width="17.6" height="44" rx="1.2" fill="rgb(253 232 204)" />
          <rect x="40" y="3" width="2" height="44" fill="rgb(253 232 204)" />
          <rect x="34" y="5" width="12" height="0.8" rx="0.3" fill={INK} />
          <rect x="29" y="7.5" width="4.2" height="4.2" rx="1" fill="white" />
          <circle cx="31.1" cy="9.7" r="1.2" fill="rgb(132 204 22)" />
          <rect x="46.8" y="7.5" width="4.2" height="4.2" rx="1" fill="white" />
          <circle cx="48.9" cy="9.7" r="1.2" fill="rgb(120 53 15)" />
          <rect x="27.5" y="13" width="7.5" height="2.4" rx="0.5" fill="rgb(20 83 45)" />
          <rect x="44.5" y="13" width="9" height="2.4" rx="0.5" fill="rgb(67 20 7)" />
          <g className="pv-pulse" style={pv({ '--pv-at': '700ms' })}>
            <circle cx="40" cy="12" r="3.3" fill="rgb(17 24 39)" stroke="white" strokeWidth="0.5" />
            <rect x="38.3" y="11.4" width="3.4" height="1.2" rx="0.3" fill="white" />
          </g>
          {[18.5, 22.5, 26.5, 30.5, 34.5].map((y, i) => (
            <g key={y}>
              <rect x="36.6" y={y} width="6.8" height="1.6" rx="0.8" fill="white" />
              <circle
                cx="25.6"
                cy={y + 2.6}
                r="0.6"
                fill={i === 4 ? 'rgb(220 38 38)' : 'rgb(21 128 61)'}
              />
              <rect x="26.8" y={y + 2.2} width="10" height="0.8" rx="0.3" fill="rgb(20 83 45)" />
              <circle
                cx="43.6"
                cy={y + 2.6}
                r="0.6"
                fill={i >= 3 ? 'rgb(220 38 38)' : 'rgb(154 52 18)'}
              />
              <rect x="44.8" y={y + 2.2} width="10" height="0.8" rx="0.3" fill="rgb(67 20 7)" />
            </g>
          ))}
          <rect x="25" y="39.5" width="30" height="5.5" rx="1" fill="rgb(17 24 39)" />
          <rect x="26.6" y="40.8" width="6" height="0.8" rx="0.3" fill="rgb(251 191 36)" />
          <rect x="26.6" y="42.4" width="20" height="0.9" rx="0.3" fill="white" />
          <rect x="49.5" y="40.3" width="4" height="4" rx="0.9" fill="white" />
        </svg>
      );
    case 'social-carousel':
      // Five Square slides fanned like a carousel, each over the one before: the hook in the
      // brand's violet, three tips on lavender (the number, the glyph disc, the tip and the
      // "Try" card) and the close in magenta with its three action cards, each slide with its
      // avatar line, its number pill and, on all but the last, the swipe cue. Hover story: the
      // swipe cues nudge along, slide by slide.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => {
            // A slide is 20 units square, drawn from a 14-unit sketch scaled by z.
            const z = 20 / 14;
            const x = 4 + i * 13;
            const y = 15;
            const at = (dx: number) => x + dx * z;
            const top = (dy: number) => y + dy * z;
            const dark = i === 0 || i === 4;
            const ink = dark ? 'white' : 'rgb(46 16 101)';
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width="20"
                  height="20"
                  rx="1.2"
                  fill={
                    i === 0 ? 'rgb(109 40 217)' : i === 4 ? 'rgb(162 28 175)' : 'rgb(245 243 255)'
                  }
                  stroke="white"
                  strokeWidth="0.5"
                />
                <circle
                  cx={at(1.9)}
                  cy={top(1.9)}
                  r="1.2"
                  fill={dark ? 'rgb(221 214 254)' : 'white'}
                />
                <rect x={at(3.2)} y={top(1.5)} width="5" height="0.9" rx="0.3" fill={ink} />
                <rect
                  x={at(10.4)}
                  y={top(1.3)}
                  width="3.6"
                  height="1.6"
                  rx="0.8"
                  fill={dark ? 'white' : VIOLET}
                />
                {i === 0 && (
                  <>
                    <rect
                      x={at(1)}
                      y={top(4.6)}
                      width="7"
                      height="1.4"
                      rx="0.7"
                      fill="rgb(253 224 71)"
                    />
                    <rect x={at(1)} y={top(6.4)} width="15" height="2.2" rx="0.5" fill="white" />
                    <rect
                      x={at(1)}
                      y={top(8.5)}
                      width="11"
                      height="2.2"
                      rx="0.5"
                      fill="rgb(253 224 71)"
                    />
                  </>
                )}
                {i > 0 && i < 4 && (
                  <>
                    <rect x={at(1)} y={top(4.4)} width="5.5" height="4.2" rx="0.5" fill={VIOLET} />
                    <circle cx={at(11.2)} cy={top(5.9)} r="2.2" fill={VIOLET} />
                    <rect x={at(1)} y={top(8.4)} width="12" height="1.3" rx="0.4" fill={ink} />
                    <rect x={at(1)} y={top(10)} width="17" height="2" rx="0.5" fill="white" />
                  </>
                )}
                {i === 4 && (
                  <>
                    <rect x={at(1)} y={top(4.4)} width="14" height="2" rx="0.5" fill="white" />
                    {[6.8, 8.6, 10.4].map((dy) => (
                      <rect
                        key={dy}
                        x={at(1)}
                        y={top(dy)}
                        width="14"
                        height="1.8"
                        rx="0.5"
                        fill="white"
                      />
                    ))}
                  </>
                )}
                {i < 4 && (
                  <circle
                    className="pv-pulse"
                    cx={at(12.3)}
                    cy={top(12.6)}
                    r="1.1"
                    fill={dark ? 'white' : VIOLET}
                    style={pv({ '--pv-at': `${600 + i * 250}ms` })}
                  />
                )}
              </g>
            );
          })}
        </svg>
      );
    default:
      return null;
  }
}
