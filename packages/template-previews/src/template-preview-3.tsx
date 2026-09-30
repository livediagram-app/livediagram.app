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
    case 'logo-design':
      // The exploration sheet: a 3x2 grid of artboards (horizontal, stacked,
      // app icon / horizontal + tagline, stacked + tagline, one colour) over
      // a four-swatch palette strip, the same composition the builder lays
      // out, in the brand's espresso + sunrise colours.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x={3 + (i % 3) * 25.5}
              y={3 + Math.floor(i / 3) * 17}
              width="23"
              height="15"
              rx="1"
              fill="white"
              stroke="rgb(203 213 225)"
              strokeWidth="0.6"
            />
          ))}
          {/* 01 horizontal and 04 horizontal + tagline. */}
          <circle cx="8.5" cy="10.5" r="2.6" fill="rgb(245 158 11)" />
          <rect x="12.5" y="9.3" width="10" height="2.4" rx="0.6" fill="rgb(59 31 20)" />
          <circle cx="8.5" cy="27.5" r="2.6" fill="rgb(245 158 11)" />
          <rect x="12.5" y="25.6" width="10" height="2.4" rx="0.6" fill="rgb(59 31 20)" />
          <rect x="12.5" y="29" width="8" height="1.3" rx="0.4" fill="rgb(146 64 14)" />
          {/* 02 stacked and 05 stacked + tagline. */}
          <circle cx="40" cy="8.5" r="2.6" fill="rgb(245 158 11)" />
          <rect x="35" y="12.5" width="10" height="2.4" rx="0.6" fill="rgb(59 31 20)" />
          <circle cx="40" cy="24.5" r="2.6" fill="rgb(245 158 11)" />
          <rect x="35" y="28.5" width="10" height="2.4" rx="0.6" fill="rgb(59 31 20)" />
          <rect x="36" y="32" width="8" height="1.3" rx="0.4" fill="rgb(146 64 14)" />
          {/* 03 app icon and 06 one colour. */}
          <rect x="60" y="5.5" width="10" height="10" rx="2.4" fill="rgb(59 31 20)" />
          <circle cx="65" cy="10.5" r="3.2" fill="rgb(245 158 11)" />
          <circle cx="59.5" cy="27.5" r="2.6" fill="rgb(31 41 55)" />
          <rect x="63.5" y="26.3" width="10" height="2.4" rx="0.6" fill="rgb(31 41 55)" />
          {/* Palette strip. */}
          {['rgb(59 31 20)', 'rgb(245 158 11)', 'rgb(254 243 199)', 'rgb(31 41 55)'].map(
            (fill, i) => (
              <rect
                key={fill}
                x={3 + i * 19}
                y="39"
                width="17"
                height="7"
                rx="1.5"
                fill={fill}
                stroke={i === 2 ? 'rgb(252 211 77)' : fill}
                strokeWidth="0.5"
              />
            ),
          )}
          {/* Hover story: the sun rises on each mark in turn, then the
              horizontal lockup is picked (a selection frame lands on it). */}
          {(
            [
              [8.5, 10.5, 900],
              [40, 8.5, 1150],
              [65, 10.5, 1400],
              [8.5, 27.5, 1650],
              [40, 24.5, 1900],
            ] as [number, number, number][]
          ).map(([cx, cy, at], i) => (
            <circle
              key={i}
              className="pv-new"
              opacity="0"
              cx={cx}
              cy={cy}
              r="1.1"
              fill="rgb(59 31 20)"
              style={pv({ '--pv-at': `${at}ms` })}
            />
          ))}
          <rect
            className="pv-new"
            opacity="0"
            x="2"
            y="2"
            width="25"
            height="17"
            rx="1.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
            strokeDasharray="2 1.5"
            style={pv({ '--pv-at': '2400ms' })}
          />
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
    case 'live-card':
      // The group card opened flat: a pink cover page (title, photo slot,
      // a party sticker) beside a cream message wall of pastel notes, each
      // with its initials badge, and a dashed slot waiting for yours.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="3"
            y="3"
            width="28"
            height="44"
            rx="2"
            fill="rgb(253 242 248)"
            stroke="rgb(249 168 212)"
            strokeWidth="0.6"
          />
          <rect x="8" y="7" width="18" height="2.6" rx="0.6" fill="rgb(15 23 42)" />
          <rect
            x="7"
            y="12"
            width="20"
            height="20"
            rx="1.5"
            fill="rgb(241 245 249)"
            stroke="rgb(148 163 184)"
            strokeWidth="0.5"
            strokeDasharray="1.5 1"
          />
          <circle cx="8" cy="41" r="3.4" fill="white" stroke="rgb(226 232 240)" strokeWidth="0.4" />
          <circle cx="8" cy="41" r="2" fill="rgb(244 114 182)" />
          <rect
            x="33"
            y="3"
            width="44"
            height="44"
            rx="2"
            fill="rgb(255 251 235)"
            stroke="rgb(252 211 77)"
            strokeWidth="0.6"
          />
          {(
            [
              [36, 6, 'rgb(254 240 138)', 'rgb(202 138 4)'],
              [56, 6, 'rgb(251 207 232)', 'rgb(219 39 119)'],
              [36, 16, 'rgb(191 219 254)', 'rgb(37 99 235)'],
              [56, 16, 'rgb(187 247 208)', 'rgb(22 163 74)'],
              [36, 26, 'rgb(221 214 254)', 'rgb(124 58 237)'],
              [56, 26, 'rgb(254 215 170)', 'rgb(234 88 12)'],
              [36, 36, 'rgb(165 243 252)', 'rgb(8 145 178)'],
            ] as [number, number, string, string][]
          ).map(([x, y, paper, badge]) => (
            <g key={`${x}-${y}`}>
              <rect x={x} y={y} width="18" height="8" fill={paper} />
              <rect x={x + 1.5} y={y + 2} width="11" height="1.2" rx="0.4" fill="rgb(71 85 105)" />
              <circle cx={x + 17} cy={y + 0.5} r="1.8" fill={badge} />
            </g>
          ))}
          <rect
            x="56"
            y="36"
            width="18"
            height="8"
            rx="1"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.5"
            strokeDasharray="1.5 1"
          />
          {/* Hover story: a new teammate signs the empty slot, then the
              confetti pops on the cover. */}
          <rect
            className="pv-arrive"
            opacity="0"
            x="56"
            y="36"
            width="18"
            height="8"
            fill="rgb(254 202 202)"
            style={pv({ '--pv-from-y': '5px', '--pv-at': '900ms' })}
          />
          <circle
            className="pv-arrive"
            opacity="0"
            cx="73"
            cy="36.5"
            r="1.8"
            fill="rgb(220 38 38)"
            style={pv({ '--pv-from-y': '5px', '--pv-at': '1100ms' })}
          />
          {(
            [
              [22, 36, 'rgb(245 158 11)'],
              [26, 40, 'rgb(59 130 246)'],
              [20, 42, 'rgb(236 72 153)'],
            ] as [number, number, string][]
          ).map(([cx, cy, fill], i) => (
            <circle
              key={i}
              className="pv-new"
              opacity="0"
              cx={cx}
              cy={cy}
              r="1.1"
              fill={fill}
              style={pv({ '--pv-at': `${1700 + i * 150}ms` })}
            />
          ))}
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
    case 'system-architecture':
      // Four tier lanes (Clients / Edge / Services / Data), each with its
      // title gutter; the gateway (bold) takes both clients' requests and
      // fans out to the services, orders publish sideways to the queue, and
      // each service drops straight into its store.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[3, 14.5, 26, 37.5].map((y) => (
            <g key={y}>
              <rect
                x="3"
                y={y}
                width="74"
                height="10"
                rx="1.2"
                fill="rgb(240 249 255)"
                stroke="rgb(125 211 252)"
                strokeWidth="0.5"
              />
              <rect x="3" y={y} width="9" height="10" rx="1.2" fill="rgb(224 242 254)" />
            </g>
          ))}
          {/* Wiring: every edge is vertical or horizontal, none cross. */}
          {[
            'M 34 11 L 34 16.5',
            'M 49 11 L 49 19.5 L 38.5 19.5',
            'M 53.5 8 L 64 8 L 64 16.5',
            'M 29.5 19.5 L 19 19.5 L 19 28',
            'M 34 23 L 34 28',
            'M 38.5 31 L 44.5 31',
            'M 53.5 31 L 59.5 31',
            'M 19 34 L 19 39.5',
            'M 34 34 L 34 39.5',
            'M 49 34 L 49 39.5',
            'M 64 34 L 64 39.5',
          ].map((d) => (
            <path key={d} d={d} fill="none" stroke="rgb(100 116 139)" strokeWidth="0.6" />
          ))}
          {(
            [
              [29.5, 5, false],
              [44.5, 5, false],
              [29.5, 16.5, true],
              [59.5, 16.5, false],
              [14.5, 28, false],
              [29.5, 28, false],
              [44.5, 28, false],
              [59.5, 28, false],
              [59.5, 39.5, false],
            ] as [number, number, boolean][]
          ).map(([x, y, bold]) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="9"
              height="6"
              rx="1"
              fill={bold ? 'rgb(3 105 161)' : 'white'}
              stroke="rgb(14 165 233)"
              strokeWidth="0.6"
            />
          ))}
          {[19, 34, 49].map((cxv) => (
            <g key={cxv}>
              <rect
                x={cxv - 4.5}
                y="40.5"
                width="9"
                height="5"
                fill="white"
                stroke="rgb(14 165 233)"
                strokeWidth="0.6"
              />
              <ellipse
                cx={cxv}
                cy="40.5"
                rx="4.5"
                ry="1.2"
                fill="white"
                stroke="rgb(14 165 233)"
                strokeWidth="0.6"
              />
            </g>
          ))}
          {/* Hover story: a request drops through the gateway into orders,
              which publishes an event the worker picks up. */}
          {(
            [
              [34, 11, 0, 5, 900],
              [34, 23, 0, 5, 1300],
              [38.5, 31, 6, 0, 1700],
              [53.5, 31, 6, 0, 2050],
            ] as [number, number, number, number, number][]
          ).map(([cx, cy, dx, dy, at], i) => (
            <circle
              key={i}
              className="pv-travel"
              opacity="0"
              cx={cx}
              cy={cy}
              r="1.3"
              fill="rgb(14 165 233)"
              style={pv({
                '--pv-dx': `${dx}px`,
                '--pv-dy': `${dy}px`,
                '--pv-at': `${at}ms`,
                '--pv-dur': '1200ms',
              })}
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
