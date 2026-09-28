import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';
import { popGroup } from './story-parts';

// Group 1 of 3 (mind maps / flowcharts). Static SVG preview tiles (one branch per
// TemplateKind; see template-preview.tsx for who renders them). Split out of template-preview.tsx to keep each file under the
// ~1000-line budget; TemplatePreview chains the groups with ??.
// A story group hidden at rest that pops in at `at` (pv-new on a <g>, scaled
// round its own box rather than the drawing's corner).
export function templatePreviewGroup1(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'blank':
      // Truly blank now (no seeded box): show an empty dashed canvas with a
      // faint centre "+" — "start from nothing, add your own".
      return (
        <svg width="60" height="36" viewBox="0 0 60 40" aria-hidden>
          <rect
            x="6"
            y="4"
            width="48"
            height="32"
            rx="3"
            fill="none"
            stroke="rgb(148 163 184)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <line x1="30" y1="14" x2="30" y2="26" stroke="rgb(148 163 184)" strokeWidth="1.5" />
          <line x1="24" y1="20" x2="36" y2="20" stroke="rgb(148 163 184)" strokeWidth="1.5" />
        </svg>
      );
    case 'mindmap':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          <circle
            cx="40"
            cy="25"
            r="9"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1.25"
          />
          <circle cx="14" cy="25" r="5" fill="none" stroke="rgb(14 165 233)" strokeWidth="1.25" />
          <circle cx="66" cy="25" r="5" fill="none" stroke="rgb(14 165 233)" strokeWidth="1.25" />
          <circle cx="40" cy="6" r="5" fill="none" stroke="rgb(14 165 233)" strokeWidth="1.25" />
          <circle cx="40" cy="44" r="5" fill="none" stroke="rgb(14 165 233)" strokeWidth="1.25" />
          <line x1="31" y1="25" x2="19" y2="25" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="49" y1="25" x2="61" y2="25" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="40" y1="16" x2="40" y2="11" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="40" y1="34" x2="40" y2="39" stroke="rgb(100 116 139)" strokeWidth="1" />
          {/* Hover story (preview-motion.css): two new ideas pop out of the
              centre and glide to their places, each connector following. */}
          <circle
            className="pv-arrive"
            opacity="0"
            cx="63"
            cy="10"
            r="4"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1.25"
            style={pv({ '--pv-from-x': '-19px', '--pv-from-y': '13px', '--pv-at': '900ms' })}
          />
          <line
            className="pv-new"
            opacity="0"
            x1="47.5"
            y1="20.1"
            x2="59.7"
            y2="12.2"
            stroke="rgb(100 116 139)"
            strokeWidth="1"
            style={pv({ '--pv-at': '1700ms' })}
          />
          <circle
            className="pv-arrive"
            opacity="0"
            cx="17"
            cy="41"
            r="4"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1.25"
            style={pv({ '--pv-from-x': '21px', '--pv-from-y': '-15px', '--pv-at': '1500ms' })}
          />
          <line
            className="pv-new"
            opacity="0"
            x1="32.6"
            y1="30.1"
            x2="20.3"
            y2="38.7"
            stroke="rgb(100 116 139)"
            strokeWidth="1"
            style={pv({ '--pv-at': '2300ms' })}
          />
        </svg>
      );
    case 'mindmap-tree':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {/* A bold root on the left, four tinted branches, two small leaves
              each: the three levels read apart by size and fill. */}
          <rect x="2" y="19" width="17" height="12" rx="2" fill="rgb(14 165 233)" />
          {[7.5, 19.5, 31.5, 43.5].map((c, i) => (
            <g key={c}>
              <path
                d={`M19 25 C24 25 23 ${c} 28 ${c}`}
                fill="none"
                stroke="rgb(100 116 139)"
                strokeWidth="0.9"
              />
              <rect
                x="28"
                y={c - 3.5}
                width="17"
                height="7"
                rx="1.5"
                fill="rgb(186 230 253)"
                stroke="rgb(56 189 248)"
                strokeWidth="0.8"
              />
              {[c - 3, c + 3].map((l, j) =>
                // The last leaf is the hover story's, grown in with Tab.
                i === 3 && j === 1 ? null : (
                  <g key={l}>
                    <path
                      d={`M45 ${c} C49 ${c} 48 ${l} 52 ${l}`}
                      fill="none"
                      stroke="rgb(148 163 184)"
                      strokeWidth="0.7"
                    />
                    <rect
                      x="52"
                      y={l - 2}
                      width="24"
                      height="4"
                      rx="1"
                      fill="white"
                      stroke="rgb(14 165 233)"
                      strokeWidth="0.7"
                    />
                  </g>
                ),
              )}
            </g>
          ))}
          {/* Hover story: Tab on the last branch grows its second leaf. */}
          <path
            className="pv-new"
            opacity="0"
            d="M45 43.5 C49 43.5 48 46.5 52 46.5"
            fill="none"
            stroke="rgb(148 163 184)"
            strokeWidth="0.7"
            style={pv({ '--pv-at': '1500ms' })}
          />
          <rect
            className="pv-arrive"
            opacity="0"
            x="52"
            y="44.5"
            width="24"
            height="4"
            rx="1"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="0.7"
            style={pv({ '--pv-from-x': '-10px', '--pv-at': '900ms' })}
          />
        </svg>
      );
    case 'mindmap-bubble':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {/* Central topic ringed by bubbles. */}
          {[
            [40, 6],
            [64, 16],
            [64, 34],
            [40, 44],
            [16, 34],
            [16, 16],
          ].map(([bx, by], i) => (
            <g key={`${bx}-${by}`}>
              <line x1="40" y1="25" x2={bx} y2={by} stroke="rgb(100 116 139)" strokeWidth="0.9" />
              {/* Hover story: a wave swells each bubble in turn round the
                  ring (a rotation would swing the oval ring past the tile). */}
              <circle
                cx={bx}
                cy={by}
                r="4.5"
                fill="none"
                stroke="rgb(14 165 233)"
                strokeWidth="1.25"
                className="pv-pulse"
                style={pv({ '--pv-at': `${900 + i * 160}ms` })}
              />
            </g>
          ))}
          <circle
            cx="40"
            cy="25"
            r="9"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1.25"
          />
          {/* ...then a new bubble sprouts off the lower-right one. */}
          <line
            className="pv-new"
            opacity="0"
            x1="67.5"
            y1="36.8"
            x2="71.7"
            y2="40.1"
            stroke="rgb(100 116 139)"
            strokeWidth="0.9"
            style={pv({ '--pv-at': '2000ms' })}
          />
          <circle
            className="pv-new"
            opacity="0"
            cx="74"
            cy="42"
            r="3"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1.25"
            style={pv({ '--pv-at': '2200ms' })}
          />
        </svg>
      );
    case 'orgchart':
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {/* CEO */}
          <rect
            x="32"
            y="2"
            width="16"
            height="7"
            rx="1.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* VP row */}
          {[6, 33, 60].map((x) => (
            <rect
              key={x}
              x={x}
              y="20"
              width="14"
              height="6"
              rx="1.25"
              fill="none"
              stroke="rgb(14 165 233)"
              strokeWidth="0.9"
              // Hover story: the middle VP, who gains the new hire below.
              {...(x === 33 ? { className: 'pv-pulse', style: pv({ '--pv-at': '2100ms' }) } : {})}
            />
          ))}
          {/* 3rd level: 2 reports under each VP */}
          {[
            [4, 12],
            [31, 39],
            [58, 66],
          ].map(([l, r], i) => (
            <g key={i}>
              <rect
                x={l}
                y="40"
                width="8"
                height="5"
                rx="1"
                fill="none"
                stroke="rgb(14 165 233)"
                strokeWidth="0.8"
              />
              <rect
                x={r}
                y="40"
                width="8"
                height="5"
                rx="1"
                fill="none"
                stroke="rgb(14 165 233)"
                strokeWidth="0.8"
              />
            </g>
          ))}
          {/* CEO -> VPs */}
          <line x1="40" y1="9" x2="40" y2="15" stroke="rgb(100 116 139)" strokeWidth="0.85" />
          <line x1="13" y1="15" x2="67" y2="15" stroke="rgb(100 116 139)" strokeWidth="0.85" />
          <line x1="13" y1="15" x2="13" y2="20" stroke="rgb(100 116 139)" strokeWidth="0.85" />
          <line x1="40" y1="15" x2="40" y2="20" stroke="rgb(100 116 139)" strokeWidth="0.85" />
          <line x1="67" y1="15" x2="67" y2="20" stroke="rgb(100 116 139)" strokeWidth="0.85" />
          {/* VPs -> reports */}
          {[13, 40, 67].map((vpX, i) => (
            <g key={i}>
              <line
                x1={vpX}
                y1="26"
                x2={[8, 35, 62][i]}
                y2="40"
                stroke="rgb(100 116 139)"
                strokeWidth="0.7"
              />
              <line
                x1={vpX}
                y1="26"
                x2={[16, 43, 70][i]}
                y2="40"
                stroke="rgb(100 116 139)"
                strokeWidth="0.7"
              />
            </g>
          ))}
          {/* Hover story: a new hire drops in beside the middle VP's team and
              their reporting line joins up. */}
          <rect
            className="pv-arrive"
            opacity="0"
            x="48.5"
            y="40"
            width="8"
            height="5"
            rx="1"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
            style={pv({ '--pv-from-y': '-14px', '--pv-from-x': '-8px', '--pv-at': '900ms' })}
          />
          <line
            className="pv-new"
            opacity="0"
            x1="40"
            y1="26"
            x2="52.5"
            y2="40"
            stroke="rgb(100 116 139)"
            strokeWidth="0.7"
            style={pv({ '--pv-at': '1700ms' })}
          />
        </svg>
      );
    case 'flowchart':
      return (
        <svg width="60" height="44" viewBox="0 0 60 50" aria-hidden>
          {/* Start (stadium) */}
          <rect
            x="14"
            y="2"
            width="20"
            height="7"
            rx="3.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* Step 1 (square) */}
          <rect
            x="14"
            y="14"
            width="20"
            height="7"
            rx="1"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* Decision (diamond) */}
          <polygon
            points="24,25 33,32 24,39 15,32"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* End (stadium) */}
          <rect
            x="14"
            y="42"
            width="20"
            height="6"
            rx="3"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* Side branch */}
          <rect
            x="40"
            y="29"
            width="16"
            height="6"
            rx="1"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* Arrows (simple lines) */}
          <line x1="24" y1="9" x2="24" y2="14" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="24" y1="21" x2="24" y2="25" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="24" y1="39" x2="24" y2="42" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="33" y1="32" x2="40" y2="32" stroke="rgb(100 116 139)" strokeWidth="1" />
          {/* Hover story: a token walks the flow, pausing at the decision. */}
          <circle
            className="pv-token"
            opacity="0"
            cx="24"
            cy="5.5"
            r="1.8"
            fill="rgb(2 132 199)"
            style={pv({ '--pv-at': '1100ms' })}
          />
        </svg>
      );
    case 'retrospective':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {/* Opening rail: the mood check over the timer + vote buttons. */}
          <rect
            x="2"
            y="3"
            width="13"
            height="26"
            rx="1.5"
            fill="white"
            stroke="rgb(148 163 184)"
            strokeWidth="0.6"
          />
          {[4.7, 6.9, 9.1, 11.3, 13.5].map((fx) => (
            <circle
              key={fx}
              cx={fx}
              cy="7"
              r="0.9"
              fill="none"
              stroke="rgb(100 116 139)"
              strokeWidth="0.5"
            />
          ))}
          <rect
            x="2"
            y="31"
            width="6"
            height="6"
            rx="1"
            fill="white"
            stroke="rgb(148 163 184)"
            strokeWidth="0.6"
          />
          <rect
            x="9"
            y="31"
            width="6"
            height="6"
            rx="1"
            fill="white"
            stroke="rgb(148 163 184)"
            strokeWidth="0.6"
          />
          {/* Went well / To improve / Ideas, each with notes in its own hue. */}
          {[
            {
              x: 17,
              fill: 'rgb(220 252 231)',
              stroke: 'rgb(134 239 172)',
              note: 'rgb(187 247 208)',
            },
            {
              x: 33,
              fill: 'rgb(255 228 230)',
              stroke: 'rgb(253 164 175)',
              note: 'rgb(254 205 211)',
            },
            {
              x: 49,
              fill: 'rgb(237 233 254)',
              stroke: 'rgb(196 181 253)',
              note: 'rgb(233 213 255)',
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
                strokeWidth="0.6"
              />
              {[11, 22, 33].map((ny) => (
                <rect
                  key={ny}
                  x={col.x + 1.5}
                  y={ny}
                  width="11"
                  height="9"
                  rx="0.4"
                  fill={col.note}
                />
              ))}
            </g>
          ))}
          {/* Action items: a checklist, then a shout-out note. */}
          <rect
            x="65"
            y="3"
            width="13"
            height="44"
            rx="1.5"
            fill="rgb(248 250 252)"
            stroke="rgb(148 163 184)"
            strokeWidth="1"
          />
          {[11, 16, 21].map((ry) => (
            <g key={ry}>
              <rect
                x="66.5"
                y={ry}
                width="2.4"
                height="2.4"
                rx="0.4"
                fill="white"
                stroke="rgb(100 116 139)"
                strokeWidth="0.45"
              />
              <line
                x1="70"
                y1={ry + 1.2}
                x2="76.5"
                y2={ry + 1.2}
                stroke="rgb(148 163 184)"
                strokeWidth="0.6"
              />
            </g>
          ))}
          <rect x="66.5" y="33" width="10" height="11" rx="0.4" fill="rgb(253 230 138)" />
          {/* Hover story: the room answers the mood check, three dots pile
              onto one To improve note, and its action gets ticked off. */}
          {[
            { x: 3.6, h: 6, at: 700 },
            { x: 6.1, h: 10, at: 800 },
            { x: 8.6, h: 14, at: 900 },
            { x: 11.1, h: 9, at: 1000 },
          ].map((b) => (
            <rect
              key={b.x}
              className="pv-grow-y"
              opacity="0"
              x={b.x}
              y={26 - b.h}
              width="1.8"
              height={b.h}
              rx="0.4"
              fill="rgb(56 189 248)"
              style={pv({ '--pv-at': `${b.at}ms` })}
            />
          ))}
          {[
            { cx: 37, at: 1500 },
            { cx: 40, at: 1700 },
            { cx: 43, at: 1900 },
          ].map((d) => (
            <circle
              key={d.cx}
              className="pv-new"
              opacity="0"
              cx={d.cx}
              cy="26.5"
              r="1.2"
              fill="rgb(79 70 229)"
              style={pv({ '--pv-at': `${d.at}ms` })}
            />
          ))}
          <path
            className="pv-new"
            opacity="0"
            d="M67 12.2 L67.8 13 L68.6 11.5"
            fill="none"
            stroke="rgb(22 163 74)"
            strokeWidth="0.6"
            style={pv({ '--pv-at': '2400ms' })}
          />
        </svg>
      );
    case 'swimlane':
      // Four role lanes (Customer / Sales / Warehouse / Courier) with a
      // header strip down the left, and the order's flow on a column grid:
      // start pill, check, the In stock? gate with its dashed restock
      // detour, pick, courier booking, delivery, and the end pill back in
      // the Customer lane. Every connector is straight or an elbow.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[2, 14, 26, 38].map((y) => (
            <g key={y}>
              <rect
                x="2"
                y={y}
                width="76"
                height="10"
                rx="1"
                fill="none"
                stroke="rgb(148 163 184)"
                strokeWidth="0.8"
              />
              <rect x="2" y={y} width="9" height="10" rx="1" fill="rgb(226 232 240)" />
              <line
                x1="11"
                y1={y}
                x2="11"
                y2={y + 10}
                stroke="rgb(148 163 184)"
                strokeWidth="0.8"
              />
            </g>
          ))}
          <g fill="none" stroke="rgb(100 116 139)" strokeWidth="0.7">
            <path d="M16 9.5 V19 H21.5" />
            <path d="M28.5 19 H30.5" />
            <path d="M37.5 19 H43 V28.5" />
            <path d="M34 22 V28.5" />
            <path d="M37.5 31 H39.5" />
            <path d="M46.5 31 H48.5" />
            <path d="M55.5 31 H61 V40.5" />
            <path d="M64.5 43 H70 V9.5" />
          </g>
          <g fill="rgb(100 116 139)">
            <polygon points="20,17.8 21.5,19 20,20.2" />
            <polygon points="41.8,27 43,28.5 44.2,27" />
            <polygon points="32.8,27 34,28.5 35.2,27" />
            <polygon points="59.8,39 61,40.5 62.2,39" />
            <polygon points="68.8,11 70,9.5 71.2,11" />
          </g>
          <rect
            x="12"
            y="4.5"
            width="8"
            height="5"
            rx="2.5"
            fill="rgb(2 132 199)"
            stroke="rgb(3 105 161)"
            strokeWidth="0.8"
          />
          {[
            { x: 21.5, y: 16.5 },
            { x: 39.5, y: 28.5 },
            { x: 48.5, y: 28.5 },
            { x: 57.5, y: 40.5 },
          ].map((b) => (
            <rect
              key={`${b.x}-${b.y}`}
              x={b.x}
              y={b.y}
              width="7"
              height="5"
              rx="1"
              fill="rgb(240 249 255)"
              stroke="rgb(14 165 233)"
              strokeWidth="0.8"
            />
          ))}
          <polygon
            points="34,16 37.5,19 34,22 30.5,19"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect
            x="30.5"
            y="28.5"
            width="7"
            height="5"
            rx="1"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
            strokeDasharray="1.2 0.8"
          />
          <rect
            x="66"
            y="4.5"
            width="8"
            height="5"
            rx="2.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
            className="pv-pulse"
            style={pv({ '--pv-at': '3400ms' })}
          />
          {/* Hover story: the parcel leaves Pick & pack, is booked with the
              courier and dropped into the Courier lane, then the delivery
              climbs back to the customer, whose end pill lights up. */}
          <g className="pv-new" opacity="0" style={popGroup(900)}>
            <g className="pv-leave" style={pv({ '--pv-at': '2150ms', '--pv-dur': '200ms' })}>
              <rect
                className="pv-route"
                x="41.8"
                y="29.8"
                width="2.4"
                height="2.4"
                rx="0.4"
                fill="rgb(180 83 9)"
                style={pv({
                  '--pv-dx': '18px',
                  '--pv-dx2': '18px',
                  '--pv-dy2': '12px',
                  '--pv-at': '950ms',
                })}
              />
            </g>
          </g>
          <g className="pv-new" opacity="0" style={popGroup(2150)}>
            <rect
              className="pv-route"
              x="59.8"
              y="41.8"
              width="2.4"
              height="2.4"
              rx="0.4"
              fill="rgb(180 83 9)"
              style={pv({
                '--pv-dx': '9px',
                '--pv-dx2': '9px',
                '--pv-dy2': '-36px',
                '--pv-at': '2200ms',
              })}
            />
          </g>
        </svg>
      );
    case 'decision-tree':
      // A question at the root, two branches, four outcomes: the tree the
      // template builds, drawn as one, with elbow connectors so the levels
      // read top-down rather than as boxes scattered around a diamond.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <polygon
            points="40,2 47,8 40,14 33,8"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <g fill="none" stroke="rgb(100 116 139)" strokeWidth="0.8">
            <path d="M40 14 V18 H23 V22" />
            <path d="M40 14 V18 H57 V22" />
            <path d="M23 30 V35 H11 V40" />
            <path d="M23 30 V35 H31 V40" />
            <path d="M57 30 V35 H51 V40" />
            <path d="M57 30 V35 H71 V40" />
          </g>
          {[14, 48].map((x) => (
            <rect
              key={x}
              x={x}
              y="22"
              width="18"
              height="8"
              rx="1.5"
              fill="none"
              stroke="rgb(14 165 233)"
              strokeWidth="1"
            />
          ))}
          {[4, 24, 44, 64].map((x) => (
            <rect
              key={x}
              x={x}
              y="40"
              width="14"
              height="8"
              rx="4"
              fill="rgb(224 242 254)"
              stroke="rgb(14 165 233)"
              strokeWidth="0.9"
              // Hover story: the outcome the answers lead to.
              {...(x === 24 ? { className: 'pv-pulse', style: pv({ '--pv-at': '2500ms' }) } : {})}
            />
          ))}
          {/* Hover story: answering the questions lights one path down the
              tree, root to branch to a single outcome. */}
          <g
            className="pv-new"
            opacity="0"
            fill="none"
            stroke="rgb(2 132 199)"
            strokeWidth="1.6"
            style={popGroup(1000)}
          >
            <path
              className="pv-draw"
              pathLength="1"
              d="M40 14 V18 H23 V22"
              style={pv({ '--pv-at': '1000ms', '--pv-dur': '600ms' })}
            />
            <path
              className="pv-draw"
              pathLength="1"
              d="M23 30 V35 H31 V40"
              style={pv({ '--pv-at': '1800ms', '--pv-dur': '600ms' })}
            />
          </g>
        </svg>
      );
    case 'approval-workflow':
      // Three role columns (Requester / Manager / Finance) under header
      // bands. The main row runs submit, review, the Approved? gate, the
      // finance check, the In budget? gate and the approved pill; each gate
      // drops a No to its dashed exception below, and the rework step
      // elbows back up into Submit.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[
            { x: 2, w: 14 },
            { x: 18, w: 28 },
            { x: 48, w: 30 },
          ].map((l) => (
            <g key={l.x}>
              <rect
                x={l.x}
                y="2"
                width={l.w}
                height="46"
                rx="1"
                fill="none"
                stroke="rgb(148 163 184)"
                strokeWidth="0.8"
              />
              <rect x={l.x} y="2" width={l.w} height="6" rx="1" fill="rgb(226 232 240)" />
            </g>
          ))}
          <g fill="none" stroke="rgb(100 116 139)" strokeWidth="0.7">
            <path d="M15 20 H20" />
            <path d="M30 20 H33" />
            <path d="M43 20 H49" />
            <path d="M57 20 H59" />
            <path d="M67 20 H69" />
            <path d="M38 24 V32.5" />
            <path d="M63 24 V32.5" />
            <path d="M33 36 H9 V23.5" />
          </g>
          <g fill="rgb(100 116 139)">
            <polygon points="36.8,31 38,32.5 39.2,31" />
            <polygon points="61.8,31 63,32.5 64.2,31" />
            <polygon points="7.8,25 9,23.5 10.2,25" />
          </g>
          <rect
            x="3"
            y="16.5"
            width="12"
            height="7"
            rx="3.5"
            fill="rgb(2 132 199)"
            stroke="rgb(3 105 161)"
            strokeWidth="0.8"
          />
          {[20, 49].map((x) => (
            <rect
              key={x}
              x={x}
              y="16.5"
              width={x === 20 ? 10 : 8}
              height="7"
              rx="1"
              fill="rgb(240 249 255)"
              stroke="rgb(14 165 233)"
              strokeWidth="0.8"
            />
          ))}
          {[38, 63].map((x) => (
            <polygon
              key={x}
              points={`${x},16 ${x + 5},20 ${x},24 ${x - 5},20`}
              fill="rgb(186 230 253)"
              stroke="rgb(14 165 233)"
              strokeWidth="0.8"
            />
          ))}
          <rect
            x="69"
            y="16.5"
            width="8"
            height="7"
            rx="3.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect
            x="33"
            y="32.5"
            width="10"
            height="7"
            rx="1"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
            strokeDasharray="1.2 0.8"
            className="pv-pulse"
            style={pv({ '--pv-at': '2100ms' })}
          />
          <rect
            x="59"
            y="32.5"
            width="8"
            height="7"
            rx="3.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
            strokeDasharray="1.2 0.8"
          />
          {/* Hover story: the first request is sent back at the manager's
              gate and lands on Request changes; the revised one sails
              through both gates and is approved, ticked. */}
          <g className="pv-new" opacity="0" style={popGroup(900)}>
            <g className="pv-leave" style={pv({ '--pv-at': '2150ms', '--pv-dur': '200ms' })}>
              <rect
                className="pv-route"
                x="7.5"
                y="18"
                width="3"
                height="4"
                rx="0.5"
                fill="rgb(2 132 199)"
                style={pv({
                  '--pv-dx': '29px',
                  '--pv-dx2': '29px',
                  '--pv-dy2': '16px',
                  '--pv-at': '950ms',
                })}
              />
            </g>
          </g>
          <g className="pv-new" opacity="0" style={popGroup(2450)}>
            <rect
              className="pv-route"
              x="7.5"
              y="18"
              width="3"
              height="4"
              rx="0.5"
              fill="rgb(2 132 199)"
              style={pv({
                '--pv-dx': '54px',
                '--pv-dx2': '64px',
                '--pv-at': '2500ms',
                '--pv-dur': '1300ms',
              })}
            />
          </g>
          <g className="pv-new" opacity="0" style={popGroup(3850)}>
            <path
              className="pv-draw"
              pathLength="1"
              d="M70.5 20 L72.5 22 L75.5 18"
              fill="none"
              stroke="rgb(22 163 74)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={pv({ '--pv-at': '3850ms', '--pv-dur': '350ms' })}
            />
          </g>
        </svg>
      );
    case 'data-flow':
      // The level-1 DFD on its grid: bold external entities either side
      // (Customer, Payment provider), three soft numbered processes, two
      // cylinder stores, with the request / result pair to the provider and
      // the dispatch notice elbowing back to the customer. A faint key row
      // of the four symbols sits along the bottom.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <g fill="none" stroke="rgb(100 116 139)" strokeWidth="0.7">
            <path d="M15 21 H24.5" />
            <path d="M30 15.5 V11.5" />
            <path d="M35.5 21 H45.5" />
            <path d="M55 18.5 H65" />
            <path d="M65 23.5 H55" />
            <path d="M51 26.5 V31" />
            <path d="M45 35 H35.5" />
            <path d="M24.5 35 H9 V25.5" />
          </g>
          {[
            { x: 3, y: 16.5 },
            { x: 65, y: 16.5 },
          ].map((e) => (
            <rect
              key={e.x}
              x={e.x}
              y={e.y}
              width="12"
              height="9"
              rx="1"
              fill="rgb(2 132 199)"
              stroke="rgb(3 105 161)"
              strokeWidth="0.8"
            />
          ))}
          {[
            { cx: 30, cy: 21 },
            { cx: 51, cy: 21 },
            { cx: 30, cy: 35 },
          ].map((p) => (
            <circle
              key={`${p.cx}-${p.cy}`}
              cx={p.cx}
              cy={p.cy}
              r="5.5"
              fill="rgb(186 230 253)"
              stroke="rgb(14 165 233)"
              strokeWidth="0.8"
            />
          ))}
          {[
            { x: 24, y: 4 },
            { x: 45, y: 31 },
          ].map((s) => (
            <g key={s.x} fill="rgb(240 249 255)" stroke="rgb(14 165 233)" strokeWidth="0.8">
              <rect x={s.x} y={s.y} width="12" height="7" />
              <ellipse cx={s.x + 6} cy={s.y} rx="6" ry="1.6" />
            </g>
          ))}
          <g fill="rgb(203 213 225)">
            <rect x="8.5" y="44.5" width="5" height="3.5" rx="0.5" />
            <circle cx="30" cy="46.25" r="2" />
            <rect x="46.5" y="44.5" width="5" height="3.5" />
          </g>
          <line
            x1="64.5"
            y1="46.25"
            x2="71.5"
            y2="46.25"
            stroke="rgb(203 213 225)"
            strokeWidth="0.8"
          />
          {/* Hover story: data keeps moving: an order in from the customer,
              the amount on to payment, a charge out to the provider, the
              paid order into the store and out to fulfilment. */}
          {[
            { x: 15.5, y: 19.8, dx: '7px', dy: '0px', at: 900 },
            { x: 36, y: 19.8, dx: '7.5px', dy: '0px', at: 1300 },
            { x: 55.5, y: 17.3, dx: '7.5px', dy: '0px', at: 1700 },
            { x: 49.8, y: 26.5, dx: '0px', dy: '2.5px', at: 2100 },
            { x: 42, y: 33.8, dx: '-5px', dy: '0px', at: 2500 },
          ].map((p) => (
            <rect
              key={p.at}
              className="pv-travel"
              opacity="0"
              x={p.x}
              y={p.y}
              width="2.4"
              height="2.4"
              rx="0.4"
              fill="rgb(2 132 199)"
              style={pv({
                '--pv-dx': p.dx,
                '--pv-dy': p.dy,
                '--pv-at': `${p.at}ms`,
                '--pv-dur': '1300ms',
              })}
            />
          ))}
        </svg>
      );
    default:
      return null;
  }
}
