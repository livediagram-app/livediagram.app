import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';

// Group 2 of 3 (agile / hierarchy / wireframes). Static SVG preview tiles for the TemplatePicker (one branch per
// TemplateKind). Split out of template-preview.tsx to keep each file under the
// ~1000-line budget; TemplatePreview chains the groups with ??.
export function templatePreviewGroup2(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'kanban':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {/* Three columns: To do (slate), In progress (blue), Done (green). */}
          {[
            { x: 4, fill: 'rgb(241 245 249)', stroke: 'rgb(203 213 225)' },
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
              {[13, 23, 33].map((sy) => (
                <rect
                  key={sy}
                  x={col.x + 2}
                  y={sy}
                  width="16"
                  height="7"
                  rx="1"
                  fill="white"
                  stroke="rgb(148 163 184)"
                  strokeWidth="0.5"
                />
              ))}
            </g>
          ))}
        </svg>
      );
    case 'swot':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {[
            { x: 4, y: 3, fill: 'rgb(220 252 231)', stroke: 'rgb(134 239 172)' },
            { x: 42, y: 3, fill: 'rgb(254 226 226)', stroke: 'rgb(252 165 165)' },
            { x: 4, y: 25, fill: 'rgb(219 234 254)', stroke: 'rgb(147 197 253)' },
            { x: 42, y: 25, fill: 'rgb(254 243 199)', stroke: 'rgb(252 211 77)' },
          ].map((q, i) => (
            <rect
              key={i}
              x={q.x}
              y={q.y}
              width="34"
              height="22"
              rx="2"
              fill={q.fill}
              stroke={q.stroke}
              strokeWidth="0.75"
            />
          ))}
        </svg>
      );
    case 'timeline':
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          <line x1="6" y1="25" x2="74" y2="25" stroke="rgb(100 116 139)" strokeWidth="1.5" />
          {[14, 28, 42, 56, 70].map((mx, i) => (
            <g key={mx}>
              <circle
                cx={mx}
                cy="25"
                r="3"
                fill="rgb(186 230 253)"
                stroke="rgb(14 165 233)"
                strokeWidth="1"
              />
              <rect
                x={mx - 6}
                y={i % 2 === 0 ? 9 : 36}
                width="12"
                height="6"
                rx="0.5"
                fill="white"
                stroke="rgb(148 163 184)"
                strokeWidth="0.5"
              />
              <line
                x1={mx}
                y1={i % 2 === 0 ? 15 : 31}
                x2={mx}
                y2={i % 2 === 0 ? 22 : 36}
                stroke="rgb(148 163 184)"
                strokeWidth="0.5"
              />
            </g>
          ))}
        </svg>
      );
    case 'milestone-timeline':
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          {/* Directional spine with an arrowhead: time flows right. */}
          <line x1="4" y1="27" x2="72" y2="27" stroke="rgb(100 116 139)" strokeWidth="1.5" />
          <path
            d="M72 27 L69 24.8 M72 27 L69 29.2"
            stroke="rgb(100 116 139)"
            strokeWidth="1.5"
            fill="none"
          />
          {[13, 30, 47, 64].map((mx, i) => {
            const above = i % 2 === 0;
            // The third milestone is the hero (Launch) card → brand tint.
            const hero = i === 2;
            return (
              <g key={mx}>
                <line
                  x1={mx}
                  y1={above ? 13 : 33}
                  x2={mx}
                  y2={above ? 24 : 40}
                  stroke="rgb(148 163 184)"
                  strokeWidth="0.75"
                />
                {/* Date chip riding the stem. */}
                <rect
                  x={mx - 4}
                  y={above ? 16.5 : 31.5}
                  width="8"
                  height="4"
                  rx="2"
                  fill="rgb(226 232 240)"
                />
                <circle
                  cx={mx}
                  cy="27"
                  r="2.6"
                  fill="rgb(14 165 233)"
                  stroke="white"
                  strokeWidth="0.75"
                />
                {/* Milestone card at the end of the stem. */}
                <rect
                  x={mx - 9}
                  y={above ? 4 : 40}
                  width="18"
                  height="9"
                  rx="2"
                  fill={hero ? 'rgb(186 230 253)' : 'white'}
                  stroke={hero ? 'rgb(14 165 233)' : 'rgb(148 163 184)'}
                  strokeWidth="0.75"
                />
              </g>
            );
          })}
        </svg>
      );
    case 'venn':
      return (
        <svg width="70" height="46" viewBox="0 0 70 50" aria-hidden>
          {/* Three semi-transparent outlined circles arranged in a triangle. */}
          <circle
            cx="35"
            cy="18"
            r="14"
            fill="rgb(186 230 253)"
            fillOpacity="0.45"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <circle
            cx="24"
            cy="32"
            r="14"
            fill="rgb(254 226 226)"
            fillOpacity="0.45"
            stroke="rgb(248 113 113)"
            strokeWidth="1"
          />
          <circle
            cx="46"
            cy="32"
            r="14"
            fill="rgb(220 252 231)"
            fillOpacity="0.45"
            stroke="rgb(74 222 128)"
            strokeWidth="1"
          />
        </svg>
      );
    case 'journey':
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          {/* Four stage boxes in a row with arrows between, sticky-note row below. */}
          {[6, 24, 42, 60].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="6"
                width="12"
                height="9"
                rx="1"
                fill="rgb(186 230 253)"
                stroke="rgb(14 165 233)"
                strokeWidth="0.75"
              />
              <rect
                x={x}
                y="28"
                width="12"
                height="10"
                rx="1"
                fill="rgb(254 243 199)"
                stroke="rgb(252 211 77)"
                strokeWidth="0.75"
              />
            </g>
          ))}
          {[18, 36, 54].map((mx) => (
            <line
              key={mx}
              x1={mx}
              y1="10"
              x2={mx + 6}
              y2="10"
              stroke="rgb(100 116 139)"
              strokeWidth="1"
              markerEnd=""
            />
          ))}
        </svg>
      );
    case 'fishbone':
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          {/* Horizontal spine with effect box at the right. */}
          <line x1="6" y1="25" x2="62" y2="25" stroke="rgb(100 116 139)" strokeWidth="1.25" />
          <rect
            x="62"
            y="20"
            width="14"
            height="10"
            rx="1"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.75"
          />
          {/* Two upper and two lower diagonal branches. */}
          {[
            { x1: 16, y1: 6, x2: 28, y2: 25 },
            { x1: 36, y1: 6, x2: 48, y2: 25 },
            { x1: 16, y1: 44, x2: 28, y2: 25 },
            { x1: 36, y1: 44, x2: 48, y2: 25 },
          ].map((b, i) => (
            <line
              key={i}
              x1={b.x1}
              y1={b.y1}
              x2={b.x2}
              y2={b.y2}
              stroke="rgb(100 116 139)"
              strokeWidth="0.75"
            />
          ))}
          {/* Small category labels at the ends of each branch. */}
          {[
            { x: 8, y: 4 },
            { x: 30, y: 4 },
            { x: 8, y: 42 },
            { x: 30, y: 42 },
          ].map((c, i) => (
            <rect
              key={i}
              x={c.x}
              y={c.y}
              width="12"
              height="5"
              rx="0.5"
              fill="white"
              stroke="rgb(148 163 184)"
              strokeWidth="0.5"
            />
          ))}
        </svg>
      );
    case 'pyramid':
      return (
        <svg width="70" height="46" viewBox="0 0 70 50" aria-hidden>
          {/* Four tiers stacked; each row narrower than the one below to read as a pyramid. */}
          {[
            { x: 28, y: 6, w: 14, h: 9 },
            { x: 22, y: 16, w: 26, h: 9 },
            { x: 16, y: 26, w: 38, h: 9 },
            { x: 10, y: 36, w: 50, h: 9 },
          ].map((t, i) => (
            <rect
              key={i}
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              rx="1"
              fill={i === 0 ? 'rgb(186 230 253)' : 'rgb(241 245 249)'}
              stroke="rgb(148 163 184)"
              strokeWidth="0.75"
            />
          ))}
        </svg>
      );
    case 'mobile-wireframe':
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {/* Three phone silhouettes with stacked content rows. */}
          {[6, 30, 54].map((px) => (
            <g key={px}>
              <rect
                x={px}
                y="3"
                width="20"
                height="44"
                rx="2.5"
                fill="white"
                stroke="rgb(100 116 139)"
                strokeWidth="0.85"
              />
              {/* Notch / status strip */}
              <rect x={px + 2} y="5.5" width="16" height="1.5" rx="0.4" fill="rgb(186 230 253)" />
              {/* Header strip */}
              <rect
                x={px + 2}
                y="9"
                width="16"
                height="3"
                rx="0.5"
                fill="rgb(219 234 254)"
                stroke="rgb(147 197 253)"
                strokeWidth="0.4"
              />
              {/* Three content cards */}
              {[15, 22, 29].map((cy) => (
                <rect
                  key={cy}
                  x={px + 2}
                  y={cy}
                  width="16"
                  height="5"
                  rx="0.5"
                  fill="white"
                  stroke="rgb(148 163 184)"
                  strokeWidth="0.4"
                />
              ))}
              {/* Bottom tab bar */}
              <rect
                x={px + 2}
                y="40"
                width="16"
                height="4.5"
                rx="0.5"
                fill="rgb(241 245 249)"
                stroke="rgb(203 213 225)"
                strokeWidth="0.4"
              />
            </g>
          ))}
        </svg>
      );
    case 'laptop-wireframe':
      return (
        <svg width="80" height="44" viewBox="0 0 80 50" aria-hidden>
          {/* Laptop body trapezoid + screen with header / sidebar / content / cards. */}
          <polygon
            points="4,38 76,38 72,42 8,42"
            fill="rgb(226 232 240)"
            stroke="rgb(100 116 139)"
            strokeWidth="0.6"
          />
          <rect
            x="8"
            y="6"
            width="64"
            height="32"
            rx="1.5"
            fill="white"
            stroke="rgb(100 116 139)"
            strokeWidth="0.85"
          />
          {/* Header strip */}
          <rect
            x="10"
            y="8"
            width="60"
            height="4"
            rx="0.4"
            fill="rgb(219 234 254)"
            stroke="rgb(147 197 253)"
            strokeWidth="0.4"
          />
          <circle cx="67" cy="10" r="1.4" fill="rgb(186 230 253)" />
          {/* Sidebar */}
          <rect
            x="10"
            y="13"
            width="14"
            height="23"
            rx="0.4"
            fill="rgb(241 245 249)"
            stroke="rgb(203 213 225)"
            strokeWidth="0.4"
          />
          {[15, 19, 23, 27, 31].map((sy) => (
            <rect
              key={sy}
              x="11.5"
              y={sy}
              width="11"
              height="2.4"
              rx="0.3"
              fill="white"
              stroke="rgb(148 163 184)"
              strokeWidth="0.3"
            />
          ))}
          {/* Three stat cards */}
          {[25, 39, 53].map((cx) => (
            <rect
              key={cx}
              x={cx}
              y="15"
              width="13"
              height="8"
              rx="0.4"
              fill="white"
              stroke="rgb(148 163 184)"
              strokeWidth="0.4"
            />
          ))}
          {/* Wider content row */}
          <rect
            x="25"
            y="25"
            width="45"
            height="10"
            rx="0.4"
            fill="white"
            stroke="rgb(148 163 184)"
            strokeWidth="0.4"
          />
        </svg>
      );
    case 'slide-deck':
      return (
        <svg width="80" height="46" viewBox="0 0 80 50" aria-hidden>
          {/* 2x2 grid of plain rectangle slides, each with a title
              band + content bullets, joined by reading-order arrows. */}
          {[
            { x: 4, y: 3 },
            { x: 42, y: 3 },
            { x: 4, y: 26 },
            { x: 42, y: 26 },
          ].map((s, i) => (
            <g key={i}>
              <rect
                x={s.x}
                y={s.y}
                width="34"
                height="20"
                rx="1.25"
                fill="white"
                stroke="rgb(100 116 139)"
                strokeWidth="0.75"
              />
              {/* Heading stadium */}
              <rect
                x={s.x + 2.5}
                y={s.y + 2}
                width="29"
                height="4"
                rx="2"
                fill="rgb(186 230 253)"
                stroke="rgb(14 165 233)"
                strokeWidth="0.4"
              />
              {/* Slide-specific content */}
              {i === 0 ? (
                <>
                  <rect
                    x={s.x + 4}
                    y={s.y + 9}
                    width="22"
                    height="2.5"
                    rx="0.3"
                    fill="rgb(226 232 240)"
                  />
                  <rect
                    x={s.x + 4}
                    y={s.y + 16}
                    width="14"
                    height="2.5"
                    rx="1.2"
                    fill="rgb(186 230 253)"
                  />
                </>
              ) : i === 1 ? (
                [9, 12.5, 16].map((ry) => (
                  <g key={ry}>
                    <rect
                      x={s.x + 3}
                      y={s.y + ry}
                      width="3"
                      height="2.4"
                      rx="0.3"
                      fill="rgb(241 245 249)"
                      stroke="rgb(148 163 184)"
                      strokeWidth="0.3"
                    />
                    <rect
                      x={s.x + 7}
                      y={s.y + ry}
                      width="24"
                      height="2.4"
                      rx="0.3"
                      fill="white"
                      stroke="rgb(148 163 184)"
                      strokeWidth="0.3"
                    />
                  </g>
                ))
              ) : i === 2 ? (
                [4, 14, 24].map((rx) => (
                  <g key={rx}>
                    <rect
                      x={s.x + rx}
                      y={s.y + 9}
                      width="8"
                      height="9"
                      rx="0.5"
                      fill="white"
                      stroke="rgb(148 163 184)"
                      strokeWidth="0.3"
                    />
                    <circle cx={s.x + rx + 4} cy={s.y + 12} r="1.4" fill="rgb(186 230 253)" />
                  </g>
                ))
              ) : (
                [9, 12.5, 16].map((ry) => (
                  <g key={ry}>
                    <circle
                      cx={s.x + 4.5}
                      cy={s.y + ry + 1.2}
                      r="1"
                      fill="rgb(220 252 231)"
                      stroke="rgb(74 222 128)"
                      strokeWidth="0.3"
                    />
                    <rect
                      x={s.x + 7}
                      y={s.y + ry}
                      width="24"
                      height="2.4"
                      rx="1.2"
                      fill="white"
                      stroke="rgb(148 163 184)"
                      strokeWidth="0.3"
                    />
                  </g>
                ))
              )}
            </g>
          ))}
          {/* Connecting arrows showing the reading order 1 -> 2 -> 4 -> 3. */}
          <line x1="38" y1="13" x2="42" y2="13" stroke="rgb(100 116 139)" strokeWidth="0.7" />
          <polygon points="42,13 40.5,12 40.5,14" fill="rgb(100 116 139)" />
          <line x1="59" y1="23" x2="59" y2="26" stroke="rgb(100 116 139)" strokeWidth="0.7" />
          <polygon points="59,26 58,24.5 60,24.5" fill="rgb(100 116 139)" />
          <line x1="42" y1="36" x2="38" y2="36" stroke="rgb(100 116 139)" strokeWidth="0.7" />
          <polygon points="38,36 39.5,35 39.5,37" fill="rgb(100 116 139)" />
        </svg>
      );
    default:
      return null;
  }
}
