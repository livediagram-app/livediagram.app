import type { ReactElement } from 'react';
import type { TemplateKind } from '@livedocuments/templates';
import { pv } from '@liveworkspace/template-previews/motion';

// Group 3: the Group Card. Static SVG preview tiles (one branch per
// TemplateKind; see template-preview.tsx for who renders them). Split out of template-preview.tsx to keep each file under the
// ~1000-line budget; TemplatePreview chains the groups with ??.
export function templatePreviewGroup3(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'live-card':
      // The group card opened flat: a pink cover page (title, photo slot,
      // a party sticker) beside a cream message wall of pastel notes, each
      // with its initials badge, and a dashed slot waiting for yours.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="3"
            y="3"
            width="28"
            height="44"
            rx="2"
            fill="rgb(253 242 248)"
            stroke="rgb(249 168 212)"
            strokeWidth="0.6"
          />
          <rect x="8" y="7" width="18" height="2.6" rx="0.6" fill="rgb(15 23 42)" />
          <rect
            x="7"
            y="12"
            width="20"
            height="20"
            rx="1.5"
            fill="rgb(241 245 249)"
            stroke="rgb(148 163 184)"
            strokeWidth="0.5"
            strokeDasharray="1.5 1"
          />
          <circle cx="8" cy="41" r="3.4" fill="white" stroke="rgb(226 232 240)" strokeWidth="0.4" />
          <circle cx="8" cy="41" r="2" fill="rgb(244 114 182)" />
          <rect
            x="33"
            y="3"
            width="44"
            height="44"
            rx="2"
            fill="rgb(255 251 235)"
            stroke="rgb(252 211 77)"
            strokeWidth="0.6"
          />
          {(
            [
              [36, 6, 'rgb(254 240 138)', 'rgb(202 138 4)'],
              [56, 6, 'rgb(251 207 232)', 'rgb(219 39 119)'],
              [36, 16, 'rgb(191 219 254)', 'rgb(37 99 235)'],
              [56, 16, 'rgb(187 247 208)', 'rgb(22 163 74)'],
              [36, 26, 'rgb(221 214 254)', 'rgb(124 58 237)'],
              [56, 26, 'rgb(254 215 170)', 'rgb(234 88 12)'],
              [36, 36, 'rgb(165 243 252)', 'rgb(8 145 178)'],
            ] as [number, number, string, string][]
          ).map(([x, y, paper, badge]) => (
            <g key={`${x}-${y}`}>
              <rect x={x} y={y} width="18" height="8" fill={paper} />
              <rect x={x + 1.5} y={y + 2} width="11" height="1.2" rx="0.4" fill="rgb(71 85 105)" />
              <circle cx={x + 17} cy={y + 0.5} r="1.8" fill={badge} />
            </g>
          ))}
          <rect
            x="56"
            y="36"
            width="18"
            height="8"
            rx="1"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.5"
            strokeDasharray="1.5 1"
          />
          {/* Hover story: a new teammate signs the empty slot, then the
              confetti pops on the cover. */}
          <rect
            className="pv-arrive"
            opacity="0"
            x="56"
            y="36"
            width="18"
            height="8"
            fill="rgb(254 202 202)"
            style={pv({ '--pv-from-y': '5px', '--pv-at': '900ms' })}
          />
          <circle
            className="pv-arrive"
            opacity="0"
            cx="73"
            cy="36.5"
            r="1.8"
            fill="rgb(220 38 38)"
            style={pv({ '--pv-from-y': '5px', '--pv-at': '1100ms' })}
          />
          {(
            [
              [22, 36, 'rgb(245 158 11)'],
              [26, 40, 'rgb(59 130 246)'],
              [20, 42, 'rgb(236 72 153)'],
            ] as [number, number, string][]
          ).map(([cx, cy, fill], i) => (
            <circle
              key={i}
              className="pv-new"
              opacity="0"
              cx={cx}
              cy={cy}
              r="1.1"
              fill={fill}
              style={pv({ '--pv-at': `${1700 + i * 150}ms` })}
            />
          ))}
        </svg>
      );
    default:
      return null;
  }
}
