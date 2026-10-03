import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';

// Group 9 (plan 0002 new templates): Crazy 8s and User persona. Static SVG
// preview tiles, one branch per TemplateKind; TemplatePreview chains the
// groups with ??. Each is a faithful miniature of its template with a hover
// story (preview-motion.css).

const INK = 'rgb(30 41 59)';
const CTA = 'rgb(249 115 22)';
const TAP = 'rgb(225 29 72)';
const FAINT = 'rgb(203 213 225)';
const SLATE = 'rgb(148 163 184)';

// The Crazy 8s sheet's panels: two rows of four.
const PANELS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
  x: 25 + (i % 4) * 13.1,
  y: i < 4 ? 9 : 27.5,
}));
const PANEL_W = 11.6;
const PANEL_H = 17;

// A pocket phone sketch in a panel: outline, a call-to-action bar and, when
// given, its tap marker.
function phoneSketch(x: number, y: number, tapped: boolean) {
  return (
    <>
      <rect
        x={x + 3.3}
        y={y + 3.4}
        width="5"
        height="10"
        rx="0.9"
        fill="white"
        stroke={INK}
        strokeWidth="0.5"
      />
      <rect x={x + 3.9} y={y + 5.2} width="3.8" height="0.6" rx="0.3" fill={FAINT} />
      <rect x={x + 3.9} y={y + 8.2} width="3.8" height="1.4" rx="0.7" fill={CTA} />
      {tapped && <circle cx={x + 8.1} cy={y + 8.9} r="0.75" fill={TAP} />}
    </>
  );
}

