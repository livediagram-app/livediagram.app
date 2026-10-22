import type { ReactElement } from 'react';
import type { TemplateKind } from '@liveplanner/templates';
import { pv } from './motion';

// Group 3 of 3 (strategy / design / technical). Static SVG preview tiles (one branch per
// TemplateKind; see template-preview.tsx for who renders them). Split out of template-preview.tsx to keep each file under the
// ~1000-line budget; TemplatePreview chains the groups with ??.
export function templatePreviewGroup3(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'flywheel':
      return (
        <svg width="70" height="46" viewBox="0 0 70 50" aria-hidden>
          {/* A bold hub inside four hue-tinted stage wheels, a clockwise loop
              of arcs, and the push / friction stickies in the corners. */}
          <rect x="3" y="4" width="11" height="6" rx="0.6" fill="rgb(187 247 208)" />
          <rect x="56" y="40" width="11" height="6" rx="0.6" fill="rgb(254 205 211)" />
          <circle
            cx="35"
            cy="25"
            r="7"
            fill="rgb(3 105 161)"
            stroke="rgb(12 74 110)"
            strokeWidth="1"
            className="pv-pulse"
            style={pv({ '--pv-at': '2700ms' })}
          />
          {/* Hover story: the wheel spins up, a full turn round the hub, and
              the hub swells as the momentum lands. */}
          <g
            className="pv-spin"
            style={pv({ '--pv-origin': '35px 25px', '--pv-at': '900ms', '--pv-dur': '1800ms' })}
          >
            {[
              { cx: 35, cy: 7, fill: 'rgb(219 234 254)' },
              { cx: 53, cy: 25, fill: 'rgb(220 252 231)' },
              { cx: 35, cy: 43, fill: 'rgb(254 243 199)' },
              { cx: 17, cy: 25, fill: 'rgb(237 233 254)' },
            ].map((s) => (
              <circle
                key={s.fill}
                cx={s.cx}
                cy={s.cy}
                r="5.5"
                fill={s.fill}
                stroke="rgb(14 165 233)"
                strokeWidth="0.8"
              />
            ))}
            {[
              'M 41 7.5 Q 51 9 52.5 19',
              'M 52.5 31 Q 51 41 41 42.5',
              'M 29 42.5 Q 19 41 17.5 31',
              'M 17.5 19 Q 19 9 29 7.5',
            ].map((d) => (
              <path
                key={d}
                d={d}
                fill="none"
                stroke="rgb(51 65 85)"
                strokeWidth="1.1"
                strokeDasharray="1.6 1.1"
                strokeLinecap="round"
              />
            ))}
            <polygon points="52.5,19.5 50.5,17 54.5,17" fill="rgb(51 65 85)" />
            <polygon points="40.5,42.5 43,40.5 43,44.5" fill="rgb(51 65 85)" />
            <polygon points="17.5,30.5 19.5,33 15.5,33" fill="rgb(51 65 85)" />
            <polygon points="29.5,7.5 27,9.5 27,5.5" fill="rgb(51 65 85)" />
          </g>
        </svg>
      );
    case 'gantt':
      // A week calendar over three workstreams (violet / blue / green group
      // rows with a thin summary bar), progress bars snapped to the weeks,
      // elbow dependencies, a dashed Today line and the launch diamond.
      // Hover story: each bar's done part fills in, one after another.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="2"
            y="3"
            width="76"
            height="45"
            rx="1.5"
            fill="white"
            stroke="rgb(203 213 225)"
            strokeWidth="0.5"
          />
          <rect x="2" y="3" width="76" height="6" rx="1.5" fill="rgb(241 245 249)" />
          {[
            { y: 10, band: 'rgb(245 243 255)', deep: 'rgb(109 40 217)', from: 0, to: 4 },
            { y: 22, band: 'rgb(239 246 255)', deep: 'rgb(29 78 216)', from: 4, to: 10 },
            { y: 34, band: 'rgb(236 253 245)', deep: 'rgb(4 120 87)', from: 8, to: 11 },
          ].map((g) => (
            <g key={g.y}>
              <rect x="2" y={g.y} width="76" height="4" fill={g.band} />
              <rect x="4" y={g.y + 1.2} width="8" height="1.6" rx="0.5" fill={g.deep} />
              <rect
                x={26 + g.from * 4.3}
                y={g.y + 1.5}
                width={(g.to - g.from) * 4.3 - 0.6}
                height="1"
                rx="0.5"
                fill={g.deep}
              />
            </g>
          ))}
          {[1, 2, 3, 5, 6, 7, 9, 10, 11].map((w) => (
            <path
              key={w}
              d={`M${26 + w * 4.3} 9 L${26 + w * 4.3} 47`}
              stroke="rgb(226 232 240)"
              strokeWidth="0.3"
            />
          ))}
          {[4, 8].map((w) => (
            <path
              key={w}
              d={`M${26 + w * 4.3} 3 L${26 + w * 4.3} 47`}
              stroke="rgb(203 213 225)"
              strokeWidth="0.4"
            />
          ))}
          <path d="M26 3 L26 47" stroke="rgb(203 213 225)" strokeWidth="0.4" />
          {[
            {
              y: 14.5,
              from: 0,
              to: 2,
              done: 1,
              track: 'rgb(237 233 254)',
              fill: 'rgb(196 181 253)',
            },
            {
              y: 18.5,
              from: 1,
              to: 4,
              done: 1,
              track: 'rgb(237 233 254)',
              fill: 'rgb(196 181 253)',
            },
            {
              y: 26.5,
              from: 4,
              to: 8,
              done: 0.5,
              track: 'rgb(219 234 254)',
              fill: 'rgb(147 197 253)',
            },
            {
              y: 30.5,
              from: 4,
              to: 10,
              done: 0.45,
              track: 'rgb(219 234 254)',
              fill: 'rgb(147 197 253)',
            },
            {
              y: 38.5,
              from: 8,
              to: 10,
              done: 0,
              track: 'rgb(209 250 229)',
              fill: 'rgb(110 231 183)',
            },
            {
              y: 42.5,
              from: 10,
              to: 11,
              done: 0,
              track: 'rgb(209 250 229)',
              fill: 'rgb(110 231 183)',
            },
          ].map((b, i) => {
            const x = 26.3 + b.from * 4.3;
            const w = (b.to - b.from) * 4.3 - 0.6;
            return (
              <g key={b.y}>
                <rect
                  x="6"
                  y={b.y + 0.7}
                  width="11"
                  height="1.4"
                  rx="0.5"
                  fill="rgb(148 163 184)"
                />
                <circle cx="21" cy={b.y + 1.4} r="1.1" fill="rgb(100 116 139)" />
                <rect x={x} y={b.y} width={w} height="2.8" rx="1.4" fill={b.track} />
                {b.done > 0 && (
                  <rect
                    x={x}
                    y={b.y}
                    width={w * b.done}
                    height="2.8"
                    rx="1.4"
                    fill={b.fill}
                    className="pv-grow-x"
                    style={pv({ '--pv-at': `${500 + i * 200}ms` })}
                  />
                )}
              </g>
            );
          })}
          {/* Finish-to-start elbows. */}
          <path
            d="M43.2 19.9 L44 19.9 L44 26.5 M60.4 27.9 L61 27.9 L61 38.5 M69 31.9 L69.6 31.9 L69.6 42.5"
            stroke="rgb(71 85 105)"
            strokeWidth="0.45"
            fill="none"
          />
          {/* Launch diamond. */}
          <path
            d="M75.2 44.4 L77 46.2 L75.2 48 L73.4 46.2 Z"
            fill="rgb(245 158 11)"
            stroke="rgb(180 83 9)"
            strokeWidth="0.4"
          />
          {/* Today. */}
          <path
            d="M54.3 1 L54.3 47"
            stroke="rgb(225 29 72)"
            strokeWidth="0.6"
            strokeDasharray="1.2 0.9"
          />
          <rect x="50.8" y="0.5" width="7" height="3" rx="1.5" fill="rgb(225 29 72)" />
        </svg>
      );
    case 'comparison-table':
      // Three plans side by side: the recommended column tinted amber under
      // its ribbon, ticks and crosses in the yes / no rows, and the reason
      // on a sticky beside it.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect x="35" y="3" width="13" height="4" rx="2" fill="rgb(245 158 11)" />
          <rect
            x="4"
            y="9"
            width="58"
            height="37"
            rx="1.5"
            fill="white"
            stroke="rgb(148 163 184)"
            strokeWidth="0.8"
          />
          <rect x="4" y="9" width="58" height="7" fill="rgb(226 232 240)" />
          <rect x="4" y="16" width="16" height="30" fill="rgb(241 245 249)" />
          <rect x="34.6" y="9" width="13.8" height="37" fill="rgb(254 243 199)" />
          <rect x="34.6" y="9" width="13.8" height="7" fill="rgb(253 230 138)" />
          {[16, 26, 36].map((y) => (
            <line
              key={y}
              x1="4"
              y1={y}
              x2="62"
              y2={y}
              stroke="rgb(203 213 225)"
              strokeWidth="0.5"
            />
          ))}
          {[20, 34.6, 48.4].map((x) => (
            <line
              key={x}
              x1={x}
              y1="9"
              x2={x}
              y2="46"
              stroke="rgb(203 213 225)"
              strokeWidth="0.5"
            />
          ))}
          <rect x="65" y="9" width="12" height="13" rx="0.6" fill="rgb(253 230 138)" />
          {/* Hover story: the options are scored cell by cell, row by row: a
              tick where an option has it, a cross where it doesn't. */}
          {(
            [
              [27.3, 21, false],
              [41.5, 21, true],
              [55.2, 21, true],
              [27.3, 31, false],
              [41.5, 31, false],
              [55.2, 31, true],
              [27.3, 41, true],
              [41.5, 41, true],
              [55.2, 41, true],
            ] as [number, number, boolean][]
          ).map(([cx, cy, yes], i) => (
            <path
              key={i}
              className="pv-new"
              opacity="0"
              d={
                yes
                  ? `M${cx - 2.5} ${cy} L${cx - 0.8} ${cy + 1.8} L${cx + 2.6} ${cy - 2}`
                  : `M${cx - 2} ${cy - 2} L${cx + 2} ${cy + 2} M${cx + 2} ${cy - 2} L${cx - 2} ${cy + 2}`
              }
              fill="none"
              stroke={yes ? 'rgb(22 163 74)' : 'rgb(148 163 184)'}
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={pv({ '--pv-at': `${900 + i * 170}ms` })}
            />
          ))}
        </svg>
      );
    case 'er-diagram':
      // Six tables in a plus around the orders hub, every relationship one
      // straight line with an open head on the many end; the status enum in
      // a dark code card top-right and a review sticky bottom-right.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {/* Hover story: the relationships draw in from the hub outwards,
              then a new column lands in the orders table. */}
          {[
            'M40 12 L40 17',
            'M24 24 L29 24',
            'M56 24 L51 24',
            'M40 32 L40 37',
            'M14 30 L14 37',
            'M24 43 L29 43',
          ].map((d, i) => (
            // A path, not a <line>: Chrome ignores pathLength on <line>, so the
            // draw-in would render as dashes.
            <path
              key={d}
              d={d}
              fill="none"
              stroke="rgb(100 116 139)"
              strokeWidth="0.8"
              pathLength="1"
              className="pv-draw"
              style={pv({ '--pv-at': `${900 + i * 220}ms`, '--pv-dur': '400ms' })}
            />
          ))}
          {[
            { x: 30, y: 2, h: 10 },
            { x: 4, y: 18, h: 12 },
            { x: 30, y: 17, h: 15, hub: true },
            { x: 56, y: 19, h: 10 },
            { x: 4, y: 37, h: 11 },
            { x: 30, y: 37, h: 11 },
          ].map((t) => (
            <g key={`${t.x}-${t.y}`}>
              <rect
                x={t.x}
                y={t.y}
                width="20"
                height={t.h}
                rx="1.2"
                fill={t.hub ? 'rgb(224 242 254)' : 'white'}
                stroke="rgb(14 165 233)"
                strokeWidth="0.8"
              />
              <line
                x1={t.x}
                y1={t.y + 3.5}
                x2={t.x + 20}
                y2={t.y + 3.5}
                stroke="rgb(186 230 253)"
                strokeWidth="0.6"
              />
              {Array.from({ length: Math.floor((t.h - 4) / 2.6) }, (_, r) => (
                <line
                  key={r}
                  x1={t.x + 2}
                  y1={t.y + 5.6 + r * 2.6}
                  x2={t.x + (r % 2 ? 9 : 12)}
                  y2={t.y + 5.6 + r * 2.6}
                  stroke="rgb(148 163 184)"
                  strokeWidth="0.7"
                />
              ))}
            </g>
          ))}
          {/* Many-end heads: open Vs on orders, order_items and menu_items. */}
          <path
            d="M38.6 15.2 L40 17 L41.4 15.2 M27.2 22.6 L29 24 L27.2 25.4 M52.8 22.6 L51 24 L52.8 25.4 M38.6 35.2 L40 37 L41.4 35.2 M12.6 35.2 L14 37 L15.4 35.2 M27.2 41.6 L29 43 L27.2 44.4"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.8"
          />
          {/* The enum code card and the review sticky. */}
          <rect x="56" y="2" width="21" height="12" rx="1.5" fill="rgb(15 23 42)" />
          {[5, 8, 11].map((y, i) => (
            <line
              key={y}
              x1="58.5"
              y1={y}
              x2={i === 1 ? 71 : 74}
              y2={y}
              stroke={i === 0 ? 'rgb(125 211 252)' : 'rgb(134 239 172)'}
              strokeWidth="0.8"
            />
          ))}
          <rect x="57" y="36" width="19" height="12" fill="rgb(254 240 138)" />
          <rect x="67" y="34" width="10" height="3.5" rx="1.2" fill="rgb(37 99 235)" />
          <rect
            className="pv-new"
            opacity="0"
            x="32"
            y="29.4"
            width="11"
            height="0.9"
            fill="rgb(14 165 233)"
            style={pv({ '--pv-at': '2400ms' })}
          />
        </svg>
      );
    case 'sequence-diagram':
      // A UML checkout: an actor and four boxed participants over dashed
      // lifelines, activation bars, calls, a self-call loop, and an alt
      // fragment split by a dashed divider.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[8, 24, 40, 56, 72].map((mx) => (
            <line
              key={mx}
              x1={mx}
              y1="10"
              x2={mx}
              y2="49"
              stroke="rgb(148 163 184)"
              strokeWidth="0.5"
              strokeDasharray="1.5 1.5"
            />
          ))}
          {/* The actor: head, body, arms, legs. */}
          <circle cx="8" cy="2.6" r="1.6" fill="none" stroke="rgb(100 116 139)" strokeWidth="0.7" />
          <path
            d="M8 4.2 L8 7.2 M6 5.4 L10 5.4 M8 7.2 L6.4 9.4 M8 7.2 L9.6 9.4"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.7"
          />
          {[24, 40, 56, 72].map((mx) => (
            <rect
              key={mx}
              x={mx - 6.5}
              y="2"
              width="13"
              height="7"
              rx="1.2"
              fill="white"
              stroke="rgb(14 165 233)"
              strokeWidth="0.75"
            />
          ))}
          {/* Activation bars. */}
          {[
            [24, 12, 36],
            [40, 16, 32],
            [56, 22, 7],
            [72, 36, 4],
          ].map(([x, y, h]) => (
            <rect
              key={`${x}-${y}`}
              x={x! - 1.2}
              y={y}
              width="2.4"
              height={h}
              fill="white"
              stroke="rgb(14 165 233)"
              strokeWidth="0.6"
            />
          ))}
          {/* The alt fragment and its operand divider. */}
          <rect
            x="3"
            y="33"
            width="74"
            height="16"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.6"
          />
          <path
            d="M3 36 L9 36 L10.5 34.5 L10.5 33"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.6"
          />
          <line
            x1="3"
            y1="42.5"
            x2="77"
            y2="42.5"
            stroke="rgb(14 165 233)"
            strokeWidth="0.5"
            strokeDasharray="1.5 1.5"
          />
          {/* Hover story: the calls cross the lifelines in order, the API
              loops back on itself, the payment replies, then inside the alt
              box the async event reaches the kitchen. */}
          {[
            { d: 'M8 13 L22.8 13', dash: false },
            { d: 'M25.2 17 L38.8 17', dash: false },
            { d: 'M41.2 20 L45 20 L45 23.5 L41.8 23.5', dash: false },
            { d: 'M41.2 26 L54.8 26', dash: false },
            { d: 'M54.8 28.5 L41.2 28.5', dash: true },
            { d: 'M41.2 38 L70.8 38', dash: false },
            { d: 'M38.8 46 L25.2 46', dash: true },
          ].map((m, i) => (
            <path
              key={m.d}
              d={m.d}
              fill="none"
              stroke="rgb(100 116 139)"
              strokeWidth="0.7"
              strokeDasharray={m.dash ? '1.4 1' : undefined}
              pathLength={m.dash ? undefined : '1'}
              className={m.dash ? undefined : 'pv-draw'}
              style={
                m.dash ? undefined : pv({ '--pv-at': `${900 + i * 280}ms`, '--pv-dur': '380ms' })
              }
            />
          ))}
          <circle
            className="pv-travel"
            opacity="0"
            cx="41.2"
            cy="38"
            r="1.2"
            fill="rgb(14 165 233)"
            style={pv({ '--pv-dx': '29px', '--pv-at': '2800ms', '--pv-dur': '1200ms' })}
          />
        </svg>
      );
    case 'prioritization-matrix':
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {/* Four named quadrants (Quick wins green top-left, Big bets blue,
              Fill-ins amber, Money pits rose) inside an impact / effort
              L-frame arrowed toward "more", matching the builder. */}
          {[
            {
              x: 12,
              y: 3,
              fill: 'rgb(220 252 231)',
              stroke: 'rgb(134 239 172)',
              ink: 'rgb(21 128 61)',
            },
            {
              x: 44,
              y: 3,
              fill: 'rgb(219 234 254)',
              stroke: 'rgb(147 197 253)',
              ink: 'rgb(29 78 216)',
            },
            {
              x: 12,
              y: 23.5,
              fill: 'rgb(254 243 199)',
              stroke: 'rgb(252 211 77)',
              ink: 'rgb(180 83 9)',
            },
            {
              x: 44,
              y: 23.5,
              fill: 'rgb(255 228 230)',
              stroke: 'rgb(253 164 175)',
              ink: 'rgb(190 18 60)',
            },
          ].map((q) => (
            <g key={`${q.x}-${q.y}`}>
              <rect
                x={q.x}
                y={q.y}
                width="31"
                height="19.5"
                rx="1.5"
                fill={q.fill}
                stroke={q.stroke}
                strokeWidth="0.75"
              />
              <rect x={q.x + 2} y={q.y + 2} width="10" height="1.8" rx="0.9" fill={q.ink} />
            </g>
          ))}
          <path
            d="M8 45 L8 4 M6 7 L8 4 L10 7"
            stroke="rgb(71 85 105)"
            strokeWidth="1.1"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 46.5 L76 46.5 M73 44.5 L76 46.5 L73 48.5"
            stroke="rgb(71 85 105)"
            strokeWidth="1.1"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Placed ideas: yellow notes. Hover story: the undecided idea on
              the divider is dragged into the Quick wins, and its dot-vote
              tally pops on its corner. */}
          {[
            [15, 9],
            [48, 9],
            [58, 15],
            [15, 30],
            [50, 33],
          ].map(([x, y]) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="11"
              height="6"
              rx="0.6"
              fill="rgb(253 230 138)"
            />
          ))}
          <rect
            x="37.5"
            y="18"
            width="11"
            height="6"
            rx="0.6"
            fill="rgb(253 230 138)"
            stroke="rgb(180 83 9)"
            strokeWidth="0.6"
            className="pv-shift"
            style={pv({
              '--pv-dx': '-8.5px',
              '--pv-dy': '-3px',
              '--pv-at': '900ms',
              '--pv-dur': '800ms',
            })}
          />
          <circle
            className="pv-new"
            opacity="0"
            cx="39.5"
            cy="15.5"
            r="2"
            fill="rgb(15 23 42)"
            style={pv({ '--pv-at': '1900ms' })}
          />
        </svg>
      );
    default:
      return null;
  }
}
