import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { pv } from '@liveworkspace/template-previews/motion';

// Group 3 of 3 (strategy / design / technical, plus the Q&A board's live-session boards). Static SVG preview tiles (one branch per
// TemplateKind; see template-preview.tsx for who renders them). Split out of template-preview.tsx to keep each file under the
// ~1000-line budget; TemplatePreview chains the groups with ??.
export function templatePreviewGroup3(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'lean-coffee':
      return (
        <svg width="70" height="46" viewBox="0 0 70 50" aria-hidden>
          {/* The four-step loop down the left (Propose / Vote / Discuss /
              Keep going?), joined by arrows, with the loop back to Discuss. */}
          {[
            { y: 5, fill: 'rgb(224 242 254)', ink: 'rgb(3 105 161)' },
            { y: 16, fill: 'rgb(237 233 254)', ink: 'rgb(109 40 217)' },
            { y: 27, fill: 'rgb(254 243 199)', ink: 'rgb(180 83 9)' },
            { y: 38, fill: 'rgb(220 252 231)', ink: 'rgb(21 128 61)' },
          ].map((s) => (
            <g key={s.y}>
              <rect
                x="2"
                y={s.y}
                width="14"
                height="7.5"
                rx="1.2"
                fill={s.fill}
                stroke={s.ink}
                strokeWidth="0.6"
              />
              <circle cx="5" cy={s.y + 3.75} r="1.6" fill={s.ink} />
              <path
                d={`M 8 ${s.y + 3.75} L 13.5 ${s.y + 3.75}`}
                stroke={s.ink}
                strokeWidth="1"
                strokeLinecap="round"
              />
            </g>
          ))}
          <path
            d="M 9 12.5 L 9 16 M 9 23.5 L 9 27 M 9 34.5 L 9 38"
            stroke="rgb(71 85 105)"
            strokeWidth="0.7"
          />
          <path
            d="M 16 41.75 Q 20.5 36.25 16 30.75"
            fill="none"
            stroke="rgb(71 85 105)"
            strokeWidth="0.7"
          />
          {/* The Topics board: ranked rows, each with its vote chip; the top
              chip is filled, the vote that put it there. */}
          <rect
            x="22"
            y="6"
            width="27"
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
                x="25"
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
                  x="25"
                  y={11 + i * 8.5}
                  width="5"
                  height="6"
                  rx="1.2"
                  fill="rgb(14 165 233)"
                  style={pv({ '--pv-at': '900ms' })}
                />
              ) : null}
              <path
                d={`M 32 ${14 + i * 8.5} L ${45 - i * 3} ${14 + i * 8.5}`}
                stroke="rgb(100 116 139)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </g>
          ))}
          {/* The kit: the timebox timer, whose hand sweeps round... */}
          <circle
            cx="58"
            cy="11"
            r="5"
            fill="rgb(224 242 254)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <g
            className="pv-spin"
            style={pv({
              '--pv-origin': '58px 11px',
              '--pv-at': '900ms',
              '--pv-dur': '2400ms',
            })}
          >
            <path
              d="M 58 8.5 L 58 11 L 60 12.2"
              fill="none"
              stroke="rgb(14 165 233)"
              strokeWidth="0.9"
              strokeLinecap="round"
            />
          </g>
          {/* ...the keep-going poll's bars... */}
          <rect
            x="53"
            y="19"
            width="10"
            height="7"
            rx="1.5"
            fill="white"
            stroke="rgb(203 213 225)"
            strokeWidth="0.7"
          />
          <path
            d="M 56 24.5 L 56 22.5 M 58 24.5 L 58 21 M 60 24.5 L 60 22"
            stroke="rgb(100 116 139)"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          {/* ...and the takeaways, ticked off in turn. */}
          {[33, 40].map((y, i) => (
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
          {/* The panel (an initials disc each) over the run-of-show agenda,
              the Q&A block current. */}
          {[
            { y: 6, fill: 'rgb(124 58 237)' },
            { y: 11.5, fill: 'rgb(8 145 178)' },
            { y: 17, fill: 'rgb(219 39 119)' },
          ].map((p) => (
            <g key={p.y}>
              <circle cx="5" cy={p.y} r="2.2" fill={p.fill} />
              <path
                d={`M 9 ${p.y} L 18 ${p.y}`}
                stroke="rgb(100 116 139)"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
            </g>
          ))}
          <rect
            x="2"
            y="22"
            width="18"
            height="24"
            rx="2.5"
            fill="white"
            stroke="rgb(203 213 225)"
            strokeWidth="0.9"
          />
          {[27, 31.5, 36, 40.5].map((y, i) => (
            <path
              key={y}
              d={`M 5 ${y} L 17 ${y}`}
              stroke={i === 2 ? 'rgb(14 165 233)' : 'rgb(148 163 184)'}
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          ))}
          {/* The questions board: the spotlit question lit at the top, the
              ranked queue under it. */}
          <rect
            x="23.5"
            y="4"
            width="26"
            height="43"
            rx="3"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <rect
            x="26"
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
            d="M 29 11.5 L 44 11.5"
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
                x="26.5"
                y={20 + i * 8.5}
                width="4.5"
                height="6"
                rx="1.2"
                fill={i === 0 ? 'rgb(14 165 233)' : 'rgb(224 242 254)'}
              />
              <path
                d={`M 33 ${23 + i * 8.5} L ${45.5 - i * 3} ${23 + i * 8.5}`}
                stroke="rgb(100 116 139)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </g>
          ))}
          {/* The kit: the Q&A timer beside the applause pad. */}
          <rect
            x="53"
            y="5"
            width="7"
            height="8"
            rx="2"
            fill="rgb(224 242 254)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect
            x="61.5"
            y="5"
            width="7"
            height="8"
            rx="2"
            fill="rgb(254 243 199)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          {/* Follow-ups checklist. */}
          {[22, 29, 36].map((y, i) => (
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
