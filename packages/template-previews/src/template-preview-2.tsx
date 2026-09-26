import type { ReactElement, SVGProps } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';

// Group 2 of 3 (agile / hierarchy / wireframes). Static SVG preview tiles (one branch per
// TemplateKind; see template-preview.tsx for who renders them). Split out of template-preview.tsx to keep each file under the
// ~1000-line budget; TemplatePreview chains the groups with ??.
export function templatePreviewGroup2(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'kanban':
      // Hover story: work moves right. A card leaves In progress for Done,
      // a To do card follows it into In progress, and new work lands in To
      // do. At rest Done is one card short, the gap the first card fills.
      // The moving cards are drawn after every column so they pass OVER the
      // column backgrounds rather than under them.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {/* Three columns: To do (slate), In progress (blue), Done (green). */}
          {[
            { x: 4, fill: 'rgb(241 245 249)', stroke: 'rgb(203 213 225)', cards: [13, 23] },
            { x: 30, fill: 'rgb(219 234 254)', stroke: 'rgb(147 197 253)', cards: [13, 23] },
            { x: 56, fill: 'rgb(220 252 231)', stroke: 'rgb(134 239 172)', cards: [13, 23] },
          ].map((col) => (
            <g key={col.x}>
              <rect
                x={col.x}
                y="3"
                width="20"
                height="44"
                rx="2"
                fill={col.fill}
                stroke={col.stroke}
                strokeWidth="0.75"
              />
              {col.cards.map((sy) => (
                <KanbanCard key={sy} x={col.x + 2} y={sy} />
              ))}
            </g>
          ))}
          <KanbanCard
            x={32}
            y={33}
            className="pv-shift"
            style={pv({ '--pv-dx': '26px', '--pv-at': '1000ms' })}
          />
          <KanbanCard
            x={6}
            y={33}
            className="pv-shift"
            style={pv({ '--pv-dx': '26px', '--pv-at': '1600ms' })}
          />
          <KanbanCard
            x={6}
            y={33}
            className="pv-new"
            opacity="0"
            style={pv({ '--pv-at': '2200ms' })}
          />
        </svg>
      );
    case 'swot':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {[
            { x: 4, y: 3, fill: 'rgb(220 252 231)', stroke: 'rgb(134 239 172)' },
            { x: 42, y: 3, fill: 'rgb(254 226 226)', stroke: 'rgb(252 165 165)' },
            { x: 4, y: 25, fill: 'rgb(219 234 254)', stroke: 'rgb(147 197 253)' },
            { x: 42, y: 25, fill: 'rgb(254 243 199)', stroke: 'rgb(252 211 77)' },
          ].map((q, i) => (
            <rect
              key={i}
              x={q.x}
              y={q.y}
              width="34"
              height="22"
              rx="2"
              fill={q.fill}
              stroke={q.stroke}
              strokeWidth="0.75"
            />
          ))}
          {/* Hover story: notes are sorted out of the middle into each
              quadrant, strengths filling up first. */}
          {[
            { x: 10, y: 8, at: 900 },
            { x: 48, y: 8, at: 1200 },
            { x: 10, y: 30, at: 1500 },
            { x: 48, y: 30, at: 1800 },
            { x: 22, y: 15, at: 2200 },
          ].map((n) => (
            <rect
              key={`${n.x}-${n.y}`}
              className="pv-arrive"
              opacity="0"
              x={n.x}
              y={n.y}
              width="12"
              height="6"
              rx="0.75"
              fill="white"
              stroke="rgb(100 116 139)"
              strokeWidth="0.5"
              style={pv({
                '--pv-from-x': `${34 - n.x}px`,
                '--pv-from-y': `${22 - n.y}px`,
                '--pv-at': `${n.at}ms`,
              })}
            />
          ))}
        </svg>
      );
    case 'timeline':
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          <line x1="6" y1="25" x2="74" y2="25" stroke="rgb(100 116 139)" strokeWidth="1.5" />
          {[14, 28, 42, 56, 70].map((mx, i) => (
            <g key={mx}>
              {/* Hover story: each event pulses as the "now" marker below
                  sweeps past it. */}
              <circle
                cx={mx}
                cy="25"
                r="3"
                fill="rgb(186 230 253)"
                stroke="rgb(14 165 233)"
                strokeWidth="1"
                className="pv-pulse"
                style={pv({ '--pv-at': `${900 + Math.round(((mx - 6) / 68) * 2000)}ms` })}
              />
              <rect
                x={mx - 6}
                y={i % 2 === 0 ? 9 : 36}
                width="12"
                height="6"
                rx="0.5"
                fill="white"
                stroke="rgb(148 163 184)"
                strokeWidth="0.5"
              />
              <line
                x1={mx}
                y1={i % 2 === 0 ? 15 : 31}
                x2={mx}
                y2={i % 2 === 0 ? 22 : 36}
                stroke="rgb(148 163 184)"
                strokeWidth="0.5"
              />
            </g>
          ))}
          {/* The "now" marker, sweeping left to right along the spine. */}
          <rect
            className="pv-travel"
            opacity="0"
            x="5"
            y="19"
            width="2"
            height="12"
            rx="1"
            fill="rgb(239 68 68)"
            style={pv({ '--pv-dx': '68px', '--pv-dur': '2400ms', '--pv-at': '900ms' })}
          />
        </svg>
      );
    case 'milestone-timeline':
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          {/* Directional spine with an arrowhead: time flows right. */}
          <line x1="4" y1="27" x2="72" y2="27" stroke="rgb(100 116 139)" strokeWidth="1.5" />
          <path
            d="M72 27 L69 24.8 M72 27 L69 29.2"
            stroke="rgb(100 116 139)"
            strokeWidth="1.5"
            fill="none"
          />
          {/* Hover story: progress fills the spine up to the Launch
              milestone, which then lights up. Dashed to nothing at rest
              (strokeDasharray 0 1) so the static art shows no progress. */}
          <path
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            d="M4 27 H47"
            stroke="rgb(14 165 233)"
            strokeWidth="2.6"
            style={pv({ '--pv-at': '900ms', '--pv-dur': '1400ms' })}
          />
          {[13, 30, 47, 64].map((mx, i) => {
            const above = i % 2 === 0;
            // The third milestone is the hero (Launch) card → brand tint.
            const hero = i === 2;
            return (
              <g key={mx}>
                <line
                  x1={mx}
                  y1={above ? 13 : 33}
                  x2={mx}
                  y2={above ? 24 : 40}
                  stroke="rgb(148 163 184)"
                  strokeWidth="0.75"
                />
                {/* Date chip riding the stem. */}
                <rect
                  x={mx - 4}
                  y={above ? 16.5 : 31.5}
                  width="8"
                  height="4"
                  rx="2"
                  fill="rgb(226 232 240)"
                />
                <circle
                  cx={mx}
                  cy="27"
                  r="2.6"
                  fill="rgb(14 165 233)"
                  stroke="white"
                  strokeWidth="0.75"
                />
                {/* Milestone card at the end of the stem. */}
                <rect
                  x={mx - 9}
                  y={above ? 4 : 40}
                  width="18"
                  height="9"
                  rx="2"
                  fill={hero ? 'rgb(186 230 253)' : 'white'}
                  stroke={hero ? 'rgb(14 165 233)' : 'rgb(148 163 184)'}
                  strokeWidth="0.75"
                  className={hero ? 'pv-pulse' : undefined}
                  style={hero ? pv({ '--pv-at': '2300ms' }) : undefined}
                />
              </g>
            );
          })}
        </svg>
      );
    case 'milestone-timeline-vertical':
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          {/* Downward spine with an arrowhead: time flows down. */}
          <line x1="40" y1="4" x2="40" y2="45" stroke="rgb(100 116 139)" strokeWidth="1.5" />
          <path
            d="M40 45 L37.8 42 M40 45 L42.2 42"
            stroke="rgb(100 116 139)"
            strokeWidth="1.5"
            fill="none"
          />
          {/* Hover story: progress runs down the spine, each milestone dot
              pulsing as it's reached, then the Launch card lights up.
              Dashed to nothing at rest so the static art shows no progress. */}
          <path
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            d="M40 4 V30"
            stroke="rgb(14 165 233)"
            strokeWidth="2.6"
            style={pv({ '--pv-at': '900ms', '--pv-dur': '1500ms' })}
          />
          {[10, 20, 30, 40].map((my, i) => {
            const leftSide = i % 2 === 0;
            // The third milestone is the hero (Launch) card → brand tint.
            const hero = i === 2;
            return (
              <g key={my}>
                <line
                  x1={leftSide ? 24 : 44}
                  y1={my}
                  x2={leftSide ? 36 : 56}
                  y2={my}
                  stroke="rgb(148 163 184)"
                  strokeWidth="0.75"
                />
                {/* Date chip riding the stem. */}
                <rect
                  x={leftSide ? 29 : 43}
                  y={my - 2}
                  width="8"
                  height="4"
                  rx="2"
                  fill="rgb(226 232 240)"
                />
                <circle
                  cx="40"
                  cy={my}
                  r="2.6"
                  fill="rgb(14 165 233)"
                  stroke="white"
                  strokeWidth="0.75"
                  className={i < 3 ? 'pv-pulse' : undefined}
                  style={i < 3 ? pv({ '--pv-at': `${1000 + i * 520}ms` }) : undefined}
                />
                {/* Milestone card at the end of the stem. */}
                <rect
                  x={leftSide ? 6 : 56}
                  y={my - 4.5}
                  width="18"
                  height="9"
                  rx="2"
                  fill={hero ? 'rgb(186 230 253)' : 'white'}
                  stroke={hero ? 'rgb(14 165 233)' : 'rgb(148 163 184)'}
                  strokeWidth="0.75"
                  className={hero ? 'pv-pulse' : undefined}
                  style={hero ? pv({ '--pv-at': '2600ms' }) : undefined}
                />
              </g>
            );
          })}
        </svg>
      );
    case 'venn':
      return (
        <svg width="70" height="46" viewBox="0 0 70 50" aria-hidden>
          {/* Three semi-transparent outlined circles arranged in a triangle. */}
          {/* Hover story: the three sets pull apart, slide back into their
              overlap, and the shared middle lights up. */}
          <circle
            cx="35"
            cy="18"
            r="14"
            fill="rgb(186 230 253)"
            fillOpacity="0.45"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
            className="pv-route"
            style={pv({ '--pv-dy': '-3px', '--pv-at': '900ms', '--pv-dur': '1300ms' })}
          />
          <circle
            cx="24"
            cy="32"
            r="14"
            fill="rgb(254 226 226)"
            fillOpacity="0.45"
            stroke="rgb(248 113 113)"
            strokeWidth="1"
            className="pv-route"
            style={pv({
              '--pv-dx': '-8px',
              '--pv-dy': '3px',
              '--pv-at': '900ms',
              '--pv-dur': '1300ms',
            })}
          />
          <circle
            cx="46"
            cy="32"
            r="14"
            fill="rgb(220 252 231)"
            fillOpacity="0.45"
            stroke="rgb(74 222 128)"
            strokeWidth="1"
            className="pv-route"
            style={pv({
              '--pv-dx': '8px',
              '--pv-dy': '3px',
              '--pv-at': '900ms',
              '--pv-dur': '1300ms',
            })}
          />
          <circle
            className="pv-new"
            opacity="0"
            cx="35"
            cy="27"
            r="3"
            fill="rgb(250 204 21)"
            stroke="rgb(202 138 4)"
            strokeWidth="0.75"
            style={pv({ '--pv-at': '2300ms' })}
          />
        </svg>
      );
    case 'journey':
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          {/* Four stage boxes in a row with arrows between, sticky-note row below. */}
          {[6, 24, 42, 60].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="6"
                width="12"
                height="9"
                rx="1"
                fill="rgb(186 230 253)"
                stroke="rgb(14 165 233)"
                strokeWidth="0.75"
              />
              <rect
                x={x}
                y="28"
                width="12"
                height="10"
                rx="1"
                fill="rgb(254 243 199)"
                stroke="rgb(252 211 77)"
                strokeWidth="0.75"
              />
            </g>
          ))}
          {[18, 36, 54].map((mx) => (
            <line
              key={mx}
              x1={mx}
              y1="10"
              x2={mx + 6}
              y2="10"
              stroke="rgb(100 116 139)"
              strokeWidth="1"
              markerEnd=""
            />
          ))}
          {/* Hover story: the customer walks the stages left to right, and
              a mood dot lands on each stage's note as they pass: happy,
              unsure, frustrated, happy again. */}
          {[
            { x: 12, fill: 'rgb(74 222 128)', at: 1100 },
            { x: 30, fill: 'rgb(250 204 21)', at: 1650 },
            { x: 48, fill: 'rgb(248 113 113)', at: 2200 },
            { x: 66, fill: 'rgb(74 222 128)', at: 2750 },
          ].map((m) => (
            <circle
              key={m.x}
              className="pv-new"
              opacity="0"
              cx={m.x}
              cy="33"
              r="2.2"
              fill={m.fill}
              stroke="white"
              strokeWidth="0.5"
              style={pv({ '--pv-at': `${m.at}ms` })}
            />
          ))}
          <circle
            className="pv-travel"
            opacity="0"
            cx="12"
            cy="21.5"
            r="2.4"
            fill="rgb(14 165 233)"
            stroke="white"
            strokeWidth="0.6"
            style={pv({ '--pv-dx': '54px', '--pv-dur': '2600ms', '--pv-at': '900ms' })}
          />
        </svg>
      );
    case 'fishbone':
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          {/* Horizontal spine with effect box at the right. */}
          <line x1="6" y1="25" x2="62" y2="25" stroke="rgb(100 116 139)" strokeWidth="1.25" />
          <rect
            x="62"
            y="20"
            width="14"
            height="10"
            rx="1"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.75"
          />
          {/* Two upper and two lower diagonal branches. */}
          {[
            { x1: 16, y1: 6, x2: 28, y2: 25 },
            { x1: 36, y1: 6, x2: 48, y2: 25 },
            { x1: 16, y1: 44, x2: 28, y2: 25 },
            { x1: 36, y1: 44, x2: 48, y2: 25 },
          ].map((b, i) => (
            // Hover story: each cause bone grows in from its category to
            // the spine, one after another.
            <path
              key={i}
              d={`M${b.x1} ${b.y1} L${b.x2} ${b.y2}`}
              stroke="rgb(100 116 139)"
              strokeWidth="0.75"
              className="pv-draw"
              pathLength="1"
              style={pv({ '--pv-at': `${900 + i * 300}ms`, '--pv-dur': '500ms' })}
            />
          ))}
          {/* Small category labels at the ends of each branch. */}
          {[
            { x: 8, y: 4 },
            { x: 30, y: 4 },
            { x: 8, y: 42 },
            { x: 30, y: 42 },
          ].map((c, i) => (
            <rect
              key={i}
              x={c.x}
              y={c.y}
              width="12"
              height="5"
              rx="0.5"
              fill="white"
              stroke="rgb(148 163 184)"
              strokeWidth="0.5"
            />
          ))}
          {/* ...then sub-causes branch off the bones, and the effect they
              all feed lights up. */}
          {[
            { x1: 22, y1: 15.5, x2: 14, at: 2200 },
            { x1: 42, y1: 15.5, x2: 34, at: 2350 },
            { x1: 22, y1: 34.5, x2: 14, at: 2500 },
            { x1: 42, y1: 34.5, x2: 34, at: 2650 },
          ].map((t) => (
            <line
              key={`${t.x1}-${t.y1}`}
              className="pv-new"
              opacity="0"
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y1}
              stroke="rgb(14 165 233)"
              strokeWidth="0.75"
              style={pv({ '--pv-at': `${t.at}ms` })}
            />
          ))}
          <rect
            className="pv-new"
            opacity="0"
            x="62"
            y="20"
            width="14"
            height="10"
            rx="1"
            fill="rgb(125 211 252)"
            stroke="rgb(2 132 199)"
            strokeWidth="0.9"
            style={pv({ '--pv-at': '3000ms' })}
          />
        </svg>
      );
    case 'pyramid':
      return (
        <svg width="70" height="46" viewBox="0 0 70 50" aria-hidden>
          {/* Four tiers stacked; each row narrower than the one below to read as a pyramid. */}
          {[
            { x: 28, y: 6, w: 14, h: 9 },
            { x: 22, y: 16, w: 26, h: 9 },
            { x: 16, y: 26, w: 38, h: 9 },
            { x: 10, y: 36, w: 50, h: 9 },
          ].map((t, i) => (
            // Hover story: the tiers stack up from the foundation, each
            // rising from its base, and the peak crowns it last.
            <rect
              key={i}
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              rx="1"
              fill={i === 0 ? 'rgb(186 230 253)' : 'rgb(241 245 249)'}
              stroke="rgb(148 163 184)"
              strokeWidth="0.75"
              className="pv-grow-y"
              style={pv({ '--pv-at': `${300 + (3 - i) * 380}ms`, '--pv-dur': '420ms' })}
            />
          ))}
          <rect
            className="pv-new"
            opacity="0"
            x="28"
            y="6"
            width="14"
            height="9"
            rx="1"
            fill="rgb(125 211 252)"
            stroke="rgb(2 132 199)"
            strokeWidth="0.9"
            style={pv({ '--pv-at': '2100ms' })}
          />
        </svg>
      );
    case 'mobile-wireframe':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {/* Three phone silhouettes with stacked content rows. */}
          {[6, 30, 54].map((px) => (
            <g key={px}>
              <rect
                x={px}
                y="3"
                width="20"
                height="44"
                rx="2.5"
                fill="white"
                stroke="rgb(100 116 139)"
                strokeWidth="0.85"
              />
              {/* Notch / status strip */}
              <rect x={px + 2} y="5.5" width="16" height="1.5" rx="0.4" fill="rgb(186 230 253)" />
              {/* Header strip */}
              <rect
                x={px + 2}
                y="9"
                width="16"
                height="3"
                rx="0.5"
                fill="rgb(219 234 254)"
                stroke="rgb(147 197 253)"
                strokeWidth="0.4"
              />
              {/* Three content cards. Hover story: the middle screen scrolls
                  its feed, the top card leaving as the rest move up. */}
              {[15, 22, 29].map((cy, ci) => {
                const scrolls = px === 30;
                return (
                  <rect
                    key={cy}
                    x={px + 2}
                    y={cy}
                    width="16"
                    height="5"
                    rx="0.5"
                    fill="white"
                    stroke="rgb(148 163 184)"
                    strokeWidth="0.4"
                    className={scrolls ? (ci === 0 ? 'pv-leave' : 'pv-shift') : undefined}
                    style={
                      scrolls
                        ? pv(
                            ci === 0
                              ? { '--pv-at': '1000ms', '--pv-dur': '300ms' }
                              : { '--pv-dy': '-7px', '--pv-at': '1000ms', '--pv-dur': '500ms' },
                          )
                        : undefined
                    }
                  />
                );
              })}
              {/* Bottom tab bar */}
              <rect
                x={px + 2}
                y="40"
                width="16"
                height="4.5"
                rx="0.5"
                fill="rgb(241 245 249)"
                stroke="rgb(203 213 225)"
                strokeWidth="0.4"
              />
            </g>
          ))}
          {/* ...a fresh card scrolls in at the bottom of the feed, then a tap
              lands on the right screen's tab bar. */}
          <rect
            className="pv-arrive"
            opacity="0"
            x="32"
            y="29"
            width="16"
            height="5"
            rx="0.5"
            fill="rgb(224 242 254)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.5"
            style={pv({ '--pv-from-y': '7px', '--pv-at': '1300ms' })}
          />
          <circle
            className="pv-new"
            opacity="0"
            cx="64"
            cy="42.25"
            r="2"
            fill="rgb(14 165 233)"
            fillOpacity="0.6"
            stroke="rgb(2 132 199)"
            strokeWidth="0.5"
            style={pv({ '--pv-at': '2200ms' })}
          />
        </svg>
      );
    case 'laptop-wireframe':
      return (
        <svg width="80" height="44" viewBox="0 0 80 50" aria-hidden>
          {/* Laptop body trapezoid + screen with header / sidebar / content / cards. */}
          <polygon
            points="4,38 76,38 72,42 8,42"
            fill="rgb(226 232 240)"
            stroke="rgb(100 116 139)"
            strokeWidth="0.6"
          />
          <rect
            x="8"
            y="6"
            width="64"
            height="32"
            rx="1.5"
            fill="white"
            stroke="rgb(100 116 139)"
            strokeWidth="0.85"
          />
          {/* Header strip */}
          <rect
            x="10"
            y="8"
            width="60"
            height="4"
            rx="0.4"
            fill="rgb(219 234 254)"
            stroke="rgb(147 197 253)"
            strokeWidth="0.4"
          />
          <circle cx="67" cy="10" r="1.4" fill="rgb(186 230 253)" />
          {/* Sidebar */}
          <rect
            x="10"
            y="13"
            width="14"
            height="23"
            rx="0.4"
            fill="rgb(241 245 249)"
            stroke="rgb(203 213 225)"
            strokeWidth="0.4"
          />
          {[15, 19, 23, 27, 31].map((sy) => (
            <rect
              key={sy}
              x="11.5"
              y={sy}
              width="11"
              height="2.4"
              rx="0.3"
              fill="white"
              stroke="rgb(148 163 184)"
              strokeWidth="0.3"
            />
          ))}
          {/* Three stat cards */}
          {[25, 39, 53].map((cx) => (
            <rect
              key={cx}
              x={cx}
              y="15"
              width="13"
              height="8"
              rx="0.4"
              fill="white"
              stroke="rgb(148 163 184)"
              strokeWidth="0.4"
            />
          ))}
          {/* Wider content row */}
          <rect
            x="25"
            y="25"
            width="45"
            height="10"
            rx="0.4"
            fill="white"
            stroke="rgb(148 163 184)"
            strokeWidth="0.4"
          />
          {/* Hover story: the dashboard loads, a figure landing in each stat
              card, then the chart draws across the content row (dashed to
              nothing at rest so the static art is unchanged). */}
          {[25, 39, 53].map((cx, i) => (
            <rect
              key={cx}
              className="pv-new"
              opacity="0"
              x={cx + 2}
              y="18"
              width={[7, 9, 5][i]}
              height="2.4"
              rx="0.4"
              fill="rgb(14 165 233)"
              style={pv({ '--pv-at': `${900 + i * 250}ms` })}
            />
          ))}
          <path
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            d="M27 33 L34 29.5 L41 31 L48 27.5 L55 29 L62 26.5 L68 27.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
            strokeLinejoin="round"
            style={pv({ '--pv-at': '1800ms', '--pv-dur': '900ms' })}
          />
        </svg>
      );
    case 'slide-deck':
      return (
        <svg width="80" height="46" viewBox="0 0 80 50" aria-hidden>
          {/* 2x2 grid of plain rectangle slides, each with a title
              band + content bullets, joined by reading-order arrows. */}
          {[
            { x: 4, y: 3 },
            { x: 42, y: 3 },
            { x: 4, y: 26 },
            { x: 42, y: 26 },
          ].map((s, i) => (
            <g key={i}>
              <rect
                x={s.x}
                y={s.y}
                width="34"
                height="20"
                rx="1.25"
                fill="white"
                stroke="rgb(100 116 139)"
                strokeWidth="0.75"
              />
              {/* Heading stadium */}
              <rect
                x={s.x + 2.5}
                y={s.y + 2}
                width="29"
                height="4"
                rx="2"
                fill="rgb(186 230 253)"
                stroke="rgb(14 165 233)"
                strokeWidth="0.4"
              />
              {/* Slide-specific content */}
              {i === 0 ? (
                <>
                  <rect
                    x={s.x + 4}
                    y={s.y + 9}
                    width="22"
                    height="2.5"
                    rx="0.3"
                    fill="rgb(226 232 240)"
                  />
                  <rect
                    x={s.x + 4}
                    y={s.y + 16}
                    width="14"
                    height="2.5"
                    rx="1.2"
                    fill="rgb(186 230 253)"
                  />
                </>
              ) : i === 1 ? (
                [9, 12.5, 16].map((ry) => (
                  <g key={ry}>
                    <rect
                      x={s.x + 3}
                      y={s.y + ry}
                      width="3"
                      height="2.4"
                      rx="0.3"
                      fill="rgb(241 245 249)"
                      stroke="rgb(148 163 184)"
                      strokeWidth="0.3"
                    />
                    <rect
                      x={s.x + 7}
                      y={s.y + ry}
                      width="24"
                      height="2.4"
                      rx="0.3"
                      fill="white"
                      stroke="rgb(148 163 184)"
                      strokeWidth="0.3"
                    />
                  </g>
                ))
              ) : i === 2 ? (
                [4, 14, 24].map((rx) => (
                  <g key={rx}>
                    <rect
                      x={s.x + rx}
                      y={s.y + 9}
                      width="8"
                      height="9"
                      rx="0.5"
                      fill="white"
                      stroke="rgb(148 163 184)"
                      strokeWidth="0.3"
                    />
                    <circle cx={s.x + rx + 4} cy={s.y + 12} r="1.4" fill="rgb(186 230 253)" />
                  </g>
                ))
              ) : (
                [9, 12.5, 16].map((ry) => (
                  <g key={ry}>
                    <circle
                      cx={s.x + 4.5}
                      cy={s.y + ry + 1.2}
                      r="1"
                      fill="rgb(220 252 231)"
                      stroke="rgb(74 222 128)"
                      strokeWidth="0.3"
                    />
                    <rect
                      x={s.x + 7}
                      y={s.y + ry}
                      width="24"
                      height="2.4"
                      rx="1.2"
                      fill="white"
                      stroke="rgb(148 163 184)"
                      strokeWidth="0.3"
                    />
                  </g>
                ))
              )}
            </g>
          ))}
          {/* Connecting arrows showing the reading order 1 -> 2 -> 4 -> 3. */}
          <line x1="38" y1="13" x2="42" y2="13" stroke="rgb(100 116 139)" strokeWidth="0.7" />
          <polygon points="42,13 40.5,12 40.5,14" fill="rgb(100 116 139)" />
          <line x1="59" y1="23" x2="59" y2="26" stroke="rgb(100 116 139)" strokeWidth="0.7" />
          <polygon points="59,26 58,24.5 60,24.5" fill="rgb(100 116 139)" />
          <line x1="42" y1="36" x2="38" y2="36" stroke="rgb(100 116 139)" strokeWidth="0.7" />
          <polygon points="38,36 39.5,35 39.5,37" fill="rgb(100 116 139)" />
          {/* Hover story: presenting walks the deck in reading order
              (1, 2, 4, 3), each slide lighting up as it's shown. */}
          {[
            { x: 4, y: 3, at: 900 },
            { x: 42, y: 3, at: 1450 },
            { x: 42, y: 26, at: 2000 },
            { x: 4, y: 26, at: 2550 },
          ].map((s) => (
            <rect
              key={`${s.x}-${s.y}`}
              className="pv-new"
              opacity="0"
              x={s.x - 0.8}
              y={s.y - 0.8}
              width="35.6"
              height="21.6"
              rx="1.6"
              fill="rgb(14 165 233)"
              fillOpacity="0.12"
              stroke="rgb(14 165 233)"
              strokeWidth="1.3"
              style={pv({ '--pv-at': `${s.at}ms` })}
            />
          ))}
        </svg>
      );
    default:
      return null;
  }
}

// One kanban card (the kanban preview draws nine, three of them moving).
function KanbanCard({
  x,
  y,
  ...rest
}: { x: number; y: number } & Omit<SVGProps<SVGRectElement>, 'x' | 'y'>) {
  return (
    <rect
      x={x}
      y={y}
      width="16"
      height="7"
      rx="1"
      fill="white"
      stroke="rgb(148 163 184)"
      strokeWidth="0.5"
      {...rest}
    />
  );
}
