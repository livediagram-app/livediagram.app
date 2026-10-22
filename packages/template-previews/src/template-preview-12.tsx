import type { ReactElement } from 'react';
import type { TemplateKind } from '@liveplanner/templates';
import { pv } from './motion';
import { Pop } from './story-parts';

// Group 12: Blank Diagram (docs/specs/007-editor/templates-by-mode.md "Five blanks"). Static SVG preview tiles (one
// branch per TemplateKind; see template-preview.tsx for who renders them); TemplatePreview chains the groups with ??.

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
    default:
      return null;
  }
}
