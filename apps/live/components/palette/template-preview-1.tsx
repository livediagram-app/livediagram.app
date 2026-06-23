import type { ReactElement } from 'react';
import type { TemplateKind } from '@/lib/templates';

// Group 1 of 3 (mind maps / flowcharts). Static SVG preview tiles for the TemplatePicker (one branch per
// TemplateKind). Split out of template-preview.tsx to keep each file under the
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
          {[8, 25, 42].map((y) => (
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
          ].map(([bx, by]) => (
            <g key={`${bx}-${by}`}>
              <line x1="40" y1="25" x2={bx} y2={by} stroke="rgb(100 116 139)" strokeWidth="0.9" />
              <circle
                cx={bx}
                cy={by}
                r="4.5"
                fill="none"
                stroke="rgb(14 165 233)"
                strokeWidth="1.25"
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
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[3, 19, 35].map((y) => (
            <rect
              key={y}
              x="2"
              y={y}
              width="76"
              height="13"
              rx="1"
              fill="none"
              stroke="rgb(148 163 184)"
              strokeWidth="0.8"
            />
          ))}
          <rect
            x="8"
            y="5.5"
            width="15"
            height="8"
            rx="1.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <rect
            x="33"
            y="21.5"
            width="15"
            height="8"
            rx="1.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <rect
            x="58"
            y="37.5"
            width="15"
            height="8"
            rx="1.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <line
            x1="15.5"
            y1="13.5"
            x2="40.5"
            y2="21.5"
            stroke="rgb(100 116 139)"
            strokeWidth="0.8"
          />
          <line x1="48" y1="25.5" x2="65.5" y2="37.5" stroke="rgb(100 116 139)" strokeWidth="0.8" />
        </svg>
      );
    case 'decision-tree':
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <polygon
            points="40,3 48,11 40,19 32,11"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <rect
            x="8"
            y="22"
            width="18"
            height="9"
            rx="1.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <polygon
            points="58,21 66,28 58,35 50,28"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <rect
            x="44"
            y="40"
            width="16"
            height="8"
            rx="1.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <rect
            x="64"
            y="40"
            width="14"
            height="8"
            rx="1.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
          />
          <line x1="34" y1="14" x2="17" y2="22" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="46" y1="14" x2="56" y2="21" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="54" y1="33" x2="52" y2="40" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="62" y1="33" x2="69" y2="40" stroke="rgb(100 116 139)" strokeWidth="0.8" />
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
