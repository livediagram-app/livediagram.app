import type { ReactElement } from 'react';
import type { TemplateKind } from '@livedesign/templates';
import { pv } from './motion';
import { Pop } from './story-parts';

// Group 12: the blanks (docs/specs/007-editor/templates-by-mode.md "Five blanks"): Blank Diagram and
// Blank Illustration, each drawn as its sheet. Static SVG preview tiles (one
// branch per TemplateKind; see template-preview.tsx for who renders them); TemplatePreview chains
// the groups with ??.

const SLATE = 'rgb(148 163 184)';

export function templatePreviewGroup12(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'blank':
      // Blank Diagram (docs/specs/007-editor/templates-by-mode.md "Five blanks"): an empty canvas on
      // a faint dot grid, the first shape just placed and selected, a dashed ghost of the next one
      // with a "+". Framed like Blank Whiteboard's board and Blank Illustration's page, so the
      // five blanks read as a set. Hover story: the connector draws across and the next shape
      // lands where the ghost was.
      return (
        <svg width="72" height="40" viewBox="0 0 80 44" aria-hidden>
          <rect
            x="3"
            y="3"
            width="74"
            height="38"
            rx="3"
            fill="rgb(248 250 252)"
            stroke="rgb(148 163 184)"
            strokeWidth="1"
          />
          {[9, 15, 21, 27, 33].map((y) =>
            [9, 15, 21, 27, 33, 39, 45, 51, 57, 63, 69].map((x) => (
              <circle key={`${x}-${y}`} cx={x} cy={y + 1} r="0.45" fill="rgb(203 213 225)" />
            )),
          )}
          {/* The first shape, selected: its outline and four handles. */}
          <rect
            x="12"
            y="15"
            width="20"
            height="13"
            rx="2"
            fill="rgb(224 242 254)"
            stroke="rgb(14 165 233)"
            strokeWidth="1.1"
          />
          <rect x="16" y="20.6" width="12" height="1.8" rx="0.9" fill="rgb(3 105 161)" />
          {[
            [12, 15],
            [32, 15],
            [12, 28],
            [32, 28],
          ].map(([x, y]) => (
            <rect
              key={`${x}-${y}`}
              x={x! - 1.1}
              y={y! - 1.1}
              width="2.2"
              height="2.2"
              rx="0.4"
              fill="white"
              stroke="rgb(14 165 233)"
              strokeWidth="0.7"
            />
          ))}
          {/* The next shape, still a dashed ghost with a "+". */}
          <rect
            x="48"
            y="15"
            width="20"
            height="13"
            rx="2"
            fill="none"
            stroke="rgb(148 163 184)"
            strokeWidth="1"
            strokeDasharray="2.4 1.8"
          />
          <line x1="58" y1="18.5" x2="58" y2="24.5" stroke="rgb(148 163 184)" strokeWidth="1.1" />
          <line x1="55" y1="21.5" x2="61" y2="21.5" stroke="rgb(148 163 184)" strokeWidth="1.1" />
          {/* The connector, drawn across on hover, and the shape it lands. */}
          <path
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            d="M33.5 21.5 H46"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="1.1"
            strokeLinecap="round"
            style={pv({ '--pv-at': '300ms', '--pv-dur': '600ms' })}
          />
          <Pop
            at={900}
            x="48"
            y="15"
            width="20"
            height="13"
            rx="2"
            fill="rgb(254 243 199)"
            stroke="rgb(245 158 11)"
            strokeWidth="1.1"
          />
          {/* The pointer that placed it. */}
          <path
            d="M63 30 L63 37.5 L65 35.6 L66.6 38.8 L67.8 38.2 L66.3 35.1 L69 35 Z"
            fill="rgb(15 23 42)"
            stroke="white"
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'blank-illustration':
      // One empty page with a dashed edge, a faint infographic on its top half and faint lines of
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