// A five-point star centred on (cx, cy), for the tech-comfort rating.
function star(cx: number, cy: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const d = i % 2 === 0 ? r : r * 0.45;
    return `${(cx + d * Math.cos(a)).toFixed(2)},${(cy + d * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

// Persona sections: tint, deep header ink, sticky paper.
const PERSONA_COLUMNS = [
  {
    x: 25,
    fill: 'rgb(220 252 231)',
    stroke: 'rgb(134 239 172)',
    deep: 'rgb(21 128 61)',
    note: 'rgb(187 247 208)',
  },
  {
    x: 42.8,
    fill: 'rgb(255 228 230)',
    stroke: 'rgb(253 164 175)',
    deep: 'rgb(190 18 60)',
    note: 'rgb(254 205 211)',
  },
  {
    x: 60.6,
    fill: 'rgb(219 234 254)',
    stroke: 'rgb(147 197 253)',
    deep: 'rgb(29 78 216)',
    note: 'rgb(186 230 253)',
  },
];

export function templatePreviewGroup9(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'crazy-eights':
      // A rail (the prompt card, timer + vote, four steps, done check) beside
      // a sheet folded into eight dashed panels: three sketched phones and a
      // watch, five waiting. Hover story: the clock starts, the empty panels
      // fill with a sketch a minute, then the vote dots land on the best two.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {/* Rail: the prompt card. */}
          <rect
            x="3"
            y="4"
            width="17"
            height="10"
            rx="1.2"
            fill="rgb(255 247 237)"
            stroke="rgb(253 186 116)"
            strokeWidth="0.6"
          />
          <rect x="5" y="5.8" width="7" height="1" rx="0.3" fill="rgb(194 65 12)" />
          <rect x="5" y="8.2" width="13" height="1.6" rx="0.4" fill="rgb(28 25 23)" />
          <rect x="5" y="10.8" width="9" height="1.6" rx="0.4" fill="rgb(28 25 23)" />
          {/* The timer (which starts the story) and the vote. */}
          <rect
            x="3"
            y="16"
            width="8"
            height="6"
            rx="1"
            fill="white"
            stroke={SLATE}
            strokeWidth="0.4"
            className="pv-pulse"
            style={pv({ '--pv-at': '700ms' })}
          />
          <rect x="4.6" y="18.4" width="4.8" height="1.2" rx="0.3" fill={INK} />
          <rect
            x="12"
            y="16"
            width="8"
            height="6"
            rx="1"
            fill="white"
            stroke={SLATE}
            strokeWidth="0.4"
          />
          <circle cx="16" cy="18.2" r="1.1" fill="none" stroke={INK} strokeWidth="0.4" />
          <rect x="13.8" y="20" width="4.4" height="0.7" rx="0.3" fill={SLATE} />
          {/* The four steps. */}
          {[25, 28, 31, 34].map((y) => (
            <g key={y}>
              <circle cx="4.2" cy={y} r="0.9" fill="rgb(3 105 161)" />
              <rect x="6.2" y={y - 0.5} width="11" height="1" rx="0.4" fill="rgb(100 116 139)" />
            </g>
          ))}
          {/* The done check. */}
          <rect
            x="3"
            y="37"
            width="17"
            height="9"
            rx="1"
            fill="rgb(240 249 255)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.5"
          />
          <circle
            cx="6.6"
            cy="40.6"
            r="1.8"
            fill="none"
            stroke="rgb(186 230 253)"
            strokeWidth="0.6"
          />
          <rect x="4.5" y="43.4" width="14" height="1.6" rx="0.8" fill="rgb(14 165 233)" />
          {/* The sheet of paper and whose it is. */}
          <rect
            x="23"
            y="4"
            width="54"
            height="42"
            rx="1"
            fill="rgb(255 253 248)"
            stroke="rgb(226 232 240)"
            strokeWidth="0.6"
          />
          <rect x="25" y="5.6" width="9" height="1.4" rx="0.5" fill={INK} />
          {PANELS.map((p, i) => (
            <g key={i}>
              <rect
                x={p.x}
                y={p.y}
                width={PANEL_W}
                height={PANEL_H}
                fill="none"
                stroke={SLATE}
                strokeWidth="0.35"
                strokeDasharray="1 0.7"
              />
              <circle cx={p.x + 1.6} cy={p.y + 1.6} r="0.9" fill={INK} />
              {i >= 3 && (
                <rect
                  x={p.x + 3}
                  y={p.y + 9}
                  width="5.6"
                  height="0.8"
                  rx="0.4"
                  fill={FAINT}
                  className="pv-leave"
                  style={pv({ '--pv-at': `${900 + (i - 3) * 300}ms` })}
                />
              )}
            </g>
          ))}
          {/* The three worked sketches: two phones and a watch. */}
          {phoneSketch(PANELS[0]!.x, PANELS[0]!.y, true)}
          {phoneSketch(PANELS[1]!.x, PANELS[1]!.y, true)}
          <rect
            x={PANELS[2]!.x + 4.2}
            y={PANELS[2]!.y + 3}
            width="3.2"
            height="2.4"
            fill="white"
            stroke={INK}
            strokeWidth="0.4"
          />
          <rect
            x={PANELS[2]!.x + 4.2}
            y={PANELS[2]!.y + 11}
            width="3.2"
            height="2.4"
            fill="white"
            stroke={INK}
            strokeWidth="0.4"
          />
          <rect
            x={PANELS[2]!.x + 2.8}
            y={PANELS[2]!.y + 5}
            width="6"
            height="6.4"
            rx="1.2"
            fill="white"
            stroke={INK}
            strokeWidth="0.5"
          />
          <circle cx={PANELS[2]!.x + 5.8} cy={PANELS[2]!.y + 8.2} r="1.7" fill={CTA} />
          <circle cx={PANELS[2]!.x + 7.9} cy={PANELS[2]!.y + 9.9} r="0.75" fill={TAP} />
          {PANELS.slice(0, 3).map((p) => (
            <rect
              key={p.x}
              x={p.x + 2.3}
              y={p.y + 14.8}
              width="7"
              height="0.8"
              rx="0.4"
              fill={INK}
            />
          ))}
          {/* Story: a sketch a minute fills the empty panels. */}
          {PANELS.slice(3).map((p, i) => (
            <g
              key={i}
              className="pv-new"
              opacity="0"
              style={pv({ '--pv-at': `${900 + i * 300}ms` })}
            >
              <rect
                x={p.x + 3.3}
                y={p.y + 3.4}
                width="5"
                height="10"
                rx="0.9"
                fill="white"
                stroke={INK}
                strokeWidth="0.5"
              />
              {i % 2 === 0 ? (
                <rect x={p.x + 3.9} y={p.y + 8.2} width="3.8" height="1.4" rx="0.7" fill={CTA} />
              ) : (
                <circle cx={p.x + 5.8} cy={p.y + 8.4} r="1.3" fill={CTA} />
              )}
              <rect x={p.x + 2.3} y={p.y + 14.8} width="7" height="0.8" rx="0.4" fill={INK} />
            </g>
          ))}
          {/* Story: the vote. Dots land on the two strongest sketches. */}
          {[
            { cx: PANELS[0]!.x + 10, cy: PANELS[0]!.y + 1.8, at: 2700, dx: -19, dy: 7 },
            { cx: PANELS[0]!.x + 8.4, cy: PANELS[0]!.y + 1.8, at: 2900, dx: -17.4, dy: 7 },
            { cx: PANELS[2]!.x + 10, cy: PANELS[2]!.y + 1.8, at: 3100, dx: -45, dy: 7 },
          ].map((d) => (
            <circle
              key={d.at}
              cx={d.cx}
              cy={d.cy}
              r="0.8"
              fill="rgb(3 105 161)"
              className="pv-arrive"
              opacity="0"
              style={pv({
                '--pv-from-x': `${d.dx}px`,
                '--pv-from-y': `${d.dy}px`,
                '--pv-at': `${d.at}ms`,
              })}
            />
          ))}
        </svg>
      );
    case 'user-persona':
      // A profile card (orange cover band, portrait, name, facts, three
      // numbers, a pull quote, tags) beside Goals / Frustrations / Behaviours
      // columns of notes, a Personality block of spectrum bars, Channels with
      // a star rating, and the teal How we help band. Hover story: her quote
      // is underlined, her spectrum bars slide to where she sits, the stars
      // light up and the needs are called out one by one.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {/* The profile card. */}
          <rect
            x="3"
            y="4"
            width="20"
            height="42"
            rx="1.5"
            fill="rgb(255 250 245)"
            stroke="rgb(254 215 170)"
            strokeWidth="0.8"
          />
          <rect x="4" y="5" width="18" height="7" rx="1" fill="rgb(234 88 12)" />
          <rect
            x="5.5"
            y="8.6"
            width="6"
            height="6"
            rx="1.2"
            fill="white"
            stroke="rgb(226 232 240)"
            strokeWidth="0.3"
          />
          <circle cx="8.5" cy="11.8" r="1.8" fill="rgb(251 191 36)" />
          <rect x="5.5" y="16.6" width="11" height="1.8" rx="0.4" fill="rgb(28 25 23)" />
          <rect x="5.5" y="19.2" width="9" height="1.1" rx="0.4" fill="rgb(194 65 12)" />
          {[22.2, 24.2, 26.2].map((y) => (
            <g key={y}>
              <circle cx="6" cy={y + 0.4} r="0.5" fill="rgb(194 65 12)" />
              <rect x="7.3" y={y} width="10" height="0.8" rx="0.3" fill="rgb(120 113 108)" />
            </g>
          ))}
          {[5.5, 10.9, 16.3].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="28.6"
                width="4.6"
                height="3.8"
                rx="0.6"
                fill="white"
                stroke="rgb(234 88 12)"
                strokeWidth="0.35"
              />
              <rect x={x + 1.1} y="29.5" width="2.4" height="1.1" rx="0.3" fill="rgb(234 88 12)" />
            </g>
          ))}
          <rect
            x="5.5"
            y="34.2"
            width="0.6"
            height="5.4"
            fill="rgb(234 88 12)"
            className="pv-grow-y"
            style={pv({ '--pv-at': '700ms' })}
          />
          <rect x="7.3" y="34.4" width="13" height="1.1" rx="0.4" fill="rgb(41 37 36)" />
          <rect x="7.3" y="36.4" width="12" height="1.1" rx="0.4" fill="rgb(41 37 36)" />
          <rect x="7.3" y="38.4" width="8" height="1.1" rx="0.4" fill="rgb(41 37 36)" />
          {[5.5, 10.4, 15.3].map((x) => (
            <rect
              key={x}
              x={x}
              y="41"
              width="4.4"
              height="1.6"
              rx="0.8"
              fill="rgb(255 237 213)"
              stroke="rgb(253 186 116)"
              strokeWidth="0.3"
            />
          ))}
          <rect x="5.5" y="44" width="10" height="0.7" rx="0.3" fill="rgb(148 163 184)" />
          {/* Goals / Frustrations / Behaviours, notes in each hue. */}
          {PERSONA_COLUMNS.map((c) => (
            <g key={c.x}>
              <rect
                x={c.x}
                y="4"
                width="16.4"
                height="18"
                rx="1"
                fill={c.fill}
                stroke={c.stroke}
                strokeWidth="0.5"
              />
              <rect x={c.x + 1.5} y="5.5" width="7" height="1.5" rx="0.4" fill={c.deep} />
              {[8.6, 12.8, 17].map((y) => (
                <rect
                  key={y}
                  x={c.x + 1.5}
                  y={y}
                  width="13.4"
                  height="3.4"
                  rx="0.3"
                  fill={c.note}
                />
              ))}
            </g>
          ))}
          {/* Personality: four spectrums, each bar filled towards her pole. */}
          <rect
            x="25"
            y="23.6"
            width="34.2"
            height="10.2"
            rx="1"
            fill="rgb(245 243 255)"
            stroke="rgb(196 181 253)"
            strokeWidth="0.5"
          />
          <rect x="26.5" y="25" width="9" height="1.5" rx="0.4" fill="rgb(109 40 217)" />
          {[
            { x: 26.5, y: 28, v: 0.72 },
            { x: 42.9, y: 28, v: 0.3 },
            { x: 26.5, y: 31, v: 0.2 },
            { x: 42.9, y: 31, v: 0.64 },
          ].map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={b.y} width="14.8" height="1.6" rx="0.8" fill="rgb(221 214 254)" />
              <rect
                x={b.x}
                y={b.y}
                width={14.8 * b.v}
                height="1.6"
                rx="0.8"
                fill="rgb(139 92 246)"
                className="pv-grow-x"
                style={pv({ '--pv-at': `${1500 + i * 150}ms` })}
              />
            </g>
          ))}
          {/* Channels and the tech-comfort stars. */}
          <rect
            x="60.6"
            y="23.6"
            width="16.4"
            height="10.2"
            rx="1"
            fill="rgb(255 251 235)"
            stroke="rgb(252 211 77)"
            strokeWidth="0.5"
          />
          <rect x="62.1" y="25" width="7" height="1.5" rx="0.4" fill="rgb(180 83 9)" />
          {[27.6, 29.4].map((y) => (
            <g key={y}>
              <circle cx="62.6" cy={y + 0.35} r="0.45" fill="rgb(180 83 9)" />
              <rect x="63.6" y={y} width="10" height="0.7" rx="0.3" fill="rgb(69 26 3)" />
            </g>
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <polygon
              key={i}
              points={star(63 + i * 2.6, 31.9, 1)}
              fill={i < 4 ? 'rgb(245 158 11)' : 'rgb(253 230 138)'}
              className={i < 4 ? 'pv-pulse' : undefined}
              style={i < 4 ? pv({ '--pv-at': `${2200 + i * 150}ms` }) : undefined}
            />
          ))}
          {/* How we help: the teal band of needs. */}
          <rect x="25" y="35.4" width="52" height="10.6" rx="1" fill="rgb(19 78 74)" />
          <rect x="26.5" y="37" width="10" height="1.5" rx="0.4" fill="white" />
          {[26.5, 43.8, 61.1].map((x, i) => (
            <g key={x}>
              <circle
                cx={x + 0.9}
                cy="41.3"
                r="0.9"
                fill="rgb(94 234 212)"
                className="pv-pulse"
                style={pv({ '--pv-at': `${3000 + i * 250}ms` })}
              />
              <rect x={x + 2.4} y="40.6" width="9" height="1.3" rx="0.4" fill="white" />
              <rect x={x + 2.4} y="43" width="12" height="0.8" rx="0.3" fill="rgb(204 251 241)" />
            </g>
          ))}
        </svg>
      );
    default:
      return null;
  }
}
