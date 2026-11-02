import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { pv } from '@liveworkspace/template-previews/motion';

// Group 1 of 3 (mind maps / flowcharts). Static SVG preview tiles (one branch per
// TemplateKind; see template-preview.tsx for who renders them). Split out of template-preview.tsx to keep each file under the
// ~1000-line budget; TemplatePreview chains the groups with ??.
// A story group hidden at rest that pops in at `at` (pv-new on a <g>, scaled
// round its own box rather than the drawing's corner).
export function templatePreviewGroup1(kind: TemplateKind): ReactElement | null {
  switch (kind) {
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
