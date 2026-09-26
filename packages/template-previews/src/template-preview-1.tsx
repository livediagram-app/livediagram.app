import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';

// Group 1 of 3 (mind maps / flowcharts). Static SVG preview tiles (one branch per
// TemplateKind; see template-preview.tsx for who renders them). Split out of template-preview.tsx to keep each file under the
// ~1000-line budget; TemplatePreview chains the groups with ??.
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
          {/* Root on the left, three branches stacked on the right. */}
          <rect
            x="6"
            y="19"
            width="16"
            height="12"
            rx="2"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1.25"
          />
          {/* Branch rows sized to keep the bottom box (y + 9 + stroke)
              inside the 50-unit viewBox; the middle connector runs
              horizontally out of the root's midline. */}
          {[7, 21, 35].map((y) => (
            <g key={y}>
              <line x1="22" y1="25" x2="40" y2={y + 4} stroke="rgb(100 116 139)" strokeWidth="1" />
              <rect
                x="40"
                y={y}
                width="18"
                height="9"
                rx="2"
                fill="none"
                stroke="rgb(14 165 233)"
                strokeWidth="1.25"
              />
            </g>
          ))}
          {/* Hover story: a child idea slides out of the middle branch. */}
          <rect
            className="pv-arrive"
            opacity="0"
            x="64"
            y="21.5"
            width="12"
            height="8"
            rx="2"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1.25"
            style={pv({ '--pv-from-x': '-14px', '--pv-at': '900ms' })}
          />
          <line
            className="pv-new"
            opacity="0"
            x1="58"
            y1="25.5"
            x2="64"
            y2="25.5"
            stroke="rgb(100 116 139)"
            strokeWidth="1"
            style={pv({ '--pv-at': '1600ms' })}
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
          {/* Mad / Sad / Glad tinted containers with header bar + 3 stickies. */}
          {[
            { x: 4, fill: 'rgb(254 226 226)', stroke: 'rgb(252 165 165)' },
            { x: 30, fill: 'rgb(219 234 254)', stroke: 'rgb(147 197 253)' },
            { x: 56, fill: 'rgb(220 252 231)', stroke: 'rgb(134 239 172)' },
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
              {[12, 22, 32].map((sy) => (
                <rect
                  key={sy}
                  x={col.x + 2}
                  y={sy}
                  width="16"
                  height="7"
                  rx="0.5"
                  fill="rgb(254 243 199)"
                  stroke="rgb(253 224 71)"
                  strokeWidth="0.5"
                />
              ))}
            </g>
          ))}
        </svg>
      );
    case 'swimlane':
      // Three lanes with a header strip down the left, and one flow that
      // hands off lane to lane: start pill, a step, a decision, a step in
      // the next lane, the end in the last. Elbow connectors with heads,
      // so it reads as a flow crossing lanes rather than boxes on rules.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[2, 18, 34].map((y) => (
            <g key={y}>
              <rect
                x="2"
                y={y}
                width="76"
                height="14"
                rx="1"
                fill="none"
                stroke="rgb(148 163 184)"
                strokeWidth="0.8"
              />
              <rect x="2" y={y} width="9" height="14" rx="1" fill="rgb(226 232 240)" />
              <line
                x1="11"
                y1={y}
                x2="11"
                y2={y + 14}
                stroke="rgb(148 163 184)"
                strokeWidth="0.8"
              />
            </g>
          ))}
          <rect
            x="15"
            y="5.5"
            width="12"
            height="7"
            rx="3.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <rect
            x="34"
            y="5"
            width="15"
            height="8"
            rx="1.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <polygon
            points="41.5,20 47.5,25 41.5,30 35.5,25"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <rect
            x="55"
            y="21"
            width="15"
            height="8"
            rx="1.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <rect
            x="56.5"
            y="37.5"
            width="12"
            height="7"
            rx="3.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <g fill="none" stroke="rgb(100 116 139)" strokeWidth="0.8">
            <path d="M27 9 H33" />
            <path d="M41.5 13 V19" />
            <path d="M47.5 25 H54" />
            <path d="M62.5 29 V36.5" />
          </g>
          <g fill="rgb(100 116 139)">
            <polygon points="31.5,7.5 34,9 31.5,10.5" />
            <polygon points="40,17.5 41.5,20 43,17.5" />
            <polygon points="52.5,23.5 55,25 52.5,26.5" />
            <polygon points="61,35 62.5,37.5 64,35" />
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
            />
          ))}
        </svg>
      );
    case 'approval-workflow':
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="3"
            y="14"
            width="16"
            height="9"
            rx="4.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <rect
            x="25"
            y="14"
            width="16"
            height="9"
            rx="1.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <polygon
            points="55,13 63,18.5 55,24 47,18.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <rect
            x="66"
            y="14"
            width="12"
            height="9"
            rx="4.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <line x1="19" y1="18.5" x2="25" y2="18.5" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="41" y1="18.5" x2="47" y2="18.5" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="63" y1="18.5" x2="66" y2="18.5" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <path
            d="M55 24 C55 38 11 38 11 23"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.8"
            strokeDasharray="2 1.5"
          />
        </svg>
      );
    case 'data-flow':
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="3"
            y="14"
            width="16"
            height="11"
            rx="1.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <circle
            cx="38"
            cy="19.5"
            r="8"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <rect
            x="60"
            y="13"
            width="16"
            height="13"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <ellipse
            cx="68"
            cy="13"
            rx="8"
            ry="2.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <rect
            x="30"
            y="38"
            width="16"
            height="9"
            rx="1.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <line x1="19" y1="19.5" x2="30" y2="19.5" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="46" y1="19.5" x2="60" y2="19.5" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="38" y1="27.5" x2="38" y2="38" stroke="rgb(100 116 139)" strokeWidth="0.8" />
        </svg>
      );
    default:
      return null;
  }
}
