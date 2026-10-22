import type { ReactElement } from 'react';
import type { TemplateKind } from '@livedesign/templates';
import { pv } from './motion';

// Group 12: the blanks (docs/specs/008-canvas/canvas-and-palette.md "Templates"): Blank Tab and Blank
// Illustration, each drawn as its sheet. Static SVG preview tiles (one
// branch per TemplateKind; see template-preview.tsx for who renders them); TemplatePreview chains
// the groups with ??.

const SLATE = 'rgb(148 163 184)';

export function templatePreviewGroup12(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    // Blank Tab is an empty Pages tab: the one unchosen page Blank Illustration opens on.
    case 'blank':
    case 'blank-illustration':
      // One empty page with a dashed edge, a faint chart on its top half and faint lines of
      // writing below: a page to fill, either way. Hover story: the two halves take turns to
      // light up, the choice the page asks for.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="25"
            y="3"
            width="30"
            height="44"
            rx="2"
            fill="white"
            stroke={SLATE}
            strokeWidth="0.8"
            strokeDasharray="2 1.4"
          />
          <g className="pv-pulse" style={pv({ '--pv-at': '700ms' })}>
            <rect x="29" y="8" width="22" height="16" rx="1.5" fill="rgb(240 249 255)" />
            <circle cx="35" cy="16" r="4" fill="none" stroke="rgb(125 211 252)" strokeWidth="2" />
            <rect x="42" y="17" width="2" height="4" rx="0.4" fill="rgb(125 211 252)" />
            <rect x="45" y="14" width="2" height="7" rx="0.4" fill="rgb(56 189 248)" />
          </g>
          <g className="pv-pulse" style={pv({ '--pv-at': '1500ms' })}>
            {[28, 31, 34, 37].map((y, i) => (
              <rect
                key={y}
                x="29"
                y={y}
                width={i === 3 ? 13 : 22}
                height="1.3"
                rx="0.6"
                fill="rgb(203 213 225)"
              />
            ))}
          </g>
          <circle cx="40" cy="42.5" r="2" fill="rgb(14 165 233)" />
          <path d="M40 41.4 V43.6 M38.9 42.5 H41.1" stroke="white" strokeWidth="0.6" />
        </svg>
      );
    default:
      return null;
  }
}
