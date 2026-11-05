import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { pv } from '@liveworkspace/template-previews/motion';

// Group 17: Workshop mode's blank (docs/specs/007-editor/templates-by-mode.md "Five blanks").
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const FRAME = 'rgb(148 163 184)';
const STICKY = 'rgb(254 240 138)';
const STICKY_EDGE = 'rgb(234 179 8)';
const TIMER = 'rgb(14 165 233)';

export function templatePreviewGroup17(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'blank-session':
      // Blank Space: an empty canvas framed like the other blanks, a timer ring at the top right
      // and two sticky notes waiting for the room. Hover story: the timer runs down.
      return (
        <svg width="72" height="40" viewBox="0 0 80 44" aria-hidden>
          <rect
            x="3"
            y="3"
            width="74"
            height="38"
            rx="3"
            fill="rgb(248 250 252)"
            stroke={FRAME}
            strokeWidth="1"
          />
          <rect
            x="12"
            y="15"
            width="16"
            height="16"
            rx="1.2"
            fill={STICKY}
            stroke={STICKY_EDGE}
            strokeWidth="0.8"
          />
          <rect
            x="33"
            y="15"
            width="16"
            height="16"
            rx="1.2"
            fill={STICKY}
            stroke={STICKY_EDGE}
            strokeWidth="0.8"
          />
          <rect x="15" y="19" width="10" height="1.6" rx="0.8" fill="rgb(113 63 18)" />
          <rect x="36" y="19" width="8" height="1.6" rx="0.8" fill="rgb(113 63 18)" />
          {/* The timer: a full ring, and the arc that runs down on hover. */}
          <circle cx="63" cy="17" r="7" fill="white" stroke={FRAME} strokeWidth="1" />
          <path
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            d="M63 10 A7 7 0 1 1 56 17"
            fill="none"
            stroke={TIMER}
            strokeWidth="1.6"
            strokeLinecap="round"
            style={pv({ '--pv-at': '200ms', '--pv-dur': '1400ms' })}
          />
          <path d="M63 17 L63 13 M63 17 L66 17" stroke="rgb(15 23 42)" strokeWidth="1" />
        </svg>
      );
    default:
      return null;
  }
}
