import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';
import { PopDot } from './story-parts';

// Group 7 (the incident postmortem and the risk matrix). Static SVG preview
// tiles, one branch per TemplateKind; TemplatePreview chains the groups
// with ??.

// The postmortem's five phases, red (it broke) through to green (it healed):
// the bar and text tone, then the card paper and its border.
const PHASES = [
  { deep: 'rgb(225 29 72)', soft: 'rgb(255 228 230)', line: 'rgb(253 164 175)' },
  { deep: 'rgb(217 119 6)', soft: 'rgb(254 243 199)', line: 'rgb(252 211 77)' },
  { deep: 'rgb(2 132 199)', soft: 'rgb(224 242 254)', line: 'rgb(125 211 252)' },
  { deep: 'rgb(124 58 237)', soft: 'rgb(237 233 254)', line: 'rgb(196 181 253)' },
  { deep: 'rgb(22 163 74)', soft: 'rgb(220 252 231)', line: 'rgb(134 239 172)' },
];
const COL_W = 13.2;
const colX = (i: number) => 5 + i * 14.2;

// The risk heatmap's shade per score, green through amber to red.
const SCORE_FILL: Record<number, string> = {
  1: 'rgb(187 247 208)',
  2: 'rgb(187 247 208)',
  3: 'rgb(217 249 157)',
  4: 'rgb(217 249 157)',
  5: 'rgb(254 240 138)',
  6: 'rgb(254 240 138)',
  8: 'rgb(253 230 138)',
  9: 'rgb(253 230 138)',
  10: 'rgb(253 186 116)',
  12: 'rgb(253 186 116)',
  15: 'rgb(251 146 60)',
  16: 'rgb(251 146 60)',
  20: 'rgb(248 113 113)',
  25: 'rgb(239 68 68)',
};
const CELL = 5.8;
const PITCH = 6.4;
const cellX = (impact: number) => 8 + (impact - 1) * PITCH;
const cellY = (likelihood: number) => 6 + (5 - likelihood) * PITCH;
const INK = 'rgb(15 23 42)';
const MUTED = 'rgb(148 163 184)';

