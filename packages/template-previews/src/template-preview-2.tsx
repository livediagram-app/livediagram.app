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
          {/* Forward-pointing spine with an arrowhead at the future end. */}
          <path
            d="M4 25 L74 25 M71 23 L74 25 L71 27"
            stroke="rgb(100 116 139)"
            strokeWidth="1.25"
            fill="none"
          />
          {/* Six milestones coloured by status: three done (green), one in
              progress (blue, larger), two up next (hollow). Label bars
              alternate above and below. */}
          {[
            { x: 9, fill: 'rgb(34 197 94)', stroke: 'rgb(21 128 61)', r: 2.6 },
            { x: 20, fill: 'rgb(34 197 94)', stroke: 'rgb(21 128 61)', r: 2.6 },
            { x: 31, fill: 'rgb(34 197 94)', stroke: 'rgb(21 128 61)', r: 2.6 },
            { x: 42, fill: 'rgb(59 130 246)', stroke: 'rgb(29 78 216)', r: 3.6 },
            { x: 57, fill: 'white', stroke: 'rgb(148 163 184)', r: 2.6 },
            { x: 68, fill: 'white', stroke: 'rgb(148 163 184)', r: 2.6 },
          ].map((m, i) => (
            <g key={m.x}>
              <rect
                x={m.x - 4.5}
                y={i % 2 === 0 ? 14 : 32}
                width="9"
                height="2.5"
                rx="0.6"
                fill="rgb(148 163 184)"
              />
              {/* Hover story: the finished milestones tick past in turn,
                  then the one in progress swells. */}
              <circle
                cx={m.x}
                cy="25"
                r={m.r}
                fill={m.fill}
                stroke={m.stroke}
                strokeWidth="0.8"
                className={i <= 3 ? 'pv-pulse' : undefined}
                style={i <= 3 ? pv({ '--pv-at': `${900 + i * 450}ms` }) : undefined}
              />
            </g>
          ))}
          {/* The Today marker: a dashed red line under its pill. */}
          <path
            d="M49.5 13 L49.5 38"
            stroke="rgb(225 29 72)"
            strokeWidth="0.8"
            strokeDasharray="1.5 1.2"
          />
          <rect x="45" y="8" width="9" height="4.5" rx="2.25" fill="rgb(225 29 72)" />
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
          {/* Three tinted, translucent circles (desirable / feasible / viable)
              whose overlaps blend, with the sweet-spot pill in the middle. */}
          {/* Hover story: the three sets pull apart, slide back into their
              overlap, and the sweet spot pulses. */}
          <circle
            cx="35"
            cy="18"
            r="14"
            fill="rgb(253 164 175)"
            fillOpacity="0.5"
            stroke="rgb(190 18 60)"
            strokeWidth="0.8"
            className="pv-route"
            style={pv({ '--pv-dy': '-3px', '--pv-at': '900ms', '--pv-dur': '1300ms' })}
          />
          <circle
            cx="24"
            cy="32"
            r="14"
            fill="rgb(147 197 253)"
            fillOpacity="0.5"
            stroke="rgb(29 78 216)"
            strokeWidth="0.8"
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
            fill="rgb(110 231 183)"
            fillOpacity="0.5"
            stroke="rgb(4 120 87)"
            strokeWidth="0.8"
            className="pv-route"
            style={pv({
              '--pv-dx': '8px',
              '--pv-dy': '3px',
              '--pv-at': '900ms',
              '--pv-dur': '1300ms',
            })}
          />
          <rect
            x="29"
            y="24.5"
            width="12"
            height="5"
            rx="2.5"
            fill="rgb(3 105 161)"
            className="pv-pulse"
            style={pv({ '--pv-at': '2300ms' })}
          />
        </svg>
      );
    case 'journey':
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          {/* A journey map: stage chips across the top, then five lens rows
              (doing, thinking, feeling, pains, ideas) behind a label gutter.
              Each lens row's stickies share a colour. */}
          {[16, 29, 42, 55, 68].map((x) => (
            <rect
              key={x}
              x={x}
              y="3"
              width="11"
              height="4"
              rx="2"
              fill="rgb(186 230 253)"
              stroke="rgb(14 165 233)"
              strokeWidth="0.5"
            />
          ))}
          {[
            { y: 9, h: 6, band: 'rgb(239 246 255)', note: 'rgb(191 219 254)' },
            { y: 16.5, h: 6, band: 'rgb(245 243 255)', note: 'rgb(221 214 254)' },
            { y: 24, h: 9, band: 'rgb(254 252 232)' },
            { y: 34.5, h: 6, band: 'rgb(255 241 242)', note: 'rgb(254 205 211)' },
            { y: 42, h: 6, band: 'rgb(240 253 244)', note: 'rgb(187 247 208)' },
          ].map((row) => (
            <g key={row.y}>
              <rect x="3" y={row.y} width="76" height={row.h} rx="1" fill={row.band} />
              <rect
                x="5"
                y={row.y + row.h / 2 - 0.8}
                width="7"
                height="1.6"
                rx="0.5"
                fill="rgb(100 116 139)"
              />
              {row.note &&
                [16, 29, 42, 55, 68].map((x) => (
                  <rect
                    key={x}
                    x={x + 0.5}
                    y={row.y + 0.8}
                    width="10"
                    height={row.h - 1.6}
                    fill={row.note}
                  />
                ))}
            </g>
          ))}
          {/* Hover story: the emotion curve draws itself through the
              stages (up, down into the painful booking, up to a regular),
              and a face lands on each stage. */}
          <path
            d="M21.5 27.5 L34.5 29 L47.5 31 L60.5 26.5 L73.5 25.5"
            stroke="rgb(245 158 11)"
            strokeWidth="1"
            fill="none"
            className="pv-draw"
            pathLength="1"
            style={pv({ '--pv-at': '900ms', '--pv-dur': '1400ms' })}
          />
          {[
            { x: 21.5, y: 27.5, at: 1000 },
            { x: 34.5, y: 29, at: 1300 },
            { x: 47.5, y: 31, at: 1600 },
            { x: 60.5, y: 26.5, at: 1900 },
            { x: 73.5, y: 25.5, at: 2200 },
          ].map((m) => (
            <circle
              key={m.x}
              className="pv-new"
              opacity="0"
              cx={m.x}
              cy={m.y}
              r="1.8"
              fill="rgb(250 204 21)"
              stroke="white"
              strokeWidth="0.5"
              style={pv({ '--pv-at': `${m.at}ms` })}
            />
          ))}
        </svg>
      );
    case 'fishbone':
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          {/* The fish: a tail, a spine and the problem as its head. */}
          <path
            d="M4 20 L8 25 L4 30 M8 25 L62 25"
            stroke="rgb(51 65 85)"
            strokeWidth="1.25"
            fill="none"
          />
          <rect
            x="62"
            y="19.5"
            width="15"
            height="11"
            rx="1.2"
            fill="rgb(3 105 161)"
            className="pv-pulse"
            style={pv({ '--pv-at': '3000ms' })}
          />
          {/* Six bones at a steady slant, three above and three below, each
              capped by a tinted category tag. */}
          {[
            { jx: 24, up: true, fill: 'rgb(255 228 230)', ink: 'rgb(190 18 60)' },
            { jx: 40, up: true, fill: 'rgb(254 243 199)', ink: 'rgb(180 83 9)' },
            { jx: 56, up: true, fill: 'rgb(219 234 254)', ink: 'rgb(29 78 216)' },
            { jx: 24, up: false, fill: 'rgb(220 252 231)', ink: 'rgb(21 128 61)' },
            { jx: 40, up: false, fill: 'rgb(237 233 254)', ink: 'rgb(109 40 217)' },
            { jx: 56, up: false, fill: 'rgb(226 232 240)', ink: 'rgb(51 65 85)' },
          ].map((b, i) => {
            const ex = b.jx - 10;
            const ey = b.up ? 8 : 42;
            return (
              <g key={i}>
                {/* Hover story: each bone grows in from its category to the
                    spine, one after another, then its causes branch off. */}
                <path
                  d={`M${ex} ${ey} L${b.jx} 25`}
                  stroke="rgb(51 65 85)"
                  strokeWidth="0.75"
                  className="pv-draw"
                  pathLength="1"
                  style={pv({ '--pv-at': `${900 + i * 220}ms`, '--pv-dur': '420ms' })}
                />
                <rect
                  x={ex - 5}
                  y={b.up ? ey - 5 : ey}
                  width="10"
                  height="5"
                  rx="2.5"
                  fill={b.fill}
                  stroke={b.ink}
                  strokeWidth="0.5"
                />
                {[1 / 3, 2 / 3].map((t) => {
                  const rx = ex + (b.jx - ex) * t;
                  const ry = ey + (25 - ey) * t;
                  return (
                    <path
                      key={t}
                      className="pv-new"
                      opacity="0"
                      d={`M${rx - 6} ${ry} L${rx} ${ry}`}
                      stroke="rgb(148 163 184)"
                      strokeWidth="0.6"
                      style={pv({ '--pv-at': `${2300 + i * 80}ms` })}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      );
    case 'pyramid':
      return (
        <svg width="70" height="46" viewBox="0 0 70 50" aria-hidden>
          {/* One clean triangle banded into five tiers, a saturated peak
              down to a pale foundation, with a rail of explanation lines
              on the right. */}
          {[
            { y0: 4, y1: 12.4, fill: 'rgb(59 130 246)' },
            { y0: 12.4, y1: 20.8, fill: 'rgb(96 165 250)' },
            { y0: 20.8, y1: 29.2, fill: 'rgb(147 197 253)' },
            { y0: 29.2, y1: 37.6, fill: 'rgb(191 219 254)' },
            { y0: 37.6, y1: 46, fill: 'rgb(224 236 255)' },
          ].map((t, i) => {
            // Half-width at y: the triangle spans 4..46 tall, 44 wide at its base.
            const half = (y: number) => ((y - 4) / 42) * 22;
            const d =
              i === 0
                ? `M24 ${t.y0} L${24 + half(t.y1)} ${t.y1} L${24 - half(t.y1)} ${t.y1} Z`
                : `M${24 - half(t.y0)} ${t.y0} L${24 + half(t.y0)} ${t.y0} L${24 + half(t.y1)} ${t.y1} L${24 - half(t.y1)} ${t.y1} Z`;
            const mid = (t.y0 + t.y1) / 2;
            return (
              <g key={i}>
                {/* Hover story: the tiers stack up from the foundation to the
                    peak, and each tier's rail line arrives with it. */}
                <path
                  d={d}
                  fill={t.fill}
                  stroke="rgb(14 165 233)"
                  strokeWidth="0.5"
                  className="pv-grow-y"
                  style={pv({ '--pv-at': `${300 + (4 - i) * 320}ms`, '--pv-dur': '380ms' })}
                />
                <rect x="50" y={mid - 2.2} width="14" height="1.6" rx="0.5" fill="rgb(37 99 235)" />
                <rect
                  x="50"
                  y={mid + 0.6}
                  width="17"
                  height="1.2"
                  rx="0.5"
                  fill="rgb(148 163 184)"
                  className="pv-new"
                  opacity="0"
                  style={pv({ '--pv-at': `${500 + (4 - i) * 320}ms` })}
                />
              </g>
            );
          })}
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
          {/* Front-on laptop: lid with its display over a slim base. */}
          <rect
            x="2"
            y="42"
            width="76"
            height="3"
            rx="1.4"
            fill="rgb(226 232 240)"
            stroke="rgb(100 116 139)"
            strokeWidth="0.6"
          />
          <rect x="34" y="42" width="12" height="1" rx="0.5" fill="rgb(148 163 184)" />
          <rect
            x="7"
            y="3"
            width="66"
            height="39"
            rx="2.5"
            fill="white"
            stroke="rgb(100 116 139)"
            strokeWidth="1"
          />
          <rect
            x="9"
            y="5"
            width="62"
            height="35"
            rx="0.8"
            fill="white"
            stroke="rgb(203 213 225)"
            strokeWidth="0.4"
          />
          {/* Top nav + avatar */}
          <rect
            x="10"
            y="6"
            width="60"
            height="4"
            rx="0.4"
            fill="rgb(219 234 254)"
            stroke="rgb(147 197 253)"
            strokeWidth="0.4"
          />
          <circle cx="67.5" cy="8" r="1.3" fill="rgb(186 230 253)" />
          {/* Sidebar, the active page tinted */}
          <rect
            x="10"
            y="11"
            width="11"
            height="28"
            rx="0.4"
            fill="rgb(241 245 249)"
            stroke="rgb(203 213 225)"
            strokeWidth="0.4"
          />
          {[13, 16.5, 20, 23.5].map((sy, i) => (
            <rect
              key={sy}
              x="11"
              y={sy}
              width="9"
              height="2.4"
              rx="0.3"
              fill={i === 0 ? 'rgb(186 230 253)' : 'white'}
              stroke="rgb(148 163 184)"
              strokeWidth="0.3"
            />
          ))}
          {/* KPI row */}
          {[22.5, 34.5, 46.5, 58.5].map((kx) => (
            <rect
              key={kx}
              x={kx}
              y="12"
              width="11"
              height="7"
              rx="0.4"
              fill="white"
              stroke="rgb(148 163 184)"
              strokeWidth="0.4"
            />
          ))}
          {/* Chart card + recent sign-ups table */}
          <rect
            x="22.5"
            y="21"
            width="27"
            height="18"
            rx="0.4"
            fill="white"
            stroke="rgb(148 163 184)"
            strokeWidth="0.4"
          />
          <rect
            x="51.5"
            y="21"
            width="18"
            height="18"
            rx="0.4"
            fill="white"
            stroke="rgb(148 163 184)"
            strokeWidth="0.4"
          />
          {[24.5, 27.5, 30.5, 33.5, 36.5].map((ty) => (
            <line
              key={ty}
              x1="51.5"
              y1={ty}
              x2="69.5"
              y2={ty}
              stroke="rgb(203 213 225)"
              strokeWidth="0.35"
            />
          ))}
          {/* Hover story: the dashboard loads, a figure landing in each KPI
              card, then the chart draws across its card (dashed to nothing
              at rest so the static art is unchanged). */}
          {[22.5, 34.5, 46.5, 58.5].map((kx, i) => (
            <rect
              key={kx}
              className="pv-new"
              opacity="0"
              x={kx + 1.5}
              y="14.3"
              width={[6, 7, 4, 5][i]}
              height="2.4"
              rx="0.4"
              fill="rgb(14 165 233)"
              style={pv({ '--pv-at': `${900 + i * 200}ms` })}
            />
          ))}
          <path
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            d="M24.5 35 L29 31.5 L33.5 32.5 L38 28 L42.5 27 L47.5 24"
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
