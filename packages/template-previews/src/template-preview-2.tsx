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