export function templatePreviewGroup7(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'incident-postmortem':
      // Title with severity + status chips; a summary card, the Blameless
      // callout and four impact stats; five phase columns of timestamped
      // cards; the detect / mitigate / resolve spans; five whys down to a
      // red root cause beside three findings columns and the actions table.
      // Hover story: the three spans measure out from the moment impact
      // began, the root cause pulses, and the status chip earns its tick.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <rect x="5" y="3.6" width="27" height="2.6" rx="0.6" fill={INK} />
          <rect x="5" y="7.2" width="20" height="0.9" rx="0.4" fill={MUTED} />
          <rect x="58" y="3.4" width="7" height="3" rx="1.5" fill="rgb(234 88 12)" />
          <rect
            x="66"
            y="3.4"
            width="9.5"
            height="3"
            rx="1.5"
            fill="rgb(220 252 231)"
            stroke="rgb(134 239 172)"
            strokeWidth="0.4"
          />
          <PopDot at={2600} cx="67.8" cy="4.9" r="0.9" fill="rgb(22 163 74)" />
          {/* Summary band: the paragraph, Blameless, the impact stats. */}
          <rect
            x="5"
            y="10"
            width="28"
            height="7"
            rx="0.8"
            fill="white"
            stroke="rgb(203 213 225)"
            strokeWidth="0.4"
          />
          {[12, 13.6, 15.2].map((y, i) => (
            <rect
              key={y}
              x="7"
              y={y}
              width={i === 2 ? 15 : 24}
              height="0.7"
              rx="0.3"
              fill={MUTED}
            />
          ))}
          <rect
            x="35"
            y="10"
            width="14"
            height="7"
            rx="0.8"
            fill="rgb(236 254 255)"
            stroke="rgb(14 116 144)"
            strokeWidth="0.4"
          />
          <circle cx="37.6" cy="12.4" r="1.1" fill="rgb(14 116 144)" />
          <rect x="37" y="14.6" width="10" height="0.7" rx="0.3" fill="rgb(8 51 68)" />
          {[51, 57.2, 63.4, 69.6].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="10"
                width="5.4"
                height="7"
                rx="0.8"
                fill="rgb(240 249 255)"
                stroke="rgb(186 230 253)"
                strokeWidth="0.4"
              />
              <rect x={x + 1} y="12" width="3.4" height="1.6" rx="0.3" fill="rgb(2 132 199)" />
              <rect x={x + 1} y="14.6" width="3.4" height="0.6" rx="0.3" fill={MUTED} />
            </g>
          ))}
          {/* Timeline: phase bars, then two timestamped cards per phase. */}
          {PHASES.map((p, i) => (
            <g key={i}>
              <rect x={colX(i)} y="20" width={COL_W} height="0.9" rx="0.45" fill={p.deep} />
              {[22, 27].map((y) => (
                <g key={y}>
                  <rect
                    x={colX(i)}
                    y={y}
                    width={COL_W}
                    height="4.2"
                    rx="0.6"
                    fill={p.soft}
                    stroke={p.line}
                    strokeWidth="0.4"
                  />
                  <rect x={colX(i) + 1} y={y + 0.9} width="3" height="0.8" rx="0.3" fill={p.deep} />
                  <rect x={colX(i) + 1} y={y + 2.4} width="10" height="0.6" rx="0.3" fill={MUTED} />
                </g>
              ))}
            </g>
          ))}
          {/* The spans, all from the moment impact began. */}
          <line
            x1="6"
            y1="31.6"
            x2="6"
            y2="38.4"
            stroke={PHASES[0]!.deep}
            strokeWidth="0.5"
            strokeDasharray="0.8 0.6"
          />
          {[
            { to: 1, y: 33, at: 900 },
            { to: 3, y: 35.2, at: 1300 },
            { to: 4, y: 37.4, at: 1700 },
          ].map((s) => (
            <rect
              key={s.to}
              className="pv-grow-x"
              x="6"
              y={s.y - 0.35}
              width={colX(s.to) + 1 - 6}
              height="0.7"
              rx="0.35"
              fill={PHASES[s.to]!.deep}
              style={pv({ '--pv-at': `${s.at}ms` })}
            />
          ))}
          {/* Five whys chained down to the root cause. */}
          {[40.5, 42.2, 43.9].map((y) => (
            <rect
              key={y}
              x="5"
              y={y}
              width="20"
              height="1.3"
              rx="0.4"
              fill="white"
              stroke="rgb(203 213 225)"
              strokeWidth="0.3"
            />
          ))}
          <rect
            className="pv-pulse"
            x="5"
            y="45.6"
            width="20"
            height="2.4"
            rx="0.5"
            fill="rgb(255 241 242)"
            stroke="rgb(225 29 72)"
            strokeWidth="0.6"
            style={pv({ '--pv-at': '2300ms' })}
          />
          {/* What we learned, then the actions table. */}
          {[
            { x: 28, fill: 'rgb(255 247 237)', note: 'rgb(254 215 170)', line: 'rgb(253 186 116)' },
            { x: 44, fill: 'rgb(240 253 244)', note: 'rgb(187 247 208)', line: 'rgb(134 239 172)' },
            { x: 60, fill: 'rgb(250 245 255)', note: 'rgb(233 213 255)', line: 'rgb(216 180 254)' },
          ].map((c) => (
            <g key={c.x}>
              <rect
                x={c.x}
                y="40.5"
                width="15"
                height="4.2"
                rx="0.6"
                fill={c.fill}
                stroke={c.line}
                strokeWidth="0.4"
              />
              <rect x={c.x + 1} y="41.6" width="6" height="2.2" rx="0.3" fill={c.note} />
              <rect x={c.x + 8} y="41.6" width="6" height="2.2" rx="0.3" fill={c.note} />
            </g>
          ))}
          <rect
            x="28"
            y="45.6"
            width="47"
            height="2.4"
            rx="0.4"
            fill="white"
            stroke="rgb(203 213 225)"
            strokeWidth="0.3"
          />
          <rect x="28" y="45.6" width="3" height="2.4" fill="rgb(254 226 226)" />
          <rect x="33" y="46.5" width="20" height="0.6" rx="0.3" fill={MUTED} />
          <rect x="68" y="46.5" width="5" height="0.6" rx="0.3" fill="rgb(3 105 161)" />
        </svg>
      );
    case 'risk-matrix':
      // A 5 x 5 heatmap shading green through amber to red with its axis
      // steps and band legend, six numbered markers, and the risk register
      // beside it with each score chip in its band's colour. Hover story:
      // R1's mitigation draws its dashed path and the marker slides down to
      // its residual cell.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <rect x="4" y="2" width="26" height="2.2" rx="0.5" fill={INK} />
          {[5, 4, 3, 2, 1].map((l) =>
            [1, 2, 3, 4, 5].map((i) => (
              <rect
                key={`${l}-${i}`}
                x={cellX(i)}
                y={cellY(l)}
                width={CELL}
                height={CELL}
                rx="0.5"
                fill={SCORE_FILL[l * i]}
              />
            )),
          )}
          {/* Axis steps down the side and along the bottom. */}
          {[1, 2, 3, 4, 5].map((n) => (
            <g key={n}>
              <rect x="3.5" y={cellY(n) + 2.4} width="3.4" height="1" rx="0.4" fill={MUTED} />
              <rect x={cellX(n) + 1.2} y="38.6" width="3.4" height="1" rx="0.4" fill={MUTED} />
            </g>
          ))}
          {/* Band legend. */}
          {['rgb(187 247 208)', 'rgb(253 230 138)', 'rgb(253 186 116)', 'rgb(248 113 113)'].map(
            (fill, i) => (
              <rect
                key={fill}
                x={8 + i * 7.9}
                y="42"
                width="7.1"
                height="2.6"
                rx="1.3"
                fill={fill}
              />
            ),
          )}
          {/* The residual move, then the markers. */}
          <circle
            cx={cellX(4) + CELL / 2}
            cy={cellY(2) + CELL / 2}
            r="1.8"
            fill="white"
            stroke={INK}
            strokeWidth="0.4"
            strokeDasharray="0.7 0.5"
          />
          <path
            className="pv-draw"
            pathLength="1"
            d="M34.6 15.2 Q30 17 30.1 25.8"
            fill="none"
            stroke={INK}
            strokeWidth="0.5"
            strokeDasharray="1.2 0.9"
            style={pv({ '--pv-at': '900ms', '--pv-dur': '700ms' })}
          />
          {[
            { l: 5, i: 3 },
            { l: 4, i: 4 },
            { l: 3, i: 3 },
            { l: 3, i: 2 },
            { l: 2, i: 5 },
          ].map((m) => (
            <circle
              key={`${m.l}-${m.i}`}
              cx={cellX(m.i) + CELL / 2}
              cy={cellY(m.l) + CELL / 2}
              r="1.8"
              fill={INK}
              stroke="white"
              strokeWidth="0.4"
            />
          ))}
          <circle
            className="pv-shift"
            cx={cellX(5) + CELL / 2}
            cy={cellY(4) + CELL / 2}
            r="1.8"
            fill={INK}
            stroke="white"
            strokeWidth="0.4"
            style={pv({
              '--pv-at': '1700ms',
              '--pv-dx': `${-PITCH}px`,
              '--pv-dy': `${2 * PITCH}px`,
            })}
          />
          {/* The register: header, then six rows led by their score chip. */}
          <rect x="44" y="6" width="32" height="3" rx="0.4" fill="rgb(226 232 240)" />
          {[
            'rgb(248 113 113)',
            'rgb(253 186 116)',
            'rgb(253 186 116)',
            'rgb(253 186 116)',
            'rgb(253 230 138)',
            'rgb(253 230 138)',
          ].map((fill, r) => (
            <g key={r}>
              <rect
                x="44"
                y={9 + r * 4}
                width="32"
                height="4"
                fill="white"
                stroke="rgb(203 213 225)"
                strokeWidth="0.3"
              />
              <rect x="45" y={10.6 + r * 4} width="2.4" height="0.8" rx="0.3" fill={INK} />
              <rect x="49" y={10.6 + r * 4} width="10" height="0.8" rx="0.3" fill={MUTED} />
              <rect x="60.5" y={9 + r * 4} width="5" height="4" fill={fill} />
              <rect x="67" y={10.6 + r * 4} width="7" height="0.8" rx="0.3" fill={MUTED} />
            </g>
          ))}
          <rect x="44" y="36" width="14" height="8.6" rx="0.4" fill="rgb(253 230 138)" />
          <rect
            x="60"
            y="36"
            width="16"
            height="8.6"
            rx="0.8"
            fill="none"
            stroke="rgb(125 211 252)"
            strokeWidth="0.4"
          />
          {[38, 40.2, 42.4].map((y) => (
            <rect key={y} x="61.5" y={y} width="1.4" height="1.4" rx="0.3" fill="rgb(2 132 199)" />
          ))}
        </svg>
      );
    default:
      return null;
  }
}
