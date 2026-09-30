import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';
import { FILL_BOX, Pop, PopDot } from './story-parts';

// Group 10 (plan 0002 new templates): the Meeting agenda and the Objectives
// planner. Static SVG preview tiles, one branch per TemplateKind;
// TemplatePreview chains the groups with ??.

const SLATE = 'rgb(148 163 184)';
const INK = 'rgb(15 23 42)';

// A short grey text line.
function Line({ x, y, w, c = SLATE }: { x: number; y: number; w: number; c?: string }) {
  return (
    <path d={`M ${x} ${y} L ${x + w} ${y}`} stroke={c} strokeWidth="0.9" strokeLinecap="round" />
  );
}

// A phase band: the rounded bar under a phase's label.
function Band({ x, w, fill }: { x: number; w: number; fill: string }) {
  return <rect x={x} y="8" width={w} height="1.4" rx="0.7" fill={fill} />;
}

export function templatePreviewGroup10(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'meeting-agenda':
      // The weekly sync, Before / During / After under a phase band: the
      // purpose card, outcomes and the room with role chips; the live agenda;
      // the dashed parking bay of amber notes; two decision records; the
      // actions checklist over the rate-this-meeting gauge. Hover story: the
      // agenda moves on a segment, an off-topic note parks itself in the bay,
      // the first decision is accepted, an action is ticked and the room
      // rates the meeting.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <rect x="3" y="2.5" width="28" height="2.4" rx="0.6" fill={INK} />
          <circle
            cx="34"
            cy="3.7"
            r="1.8"
            fill="rgb(254 226 226)"
            stroke="rgb(239 68 68)"
            strokeWidth="0.5"
          />
          <Band x={3} w={12} fill="rgb(99 102 241)" />
          <Band x={18} w={43} fill="rgb(14 165 233)" />
          <Band x={64} w={13} fill="rgb(139 92 246)" />

          {/* BEFORE: purpose callout, outcomes, the room. */}
          <rect
            x="3"
            y="12"
            width="12"
            height="7"
            rx="1.2"
            fill="white"
            stroke="rgb(99 102 241)"
            strokeWidth="0.6"
          />
          <circle cx="5.2" cy="14.2" r="1" fill="rgb(99 102 241)" />
          <Line x={7} y={14.2} w={6} c={INK} />
          <Line x={5} y={16.8} w={8} />
          {[22, 24.6, 27.2].map((y) => (
            <g key={y}>
              <rect
                x="3.4"
                y={y - 0.8}
                width="1.6"
                height="1.6"
                rx="0.3"
                fill="white"
                stroke="rgb(14 165 233)"
                strokeWidth="0.4"
              />
              <Line x={6} y={y} w={7} />
            </g>
          ))}
          {[
            { y: 31.5, disc: 'rgb(79 70 229)', chip: 'rgb(224 231 255)' },
            { y: 35.5, disc: 'rgb(13 148 136)', chip: 'rgb(204 251 241)' },
            { y: 39.5, disc: 'rgb(217 119 6)', chip: 'rgb(254 243 199)' },
            { y: 43.5, disc: 'rgb(219 39 119)', chip: 'rgb(252 231 243)' },
          ].map((p) => (
            <g key={p.y}>
              <circle cx="4.4" cy={p.y} r="1.4" fill={p.disc} />
              <Line x={7} y={p.y} w={3} c={INK} />
              <rect x="11" y={p.y - 1} width="4.4" height="2" rx="1" fill={p.chip} />
            </g>
          ))}

          {/* DURING: the live agenda, one segment lit. */}
          <rect
            x="18"
            y="12"
            width="14"
            height="24"
            rx="1.6"
            fill="rgb(240 249 255)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.7"
          />
          <Line x={20} y={14.6} w={6} c="rgb(3 105 161)" />
          <path d="M 20.4 17 L 20.4 33" stroke="rgb(186 230 253)" strokeWidth="0.5" />
          <rect
            className="pv-shift"
            x="19.4"
            y="16.8"
            width="11.6"
            height="3.4"
            rx="1"
            fill="rgb(186 230 253)"
            style={pv({ '--pv-dy': '3.2px', '--pv-at': '900ms' })}
          />
          {[18.5, 21.7, 24.9, 28.1, 31.3].map((y, i) => (
            <g key={y}>
              <circle
                cx="20.4"
                cy={y}
                r="0.7"
                fill="white"
                stroke="rgb(14 165 233)"
                strokeWidth="0.4"
              />
              <Line x={22} y={y} w={i === 2 ? 6.5 : 5} c="rgb(3 105 161)" />
            </g>
          ))}
          {[38.5, 41, 43.5].map((y) => (
            <g key={y}>
              <path
                d={`M 18.3 ${y} L 19.3 ${y + 0.8} L 20.8 ${y - 0.8}`}
                fill="none"
                stroke="rgb(14 165 233)"
                strokeWidth="0.5"
              />
              <Line x={22} y={y} w={9} />
            </g>
          ))}

          {/* The parking bay, and the note that parks itself there. */}
          <rect
            x="34.5"
            y="12"
            width="11"
            height="35"
            rx="1.6"
            fill="rgb(254 243 199)"
            opacity="0.5"
          />
          <rect
            x="34.5"
            y="12"
            width="11"
            height="35"
            rx="1.6"
            fill="none"
            stroke="rgb(245 158 11)"
            strokeWidth="0.6"
            strokeDasharray="1.4 0.9"
          />
          {[13.5, 21.5, 29.5].map((y) => (
            <rect key={y} x="36" y={y} width="8" height="6.5" rx="0.4" fill="rgb(253 230 138)" />
          ))}
          <rect
            className="pv-arrive"
            opacity="0"
            x="36"
            y="37.5"
            width="8"
            height="6.5"
            rx="0.4"
            fill="rgb(253 230 138)"
            style={pv({ '--pv-from-x': '-15px', '--pv-from-y': '-14px', '--pv-at': '1400ms' })}
          />

          {/* Decisions: the first is accepted as the room watches. */}
          {[12, 30].map((y) => (
            <g key={y}>
              <rect
                x="48"
                y={y}
                width="13.5"
                height="16"
                rx="1.6"
                fill="rgb(240 249 255)"
                stroke="rgb(14 165 233)"
                strokeWidth="0.6"
              />
              <Line x={50} y={y + 3} w={6} c={INK} />
              <Line x={50} y={y + 5} w={5} c={INK} />
              <Line x={50} y={y + 8.5} w={8} />
              <Line x={50} y={y + 10.5} w={7} />
            </g>
          ))}
          <rect x="56.8" y="12.9" width="3.8" height="1.8" rx="0.9" fill="rgb(226 232 240)" />
          <rect x="56.8" y="30.9" width="3.8" height="1.8" rx="0.9" fill="rgb(226 232 240)" />
          <Pop
            at={1900}
            x="56.8"
            y="12.9"
            width="3.8"
            height="1.8"
            rx="0.9"
            fill="rgb(34 197 94)"
          />

          {/* AFTER: actions (one ticked), the gauge rising, the next sync. */}
          <rect
            x="64"
            y="12"
            width="13"
            height="10"
            rx="1.2"
            fill="rgb(240 249 255)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.6"
          />
          {[14.6, 17, 19.4].map((y) => (
            <g key={y}>
              <rect
                x="65.4"
                y={y - 0.7}
                width="1.4"
                height="1.4"
                rx="0.3"
                fill="white"
                stroke="rgb(14 165 233)"
                strokeWidth="0.4"
              />
              <Line x={67.8} y={y} w={7} />
            </g>
          ))}
          <Pop
            at={2300}
            x="65.4"
            y="13.9"
            width="1.4"
            height="1.4"
            rx="0.3"
            fill="rgb(14 165 233)"
          />
          <rect
            x="64"
            y="24"
            width="13"
            height="16"
            rx="1.6"
            fill="rgb(240 249 255)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.6"
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect
              key={i}
              x={65.3 + i * 2.35}
              y="27"
              width="1.7"
              height="11"
              rx="0.8"
              fill="rgb(224 242 254)"
            />
          ))}
          {[3, 5, 8, 6].map((h, i) => (
            <rect
              key={i}
              className="pv-grow-y"
              x={65.3 + (i + 1) * 2.35}
              y={38 - h}
              width="1.7"
              height={h}
              rx="0.8"
              fill="rgb(14 165 233)"
              style={pv({ '--pv-at': `${2600 + i * 120}ms` })}
            />
          ))}
          <rect
            x="64"
            y="42"
            width="13"
            height="5"
            rx="1.2"
            fill="white"
            stroke="rgb(139 92 246)"
            strokeWidth="0.6"
          />
          <circle cx="66" cy="44.5" r="0.9" fill="rgb(139 92 246)" />
          <Line x={68} y={44.5} w={7} />
        </svg>
      );
    case 'objectives-planner':
      // Alex's half, left to right: the focus card over strength and growth
      // notes; the formula as four coloured chips over the dashed rewrite and
      // the SMART checklist; three objective cards, each bordered in its life
      // area's hue, the sentence in the formula's four colours over two key
      // result bars, steps and stars; the check-in rhythm along the foot.
      // Hover story: a draft is tested (the SMART boxes tick), the key
      // results move, a confidence star lights, and today slides up to the
      // mid-point review.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <rect x="3" y="2.5" width="24" height="2.4" rx="0.6" fill={INK} />
          <circle
            cx="30"
            cy="3.7"
            r="1.8"
            fill="rgb(254 249 195)"
            stroke="rgb(234 179 8)"
            strokeWidth="0.5"
          />
          <Band x={3} w={11} fill="rgb(225 29 72)" />
          <Band x={17} w={15} fill="rgb(79 70 229)" />
          <Band x={35} w={42} fill="rgb(2 132 199)" />

          {/* START WITH WHY: focus, strengths, areas to grow. */}
          <rect
            x="3"
            y="12"
            width="11"
            height="7"
            rx="1.2"
            fill="white"
            stroke="rgb(225 29 72)"
            strokeWidth="0.6"
          />
          <circle cx="5" cy="14.2" r="0.9" fill="rgb(225 29 72)" />
          <Line x={6.8} y={14.2} w={6} c={INK} />
          <Line x={5} y={16.8} w={7.5} />
          {[3, 6.8, 10.6].map((x) => (
            <rect
              key={`s${x}`}
              x={x}
              y="21.5"
              width="3.4"
              height="5"
              rx="0.3"
              fill="rgb(187 247 208)"
            />
          ))}
          {[3, 6.8, 10.6].map((x) => (
            <rect
              key={`g${x}`}
              x={x}
              y="29"
              width="3.4"
              height="5"
              rx="0.3"
              fill="rgb(254 215 170)"
            />
          ))}
          <circle cx="4.2" cy="37.5" r="1.1" fill="rgb(2 132 199)" />
          <Line x={6.4} y={37.5} w={6} />

          {/* HOW TO WRITE ONE: the formula chips, the rewrite, the test. */}
          {[
            { y: 12.5, fill: 'rgb(224 231 255)', ink: 'rgb(99 102 241)' },
            { y: 15.5, fill: 'rgb(207 250 254)', ink: 'rgb(8 145 178)' },
            { y: 18.5, fill: 'rgb(209 250 229)', ink: 'rgb(5 150 105)' },
            { y: 21.5, fill: 'rgb(255 228 230)', ink: 'rgb(225 29 72)' },
          ].map((p) => (
            <g key={p.y}>
              <rect x="17" y={p.y - 1} width="5" height="2" rx="1" fill={p.fill} />
              <Line x={23.5} y={p.y} w={7.5} c={p.ink} />
            </g>
          ))}
          <rect
            x="17"
            y="24.5"
            width="15"
            height="7"
            rx="1.2"
            fill="none"
            stroke="rgb(165 180 252)"
            strokeWidth="0.5"
            strokeDasharray="1 0.7"
          />
          <Line x={18.5} y={26.6} w={6} />
          <path
            d="M 18.5 29.2 L 21.5 29.2"
            stroke="rgb(99 102 241)"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          <path
            d="M 22.3 29.2 L 25 29.2"
            stroke="rgb(8 145 178)"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          <path
            d="M 25.8 29.2 L 28.3 29.2"
            stroke="rgb(5 150 105)"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          <path
            d="M 29.1 29.2 L 30.6 29.2"
            stroke="rgb(225 29 72)"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          <rect
            x="17"
            y="33"
            width="15"
            height="7.5"
            rx="1.2"
            fill="rgb(240 249 255)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.5"
          />
          {[34.6, 36.6, 38.6].map((y, i) => (
            <g key={y}>
              <rect
                x="18.2"
                y={y - 0.6}
                width="1.2"
                height="1.2"
                rx="0.25"
                fill="white"
                stroke="rgb(14 165 233)"
                strokeWidth="0.35"
              />
              <Pop
                at={900 + i * 250}
                x="18.2"
                y={y - 0.6}
                width="1.2"
                height="1.2"
                rx="0.25"
                fill="rgb(14 165 233)"
              />
              <Line x={20.4} y={y} w={10} />
            </g>
          ))}

          {/* THREE OBJECTIVES, one card per life area. */}
          {[
            { x: 35, hue: 'rgb(245 158 11)', chip: 'rgb(254 243 199)', a: 60, b: 55, stars: 4 },
            { x: 49.3, hue: 'rgb(192 38 211)', chip: 'rgb(250 232 255)', a: 50, b: 40, stars: 3 },
            { x: 63.6, hue: 'rgb(101 163 13)', chip: 'rgb(236 252 203)', a: 42, b: 60, stars: 2 },
          ].map((c, ci) => (
            <g key={c.x}>
              <rect
                x={c.x}
                y="12"
                width="13.4"
                height="28"
                rx="1.6"
                fill="white"
                stroke={c.hue}
                strokeWidth="0.7"
              />
              <rect x={c.x + 1.3} y="13.4" width="4.8" height="1.9" rx="0.95" fill={c.chip} />
              <path
                d={`M ${c.x + 1.3} 17.6 L ${c.x + 6} 17.6`}
                stroke="rgb(99 102 241)"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
              <path
                d={`M ${c.x + 6.8} 17.6 L ${c.x + 11.6} 17.6`}
                stroke="rgb(8 145 178)"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
              <path
                d={`M ${c.x + 1.3} 19.4 L ${c.x + 7} 19.4`}
                stroke="rgb(5 150 105)"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
              <path
                d={`M ${c.x + 7.8} 19.4 L ${c.x + 11.6} 19.4`}
                stroke="rgb(225 29 72)"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
              {[c.a, c.b].map((p, i) => (
                <g key={i}>
                  <rect
                    x={c.x + 1.3}
                    y={23 + i * 3}
                    width="10.8"
                    height="1.6"
                    rx="0.8"
                    fill="rgb(226 232 240)"
                  />
                  <rect
                    className="pv-grow-x"
                    x={c.x + 1.3}
                    y={23 + i * 3}
                    width={(10.8 * p) / 100}
                    height="1.6"
                    rx="0.8"
                    fill={c.hue}
                    style={pv({ '--pv-at': `${1500 + ci * 150 + i * 80}ms` })}
                  />
                </g>
              ))}
              {[30.5, 32.5].map((y) => (
                <Line key={y} x={c.x + 1.3} y={y} w={8} />
              ))}
              {[0, 1, 2, 3, 4].map((s) => (
                <circle
                  key={s}
                  cx={c.x + 3 + s * 1.9}
                  cy="37"
                  r="0.7"
                  fill={s < c.stars ? 'rgb(245 158 11)' : 'rgb(226 232 240)'}
                />
              ))}
              {ci === 2 && (
                <PopDot at={2300} cx={c.x + 3 + 2 * 1.9} cy="37" r="0.7" fill="rgb(245 158 11)" />
              )}
            </g>
          ))}

          {/* CHECK IN: the rhythm along the foot, today moving up. */}
          <rect x="3" y="44" width="74" height="1.2" rx="0.6" fill="rgb(13 148 136)" />
          {[12.25, 30.75, 49.25, 67.75].map((x, i) => (
            <circle
              key={x}
              cx={x}
              cy="44.6"
              r={i === 2 ? 1.5 : 1.1}
              fill={i === 3 ? 'white' : 'rgb(13 148 136)'}
              stroke="rgb(13 148 136)"
              strokeWidth="0.5"
            />
          ))}
          <g
            className="pv-shift"
            style={{ ...pv({ '--pv-dx': '7.25px', '--pv-at': '2600ms' }), ...FILL_BOX }}
          >
            <rect
              x="38.5"
              y="40.8"
              width="7"
              height="2"
              rx="1"
              fill="rgb(204 251 241)"
              stroke="rgb(94 234 212)"
              strokeWidth="0.3"
            />
          </g>
        </svg>
      );
    default:
      return null;
  }
}
