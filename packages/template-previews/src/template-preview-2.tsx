import type { ReactElement, SVGProps } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';
import { Pop } from './story-parts';

// Group 2 of 3 (agile / hierarchy / wireframes). Static SVG preview tiles (one branch per
// TemplateKind; see template-preview.tsx for who renders them). Split out of template-preview.tsx to keep each file under the
// ~1000-line budget; TemplatePreview chains the groups with ??.
export function templatePreviewGroup2(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'kanban':
      // Five tinted lanes (Backlog slate, To do sky, In progress amber,
      // Review violet, Done green), each topped by its deep-hue header bar.
      // In progress holds the blocked ticket (red border). Hover story: work
      // moves right. The Review ticket lands in Done, an In progress ticket
      // follows it into Review, and Done's trophy pops once the ticket lands.
      // The moving cards are drawn after every lane so they pass OVER them.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {[
            {
              x: 2,
              fill: 'rgb(241 245 249)',
              stroke: 'rgb(203 213 225)',
              ink: 'rgb(51 65 85)',
              cards: [9, 17, 25],
            },
            {
              x: 17.5,
              fill: 'rgb(224 242 254)',
              stroke: 'rgb(125 211 252)',
              ink: 'rgb(3 105 161)',
              cards: [9, 17],
            },
            {
              x: 33,
              fill: 'rgb(254 243 199)',
              stroke: 'rgb(252 211 77)',
              ink: 'rgb(180 83 9)',
              cards: [9],
            },
            {
              x: 48.5,
              fill: 'rgb(237 233 254)',
              stroke: 'rgb(196 181 253)',
              ink: 'rgb(109 40 217)',
              cards: [],
            },
            {
              x: 64,
              fill: 'rgb(220 252 231)',
              stroke: 'rgb(134 239 172)',
              ink: 'rgb(21 128 61)',
              cards: [9, 17],
            },
          ].map((col) => (
            <g key={col.x}>
              <rect
                x={col.x}
                y="3"
                width="14"
                height="44"
                rx="1.5"
                fill={col.fill}
                stroke={col.stroke}
                strokeWidth="0.75"
              />
              <rect x={col.x + 2} y="5" width="7" height="1.8" rx="0.9" fill={col.ink} />
              {col.cards.map((sy) => (
                <KanbanCard key={sy} x={col.x + 1} y={sy} />
              ))}
            </g>
          ))}
          {/* The blocked ticket: a red border in In progress. */}
          <KanbanCard x={34} y={25} stroke="rgb(220 38 38)" strokeWidth="1" />
          <KanbanCard
            x={49.5}
            y={9}
            className="pv-shift"
            style={pv({ '--pv-dx': '15.5px', '--pv-dy': '16px', '--pv-at': '1000ms' })}
          />
          <KanbanCard
            x={34}
            y={17}
            className="pv-shift"
            style={pv({ '--pv-dx': '15.5px', '--pv-dy': '-8px', '--pv-at': '1600ms' })}
          />
          <circle
            className="pv-new"
            opacity="0"
            cx="71"
            cy="40"
            r="3"
            fill="rgb(250 204 21)"
            stroke="rgb(202 138 4)"
            strokeWidth="0.75"
            style={pv({ '--pv-at': '2200ms' })}
          />
        </svg>
      );
    case 'swot':
      // Named axes (Helpful / Harmful ticks over the columns, Internal /
      // External down the rows), the four tinted quadrants, and the So what?
      // strip beneath. Hover story: a sticky in each quadrant's own hue lands,
      // strengths first, then the strip's four moves are written in turn.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {[12, 46].map((x) => (
            <rect
              key={x}
              x={x + 11}
              y="1.5"
              width="10"
              height="1.4"
              rx="0.7"
              fill="rgb(148 163 184)"
            />
          ))}
          {[6, 20].map((y) => (
            <rect key={y} x="3" y={y + 2} width="1.4" height="8" rx="0.7" fill="rgb(148 163 184)" />
          ))}
          {[
            {
              x: 7,
              y: 4,
              fill: 'rgb(220 252 231)',
              stroke: 'rgb(134 239 172)',
              note: 'rgb(187 247 208)',
              at: 900,
            },
            {
              x: 42,
              y: 4,
              fill: 'rgb(255 228 230)',
              stroke: 'rgb(253 164 175)',
              note: 'rgb(254 205 211)',
              at: 1150,
            },
            {
              x: 7,
              y: 19,
              fill: 'rgb(219 234 254)',
              stroke: 'rgb(147 197 253)',
              note: 'rgb(186 230 253)',
              at: 1400,
            },
            {
              x: 42,
              y: 19,
              fill: 'rgb(254 243 199)',
              stroke: 'rgb(252 211 77)',
              note: 'rgb(253 230 138)',
              at: 1650,
            },
          ].map((q) => (
            <g key={`${q.x}-${q.y}`}>
              <rect
                x={q.x}
                y={q.y}
                width="33"
                height="13"
                rx="1.5"
                fill={q.fill}
                stroke={q.stroke}
                strokeWidth="0.75"
              />
              <rect x={q.x + 2.5} y={q.y + 5} width="8" height="6" rx="0.6" fill={q.note} />
              <rect x={q.x + 12.5} y={q.y + 5} width="8" height="6" rx="0.6" fill={q.note} />
              <Pop
                at={q.at}
                x={q.x + 22.5}
                y={q.y + 5}
                width="8"
                height="6"
                rx="0.6"
                fill={q.note}
              />
            </g>
          ))}
          <rect
            x="7"
            y="35"
            width="68"
            height="12"
            rx="1.5"
            fill="rgb(248 250 252)"
            stroke="rgb(148 163 184)"
            strokeWidth="1.2"
          />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect
                x={9.5 + i * 16.5}
                y="38"
                width="15"
                height="6.5"
                rx="0.8"
                fill="white"
                stroke="rgb(203 213 225)"
                strokeWidth="0.6"
              />
              <Pop
                at={2000 + i * 250}
                x={10.5 + i * 16.5}
                y="39.2"
                width="7"
                height="1.8"
                rx="0.9"
                fill="rgb(3 105 161)"
              />
            </g>
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
      // A to-scale phase ribbon (violet / blue / amber / green segments) with
      // six milestones alternating above and below: a ring on the ribbon's
      // edge, a stem, a date chip and a callout card. Launch day is the
      // larger amber hero. Hover story: the year fills along the ribbon up to
      // launch, which then lights up.
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          {[
            { x: 7, w: 10.6, fill: 'rgb(237 233 254)' },
            { x: 18.1, w: 16, fill: 'rgb(219 234 254)' },
            { x: 34.6, w: 10.4, fill: 'rgb(254 243 199)' },
            { x: 45.6, w: 27.4, fill: 'rgb(209 250 229)' },
          ].map((p) => (
            <rect key={p.x} x={p.x} y="23" width={p.w} height="4" rx="2" fill={p.fill} />
          ))}
          <path
            d="M73.5 25 L77 25 M75.2 23.4 L77 25 L75.2 26.6"
            stroke="rgb(100 116 139)"
            strokeWidth="0.8"
            fill="none"
          />
          <path
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            d="M8 25 H41"
            stroke="rgb(14 165 233)"
            strokeWidth="1.4"
            style={pv({ '--pv-at': '900ms', '--pv-dur': '1400ms' })}
          />
          {[
            { x: 8.8, deep: 'rgb(109 40 217)' },
            { x: 17.2, deep: 'rgb(109 40 217)' },
            { x: 32, deep: 'rgb(29 78 216)' },
            { x: 41.1, deep: 'rgb(180 83 9)', hero: true },
            { x: 56.3, deep: 'rgb(4 120 87)' },
            { x: 67.5, deep: 'rgb(4 120 87)' },
          ].map((m, i) => {
            const above = i % 2 === 0;
            const edge = above ? 23 : 27;
            const w = m.hero ? 15 : 12;
            const h = m.hero ? 10 : 8.5;
            const cardY = above ? 3 : 36;
            return (
              <g key={m.x}>
                <path
                  d={
                    above
                      ? `M${m.x} ${edge} L${m.x} ${cardY + h}`
                      : `M${m.x} ${edge} L${m.x} ${cardY}`
                  }
                  stroke={m.deep}
                  strokeWidth="0.5"
                />
                <rect
                  x={m.x - 3.5}
                  y={above ? 15 : 30.5}
                  width="7"
                  height="3"
                  rx="1.5"
                  fill="white"
                  stroke={m.deep}
                  strokeWidth="0.45"
                />
                <circle cx={m.x} cy={edge} r="1.2" fill="white" stroke={m.deep} strokeWidth="0.6" />
                <rect
                  x={m.x - w / 2}
                  y={cardY}
                  width={w}
                  height={h}
                  rx="1.2"
                  fill={m.hero ? 'rgb(255 251 235)' : 'white'}
                  stroke={m.deep}
                  strokeWidth={m.hero ? 0.9 : 0.5}
                  className={m.hero ? 'pv-pulse' : undefined}
                  style={m.hero ? pv({ '--pv-at': '2300ms' }) : undefined}
                />
                <circle cx={m.x - w / 2 + 2} cy={cardY + 2.2} r="1" fill={m.deep} />
                <rect
                  x={m.x - w / 2 + 3.6}
                  y={cardY + 1.6}
                  width={w - 5.5}
                  height="1.2"
                  rx="0.4"
                  fill="rgb(51 65 85)"
                />
                <rect
                  x={m.x - w / 2 + 3.6}
                  y={cardY + 4.2}
                  width={w - 5.5}
                  height="1"
                  rx="0.4"
                  fill="rgb(148 163 184)"
                />
              </g>
            );
          })}
        </svg>
      );
    case 'milestone-timeline-vertical':
      // A company history down the page: a downward spine with a disc per
      // chapter, story cards alternating right and left, a bold year on the
      // other side, an amber highlight card and a dashed next chapter at the
      // arrow's tip. Hover story: the years run down the spine, each disc
      // pulsing as it's reached, then the highlight lights up.
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          <path d="M40 2 L40 47" stroke="rgb(168 162 158)" strokeWidth="1" />
          <path
            d="M38.4 45 L40 47.5 L41.6 45"
            stroke="rgb(168 162 158)"
            strokeWidth="1"
            fill="none"
          />
          <path
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            d="M40 2 V33"
            stroke="rgb(217 119 6)"
            strokeWidth="1.6"
            style={pv({ '--pv-at': '900ms', '--pv-dur': '1500ms' })}
          />
          {[5, 11, 17, 23, 29, 35, 41].map((y, i) => {
            const right = i % 2 === 0;
            const highlight = i === 4;
            const next = i === 6;
            const stroke = highlight
              ? 'rgb(217 119 6)'
              : next
                ? 'rgb(100 116 139)'
                : 'rgb(146 64 14)';
            return (
              <g key={y}>
                <path
                  d={right ? `M41.6 ${y} L45 ${y}` : `M35 ${y} L38.4 ${y}`}
                  stroke={stroke}
                  strokeWidth="0.45"
                  strokeDasharray={next ? '0.8 0.6' : undefined}
                />
                <rect
                  x={right ? 45 : 11}
                  y={y - 2.4}
                  width="24"
                  height="4.8"
                  rx="1"
                  fill={highlight ? 'rgb(255 251 235)' : 'white'}
                  stroke={stroke}
                  strokeWidth={highlight ? 0.8 : 0.45}
                  strokeDasharray={next ? '1 0.7' : undefined}
                  className={highlight ? 'pv-pulse' : undefined}
                  style={highlight ? pv({ '--pv-at': '2500ms' }) : undefined}
                />
                <rect
                  x={right ? 48 : 14}
                  y={y - 0.7}
                  width="15"
                  height="1.4"
                  rx="0.4"
                  fill="rgb(148 163 184)"
                />
                <rect x={right ? 29 : 44} y={y - 1} width="7" height="2" rx="0.5" fill={stroke} />
                <circle
                  cx="40"
                  cy={y}
                  r="1.6"
                  fill={highlight ? 'rgb(254 243 199)' : 'white'}
                  stroke={stroke}
                  strokeWidth="0.6"
                  className={i < 5 ? 'pv-pulse' : undefined}
                  style={i < 5 ? pv({ '--pv-at': `${1000 + i * 300}ms` }) : undefined}
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
      // A three-phone flow joined by tap arrows, numbered pins on the
      // screens and an amber notes rail. Hover story: the flow is walked,
      // each Tap arrow drawing in turn, then each note's pin pulses in turn.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {[3, 24, 45].map((px, i) => (
            <g key={px}>
              <rect
                x={px}
                y="4"
                width="15"
                height="42"
                rx="2.5"
                fill="white"
                stroke="rgb(100 116 139)"
                strokeWidth="0.85"
              />
              <rect x={px + 2} y="7" width="11" height="1.4" rx="0.4" fill="rgb(203 213 225)" />
              {i === 0 ? (
                <>
                  <rect
                    x={px + 2}
                    y="10.5"
                    width="11"
                    height="2.6"
                    rx="1.3"
                    fill="rgb(186 230 253)"
                  />
                  {[15, 21, 27].map((cy) => (
                    <rect
                      key={cy}
                      x={px + 2}
                      y={cy}
                      width="11"
                      height="4.5"
                      rx="0.8"
                      fill="white"
                      stroke="rgb(148 163 184)"
                      strokeWidth="0.4"
                    />
                  ))}
                </>
              ) : i === 1 ? (
                <>
                  <rect
                    x={px + 2}
                    y="10.5"
                    width="11"
                    height="7"
                    rx="0.8"
                    fill="rgb(241 245 249)"
                    stroke="rgb(148 163 184)"
                    strokeWidth="0.4"
                  />
                  {[2, 5.8, 9.6].map((dx, s) => (
                    <rect
                      key={dx}
                      x={px + dx}
                      y="20"
                      width="3.4"
                      height="2.2"
                      rx="1.1"
                      fill={s === 1 ? 'rgb(186 230 253)' : 'white'}
                      stroke="rgb(14 165 233)"
                      strokeWidth="0.35"
                    />
                  ))}
                  {[24.5, 27.5, 30.5].map((cy) => (
                    <rect
                      key={cy}
                      x={px + 2}
                      y={cy}
                      width="8"
                      height="1.6"
                      rx="0.4"
                      fill="rgb(203 213 225)"
                    />
                  ))}
                  <rect x={px + 2} y="37" width="11" height="3.6" rx="1.8" fill="rgb(3 105 161)" />
                </>
              ) : (
                <>
                  <circle
                    cx={px + 7.5}
                    cy="14"
                    r="3"
                    fill="rgb(254 243 199)"
                    stroke="rgb(245 158 11)"
                    strokeWidth="0.5"
                  />
                  <rect x={px + 3} y="19" width="9" height="1.8" rx="0.5" fill="rgb(15 23 42)" />
                  {[3.5, 7.5, 11.5].map((dx) => (
                    <circle key={dx} cx={px + dx} cy="25" r="1.2" fill="rgb(14 165 233)" />
                  ))}
                  <rect
                    x={px + 2}
                    y="29"
                    width="11"
                    height="5"
                    rx="0.8"
                    fill="white"
                    stroke="rgb(148 163 184)"
                    strokeWidth="0.4"
                  />
                </>
              )}
              {i !== 1 && (
                <rect
                  x={px + 2}
                  y="40"
                  width="11"
                  height="3.4"
                  rx="0.8"
                  fill="white"
                  stroke="rgb(148 163 184)"
                  strokeWidth="0.4"
                />
              )}
            </g>
          ))}
          {/* Tap arrows: menu item -> Customise, CTA -> Order placed. */}
          {[
            { x1: 16, y1: 17, x2: 23, y2: 24, at: 900 },
            { x1: 37, y1: 39, x2: 44, y2: 26, at: 1500 },
          ].map((a) => (
            <g key={a.at}>
              <line
                x1={a.x1}
                y1={a.y1}
                x2={a.x2}
                y2={a.y2}
                stroke="rgb(15 23 42)"
                strokeWidth="0.7"
              />
              <circle
                className="pv-pulse"
                cx={a.x2}
                cy={a.y2}
                r="0.9"
                fill="rgb(15 23 42)"
                style={pv({ '--pv-at': `${a.at}ms` })}
              />
            </g>
          ))}
          {/* Pins on the screens, and the notes rail they match. */}
          {[
            { cx: 17, cy: 11 },
            { cx: 29, cy: 20 },
            { cx: 58, cy: 25 },
          ].map((p) => (
            <circle key={p.cx} cx={p.cx} cy={p.cy} r="1.5" fill="rgb(3 105 161)" />
          ))}
          {[8, 18, 28].map((y, i) => (
            <g key={y}>
              <circle
                className="pv-pulse"
                cx="66"
                cy={y + 2}
                r="1.5"
                fill="rgb(3 105 161)"
                style={pv({ '--pv-at': `${2000 + i * 250}ms` })}
              />
              <rect x="68.5" y={y} width="9.5" height="7" rx="0.6" fill="rgb(253 230 138)" />
            </g>
          ))}
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
      // Six 16:9 slides read left to right, each with a kicker and a
      // headline, the pitch bodies sketched in (pains, a process, a chart,
      // avatars, a pie), and a muted speaker-notes line under each. Hover
      // story: the deck is presented, each slide lighting up in turn.
      return (
        <svg width="80" height="46" viewBox="0 0 80 50" aria-hidden>
          {[
            { x: 3, y: 4 },
            { x: 29, y: 4 },
            { x: 55, y: 4 },
            { x: 3, y: 27 },
            { x: 29, y: 27 },
            { x: 55, y: 27 },
          ].map((s, i) => (
            <g key={i}>
              <rect
                x={s.x}
                y={s.y}
                width="22"
                height="12.4"
                rx="1"
                fill="white"
                stroke="rgb(100 116 139)"
                strokeWidth="0.7"
              />
              <rect
                x={s.x + 2}
                y={s.y + 1.8}
                width="6"
                height="1"
                rx="0.3"
                fill="rgb(148 163 184)"
              />
              <rect
                x={s.x + 2}
                y={s.y + 3.6}
                width="15"
                height="1.8"
                rx="0.4"
                fill="rgb(15 23 42)"
              />
              {i === 0 && <circle cx={s.x + 18} cy={s.y + 9} r="2" fill="rgb(251 146 60)" />}
              {i === 1 &&
                [7, 9, 11].map((dy) => (
                  <rect
                    key={dy}
                    x={s.x + 2}
                    y={s.y + dy - 0.4}
                    width="12"
                    height="0.9"
                    rx="0.3"
                    fill="rgb(148 163 184)"
                  />
                ))}
              {i === 2 &&
                [5, 11, 17].map((dx) => (
                  <circle key={dx} cx={s.x + dx} cy={s.y + 9} r="1.6" fill="rgb(14 165 233)" />
                ))}
              {i === 3 && (
                <polyline
                  points={`${s.x + 2},${s.y + 11} ${s.x + 7},${s.y + 9.5} ${s.x + 12},${s.y + 8.5} ${s.x + 17},${s.y + 6.5}`}
                  fill="none"
                  stroke="rgb(14 165 233)"
                  strokeWidth="0.8"
                />
              )}
              {i === 4 &&
                [5, 11, 17].map((dx) => (
                  <circle
                    key={dx}
                    cx={s.x + dx}
                    cy={s.y + 8.8}
                    r="1.8"
                    fill="none"
                    stroke="rgb(14 165 233)"
                    strokeWidth="0.6"
                  />
                ))}
              {i === 5 && (
                <>
                  <circle cx={s.x + 6} cy={s.y + 8.8} r="2.4" fill="rgb(14 165 233)" />
                  <path
                    d={`M ${s.x + 6} ${s.y + 8.8} L ${s.x + 6} ${s.y + 6.4} A 2.4 2.4 0 0 1 ${s.x + 8.4} ${s.y + 8.8} Z`}
                    fill="rgb(186 230 253)"
                  />
                  <rect
                    x={s.x + 11}
                    y={s.y + 7}
                    width="8"
                    height="0.9"
                    rx="0.3"
                    fill="rgb(148 163 184)"
                  />
                  <rect
                    x={s.x + 11}
                    y={s.y + 9.4}
                    width="6"
                    height="0.9"
                    rx="0.3"
                    fill="rgb(148 163 184)"
                  />
                </>
              )}
              {/* Speaker notes under the slide. */}
              <rect
                x={s.x}
                y={s.y + 14.4}
                width="16"
                height="1.2"
                rx="0.4"
                fill="rgb(203 213 225)"
              />
              <rect
                className="pv-new"
                opacity="0"
                x={s.x - 0.6}
                y={s.y - 0.6}
                width="23.2"
                height="13.6"
                rx="1.4"
                fill="rgb(14 165 233)"
                fillOpacity="0.12"
                stroke="rgb(14 165 233)"
                strokeWidth="1.1"
                style={pv({ '--pv-at': `${900 + i * 260}ms` })}
              />
            </g>
          ))}
        </svg>
      );
    default:
      return null;
  }
}

// One kanban card (the kanban preview draws ten, two of them moving).
function KanbanCard({
  x,
  y,
  ...rest
}: { x: number; y: number } & Omit<SVGProps<SVGRectElement>, 'x' | 'y'>) {
  return (
    <rect
      x={x}
      y={y}
      width="12"
      height="6"
      rx="1"
      fill="white"
      stroke="rgb(148 163 184)"
      strokeWidth="0.5"
      {...rest}
    />
  );
}
