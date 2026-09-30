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
      // A bold round topic, five branches each in its own hue (card and
      // connector alike), two white leaves edged in the branch's hue.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {[
            {
              b: [17, 15],
              l: [
                [6, 6],
                [6, 24],
              ],
              c: 'rgb(16 185 129)',
              f: 'rgb(209 250 229)',
              e: 'rgb(110 231 183)',
            },
            {
              b: [40, 7],
              l: [
                [26, 2.5],
                [54, 2.5],
              ],
              c: 'rgb(14 165 233)',
              f: 'rgb(224 242 254)',
              e: 'rgb(125 211 252)',
            },
            {
              b: [63, 15],
              l: [
                [74, 7],
                [74, 23],
              ],
              c: 'rgb(139 92 246)',
              f: 'rgb(237 233 254)',
              e: 'rgb(196 181 253)',
            },
            {
              b: [60, 37],
              l: [
                [74, 44],
                [48, 46],
              ],
              c: 'rgb(245 158 11)',
              f: 'rgb(254 243 199)',
              e: 'rgb(252 211 77)',
            },
            {
              b: [20, 37],
              l: [
                [7, 44],
                [31, 46],
              ],
              c: 'rgb(244 63 94)',
              f: 'rgb(255 228 230)',
              e: 'rgb(253 164 175)',
            },
          ].map(({ b, l, c, f, e }) => (
            <g key={c}>
              <line x1="40" y1="25" x2={b[0]} y2={b[1]} stroke={c} strokeWidth="1.3" />
              {l.map(([lx, ly]) => (
                <g key={`${lx}-${ly}`}>
                  <line x1={b[0]} y1={b[1]} x2={lx} y2={ly} stroke={e} strokeWidth="0.7" />
                  <rect
                    x={lx! - 5}
                    y={ly! - 2}
                    width="10"
                    height="4"
                    rx="1"
                    fill="white"
                    stroke={e}
                    strokeWidth="0.6"
                  />
                </g>
              ))}
              <rect
                x={b[0]! - 7}
                y={b[1]! - 3}
                width="14"
                height="6"
                rx="1.5"
                fill={f}
                stroke={c}
                strokeWidth="0.9"
              />
            </g>
          ))}
          <circle
            cx="40"
            cy="25"
            r="7.5"
            fill="rgb(3 105 161)"
            stroke="rgb(7 89 133)"
            strokeWidth="1"
          />
          {/* Hover story (preview-motion.css): Tab on the violet branch grows
              a third leaf, which glides out of the branch in its hue. */}
          <line
            className="pv-new"
            opacity="0"
            x1="63"
            y1="15"
            x2="72"
            y2="31"
            stroke="rgb(196 181 253)"
            strokeWidth="0.7"
            style={pv({ '--pv-at': '1700ms' })}
          />
          <rect
            className="pv-arrive"
            opacity="0"
            x="67"
            y="29"
            width="10"
            height="4"
            rx="1"
            fill="white"
            stroke="rgb(139 92 246)"
            strokeWidth="0.7"
            style={pv({ '--pv-from-x': '-9px', '--pv-from-y': '-14px', '--pv-at': '900ms' })}
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
          {/* A bold topic ringed by adjective bubbles, each in its own hue
              with a matching spoke. */}
          {[
            [40, 6, 'rgb(14 165 233)', 'rgb(224 242 254)'],
            [63, 15, 'rgb(139 92 246)', 'rgb(237 233 254)'],
            [63, 35, 'rgb(245 158 11)', 'rgb(254 243 199)'],
            [40, 44, 'rgb(244 63 94)', 'rgb(255 228 230)'],
            [17, 35, 'rgb(20 184 166)', 'rgb(204 251 241)'],
            [17, 15, 'rgb(16 185 129)', 'rgb(209 250 229)'],
          ].map(([bx, by, c, f], i) => (
            <g key={`${bx}-${by}`}>
              <line x1="40" y1="25" x2={bx} y2={by} stroke={c as string} strokeWidth="0.9" />
              {/* Hover story: a wave swells each bubble in turn round the
                  ring (a rotation would swing the oval ring past the tile). */}
              <circle
                cx={bx}
                cy={by}
                r="5"
                fill={f as string}
                stroke={c as string}
                strokeWidth="1.1"
                className="pv-pulse"
                style={pv({ '--pv-at': `${900 + i * 160}ms` })}
              />
              {/* The adjective over its proof line. */}
              <line
                x1={(bx as number) - 2.4}
                y1={(by as number) - 0.9}
                x2={(bx as number) + 2.4}
                y2={(by as number) - 0.9}
                stroke={c as string}
                strokeWidth="0.9"
              />
              <line
                x1={(bx as number) - 1.8}
                y1={(by as number) + 1.2}
                x2={(bx as number) + 1.8}
                y2={(by as number) + 1.2}
                stroke={c as string}
                strokeWidth="0.5"
              />
            </g>
          ))}
          <circle
            cx="40"
            cy="25"
            r="9"
            fill="rgb(3 105 161)"
            stroke="rgb(7 89 133)"
            strokeWidth="1.1"
          />
          {/* ...then a new bubble sprouts off the lower-right one. */}
          <line
            className="pv-new"
            opacity="0"
            x1="67"
            y1="38.5"
            x2="71.7"
            y2="42.1"
            stroke="rgb(100 116 139)"
            strokeWidth="0.9"
            style={pv({ '--pv-at': '2000ms' })}
          />
          <circle
            className="pv-new"
            opacity="0"
            cx="74"
            cy="44"
            r="3"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1.1"
            style={pv({ '--pv-at': '2200ms' })}
          />
        </svg>
      );
    case 'orgchart':
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {/* Three tinted team bands, each a VP over three reports on a
              spine; the CEO on top with the Chief of Staff on a staff line. */}
          {[
            {
              x: 2,
              band: 'rgb(245 243 255)',
              edge: 'rgb(221 214 254)',
              card: 'rgb(237 233 254)',
              hue: 'rgb(139 92 246)',
            },
            {
              x: 28,
              band: 'rgb(240 249 255)',
              edge: 'rgb(186 230 253)',
              card: 'rgb(224 242 254)',
              hue: 'rgb(14 165 233)',
            },
            {
              x: 54,
              band: 'rgb(255 251 235)',
              edge: 'rgb(253 230 138)',
              card: 'rgb(254 243 199)',
              hue: 'rgb(245 158 11)',
            },
          ].map((t, i) => (
            <g key={t.x}>
              <rect
                x={t.x}
                y="15"
                width="24"
                height="34"
                rx="1.5"
                fill={t.band}
                stroke={t.edge}
                strokeWidth="0.6"
              />
              <path
                d={`M${t.x + 6} 24 V41.25 M${t.x + 6} 29.25 H${t.x + 9} M${t.x + 6} 35.25 H${t.x + 9} M${t.x + 6} 41.25 H${t.x + 9}`}
                fill="none"
                stroke="rgb(100 116 139)"
                strokeWidth="0.6"
              />
              <rect
                x={t.x + 2}
                y="18"
                width="20"
                height="6"
                rx="1"
                fill={t.card}
                stroke={t.hue}
                strokeWidth="0.9"
              />
              {[27, 33, 39].map((y, j) => (
                <rect
                  key={y}
                  x={t.x + 9}
                  y={y}
                  width="13"
                  height="4.5"
                  rx="0.8"
                  fill="white"
                  stroke={t.hue}
                  strokeWidth="0.6"
                  // The open role: a dashed card waiting for a hire.
                  {...(i === 0 && j === 2 ? { strokeDasharray: '1.2 0.8' } : {})}
                />
              ))}
            </g>
          ))}
          <path
            d="M36 8 V11.5 H14 V18 M40 8 V18 M44 8 V11.5 H66 V18"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.7"
          />
          <line x1="48" y1="4.5" x2="55" y2="4.5" stroke="rgb(100 116 139)" strokeWidth="0.7" />
          {/* The dotted-line report: Engineering across the gap to Sales. */}
          <path
            d="M50 41.25 H53 V21 H56"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.6"
            strokeDasharray="1.2 0.8"
          />
          <rect x="32" y="1" width="16" height="7" rx="1.5" fill="rgb(3 105 161)" />
          <rect
            x="55"
            y="2"
            width="12"
            height="5"
            rx="1"
            fill="white"
            stroke="rgb(148 163 184)"
            strokeWidth="0.7"
          />
          {/* Hover story: the open role is filled, the dashed card turning
              into a person in the team's hue. */}
          <rect
            className="pv-new"
            opacity="0"
            x="11"
            y="39"
            width="13"
            height="4.5"
            rx="0.8"
            fill="rgb(237 233 254)"
            stroke="rgb(139 92 246)"
            strokeWidth="0.8"
            style={pv({ '--pv-at': '1300ms' })}
          />
          <circle
            className="pv-new"
            opacity="0"
            cx="14"
            cy="41.25"
            r="1.2"
            fill="rgb(139 92 246)"
            style={pv({ '--pv-at': '1600ms' })}
          />
        </svg>
      );
    case 'flowchart':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {/* The ISO spine: start, input, process, decision, document, end,
              with the declined card's error step looping back to the form,
              and the key card on the right. */}
          <g fill="none" stroke="rgb(100 116 139)" strokeWidth="0.8">
            <line x1="22" y1="5" x2="22" y2="8" />
            <line x1="22" y1="12" x2="22" y2="15" />
            <line x1="22" y1="20" x2="22" y2="24.5" />
            <line x1="22" y1="34.5" x2="22" y2="37.5" />
            <line x1="22" y1="43" x2="22" y2="45.5" />
            <line x1="31" y1="29.5" x2="39" y2="29.5" />
            <path d="M46 27 V10 H31" />
          </g>
          <rect x="13" y="1" width="18" height="4" rx="2" fill="rgb(3 105 161)" />
          <polygon
            points="15,8 32,8 29,12 12,12"
            fill="rgb(240 249 255)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect
            x="13"
            y="15"
            width="18"
            height="5"
            rx="0.8"
            fill="rgb(240 249 255)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <polygon
            points="22,24.5 31,29.5 22,34.5 13,29.5"
            fill="rgb(224 242 254)"
            stroke="rgb(125 211 252)"
            strokeWidth="0.8"
          />
          <path
            d="M13 37.5 H31 V42.5 Q26.5 44.5 22 42.5 Q17.5 40.5 13 42.5 Z"
            fill="rgb(240 249 255)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect
            x="13"
            y="45.5"
            width="18"
            height="4"
            rx="2"
            fill="rgb(224 242 254)"
            stroke="rgb(125 211 252)"
            strokeWidth="0.8"
          />
          <rect
            x="39"
            y="27"
            width="14"
            height="5"
            rx="0.8"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
            strokeDasharray="1.2 0.8"
          />
          {/* The key: one miniature per symbol, a caption line beside each. */}
          <rect
            x="58"
            y="2"
            width="20"
            height="36"
            rx="1.5"
            fill="rgb(248 250 252)"
            stroke="rgb(203 213 225)"
            strokeWidth="0.6"
          />
          <rect x="60" y="6" width="6" height="2.6" rx="1.3" fill="rgb(3 105 161)" />
          <rect
            x="60"
            y="12"
            width="6"
            height="3"
            rx="0.5"
            fill="rgb(240 249 255)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.5"
          />
          <polygon
            points="63,18 66,20 63,22 60,20"
            fill="rgb(224 242 254)"
            stroke="rgb(125 211 252)"
            strokeWidth="0.5"
          />
          <polygon
            points="61,25 66.5,25 65,28 59.5,28"
            fill="rgb(240 249 255)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.5"
          />
          <path
            d="M60 31 H66 V34 Q64.5 35 63 34 Q61.5 33 60 34 Z"
            fill="rgb(240 249 255)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.5"
          />
          <g stroke="rgb(148 163 184)" strokeWidth="0.7">
            <line x1="68" y1="7.3" x2="76" y2="7.3" />
            <line x1="68" y1="13.5" x2="75" y2="13.5" />
            <line x1="68" y1="20" x2="76" y2="20" />
            <line x1="68" y1="26.5" x2="74" y2="26.5" />
            <line x1="68" y1="32.5" x2="75" y2="32.5" />
          </g>
          {/* Hover story: a token walks the flow, pausing at the decision. */}
          <circle
            className="pv-token"
            opacity="0"
            cx="22"
            cy="3"
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
      // A bold root question, two soft follow-ups, four outcomes coloured by
      // what they mean (stop, wait, wait, go), each with a sticker; No leaves
      // by the left corner and Yes by the right, as elbows.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <g fill="none" stroke="rgb(100 116 139)" strokeWidth="0.8">
            <path d="M32 8 H22 V16" />
            <path d="M48 8 H58 V16" />
            <path d="M15 21 H10 V35" />
            <path d="M29 21 H30 V35" />
            <path d="M51 21 H50 V35" />
            <path d="M65 21 H70 V35" />
          </g>
          <polygon points="40,2 48,8 40,14 32,8" fill="rgb(3 105 161)" />
          {[22, 58].map((x) => (
            <polygon
              key={x}
              points={`${x},16 ${x + 7},21 ${x},26 ${x - 7},21`}
              fill="rgb(224 242 254)"
              stroke="rgb(125 211 252)"
              strokeWidth="0.8"
            />
          ))}
          {[
            [2, 'rgb(254 226 226)', 'rgb(220 38 38)'],
            [22, 'rgb(254 243 199)', 'rgb(217 119 6)'],
            [42, 'rgb(254 243 199)', 'rgb(217 119 6)'],
            [62, 'rgb(220 252 231)', 'rgb(22 163 74)'],
          ].map(([x, fill, stroke]) => (
            <g key={x as number}>
              <rect
                x={x as number}
                y="35"
                width="16"
                height="8"
                rx="1.2"
                fill={fill as string}
                stroke={stroke as string}
                strokeWidth="0.9"
                // Hover story: the outcome the answers lead to.
                {...(x === 62 ? { className: 'pv-pulse', style: pv({ '--pv-at': '2500ms' }) } : {})}
              />
              <circle
                cx={(x as number) + 15}
                cy="35.5"
                r="1.9"
                fill="white"
                stroke={stroke as string}
                strokeWidth="0.6"
              />
            </g>
          ))}
          {/* The key: go, wait, stop. */}
          {[
            [2, 'rgb(220 252 231)', 'rgb(22 163 74)'],
            [16, 'rgb(254 243 199)', 'rgb(217 119 6)'],
            [30, 'rgb(254 226 226)', 'rgb(220 38 38)'],
          ].map(([x, fill, stroke]) => (
            <g key={x as number}>
              <rect
                x={x as number}
                y="46"
                width="5"
                height="2.6"
                rx="0.6"
                fill={fill as string}
                stroke={stroke as string}
                strokeWidth="0.5"
              />
              <line
                x1={(x as number) + 6.5}
                y1="47.3"
                x2={(x as number) + 11}
                y2="47.3"
                stroke="rgb(148 163 184)"
                strokeWidth="0.7"
              />
            </g>
          ))}
          {/* Hover story: answering yes, yes lights the path down the tree
              to the green outcome. */}
          <g
            className="pv-new"
            opacity="0"
            fill="none"
            stroke="rgb(22 163 74)"
            strokeWidth="1.6"
            style={popGroup(1000)}
          >
            <path
              className="pv-draw"
              pathLength="1"
              d="M48 8 H58 V16"
              style={pv({ '--pv-at': '1000ms', '--pv-dur': '600ms' })}
            />
            <path
              className="pv-draw"
              pathLength="1"
              d="M65 21 H70 V35"
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
