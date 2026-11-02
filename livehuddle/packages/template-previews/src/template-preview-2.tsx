import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { pv } from '@liveworkspace/template-previews/motion';
import { Pop } from '@liveworkspace/template-previews/story-parts';

// Group 2 of 3 (agile / hierarchy / wireframes). Static SVG preview tiles (one branch per
// TemplateKind; see template-preview.tsx for who renders them). Split out of template-preview.tsx to keep each file under the
// ~1000-line budget; TemplatePreview chains the groups with ??.
export function templatePreviewGroup2(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'swot':
      // Named axes (Helpful / Harmful ticks over the columns, Internal /
      // External down the rows), the four tinted quadrants, and the So what?
      // strip beneath. Hover story: a sticky in each quadrant's own hue lands,
      // strengths first, then the strip's four moves are written in turn.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {[12, 46].map((x) => (
            <rect
              key={x}
              x={x + 11}
              y="1.5"
              width="10"
              height="1.4"
              rx="0.7"
              fill="rgb(148 163 184)"
            />
          ))}
          {[6, 20].map((y) => (
            <rect key={y} x="3" y={y + 2} width="1.4" height="8" rx="0.7" fill="rgb(148 163 184)" />
          ))}
          {[
            {
              x: 7,
              y: 4,
              fill: 'rgb(220 252 231)',
              stroke: 'rgb(134 239 172)',
              note: 'rgb(187 247 208)',
              at: 900,
            },
            {
              x: 42,
              y: 4,
              fill: 'rgb(255 228 230)',
              stroke: 'rgb(253 164 175)',
              note: 'rgb(254 205 211)',
              at: 1150,
            },
            {
              x: 7,
              y: 19,
              fill: 'rgb(219 234 254)',
              stroke: 'rgb(147 197 253)',
              note: 'rgb(186 230 253)',
              at: 1400,
            },
            {
              x: 42,
              y: 19,
              fill: 'rgb(254 243 199)',
              stroke: 'rgb(252 211 77)',
              note: 'rgb(253 230 138)',
              at: 1650,
            },
          ].map((q) => (
            <g key={`${q.x}-${q.y}`}>
              <rect
                x={q.x}
                y={q.y}
                width="33"
                height="13"
                rx="1.5"
                fill={q.fill}
                stroke={q.stroke}
                strokeWidth="0.75"
              />
              <rect x={q.x + 2.5} y={q.y + 5} width="8" height="6" rx="0.6" fill={q.note} />
              <rect x={q.x + 12.5} y={q.y + 5} width="8" height="6" rx="0.6" fill={q.note} />
              <Pop
                at={q.at}
                x={q.x + 22.5}
                y={q.y + 5}
                width="8"
                height="6"
                rx="0.6"
                fill={q.note}
              />
            </g>
          ))}
          <rect
            x="7"
            y="35"
            width="68"
            height="12"
            rx="1.5"
            fill="rgb(248 250 252)"
            stroke="rgb(148 163 184)"
            strokeWidth="1.2"
          />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect
                x={9.5 + i * 16.5}
                y="38"
                width="15"
                height="6.5"
                rx="0.8"
                fill="white"
                stroke="rgb(203 213 225)"
                strokeWidth="0.6"
              />
              <Pop
                at={2000 + i * 250}
                x={10.5 + i * 16.5}
                y="39.2"
                width="7"
                height="1.8"
                rx="0.9"
                fill="rgb(3 105 161)"
              />
            </g>
          ))}
        </svg>
      );
    case 'journey':
      return (
        <svg width="80" height="40" viewBox="0 0 80 50" aria-hidden>
          {/* A journey map: stage chips across the top, then five lens rows
              (doing, thinking, feeling, pains, ideas) behind a label gutter.
              Each lens row's stickies share a colour. */}
          {[16, 29, 42, 55, 68].map((x) => (
            <rect
              key={x}
              x={x}
              y="3"
              width="11"
              height="4"
              rx="2"
              fill="rgb(186 230 253)"
              stroke="rgb(14 165 233)"
              strokeWidth="0.5"
            />
          ))}
          {[
            { y: 9, h: 6, band: 'rgb(239 246 255)', note: 'rgb(191 219 254)' },
            { y: 16.5, h: 6, band: 'rgb(245 243 255)', note: 'rgb(221 214 254)' },
            { y: 24, h: 9, band: 'rgb(254 252 232)' },
            { y: 34.5, h: 6, band: 'rgb(255 241 242)', note: 'rgb(254 205 211)' },
            { y: 42, h: 6, band: 'rgb(240 253 244)', note: 'rgb(187 247 208)' },
          ].map((row) => (
            <g key={row.y}>
              <rect x="3" y={row.y} width="76" height={row.h} rx="1" fill={row.band} />
              <rect
                x="5"
                y={row.y + row.h / 2 - 0.8}
                width="7"
                height="1.6"
                rx="0.5"
                fill="rgb(100 116 139)"
              />
              {row.note &&
                [16, 29, 42, 55, 68].map((x) => (
                  <rect
                    key={x}
                    x={x + 0.5}
                    y={row.y + 0.8}
                    width="10"
                    height={row.h - 1.6}
                    fill={row.note}
                  />
                ))}
            </g>
          ))}
          {/* Hover story: the emotion curve draws itself through the
              stages (up, down into the painful booking, up to a regular),
              and a face lands on each stage. */}
          <path
            d="M21.5 27.5 L34.5 29 L47.5 31 L60.5 26.5 L73.5 25.5"
            stroke="rgb(245 158 11)"
            strokeWidth="1"
            fill="none"
            className="pv-draw"
            pathLength="1"
            style={pv({ '--pv-at': '900ms', '--pv-dur': '1400ms' })}
          />
          {[
            { x: 21.5, y: 27.5, at: 1000 },
            { x: 34.5, y: 29, at: 1300 },
            { x: 47.5, y: 31, at: 1600 },
            { x: 60.5, y: 26.5, at: 1900 },
            { x: 73.5, y: 25.5, at: 2200 },
          ].map((m) => (
            <circle
              key={m.x}
              className="pv-new"
              opacity="0"
              cx={m.x}
              cy={m.y}
              r="1.8"
              fill="rgb(250 204 21)"
              stroke="white"
              strokeWidth="0.5"
              style={pv({ '--pv-at': `${m.at}ms` })}
            />
          ))}
        </svg>
      );
    default:
      return null;
  }
}
