import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';

// Group 3 of 3 (strategy / design / technical, plus the Q&A board's live-session boards). Static SVG preview tiles (one branch per
// TemplateKind; see template-preview.tsx for who renders them). Split out of template-preview.tsx to keep each file under the
// ~1000-line budget; TemplatePreview chains the groups with ??.
export function templatePreviewGroup3(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'lean-coffee':
      return (
        <svg width="70" height="46" viewBox="0 0 70 50" aria-hidden>
          {/* How-it-works steps down the left. */}
          {[12, 18, 24, 30].map((y) => (
            <path
              key={y}
              d={`M 4 ${y} L 16 ${y}`}
              stroke="rgb(148 163 184)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          ))}
          {/* The Topics board: ranked rows, each with its vote chip; the top
              chip is filled, the vote that put it there. */}
          <rect
            x="21"
            y="6"
            width="28"
            height="40"
            rx="3"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* Hover story: a vote lands on the third topic and it climbs
              above the second as the board re-sorts itself. */}
          {[0, 1, 2, 3].map((i) => (
            <g
              key={i}
              className={i === 1 || i === 2 ? 'pv-shift' : undefined}
              style={
                i === 1 || i === 2
                  ? pv({ '--pv-dy': i === 2 ? '-8.5px' : '8.5px', '--pv-at': '1500ms' })
                  : undefined
              }
            >
              <rect
                x="24"
                y={11 + i * 8.5}
                width="5"
                height="6"
                rx="1.2"
                fill={i === 0 ? 'rgb(14 165 233)' : 'rgb(224 242 254)'}
              />
              {i === 2 ? (
                <rect
                  className="pv-new"
                  opacity="0"
                  x="24"
                  y={11 + i * 8.5}
                  width="5"
                  height="6"
                  rx="1.2"
                  fill="rgb(14 165 233)"
                  style={pv({ '--pv-at': '900ms' })}
                />
              ) : null}
              <path
                d={`M 31 ${14 + i * 8.5} L ${45 - i * 3} ${14 + i * 8.5}`}
                stroke="rgb(100 116 139)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </g>
          ))}
          {/* The timebox timer and the keep-going poll. */}
          <circle
            cx="58"
            cy="12"
            r="5"
            fill="rgb(224 242 254)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          {/* ...while the timebox's hand sweeps round... */}
          <g
            className="pv-spin"
            style={pv({
              '--pv-origin': '58px 12px',
              '--pv-at': '900ms',
              '--pv-dur': '2400ms',
            })}
          >
            <path
              d="M 58 9.5 L 58 12 L 60 13.2"
              fill="none"
              stroke="rgb(14 165 233)"
              strokeWidth="0.9"
              strokeLinecap="round"
            />
          </g>
          {/* Takeaways checklist; the story ticks them off in turn. */}
          {[25, 32, 39].map((y, i) => (
            <g key={y}>
              <rect
                x="53"
                y={y - 2.5}
                width="4"
                height="4"
                rx="0.8"
                fill="white"
                stroke="rgb(100 116 139)"
                strokeWidth="0.8"
              />
              <path
                className="pv-new"
                opacity="0"
                d={`M 53.9 ${y - 0.6} L 54.8 ${y + 0.4} L 56.3 ${y - 1.6}`}
                fill="none"
                stroke="rgb(34 197 94)"
                strokeWidth="0.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={pv({ '--pv-at': `${2300 + i * 350}ms` })}
              />
              <path
                d={`M 59.5 ${y - 0.5} L ${67 - i * 2} ${y - 0.5}`}
                stroke="rgb(148 163 184)"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
            </g>
          ))}
        </svg>
      );
    case 'town-hall':
      return (
        <svg width="70" height="46" viewBox="0 0 70 50" aria-hidden>
          {/* The agenda: segments with their minutes, the Q&A block current. */}
          <rect
            x="3"
            y="6"
            width="17"
            height="24"
            rx="2.5"
            fill="white"
            stroke="rgb(203 213 225)"
            strokeWidth="0.9"
          />
          {[11, 16, 21, 26].map((y, i) => (
            <path
              key={y}
              d={`M 6 ${y} L 17 ${y}`}
              stroke={i === 2 ? 'rgb(14 165 233)' : 'rgb(148 163 184)'}
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          ))}
          <rect
            x="3"
            y="34"
            width="17"
            height="8"
            rx="4"
            fill="rgb(224 242 254)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          {/* The questions board: the spotlit question lit at the top, the
              ranked queue under it. */}
          <rect
            x="24"
            y="4"
            width="26"
            height="43"
            rx="3"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <rect
            x="26.5"
            y="7"
            width="21"
            height="9"
            rx="2"
            fill="rgb(224 242 254)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          {/* Hover story: the spotlit question is answered and clears, the top
              of the queue slides up into the spotlight, the rest move up
              behind it, and a follow-up is ticked. */}
          <path
            className="pv-leave"
            d="M 29.5 11.5 L 44.5 11.5"
            stroke="rgb(14 165 233)"
            strokeWidth="1.3"
            strokeLinecap="round"
            style={pv({ '--pv-at': '1000ms' })}
          />
          {[0, 1, 2].map((i) => (
            <g
              key={i}
              className="pv-shift"
              style={pv({
                '--pv-dy': i === 0 ? '-11.5px' : '-8.5px',
                '--pv-at': i === 0 ? '1400ms' : '1900ms',
              })}
            >
              <rect
                x="27"
                y={20 + i * 8.5}
                width="4.5"
                height="6"
                rx="1.2"
                fill={i === 0 ? 'rgb(14 165 233)' : 'rgb(224 242 254)'}
              />
              <path
                d={`M 33.5 ${23 + i * 8.5} L ${46 - i * 3} ${23 + i * 8.5}`}
                stroke="rgb(100 116 139)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </g>
          ))}
          {/* Follow-ups checklist. */}
          {[12, 19, 26].map((y, i) => (
            <g key={y}>
              <rect
                x="54"
                y={y - 2.5}
                width="4"
                height="4"
                rx="0.8"
                fill="white"
                stroke="rgb(100 116 139)"
                strokeWidth="0.8"
              />
              {i === 0 ? (
                <path
                  className="pv-new"
                  opacity="0"
                  d={`M 54.9 ${y - 0.6} L 55.8 ${y + 0.4} L 57.3 ${y - 1.6}`}
                  fill="none"
                  stroke="rgb(34 197 94)"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={pv({ '--pv-at': '2500ms' })}
                />
              ) : null}
              <path
                d={`M 60.5 ${y - 0.5} L ${67 - i * 2} ${y - 0.5}`}
                stroke="rgb(148 163 184)"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
            </g>
          ))}
        </svg>
      );
    case 'flywheel':
      return (
        <svg width="70" height="46" viewBox="0 0 70 50" aria-hidden>
          {/* Hub + four orbiting sector circles with curved arrows hinting at clockwise motion. */}
          <circle
            cx="35"
            cy="25"
            r="7"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
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
              { cx: 35, cy: 7 },
              { cx: 53, cy: 25 },
              { cx: 35, cy: 43 },
              { cx: 17, cy: 25 },
            ].map((s, i) => (
              <circle
                key={i}
                cx={s.cx}
                cy={s.cy}
                r="5"
                fill="white"
                stroke="rgb(14 165 233)"
                strokeWidth="0.9"
              />
            ))}
            {/* Clockwise arrows (curved using quad paths). */}
            <path
              d="M 41 9 Q 50 12 51 19"
              fill="none"
              stroke="rgb(100 116 139)"
              strokeWidth="0.85"
              strokeLinecap="round"
            />
            <path
              d="M 51 31 Q 50 38 41 41"
              fill="none"
              stroke="rgb(100 116 139)"
              strokeWidth="0.85"
              strokeLinecap="round"
            />
            <path
              d="M 29 41 Q 20 38 19 31"
              fill="none"
              stroke="rgb(100 116 139)"
              strokeWidth="0.85"
              strokeLinecap="round"
            />
            <path
              d="M 19 19 Q 20 12 29 9"
              fill="none"
              stroke="rgb(100 116 139)"
              strokeWidth="0.85"
              strokeLinecap="round"
            />
            {/* Arrowheads on the trailing end of each curve. */}
            <polygon points="51,19 49,17 53,17" fill="rgb(100 116 139)" />
            <polygon points="41,41 39,39 39,43" fill="rgb(100 116 139)" />
            <polygon points="19,31 21,33 17,33" fill="rgb(100 116 139)" />
            <polygon points="29,9 31,11 31,7" fill="rgb(100 116 139)" />
          </g>
        </svg>
      );
    case 'logo-design':
      // Four mini lockups in a 2x2 grid: top-left icon-left, top-right
      // icon-left-with-tagline, bottom-left icon-above, bottom-right
      // icon-above-with-tagline. Matches the canvas layout the builder
      // produces so the preview previews what users get.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {/* Top-left: icon left, brand only. */}
          <circle
            cx="9"
            cy="11"
            r="4"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect x="16" y="9" width="18" height="4" rx="0.8" fill="rgb(15 23 42)" />
          {/* Top-right: icon left + tagline. */}
          <circle
            cx="48"
            cy="11"
            r="4"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect x="55" y="7" width="18" height="4" rx="0.8" fill="rgb(15 23 42)" />
          <rect x="55" y="12.5" width="14" height="2.5" rx="0.5" fill="rgb(148 163 184)" />
          {/* Bottom-left: icon above, brand only. */}
          <circle
            cx="14"
            cy="32"
            r="4"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect x="5" y="39" width="18" height="4" rx="0.8" fill="rgb(15 23 42)" />
          {/* Bottom-right: icon above + tagline. */}
          <circle
            cx="53"
            cy="30"
            r="4"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect x="44" y="37" width="18" height="4" rx="0.8" fill="rgb(15 23 42)" />
          <rect x="46" y="43" width="14" height="2.5" rx="0.5" fill="rgb(148 163 184)" />
          {/* Hover story: the mark is tried in a new colour on each lockup in
              turn, then one lockup is picked (a selection frame lands on it). */}
          {(
            [
              [9, 11, 'rgb(14 165 233)'],
              [48, 11, 'rgb(139 92 246)'],
              [14, 32, 'rgb(245 158 11)'],
              [53, 30, 'rgb(16 185 129)'],
            ] as [number, number, string][]
          ).map(([cx, cy, fill], i) => (
            <circle
              key={i}
              className="pv-new"
              opacity="0"
              cx={cx}
              cy={cy}
              r="4"
              fill={fill}
              style={pv({ '--pv-at': `${900 + i * 300}ms` })}
            />
          ))}
          <rect
            className="pv-new"
            opacity="0"
            x="41"
            y="4"
            width="35"
            height="14"
            rx="2"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
            strokeDasharray="2 1.5"
            style={pv({ '--pv-at': '2400ms' })}
          />
        </svg>
      );
    case 'gantt':
      // Month header strip + four cascading milestone rows (label +
      // track + a coloured duration bar that steps right each row).
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="24"
            y="3"
            width="53"
            height="7"
            rx="1"
            fill="rgb(226 232 240)"
            stroke="rgb(148 163 184)"
            strokeWidth="0.5"
          />
          {[
            { y: 13, bx: 25, bw: 10, fill: 'rgb(79 134 198)' },
            { y: 21, bx: 30, bw: 14, fill: 'rgb(125 107 176)' },
            { y: 29, bx: 40, bw: 18, fill: 'rgb(201 138 59)' },
            { y: 37, bx: 52, bw: 14, fill: 'rgb(106 155 94)' },
          ].map((r, i) => (
            <g key={r.y}>
              <rect
                x="3"
                y={r.y}
                width="74"
                height="6"
                rx="1"
                fill="rgb(241 245 249)"
                stroke="rgb(203 213 225)"
                strokeWidth="0.4"
              />
              <rect x="4.5" y={r.y + 1} width="17" height="4" rx="0.5" fill="rgb(148 163 184)" />
              {/* Hover story: each duration bar grows in, one after another. */}
              <rect
                x={r.bx}
                y={r.y + 1}
                width={r.bw}
                height="4"
                rx="1"
                fill={r.fill}
                className="pv-grow-x"
                style={pv({ '--pv-at': `${600 + i * 220}ms` })}
              />
            </g>
          ))}
        </svg>
      );
    case 'live-card':
      // Left panel: hero image placeholder + bold title. Right panel:
      // a board of avatar + message rows.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="3"
            y="3"
            width="36"
            height="44"
            rx="2"
            fill="rgb(224 231 255)"
            stroke="rgb(67 56 202)"
            strokeWidth="0.6"
          />
          <rect
            x="6"
            y="6"
            width="30"
            height="24"
            rx="1"
            fill="white"
            stroke="rgb(165 180 252)"
            strokeWidth="0.5"
            strokeDasharray="1.5 1"
          />
          <rect x="6" y="33" width="30" height="5" rx="1" fill="rgb(49 46 129)" />
          <rect
            x="41"
            y="3"
            width="36"
            height="44"
            rx="2"
            fill="rgb(224 231 255)"
            stroke="rgb(67 56 202)"
            strokeWidth="0.6"
          />
          {[6, 16, 26, 36].map((ry) => (
            <g key={ry}>
              <rect
                x="44"
                y={ry}
                width="30"
                height="8"
                rx="1"
                fill="none"
                stroke="rgb(99 102 241)"
                strokeWidth="0.4"
                strokeDasharray="1.5 1"
              />
              <rect
                x="45.5"
                y={ry + 1.5}
                width="5"
                height="5"
                rx="0.8"
                fill="white"
                stroke="rgb(165 180 252)"
                strokeWidth="0.4"
              />
              <rect x="52" y={ry + 3} width="20" height="2" rx="0.5" fill="rgb(99 102 241)" />
            </g>
          ))}
          {/* Hover story: guests' messages land on the board one after another,
              each filling an empty slot with its own avatar colour. */}
          {(
            [
              [6, 'rgb(244 114 182)'],
              [16, 'rgb(52 211 153)'],
              [26, 'rgb(251 191 36)'],
              [36, 'rgb(56 189 248)'],
            ] as [number, string][]
          ).map(([ry, avatar], i) => {
            const motion = pv({ '--pv-from-y': '5px', '--pv-at': `${900 + i * 380}ms` });
            return (
              <g key={ry}>
                <rect
                  className="pv-arrive"
                  opacity="0"
                  x="44"
                  y={ry}
                  width="30"
                  height="8"
                  rx="1"
                  fill="white"
                  stroke="rgb(99 102 241)"
                  strokeWidth="0.5"
                  style={motion}
                />
                <rect
                  className="pv-arrive"
                  opacity="0"
                  x="45.5"
                  y={ry + 1.5}
                  width="5"
                  height="5"
                  rx="2.5"
                  fill={avatar}
                  style={motion}
                />
                <rect
                  className="pv-arrive"
                  opacity="0"
                  x="52"
                  y={ry + 3}
                  width="18"
                  height="2"
                  rx="0.5"
                  fill="rgb(49 46 129)"
                  style={motion}
                />
              </g>
            );
          })}
        </svg>
      );
    case 'comparison-table':
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="6"
            y="6"
            width="68"
            height="38"
            rx="2"
            fill="white"
            stroke="rgb(148 163 184)"
            strokeWidth="0.8"
          />
          <rect x="6" y="6" width="68" height="9" fill="rgb(226 232 240)" />
          <rect x="6" y="15" width="17" height="29" fill="rgb(241 245 249)" />
          {[24, 33].map((y) => (
            <line
              key={y}
              x1="6"
              y1={y}
              x2="74"
              y2={y}
              stroke="rgb(203 213 225)"
              strokeWidth="0.5"
            />
          ))}
          {[23, 40, 57].map((x) => (
            <line
              key={x}
              x1={x}
              y1="6"
              x2={x}
              y2="44"
              stroke="rgb(203 213 225)"
              strokeWidth="0.5"
            />
          ))}
          {/* Hover story: the options are scored cell by cell, row by row: a
              tick where an option has it, a cross where it doesn't. */}
          {(
            [
              [31.5, 19.5, true],
              [48.5, 19.5, true],
              [65.5, 19.5, false],
              [31.5, 28.5, true],
              [48.5, 28.5, false],
              [65.5, 28.5, true],
              [31.5, 38.5, true],
              [48.5, 38.5, true],
              [65.5, 38.5, true],
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
              stroke={yes ? 'rgb(16 185 129)' : 'rgb(244 63 94)'}
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={pv({ '--pv-at': `${900 + i * 170}ms` })}
            />
          ))}
        </svg>
      );
    case 'system-architecture':
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {/* client → gateway → two services → two datastores */}
          {[
            [40, 11, 40, 16],
            [40, 24, 21, 29],
            [40, 24, 59, 29],
            [21, 37, 19, 42],
            [59, 37, 56, 42],
          ].map(([x1, y1, x2, y2], i) => (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgb(148 163 184)"
              strokeWidth="0.7"
            />
          ))}
          {[
            { x: 31, y: 3, w: 18 },
            { x: 31, y: 16, w: 18 },
            { x: 10, y: 29, w: 22 },
            { x: 48, y: 29, w: 22 },
          ].map((b, i) => (
            <rect
              key={i}
              x={b.x}
              y={b.y}
              width={b.w}
              height="8"
              rx="1.5"
              fill="white"
              stroke="rgb(100 116 139)"
              strokeWidth="0.75"
            />
          ))}
          {[19, 56].map((cxv) => (
            <g key={cxv}>
              <rect
                x={cxv - 7}
                y="42"
                width="14"
                height="6"
                fill="rgb(226 232 240)"
                stroke="rgb(100 116 139)"
                strokeWidth="0.75"
              />
              <ellipse
                cx={cxv}
                cy="42"
                rx="7"
                ry="1.6"
                fill="white"
                stroke="rgb(100 116 139)"
                strokeWidth="0.75"
              />
            </g>
          ))}
          {/* Hover story: requests flow down the stack, client to gateway,
              fanned out to both services, and on into their datastores. */}
          {(
            [
              [40, 11, 0, 5, 900],
              [40, 24, -19, 5, 1250],
              [40, 24, 19, 5, 1450],
              [21, 37, -2, 5, 1750],
              [59, 37, -3, 5, 1950],
            ] as [number, number, number, number, number][]
          ).map(([cx, cy, dx, dy, at], i) => (
            <circle
              key={i}
              className="pv-travel"
              opacity="0"
              cx={cx}
              cy={cy}
              r="1.4"
              fill="rgb(14 165 233)"
              style={pv({
                '--pv-dx': `${dx}px`,
                '--pv-dy': `${dy}px`,
                '--pv-at': `${at}ms`,
                '--pv-dur': '1400ms',
              })}
            />
          ))}
        </svg>
      );
    case 'er-diagram':
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {/* Hover story: each relationship draws itself from table to table,
              then a new one links the top-left table to the bottom-right and a
              new field lands in that table. */}
          {[
            [34, 13, 46, 13],
            [60, 21, 60, 29],
            [34, 37, 46, 37],
          ].map(([x1, y1, x2, y2], i) => (
            // A path, not a <line>: Chrome ignores pathLength on <line>, so the
            // draw-in would render as dashes.
            <path
              key={i}
              d={`M${x1} ${y1} L${x2} ${y2}`}
              fill="none"
              stroke="rgb(148 163 184)"
              strokeWidth="0.7"
              pathLength="1"
              className="pv-draw"
              style={pv({ '--pv-at': `${900 + i * 350}ms`, '--pv-dur': '500ms' })}
            />
          ))}
          <line
            className="pv-new"
            opacity="0"
            x1="34"
            y1="21"
            x2="46"
            y2="29"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
            style={pv({ '--pv-at': '2100ms' })}
          />
          {[
            { x: 6, y: 5 },
            { x: 46, y: 5 },
            { x: 6, y: 29 },
            { x: 46, y: 29 },
          ].map((t, i) => (
            <g key={i}>
              <rect
                x={t.x}
                y={t.y}
                width="28"
                height="16"
                rx="1.5"
                fill="white"
                stroke="rgb(100 116 139)"
                strokeWidth="0.75"
              />
              <rect x={t.x} y={t.y} width="28" height="5" fill="rgb(226 232 240)" />
              <line
                x1={t.x}
                y1={t.y + 10}
                x2={t.x + 28}
                y2={t.y + 10}
                stroke="rgb(203 213 225)"
                strokeWidth="0.5"
              />
            </g>
          ))}
          <rect
            className="pv-new"
            opacity="0"
            x="48"
            y="40"
            width="18"
            height="2.5"
            rx="0.5"
            fill="rgb(14 165 233)"
            style={pv({ '--pv-at': '2500ms' })}
          />
        </svg>
      );
    case 'sequence-diagram':
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[10, 30, 50, 70].map((mx) => (
            <g key={mx}>
              <line
                x1={mx}
                y1="11"
                x2={mx}
                y2="47"
                stroke="rgb(148 163 184)"
                strokeWidth="0.6"
                strokeDasharray="2 2"
              />
              <rect
                x={mx - 7}
                y="3"
                width="14"
                height="8"
                rx="1.5"
                fill="white"
                stroke="rgb(100 116 139)"
                strokeWidth="0.75"
              />
            </g>
          ))}
          {/* Hover story: the calls cross the lifelines in order, each drawn
              from caller to callee, then the dashed reply runs back (grown
              from its right end, via the flipped group) and a response token
              travels it. */}
          {[
            { x1: 10, x2: 30, y: 18 },
            { x1: 30, x2: 50, y: 26 },
            { x1: 50, x2: 70, y: 34 },
          ].map((m, i) => (
            // A path for the same reason as the schema's relationships.
            <path
              key={i}
              d={`M${m.x1} ${m.y} L${m.x2} ${m.y}`}
              fill="none"
              stroke="rgb(100 116 139)"
              strokeWidth="0.8"
              pathLength="1"
              className="pv-draw"
              style={pv({ '--pv-at': `${900 + i * 400}ms`, '--pv-dur': '450ms' })}
            />
          ))}
          <g transform="translate(80 0) scale(-1 1)">
            <line
              x1="30"
              y1="42"
              x2="50"
              y2="42"
              stroke="rgb(100 116 139)"
              strokeWidth="0.8"
              strokeDasharray="2 2"
              className="pv-grow-x"
              style={pv({ '--pv-at': '2100ms', '--pv-dur': '450ms' })}
            />
          </g>
          <circle
            className="pv-travel"
            opacity="0"
            cx="50"
            cy="42"
            r="1.4"
            fill="rgb(14 165 233)"
            style={pv({ '--pv-dx': '-20px', '--pv-at': '2600ms', '--pv-dur': '1300ms' })}
          />
        </svg>
      );
    case 'prioritization-matrix':
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {/* Crossed value / effort axes (a centred quadrant divider plus
              an L-frame) with a few items scattered across the field:
              matching the builder's drag-into-a-quadrant layout. */}
          {/* L-frame: left + bottom axes with arrowheads toward "more". */}
          <path
            d="M9 44 L9 6 M7 9 L9 6 L11 9"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 44 L74 44 M71 42 L74 44 L71 46"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Centred quadrant cross (double-headed). */}
          <line x1="14" y1="25" x2="70" y2="25" stroke="rgb(14 165 233)" strokeWidth="0.7" />
          <line x1="42" y1="11" x2="42" y2="41" stroke="rgb(14 165 233)" strokeWidth="0.7" />
          {/* Hover story: the board is reprioritised. Up is more value,
              right is more effort, so top-left is the quick wins. The
              undecided item on the divider (tinted, so the eye can follow it)
              is dragged into the quick wins as the item there makes room,
              the quadrant lights up, then the costly top-right item is
              demoted to later as its new neighbour shuffles aside. Every
              final position clears the dividers and the other boxes. */}
          <rect
            className="pv-new"
            opacity="0"
            x="14.5"
            y="11.5"
            width="27"
            height="13"
            rx="1.5"
            fill="rgb(220 252 231)"
            style={pv({ '--pv-at': '2000ms' })}
          />
          {(
            [
              // [centre x, centre y, dx, dy, start ms, fill, stroke]
              [24, 15, -3, -1, 900, 'white', 'rgb(100 116 139)'],
              [30, 36, 0, 0, 0, 'white', 'rgb(100 116 139)'],
              [60, 33, 2.5, 3.5, 2300, 'white', 'rgb(100 116 139)'],
              [58, 13, -8, 16.5, 2450, 'white', 'rgb(100 116 139)'],
              [47, 22, -12, -1, 1100, 'rgb(224 242 254)', 'rgb(14 165 233)'],
            ] as [number, number, number, number, number, string, string][]
          ).map(([x, y, dx, dy, at, fill, stroke], i) => (
            <rect
              key={i}
              x={x - 6.5}
              y={y - 3.5}
              width="13"
              height="7"
              rx="1"
              fill={fill}
              stroke={stroke}
              strokeWidth="0.7"
              className={at ? 'pv-shift' : undefined}
              style={
                at
                  ? pv({
                      '--pv-dx': `${dx}px`,
                      '--pv-dy': `${dy}px`,
                      '--pv-at': `${at}ms`,
                      '--pv-dur': '800ms',
                    })
                  : undefined
              }
            />
          ))}
        </svg>
      );
    default:
      return null;
  }
}
