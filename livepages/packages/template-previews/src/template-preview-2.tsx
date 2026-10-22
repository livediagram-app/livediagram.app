import type { ReactElement } from 'react';
import type { TemplateKind } from '@livepages/templates';
import { pv } from './motion';

// Group 2: the Slide Deck. Static SVG preview tiles (one branch per
// TemplateKind; see template-preview.tsx for who renders them). Split out of template-preview.tsx to keep each file under the
// ~1000-line budget; TemplatePreview chains the groups with ??.
export function templatePreviewGroup2(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'slide-deck':
      // Six 16:9 slides read left to right, each with a kicker and a
      // headline, the pitch bodies sketched in (pains, a process, a chart,
      // avatars, a pie), and a muted speaker-notes line under each. Hover
      // story: the deck is presented, each slide lighting up in turn.
      return (
        <svg width="80" height="46" viewBox="0 0 80 50" aria-hidden>
          {[
            { x: 3, y: 4 },
            { x: 29, y: 4 },
            { x: 55, y: 4 },
            { x: 3, y: 27 },
            { x: 29, y: 27 },
            { x: 55, y: 27 },
          ].map((s, i) => (
            <g key={i}>
              <rect
                x={s.x}
                y={s.y}
                width="22"
                height="12.4"
                rx="1"
                fill="white"
                stroke="rgb(100 116 139)"
                strokeWidth="0.7"
              />
              <rect
                x={s.x + 2}
                y={s.y + 1.8}
                width="6"
                height="1"
                rx="0.3"
                fill="rgb(148 163 184)"
              />
              <rect
                x={s.x + 2}
                y={s.y + 3.6}
                width="15"
                height="1.8"
                rx="0.4"
                fill="rgb(15 23 42)"
              />
              {i === 0 && <circle cx={s.x + 18} cy={s.y + 9} r="2" fill="rgb(251 146 60)" />}
              {i === 1 &&
                [7, 9, 11].map((dy) => (
                  <rect
                    key={dy}
                    x={s.x + 2}
                    y={s.y + dy - 0.4}
                    width="12"
                    height="0.9"
                    rx="0.3"
                    fill="rgb(148 163 184)"
                  />
                ))}
              {i === 2 &&
                [5, 11, 17].map((dx) => (
                  <circle key={dx} cx={s.x + dx} cy={s.y + 9} r="1.6" fill="rgb(14 165 233)" />
                ))}
              {i === 3 && (
                <polyline
                  points={`${s.x + 2},${s.y + 11} ${s.x + 7},${s.y + 9.5} ${s.x + 12},${s.y + 8.5} ${s.x + 17},${s.y + 6.5}`}
                  fill="none"
                  stroke="rgb(14 165 233)"
                  strokeWidth="0.8"
                />
              )}
              {i === 4 &&
                [5, 11, 17].map((dx) => (
                  <circle
                    key={dx}
                    cx={s.x + dx}
                    cy={s.y + 8.8}
                    r="1.8"
                    fill="none"
                    stroke="rgb(14 165 233)"
                    strokeWidth="0.6"
                  />
                ))}
              {i === 5 && (
                <>
                  <circle cx={s.x + 6} cy={s.y + 8.8} r="2.4" fill="rgb(14 165 233)" />
                  <path
                    d={`M ${s.x + 6} ${s.y + 8.8} L ${s.x + 6} ${s.y + 6.4} A 2.4 2.4 0 0 1 ${s.x + 8.4} ${s.y + 8.8} Z`}
                    fill="rgb(186 230 253)"
                  />
                  <rect
                    x={s.x + 11}
                    y={s.y + 7}
                    width="8"
                    height="0.9"
                    rx="0.3"
                    fill="rgb(148 163 184)"
                  />
                  <rect
                    x={s.x + 11}
                    y={s.y + 9.4}
                    width="6"
                    height="0.9"
                    rx="0.3"
                    fill="rgb(148 163 184)"
                  />
                </>
              )}
              {/* Speaker notes under the slide. */}
              <rect
                x={s.x}
                y={s.y + 14.4}
                width="16"
                height="1.2"
                rx="0.4"
                fill="rgb(203 213 225)"
              />
              <rect
                className="pv-new"
                opacity="0"
                x={s.x - 0.6}
                y={s.y - 0.6}
                width="23.2"
                height="13.6"
                rx="1.4"
                fill="rgb(14 165 233)"
                fillOpacity="0.12"
                stroke="rgb(14 165 233)"
                strokeWidth="1.1"
                style={pv({ '--pv-at': `${900 + i * 260}ms` })}
              />
            </g>
          ))}
        </svg>
      );
    default:
      return null;
  }
}
