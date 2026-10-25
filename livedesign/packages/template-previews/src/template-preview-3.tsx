import type { ReactElement } from 'react';
import type { TemplateKind } from '@livedesign/templates';
import { pv } from '@liveworkspace/template-previews/motion';

// Group 3: the Logo Design and the Group Card. Static SVG preview tiles (one branch per
// TemplateKind; see template-preview.tsx for who renders them). Split out of template-preview.tsx to keep each file under the
// ~1000-line budget; TemplatePreview chains the groups with ??.
export function templatePreviewGroup3(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'logo-design':
      // The exploration sheet: a 3x2 grid of artboards (horizontal, stacked,
      // app icon / horizontal + tagline, stacked + tagline, one colour) over
      // a four-swatch palette strip, the same composition the builder lays
      // out, in the brand's espresso + sunrise colours.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x={3 + (i % 3) * 25.5}
              y={3 + Math.floor(i / 3) * 17}
              width="23"
              height="15"
              rx="1"
              fill="white"
              stroke="rgb(203 213 225)"
              strokeWidth="0.6"
            />
          ))}
          {/* 01 horizontal and 04 horizontal + tagline. */}
          <circle cx="8.5" cy="10.5" r="2.6" fill="rgb(245 158 11)" />
          <rect x="12.5" y="9.3" width="10" height="2.4" rx="0.6" fill="rgb(59 31 20)" />
          <circle cx="8.5" cy="27.5" r="2.6" fill="rgb(245 158 11)" />
          <rect x="12.5" y="25.6" width="10" height="2.4" rx="0.6" fill="rgb(59 31 20)" />
          <rect x="12.5" y="29" width="8" height="1.3" rx="0.4" fill="rgb(146 64 14)" />
          {/* 02 stacked and 05 stacked + tagline. */}
          <circle cx="40" cy="8.5" r="2.6" fill="rgb(245 158 11)" />
          <rect x="35" y="12.5" width="10" height="2.4" rx="0.6" fill="rgb(59 31 20)" />
          <circle cx="40" cy="24.5" r="2.6" fill="rgb(245 158 11)" />
          <rect x="35" y="28.5" width="10" height="2.4" rx="0.6" fill="rgb(59 31 20)" />
          <rect x="36" y="32" width="8" height="1.3" rx="0.4" fill="rgb(146 64 14)" />
          {/* 03 app icon and 06 one colour. */}
          <rect x="60" y="5.5" width="10" height="10" rx="2.4" fill="rgb(59 31 20)" />
          <circle cx="65" cy="10.5" r="3.2" fill="rgb(245 158 11)" />
          <circle cx="59.5" cy="27.5" r="2.6" fill="rgb(31 41 55)" />
          <rect x="63.5" y="26.3" width="10" height="2.4" rx="0.6" fill="rgb(31 41 55)" />
          {/* Palette strip. */}
          {['rgb(59 31 20)', 'rgb(245 158 11)', 'rgb(254 243 199)', 'rgb(31 41 55)'].map(
            (fill, i) => (
              <rect
                key={fill}
                x={3 + i * 19}
                y="39"
                width="17"
                height="7"
                rx="1.5"
                fill={fill}
                stroke={i === 2 ? 'rgb(252 211 77)' : fill}
                strokeWidth="0.5"
              />
            ),
          )}
          {/* Hover story: the sun rises on each mark in turn, then the
              horizontal lockup is picked (a selection frame lands on it). */}
          {(
            [
              [8.5, 10.5, 900],
              [40, 8.5, 1150],
              [65, 10.5, 1400],
              [8.5, 27.5, 1650],
              [40, 24.5, 1900],
            ] as [number, number, number][]
          ).map(([cx, cy, at], i) => (
            <circle
              key={i}
              className="pv-new"
              opacity="0"
              cx={cx}
              cy={cy}
              r="1.1"
              fill="rgb(59 31 20)"
              style={pv({ '--pv-at': `${at}ms` })}
            />
          ))}
          <rect
            className="pv-new"
            opacity="0"
            x="2"
            y="2"
            width="25"
            height="17"
            rx="1.5"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
            strokeDasharray="2 1.5"
            style={pv({ '--pv-at': '2400ms' })}
          />
        </svg>
      );
    default:
      return null;
  }
}
