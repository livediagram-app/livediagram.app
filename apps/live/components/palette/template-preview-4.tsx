import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';

// Group 4 of 4 (the roadmap / canvas / workshop / hierarchy / UML /
// cloud batch). Static SVG preview tiles for the TemplatePicker (one
// branch per TemplateKind). Split out of template-preview.tsx to keep
// each file under the ~1000-line budget; TemplatePreview chains the
// groups with ??. Shared palette: sky accents (rgb(14 165 233) stroke,
// rgb(186 230 253) fill), slate connectors (rgb(100 116 139)), amber
// stickies (rgb(254 243 199) / rgb(253 230 138)).
export function templatePreviewGroup4(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'roadmap':
      // Three horizon lanes (green / blue / slate) of initiative cards.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {[
            { x: 4, fill: 'rgb(220 252 231)', stroke: 'rgb(134 239 172)' },
            { x: 30, fill: 'rgb(219 234 254)', stroke: 'rgb(147 197 253)' },
            { x: 56, fill: 'rgb(226 232 240)', stroke: 'rgb(203 213 225)' },
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
              {[15, 30].map((y) => (
                <rect
                  key={y}
                  x={lane.x + 3}
                  y={y}
                  width="14"
                  height="11"
                  rx="1.5"
                  fill="white"
                  stroke="rgb(148 163 184)"
                  strokeWidth="0.8"
                />
              ))}
            </g>
          ))}
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
          {/* Scattered R/A/C/I marks as tinted dots. */}
          {[
            { cx: 34, cy: 19.5, f: 'rgb(134 239 172)' },
            { cx: 50, cy: 19.5, f: 'rgb(147 197 253)' },
            { cx: 66, cy: 29, f: 'rgb(252 211 77)' },
            { cx: 34, cy: 39, f: 'rgb(203 213 225)' },
            { cx: 66, cy: 39, f: 'rgb(134 239 172)' },
            { cx: 50, cy: 29, f: 'rgb(252 211 77)' },
          ].map((d, i) => (
            <circle key={i} cx={d.cx} cy={d.cy} r="2.6" fill={d.f} />
          ))}
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
          {[4, 24, 44, 64].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="17"
                width="14"
                height="9"
                rx="1"
                fill="rgb(254 243 199)"
                stroke="rgb(253 230 138)"
                strokeWidth="0.9"
              />
              <rect
                x={x}
                y="38"
                width="14"
                height="9"
                rx="1"
                fill="rgb(254 243 199)"
                stroke="rgb(253 230 138)"
                strokeWidth="0.9"
              />
            </g>
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
          {/* Elbow connectors: down from Home, across, down into each tier. */}
          <path
            d="M 40 12 V 17 H 14 V 22 M 40 17 V 22 M 40 17 H 66 V 22"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.8"
          />
          <path
            d="M 14 30 V 34.5 H 8 V 39 M 14 34.5 H 20 V 39"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.7"
          />
          <path
            d="M 40 30 V 34.5 H 34 V 39 M 40 34.5 H 46 V 39"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.7"
          />
          <path
            d="M 66 30 V 34.5 H 60 V 39 M 66 34.5 H 72 V 39"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.7"
          />
        </svg>
      );
    case 'browser-wireframe':
      // Browser chrome over a hero + button and three feature cards.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="4"
            y="3"
            width="72"
            height="44"
            rx="3"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1.2"
          />
          <line x1="4" y1="11" x2="76" y2="11" stroke="rgb(14 165 233)" strokeWidth="0.9" />
          {[9, 13.5, 18].map((cx) => (
            <circle key={cx} cx={cx} cy="7" r="1.4" fill="rgb(148 163 184)" />
          ))}
          <rect x="24" y="5" width="46" height="4" rx="2" fill="rgb(226 232 240)" />
          {/* Hero copy + CTA on the left, image placeholder right. */}
          <rect x="9" y="16" width="26" height="4" rx="1" fill="rgb(15 23 42)" />
          <rect x="9" y="22" width="20" height="2.5" rx="0.8" fill="rgb(148 163 184)" />
          <rect
            x="9"
            y="27"
            width="13"
            height="5"
            rx="2.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect
            x="44"
            y="15"
            width="27"
            height="18"
            rx="1.5"
            fill="none"
            stroke="rgb(148 163 184)"
            strokeWidth="0.9"
          />
          <circle
            cx="49"
            cy="20"
            r="2"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.7"
          />
          {/* Feature-card row. */}
          {[9, 31, 53].map((x) => (
            <rect
              key={x}
              x={x}
              y="37"
              width="18"
              height="7"
              rx="1.5"
              fill="white"
              stroke="rgb(148 163 184)"
              strokeWidth="0.8"
            />
          ))}
        </svg>
      );
    case 'storyboard':
      // Six numbered scene frames with caption lines.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {[
            { x: 5, y: 5 },
            { x: 31, y: 5 },
            { x: 57, y: 5 },
            { x: 5, y: 28 },
            { x: 31, y: 28 },
            { x: 57, y: 28 },
          ].map((f, i) => (
            <g key={i}>
              <rect
                x={f.x}
                y={f.y}
                width="18"
                height="12"
                rx="1.5"
                fill="white"
                stroke="rgb(14 165 233)"
                strokeWidth="0.9"
              />
              <circle
                cx={f.x + 1.5}
                cy={f.y + 1.5}
                r="2.6"
                fill="rgb(186 230 253)"
                stroke="rgb(14 165 233)"
                strokeWidth="0.7"
              />
              <rect
                x={f.x + 2}
                y={f.y + 14.5}
                width="14"
                height="2.2"
                rx="0.7"
                fill="rgb(148 163 184)"
              />
            </g>
          ))}
        </svg>
      );
    case 'cloud-architecture':
      // Edge cloud fanning through services into three data stores.
      return (
        <svg width="72" height="46" viewBox="0 0 80 50" aria-hidden>
          {/* CDN cloud at the edge. */}
          <path
            d="M 32 12 Q 32 6 38 6 Q 40 2 45 3.5 Q 50 2 51 7 Q 56 8 54 12 Z"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* Two service tiles. */}
          <rect
            x="18"
            y="20"
            width="16"
            height="10"
            rx="1.5"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <rect
            x="46"
            y="20"
            width="16"
            height="10"
            rx="1.5"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* Three datastore cylinders. */}
          {[10, 33, 56].map((x) => (
            <g key={x}>
              <path
                d={`M ${x} 39 V 45 Q ${x + 7} 48.5 ${x + 14} 45 V 39`}
                fill="white"
                stroke="rgb(14 165 233)"
                strokeWidth="0.9"
              />
              <ellipse
                cx={x + 7}
                cy="39"
                rx="7"
                ry="2.6"
                fill="rgb(186 230 253)"
                stroke="rgb(14 165 233)"
                strokeWidth="0.9"
              />
            </g>
          ))}
          {/* Fan-out connectors. */}
          <line x1="40" y1="12" x2="27" y2="20" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="44" y1="12" x2="53" y2="20" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="25" y1="30" x2="18" y2="37" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="30" y1="30" x2="38" y2="37" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="55" y1="30" x2="61" y2="37" stroke="rgb(100 116 139)" strokeWidth="0.8" />
        </svg>
      );
    case 'uml-class':
      // Three compartmented class boxes with a hollow inheritance triangle.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {/* Parent class. */}
          <g>
            <rect
              x="28"
              y="3"
              width="24"
              height="16"
              rx="1"
              fill="white"
              stroke="rgb(14 165 233)"
              strokeWidth="1"
            />
            <rect
              x="28"
              y="3"
              width="24"
              height="5"
              fill="rgb(186 230 253)"
              stroke="rgb(14 165 233)"
              strokeWidth="0.8"
            />
            <line x1="28" y1="13" x2="52" y2="13" stroke="rgb(14 165 233)" strokeWidth="0.8" />
          </g>
          {/* Two subclasses. */}
          {[8, 48].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="31"
                width="24"
                height="16"
                rx="1"
                fill="white"
                stroke="rgb(14 165 233)"
                strokeWidth="1"
              />
              <rect
                x={x}
                y="31"
                width="24"
                height="5"
                fill="rgb(186 230 253)"
                stroke="rgb(14 165 233)"
                strokeWidth="0.8"
              />
              <line x1={x} y1="41" x2={x + 24} y2="41" stroke="rgb(14 165 233)" strokeWidth="0.8" />
            </g>
          ))}
          {/* Inheritance edges meeting a hollow triangle at the parent. */}
          <line x1="20" y1="31" x2="38" y2="23" stroke="rgb(100 116 139)" strokeWidth="0.9" />
          <line x1="60" y1="31" x2="42" y2="23" stroke="rgb(100 116 139)" strokeWidth="0.9" />
          <polygon
            points="40,19 36.5,24.5 43.5,24.5"
            fill="white"
            stroke="rgb(100 116 139)"
            strokeWidth="0.9"
          />
        </svg>
      );
    case 'state-machine':
      // Initial dot → two states → bullseye final, event ticks between.
      return (
        <svg width="76" height="40" viewBox="0 0 80 40" aria-hidden>
          <circle cx="7" cy="20" r="3.5" fill="rgb(15 23 42)" />
          <rect
            x="16"
            y="12"
            width="20"
            height="16"
            rx="8"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <rect
            x="46"
            y="12"
            width="20"
            height="16"
            rx="8"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <circle cx="74" cy="20" r="4.5" fill="white" stroke="rgb(15 23 42)" strokeWidth="1.1" />
          <circle cx="74" cy="20" r="2.2" fill="rgb(15 23 42)" />
          {/* Transitions. */}
          <line x1="10.5" y1="20" x2="15" y2="20" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="36" y1="20" x2="44" y2="20" stroke="rgb(100 116 139)" strokeWidth="1" />
          <polygon points="45.5,20 42.5,18.4 42.5,21.6" fill="rgb(100 116 139)" />
          <line x1="66" y1="20" x2="68.5" y2="20" stroke="rgb(100 116 139)" strokeWidth="1" />
        </svg>
      );
    default:
      return null;
  }
}
