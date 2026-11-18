import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from '@liveworkspace/template-previews/motion';
import { PopDot, popGroup } from '@liveworkspace/template-previews/story-parts';

// Group 17: Workshop mode's blank (docs/specs/007-editor/templates-by-mode.md "Five blanks") and the BPMN Process
// (docs/specs/009-elements/bpmn.md "The template").
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const FRAME = 'rgb(148 163 184)';
const STICKY = 'rgb(254 240 138)';
const STICKY_EDGE = 'rgb(234 179 8)';
const TIMER = 'rgb(14 165 233)';
const DOT = 'rgb(139 92 246)';
const INK = 'rgb(51 65 85)';
const BPMN_START = 'rgb(22 163 74)';
const BPMN_END = 'rgb(220 38 38)';

export function templatePreviewGroup17(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'blank-session':
      // Blank Workshop: an empty canvas framed like the other blanks, a timer ring at the top right
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
    case 'bpmn-process':
      // BPMN Process: the customer's pool over the shop's pool of two lanes, a start, a task, an X gateway, a
      // parallel split and an end, a dashed message flow dropping between the pools. Hover story: the token runs
      // along the shop's flow and the end event lands.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="2"
            y="3"
            width="76"
            height="12"
            rx="0.8"
            fill="rgb(250 245 255)"
            stroke="rgb(216 180 254)"
            strokeWidth="0.5"
          />
          <rect x="2" y="3" width="4" height="12" fill="rgb(243 232 255)" />
          <rect
            x="2"
            y="18"
            width="76"
            height="30"
            rx="0.8"
            fill="rgb(248 250 252)"
            stroke={FRAME}
            strokeWidth="0.5"
          />
          <rect x="2" y="18" width="4" height="30" fill="rgb(226 232 240)" />
          <rect
            x="6"
            y="18"
            width="72"
            height="15"
            fill="rgb(240 249 255)"
            stroke="rgb(186 230 253)"
            strokeWidth="0.4"
          />
          <rect
            x="6"
            y="33"
            width="72"
            height="15"
            fill="rgb(255 251 235)"
            stroke="rgb(253 230 138)"
            strokeWidth="0.4"
          />
          <g fill="none" stroke={INK} strokeWidth="0.55">
            <path d="M13.5 9 H19" />
            <path d="M15.5 25.5 H20 M30 25.5 H34 M42 25.5 H46 M53 25.5 H58 M50 29 V40.5 H58" />
            <path d="M24 12 V22.5" strokeDasharray="1 0.8" />
          </g>
          <circle cx="11.5" cy="9" r="2" fill="white" stroke={BPMN_START} strokeWidth="0.6" />
          <rect
            x="19"
            y="6.5"
            width="10"
            height="5"
            rx="1"
            fill="white"
            stroke={INK}
            strokeWidth="0.55"
          />
          <circle cx="13.5" cy="25.5" r="2" fill="white" stroke={BPMN_START} strokeWidth="0.6" />
          <rect
            x="20"
            y="23"
            width="10"
            height="5"
            rx="1"
            fill="white"
            stroke={INK}
            strokeWidth="0.55"
          />
          <path
            d="M38 21.5 L42 25.5 L38 29.5 L34 25.5 Z"
            fill="white"
            stroke={INK}
            strokeWidth="0.55"
          />
          <path d="M36.8 24.3 L39.2 26.7 M39.2 24.3 L36.8 26.7" stroke={INK} strokeWidth="0.6" />
          <path
            d="M50 21.5 L54 25.5 L50 29.5 L46 25.5 Z"
            fill="white"
            stroke={INK}
            strokeWidth="0.55"
          />
          <path d="M50 23.8 V27.2 M48.3 25.5 H51.7" stroke={INK} strokeWidth="0.6" />
          <rect
            x="58"
            y="23"
            width="10"
            height="5"
            rx="1"
            fill="white"
            stroke={INK}
            strokeWidth="0.55"
          />
          <rect
            x="58"
            y="38"
            width="10"
            height="5"
            rx="1"
            fill="white"
            stroke={INK}
            strokeWidth="0.55"
          />
          <circle
            className="pv-travel"
            opacity="0"
            cx="15.5"
            cy="25.5"
            r="0.9"
            fill={BPMN_START}
            style={pv({ '--pv-dx': '42px', '--pv-at': '300ms', '--pv-dur': '1600ms' })}
          />
          <g className="pv-new" opacity="0" style={popGroup(1500)}>
            <path d="M68 25.5 H71" fill="none" stroke={INK} strokeWidth="0.55" />
            <circle cx="73" cy="25.5" r="2" fill="white" stroke={BPMN_END} strokeWidth="1.1" />
          </g>
        </svg>
      );
    default:
      return null;
  }
}
