import type { ReactElement, SVGProps } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';
import { FILL_BOX, Pop, PopDot, popGroup } from './story-parts';

// Group 4 of 4 (the roadmap / canvas / workshop / hierarchy / UML /
// cloud batch). Static SVG preview tiles (one branch per TemplateKind; see
// template-preview.tsx for who renders them). Split out of template-preview.tsx to keep
// each file under the ~1000-line budget; TemplatePreview chains the
// groups with ??. Shared palette: sky accents (rgb(14 165 233) stroke,
// rgb(186 230 253) fill), slate connectors (rgb(100 116 139)), amber
// stickies (rgb(254 243 199) / rgb(253 230 138)).
export function templatePreviewGroup4(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'roadmap':
      // Three horizon lanes (green / blue / slate) of initiative cards.
      // Hover story: a Later item is pulled forward into Next, then the Now
      // lane's second item ships. At rest Next is one item short, the gap
      // the pulled item fills; both moving cards are drawn last.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {[
            { x: 4, fill: 'rgb(220 252 231)', stroke: 'rgb(134 239 172)', cards: [15] },
            { x: 30, fill: 'rgb(219 234 254)', stroke: 'rgb(147 197 253)', cards: [15] },
            { x: 56, fill: 'rgb(226 232 240)', stroke: 'rgb(203 213 225)', cards: [15] },
          ].map((lane, i) => (
            <g key={i}>
              <rect
                x={lane.x}
                y="4"
                width="20"
                height="42"
                rx="2"
                fill={lane.fill}
                stroke={lane.stroke}
                strokeWidth="1"
              />
              <rect x={lane.x + 3} y="8" width="10" height="3" rx="1" fill="rgb(15 23 42)" />
              {lane.cards.map((y) => (
                <RoadCard key={y} x={lane.x + 3} y={y} />
              ))}
            </g>
          ))}
          <RoadCard x={7} y={30} className="pv-leave" style={pv({ '--pv-at': '1900ms' })} />
          <RoadCard
            x={59}
            y={30}
            className="pv-shift"
            style={pv({ '--pv-dx': '-26px', '--pv-at': '1000ms', '--pv-dur': '800ms' })}
          />
        </svg>
      );
    case 'raci-matrix':
      // Tasks-by-roles grid: header band + column, letter dots in the body.
      return (
        <svg width="72" height="44" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="6"
            y="6"
            width="68"
            height="38"
            rx="2"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1.2"
          />
          <rect x="6" y="6" width="68" height="9" fill="rgb(186 230 253)" />
          <rect x="6" y="6" width="20" height="38" fill="rgb(224 242 254)" />
          <rect
            x="6"
            y="6"
            width="68"
            height="9"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {[15, 24.5, 34].map((y) => (
            <line
              key={y}
              x1="6"
              y1={y}
              x2="74"
              y2={y}
              stroke="rgb(148 163 184)"
              strokeWidth="0.7"
            />
          ))}
          {[26, 42, 58].map((x) => (
            <line
              key={x}
              x1={x}
              y1="6"
              x2={x}
              y2="44"
              stroke="rgb(148 163 184)"
              strokeWidth="0.7"
            />
          ))}
          {/* Scattered R/A/C/I marks as tinted dots. Hover story: the bottom
              task's grey mark is handed to the next role, then the middle
              task gains a Responsible (green). */}
          {[
            { cx: 34, cy: 19.5, f: 'rgb(134 239 172)' },
            { cx: 50, cy: 19.5, f: 'rgb(147 197 253)' },
            { cx: 66, cy: 29, f: 'rgb(252 211 77)' },
            { cx: 66, cy: 39, f: 'rgb(134 239 172)' },
            { cx: 50, cy: 29, f: 'rgb(252 211 77)' },
          ].map((d, i) => (
            <circle key={i} cx={d.cx} cy={d.cy} r="2.6" fill={d.f} />
          ))}
          <circle
            cx="34"
            cy="39"
            r="2.6"
            fill="rgb(203 213 225)"
            className="pv-shift"
            style={pv({ '--pv-dx': '16px', '--pv-at': '1000ms' })}
          />
          <PopDot at={1700} cx="34" cy="29" r="2.6" fill="rgb(134 239 172)" />
        </svg>
      );
    case 'user-story-map':
      // Activity backbone over two release bands of stickies, cut by a
      // dashed release line.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {[4, 24, 44, 64].map((x) => (
            <rect
              key={x}
              x={x}
              y="4"
              width="14"
              height="8"
              rx="1.5"
              fill="rgb(186 230 253)"
              stroke="rgb(14 165 233)"
              strokeWidth="0.9"
            />
          ))}
          {/* Hover story: the third activity's later story is promoted
              over the release line into the first release, and a new story
              backfills the later release. At rest the first release has
              the gap it fills. */}
          {[4, 24, 64].map((x) => (
            <Sticky key={x} x={x} y={17} />
          ))}
          {[4, 24, 64].map((x) => (
            <Sticky key={x} x={x} y={38} />
          ))}
          <line
            x1="2"
            y1="32.5"
            x2="78"
            y2="32.5"
            stroke="rgb(100 116 139)"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
          <Sticky
            x={44}
            y={38}
            className="pv-shift"
            style={pv({ '--pv-dy': '-21px', '--pv-at': '1000ms', '--pv-dur': '800ms' })}
          />
          <Sticky
            x={44}
            y={38}
            className="pv-arrive"
            opacity="0"
            style={pv({ '--pv-from-y': '10px', '--pv-at': '1900ms' })}
          />
        </svg>
      );
    case 'affinity-map':
      // Two dashed theme clusters of tilted stickies plus a loose note.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {[3, 32].map((x) => (
            <rect
              key={x}
              x={x}
              y="6"
              width="25"
              height="38"
              rx="3"
              fill="none"
              stroke="rgb(148 163 184)"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          ))}
          {[
            { x: 7, y: 11, r: -4 },
            { x: 8, y: 26, r: 3 },
            { x: 36, y: 11, r: 3 },
            { x: 37, y: 26, r: -3 },
          ].map((s, i) => (
            <rect
              key={i}
              x={s.x}
              y={s.y}
              width="17"
              height="11"
              rx="1"
              fill="rgb(254 243 199)"
              stroke="rgb(253 230 138)"
              strokeWidth="0.9"
              transform={`rotate(${s.r} ${s.x + 8.5} ${s.y + 5.5})`}
            />
          ))}
          {/* Hover story: the loose note is grouped onto the second theme's
              pile, then a fresh note turns up loose. The tilted note moves
              inside a <g> so its own rotate() survives. */}
          <g
            className="pv-shift"
            style={{
              ...pv({
                '--pv-dx': '-22px',
                '--pv-dy': '13px',
                '--pv-at': '1000ms',
                '--pv-dur': '800ms',
              }),
              ...FILL_BOX,
            }}
          >
            <rect
              x="62"
              y="16"
              width="15"
              height="10"
              rx="1"
              fill="rgb(254 243 199)"
              stroke="rgb(253 230 138)"
              strokeWidth="0.9"
              transform="rotate(7 69.5 21)"
            />
          </g>
          <Sticky
            x={62}
            y={16}
            className="pv-arrive"
            opacity="0"
            style={pv({ '--pv-from-x': '10px', '--pv-at': '2000ms' })}
          />
        </svg>
      );
    case 'business-model-canvas':
      // The iconic nine-block Osterwalder grid with the value column tinted.
      return (
        <svg width="72" height="44" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="4"
            y="4"
            width="72"
            height="42"
            rx="2"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1.2"
          />
          {/* Value-proposition centre column. */}
          <rect x="33" y="4" width="14" height="30" fill="rgb(186 230 253)" />
          {/* Vertical partitions of the top area. */}
          {[18.5, 33, 47, 61.5].map((x) => (
            <line
              key={x}
              x1={x}
              y1="4"
              x2={x}
              y2="34"
              stroke="rgb(100 116 139)"
              strokeWidth="0.8"
            />
          ))}
          {/* Stacked halves for the activities/resources + relationships/channels columns. */}
          <line x1="18.5" y1="19" x2="33" y2="19" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="47" y1="19" x2="61.5" y2="19" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          {/* Costs / revenue base row. */}
          <line x1="4" y1="34" x2="76" y2="34" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="40" y1="34" x2="40" y2="46" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          {/* Hover story: the canvas fills in, value proposition first, then
              who it's for, who helps, and how it earns. */}
          {[
            [36, 8, 1000],
            [36, 15, 1250],
            [65, 8, 1550],
            [7, 8, 1850],
            [58, 38, 2150],
          ].map(([x, y, at]) => (
            <Pop
              key={at}
              at={at!}
              x={x}
              y={y}
              width="8"
              height="5"
              rx="0.8"
              fill="rgb(254 243 199)"
              stroke="rgb(245 158 11)"
              strokeWidth="0.6"
            />
          ))}
        </svg>
      );
    case 'empathy-map':
      // Says / Thinks / Does / Feels quadrants around the persona circle.
      return (
        <svg width="72" height="44" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="6"
            y="4"
            width="33"
            height="20"
            rx="2"
            fill="rgb(219 234 254)"
            stroke="rgb(147 197 253)"
            strokeWidth="0.9"
          />
          <rect
            x="41"
            y="4"
            width="33"
            height="20"
            rx="2"
            fill="rgb(237 233 254)"
            stroke="rgb(196 181 253)"
            strokeWidth="0.9"
          />
          <rect
            x="6"
            y="26"
            width="33"
            height="20"
            rx="2"
            fill="rgb(220 252 231)"
            stroke="rgb(134 239 172)"
            strokeWidth="0.9"
          />
          <rect
            x="41"
            y="26"
            width="33"
            height="20"
            rx="2"
            fill="rgb(255 228 230)"
            stroke="rgb(253 164 175)"
            strokeWidth="0.9"
          />
          <circle
            cx="40"
            cy="25"
            r="7.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1.2"
          />
          {/* Head-and-shoulders glyph inside the persona circle. */}
          <circle cx="40" cy="22.6" r="2.2" fill="rgb(14 165 233)" />
          <path d="M 35.8 29.2 Q 40 24.8 44.2 29.2" fill="rgb(14 165 233)" />
          {/* Hover story: an observation comes out of the persona into each
              quadrant in turn: says, thinks, does, feels. */}
          {[
            [12, 10, 1000],
            [59, 10, 1300],
            [12, 34, 1600],
            [59, 34, 1900],
          ].map(([x, y, at]) => (
            <rect
              key={at}
              className="pv-arrive"
              opacity="0"
              x={x}
              y={y}
              width="9"
              height="6"
              rx="0.8"
              fill="white"
              stroke="rgb(100 116 139)"
              strokeWidth="0.6"
              style={pv({
                '--pv-from-x': `${35.5 - x!}px`,
                '--pv-from-y': `${22 - y!}px`,
                '--pv-at': `${at}ms`,
              })}
            />
          ))}
        </svg>
      );
    case 'funnel':
      // Four tiers tapering downward, mouth tinted, exit narrow.
      return (
        <svg width="70" height="46" viewBox="0 0 70 50" aria-hidden>
          <polygon
            points="5,4 65,4 55,13 15,13"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <polygon
            points="16,17 54,17 47,26 23,26"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <polygon
            points="24,30 46,30 42,39 28,39"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <polygon
            points="29,43 41,43 39,48 31,48"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* Hover story: prospects drop through the stages on a loop; the
              ones at the edges fall out after the first stage. */}
          {[
            { x: 35, dx: 0, dy: 38, at: 1000 },
            { x: 20, dx: -4, dy: 11, at: 1300 },
            { x: 35, dx: 0, dy: 38, at: 1600 },
            { x: 50, dx: 4, dy: 11, at: 1900 },
            { x: 35, dx: 0, dy: 38, at: 2200 },
          ].map((d) => (
            <circle
              key={d.at}
              className="pv-travel"
              opacity="0"
              cx={d.x}
              cy="7"
              r="1.6"
              fill="rgb(2 132 199)"
              style={pv({
                '--pv-dx': `${d.dx}px`,
                '--pv-dy': `${d.dy}px`,
                '--pv-at': `${d.at}ms`,
                '--pv-dur': '1800ms',
              })}
            />
          ))}
        </svg>
      );
    case 'okr-tree':
      // Objective root over three key results, initiatives beneath.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="30"
            y="3"
            width="20"
            height="9"
            rx="1.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {[8, 33, 58].map((x) => (
            <rect
              key={x}
              x={x}
              y="21"
              width="14"
              height="8"
              rx="1.5"
              fill="white"
              stroke="rgb(14 165 233)"
              strokeWidth="0.9"
            />
          ))}
          {[4, 21, 29, 46, 54, 71].map((x, i) => (
            <rect
              key={i}
              x={x}
              y="38"
              width="9"
              height="7"
              rx="1"
              fill="white"
              stroke="rgb(148 163 184)"
              strokeWidth="0.8"
            />
          ))}
          {/* Root → KR connectors. */}
          {[15, 40, 65].map((x) => (
            <line
              key={x}
              x1="40"
              y1="12"
              x2={x}
              y2="21"
              stroke="rgb(100 116 139)"
              strokeWidth="0.8"
            />
          ))}
          {/* KR → initiative connectors. */}
          {[
            [15, 8.5],
            [15, 25.5],
            [40, 33.5],
            [40, 50.5],
            [65, 58.5],
            [65, 75.5],
          ].map(([fx, tx], i) => (
            <line
              key={i}
              x1={fx}
              y1="29"
              x2={tx}
              y2="38"
              stroke="rgb(100 116 139)"
              strokeWidth="0.7"
            />
          ))}
          {/* Hover story: each key result's progress bar fills to where it
              stands this quarter. The bar pops in with its track, then grows. */}
          {[
            [8, 10, 1000],
            [33, 5, 1300],
            [58, 8, 1600],
          ].map(([x, w, at]) => (
            <g key={x} className="pv-new" opacity="0" style={popGroup(at!)}>
              <rect x={x! + 2} y="25.5" width="10" height="1.8" rx="0.9" fill="rgb(226 232 240)" />
              <rect
                x={x! + 2}
                y="25.5"
                width={w}
                height="1.8"
                rx="0.9"
                fill="rgb(34 197 94)"
                className="pv-grow-x"
                style={pv({ '--pv-at': `${at! + 150}ms`, '--pv-dur': '900ms' })}
              />
            </g>
          ))}
        </svg>
      );
    case 'sitemap':
      // Home over sections and pages, wired with elbow connectors.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="31"
            y="3"
            width="18"
            height="9"
            rx="1.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {[7, 33, 59].map((x) => (
            <rect
              key={x}
              x={x}
              y="22"
              width="14"
              height="8"
              rx="1.5"
              fill="white"
              stroke="rgb(14 165 233)"
              strokeWidth="0.9"
            />
          ))}
          {[3, 15, 29, 41, 55, 67].map((x, i) => (
            <rect
              key={i}
              x={x}
              y="39"
              width="10"
              height="7"
              rx="1"
              fill="white"
              stroke="rgb(148 163 184)"
              strokeWidth="0.8"
            />
          ))}
          {/* Elbow connectors: down from Home, across, down into each tier.
              Hover story: the site's links wire up from Home down, tier by
              tier, then a visitor's route lights up to its last page. */}
          {[
            ['M 40 12 V 17 H 14 V 22 M 40 17 V 22 M 40 17 H 66 V 22', 0.8, 900],
            ['M 14 30 V 34.5 H 8 V 39 M 14 34.5 H 20 V 39', 0.7, 1300],
            ['M 40 30 V 34.5 H 34 V 39 M 40 34.5 H 46 V 39', 0.7, 1450],
            ['M 66 30 V 34.5 H 60 V 39 M 66 34.5 H 72 V 39', 0.7, 1600],
          ].map(([d, w, at]) => (
            <path
              key={at}
              d={d as string}
              pathLength="1"
              fill="none"
              stroke="rgb(100 116 139)"
              strokeWidth={w}
              className="pv-draw"
              style={pv({ '--pv-at': `${at}ms`, '--pv-dur': '600ms' })}
            />
          ))}
          <g className="pv-new" opacity="0" style={popGroup(2200)}>
            <path
              d="M 40 12 V 17 H 66 V 22 M 66 30 V 34.5 H 72 V 39"
              pathLength="1"
              fill="none"
              stroke="rgb(14 165 233)"
              strokeWidth="1.6"
              className="pv-draw"
              style={pv({ '--pv-at': '2200ms', '--pv-dur': '900ms' })}
            />
          </g>
        </svg>
      );
    default:
      return null;
  }
}

// Helpers for the hover stories (preview-motion.css).

// A roadmap initiative card.
function RoadCard(props: { x: number; y: number } & Omit<SVGProps<SVGRectElement>, 'x' | 'y'>) {
  return (
    <rect
      width="14"
      height="11"
      rx="1.5"
      fill="white"
      stroke="rgb(148 163 184)"
      strokeWidth="0.8"
      {...props}
    />
  );
}

// An amber sticky (user story map, affinity map).
function Sticky(props: { x: number; y: number } & Omit<SVGProps<SVGRectElement>, 'x' | 'y'>) {
  return (
    <rect
      width="14"
      height="9"
      rx="1"
      fill="rgb(254 243 199)"
      stroke="rgb(253 230 138)"
      strokeWidth="0.9"
      {...props}
    />
  );
}
