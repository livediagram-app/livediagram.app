import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';

// Group 3 of 3 (strategy / design / technical). Static SVG preview tiles for the TemplatePicker (one branch per
// TemplateKind). Split out of template-preview.tsx to keep each file under the
// ~1000-line budget; TemplatePreview chains the groups with ??.
export function templatePreviewGroup3(kind: TemplateKind): ReactElement | null {
  switch (kind) {
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
          />
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
          ].map((r) => (
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
              <rect x={r.bx} y={r.y + 1} width={r.bw} height="4" rx="1" fill={r.fill} />
            </g>
          ))}
        </svg>
      );
    case 'live-card':
      // Left panel: hero image placeholder + bold title. Right panel:
      // a board of grouped avatar + message rows.
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
        </svg>
      );
    case 'er-diagram':
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[
            [34, 13, 46, 13],
            [60, 21, 60, 29],
            [34, 37, 46, 37],
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
          {[
            { x1: 10, x2: 30, y: 18, dash: false },
            { x1: 30, x2: 50, y: 26, dash: false },
            { x1: 50, x2: 70, y: 34, dash: false },
            { x1: 50, x2: 30, y: 42, dash: true },
          ].map((m, i) => (
            <line
              key={i}
              x1={m.x1}
              y1={m.y}
              x2={m.x2}
              y2={m.y}
              stroke="rgb(100 116 139)"
              strokeWidth="0.8"
              strokeDasharray={m.dash ? '2 2' : undefined}
            />
          ))}
        </svg>
      );
    case 'prioritization-matrix':
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {/* Crossed value / effort axes (a centred quadrant divider plus
              an L-frame) with a few items scattered across the field —
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
          {/* Scattered item boxes, one per quadrant + one near centre. */}
          {(
            [
              [24, 15],
              [58, 13],
              [60, 33],
              [30, 36],
              [47, 22],
            ] as [number, number][]
          ).map(([x, y], i) => (
            <rect
              key={i}
              x={x - 6.5}
              y={y - 3.5}
              width="13"
              height="7"
              rx="1"
              fill="white"
              stroke="rgb(100 116 139)"
              strokeWidth="0.7"
            />
          ))}
        </svg>
      );
    default:
      return null;
  }
}
