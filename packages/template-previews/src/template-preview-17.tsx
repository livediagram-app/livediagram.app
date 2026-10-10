import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';
import { PopDot } from './story-parts';

// Group 17: Facilitate mode's blank (docs/specs/007-editor/templates-by-mode.md "Five blanks").
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const FRAME = 'rgb(148 163 184)';
const STICKY = 'rgb(254 240 138)';
const STICKY_EDGE = 'rgb(234 179 8)';
const TIMER = 'rgb(14 165 233)';
const DOT = 'rgb(139 92 246)';

export function templatePreviewGroup17(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'blank-session':
      // Blank Session: an empty canvas framed like the other blanks, a timer ring at the top right
      // and two sticky notes waiting for the room. Hover story: the timer runs down and the room's
      // dot votes land on the notes.
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
          {/* The room's votes. */}
          <PopDot at={700} cx="17" cy="27" r="1.6" fill={DOT} />
          <PopDot at={900} cx="22" cy="27" r="1.6" fill={DOT} />
          <PopDot at={1100} cx="38" cy="27" r="1.6" fill={DOT} />
        </svg>
      );
    default:
      return null;
  }
}
