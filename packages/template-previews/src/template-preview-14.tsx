import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';
import { FILL_BOX } from './story-parts';
import {
  BLUE,
  Board,
  GREEN,
  INK,
  NOTE,
  NOTE_EDGE,
  ORANGE,
  RED,
  VIOLET,
  pen,
} from './sketch-preview-parts';

// Group 14: the second set of Draw templates (docs/specs/007-editor/templates-by-mode.md "Draw
// templates"), drawn like group 11: the off-white board with marker lines in its stock colours.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const PINK = 'rgb(254 205 211)';
const PINK_EDGE = 'rgb(244 114 182)';
const MINT = 'rgb(187 247 208)';
const MINT_EDGE = 'rgb(74 222 128)';

// A drawn tap: the story adds it at `at` ms.
const Tap = ({ x, y, at }: { x: number; y: number; at: number }) => (
  <circle
    className="pv-new"
    opacity="0"
    cx={x}
    cy={y}
    r="1.4"
    fill={RED}
    style={{ ...pv({ '--pv-at': `${at}ms` }), ...FILL_BOX }}
  />
);

// A face for how a moment felt, centred on (x, y).
const Face = ({
  x,
  y,
  c,
  mouth,
}: {
  x: number;
  y: number;
  c: string;
  mouth: 'up' | 'flat' | 'down';
}) => (
  <g {...pen(c, 0.6)}>
    <circle cx={x} cy={y} r="2.6" />
    <path
      d={
        mouth === 'up'
          ? `M${x - 1.2} ${y + 0.6} Q${x} ${y + 1.8} ${x + 1.2} ${y + 0.6}`
          : mouth === 'down'
            ? `M${x - 1.2} ${y + 1.6} Q${x} ${y + 0.4} ${x + 1.2} ${y + 1.6}`
            : `M${x - 1.1} ${y + 1} L${x + 1.1} ${y + 1}`
      }
    />
  </g>
);

export function templatePreviewGroup14(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'paper-prototype':
      // Three phone screens sketched on paper (a list, a detail with a crossed image, a big tick)
      // and the notes to test with. Hover story: a tap lands on each screen and an arrow carries it
      // on to the next.
      return (
        <svg width="72" height="40" viewBox="0 0 80 44" aria-hidden>
          <Board />
          {[6, 25, 44].map((x) => (
            <rect key={x} x={x} y="6.5" width="15" height="31" rx="2.5" {...pen(INK, 0.8)} />
          ))}
          <path
            d="M8.5 11 L13 11 M8.5 14.5 L11.5 14.5 L11.5 17.5 L8.5 17.5 Z M13 16 L18.5 16 M8.5 20.5 L11.5 20.5 L11.5 23.5 L8.5 23.5 Z M13 22 L17.5 22 M8.5 26.5 L11.5 26.5 L11.5 29.5 L8.5 29.5 Z M13 28 L18 28"
            {...pen(INK, 0.5)}
          />
          <path
            d="M27.5 10 L37.5 10 L37.5 18 L27.5 18 Z M27.5 10 L37.5 18 M37.5 10 L27.5 18 M27.5 21 L35 21 M27.5 24 L33 24 M28 29 L37 29 L37 32.5 L28 32.5 Z"
            {...pen(INK, 0.5)}
          />
          <circle cx="51.5" cy="15" r="3.6" {...pen(GREEN, 0.8)} />
          <path d="M49.8 15 L51.1 16.4 L53.4 13.6" {...pen(GREEN, 0.8)} />
          <path d="M47.5 22 L56 22 M48.5 29 L55.5 29 L55.5 32.5 L48.5 32.5 Z" {...pen(INK, 0.5)} />
          <rect
            x="63"
            y="7"
            width="11"
            height="9"
            fill={NOTE}
            stroke={NOTE_EDGE}
            strokeWidth="0.4"
          />
          <rect
            x="63"
            y="18"
            width="11"
            height="9"
            fill={PINK}
            stroke={PINK_EDGE}
            strokeWidth="0.4"
          />
          <rect
            x="63"
            y="29"
            width="11"
            height="9"
            fill={PINK}
            stroke={PINK_EDGE}
            strokeWidth="0.4"
          />
          <path
            d="M64.5 10 L72 10 M64.5 12.5 L70 12.5 M64.5 21 L72 21 M64.5 32 L71 32"
            {...pen(INK, 0.4)}
          />
          <Tap x={17} y={16} at={400} />
          <path
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            d="M18 15 Q21.5 11 24.5 12.5"
            {...pen(RED, 0.8)}
            style={pv({ '--pv-at': '600ms', '--pv-dur': '400ms' })}
          />
          <Tap x={35} y={31} at={1100} />
          <path
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            d="M36.5 31 Q40.5 26 43.5 25"
            {...pen(RED, 0.8)}
            style={pv({ '--pv-at': '1300ms', '--pv-dur': '400ms' })}
          />
        </svg>
      );
    case 'journey-doodle':
      // A customer's day as a winding road, a face over each stop rising and falling with the
      // mood. Hover story: the mood line is drawn through the faces, then the dip is ringed red.
      return (
        <svg width="72" height="40" viewBox="0 0 80 44" aria-hidden>
          <Board />
          <path
            d="M6 29 C14 23 20 23 28 28 S42 33 50 28 S64 23 74 28 M6 34 C14 28 20 28 28 33 S42 38 50 33 S64 28 74 33"
            {...pen(INK, 0.9)}
          />
          <path
            d="M8 31.5 L10 30.3 M14 28.6 L16 28.2 M20 28.4 L22 29 M26 30.5 L28 31.3 M33 33.4 L35 33.6 M40 33.4 L42 33 M46 31.6 L48 30.8 M53 28.8 L55 28.3 M60 28 L62 28.3 M66 29 L68 29.6"
            {...pen(ORANGE, 0.5)}
          />
          <Face x={12} y={15} c={ORANGE} mouth="flat" />
          <Face x={25} y={9} c={GREEN} mouth="up" />
          <Face x={38} y={20} c={RED} mouth="down" />
          <Face x={51} y={20} c={RED} mouth="down" />
          <Face x={64} y={9} c={GREEN} mouth="up" />
          <path
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            d="M14.5 14 L22.5 10 M27.5 10 L35.8 18.6 M40.6 20 L48.4 20 M53.2 18.6 L61.8 10.4"
            {...pen(VIOLET, 0.5)}
            style={pv({ '--pv-at': '400ms', '--pv-dur': '900ms' })}
          />
          <ellipse
            className="pv-new"
            opacity="0"
            cx="44.5"
            cy="20"
            rx="11"
            ry="5"
            {...pen(RED, 0.8)}
            style={{ ...pv({ '--pv-at': '1400ms' }), ...FILL_BOX }}
          />
        </svg>
      );
    case 'pre-mortem':
      // The project as a ship going down, the reasons on pink notes round it and what to do now
      // in a ticked column. Hover story: the ship sinks a little further, then the first action is
      // ticked off.
      return (
        <svg width="72" height="40" viewBox="0 0 80 44" aria-hidden>
          <Board />
          {[
            [6, 7],
            [14, 7],
            [6, 15],
            [6, 25],
            [14, 25],
            [6, 33],
            [42, 7],
            [42, 15],
            [42, 25],
            [42, 33],
          ].map(([x, y]) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="7"
              height="6"
              fill={PINK}
              stroke={PINK_EDGE}
              strokeWidth="0.4"
            />
          ))}
          <g
            className="pv-shift"
            style={pv({ '--pv-at': '500ms', '--pv-dy': '2px', '--pv-dur': '900ms' })}
          >
            <path d="M23 15 L37 20 L34.5 24 L23.5 20 Z" {...pen(INK, 0.8)} />
            <path d="M29 17 L31 8.5 M30.6 10 L25.5 14.5 L28 15 L27 16.5" {...pen(INK, 0.7)} />
            <path d="M30.6 10 L25.5 14.5" {...pen(RED, 0.8)} />
          </g>
          <path
            d="M21 24 Q22.5 22.5 24 24 T27 24 T30 24 T33 24 T36 24 T39 24 M22.5 27 Q24 25.5 25.5 27 T28.5 27 T31.5 27 T34.5 27 T37.5 27"
            {...pen(BLUE, 0.8)}
          />
          <path d="M53 6.5 L74 6.5 L74 38 L53 38 Z" {...pen(INK, 0.8)} />
          {[12, 18.5, 25, 31.5].map((y) => (
            <g key={y}>
              <rect x="55.5" y={y} width="3" height="3" {...pen(INK, 0.5)} />
              <path d={`M60.5 ${y + 1.5} L71 ${y + 1.5}`} {...pen(INK, 0.5)} />
            </g>
          ))}
          <path d="M55.5 9 L66 9" {...pen(GREEN, 0.8)} />
          <path
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            d="M55.6 13.2 L56.8 14.6 L59.2 11.2"
            {...pen(GREEN, 0.8)}
            style={pv({ '--pv-at': '1500ms', '--pv-dur': '400ms' })}
          />
        </svg>
      );
    case 'idea-garden':
      // A drawn tree: the question at the roots, themes as branches, ideas as green leaves and the
      // best ones as red fruit. Hover story: a new leaf grows, then a fruit ripens.
      return (
        <svg width="72" height="40" viewBox="0 0 80 44" aria-hidden>
          <Board />
          <path d="M14 33 Q40 31.5 66 33" {...pen(GREEN, 0.8)} />
          <path
            d="M38 33 L38.8 22 M42 33 L41.2 22 M40 22 Q30 19 18 15 M40 22 Q36 15 31 9 M40 22 Q44 15 49 9 M40 22 Q50 19 62 15 M38 33 Q34 36 30 36.5 M42 33 Q46 36 50 36.5"
            {...pen(ORANGE, 0.9)}
          />
          <path d="M33 38.5 L47 38.5" {...pen(INK, 0.8)} />
          {[
            [15, 12],
            [21, 17],
            [28, 7],
            [34, 11],
            [46, 11],
            [52, 7],
            [59, 17],
            [65, 12],
          ].map(([x, y]) => (
            <ellipse
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              rx="3"
              ry="1.6"
              fill={MINT}
              stroke={MINT_EDGE}
              strokeWidth="0.5"
            />
          ))}
          <circle cx="26" cy="20.5" r="1.8" {...pen(RED, 0.8)} />
          <circle
            className="pv-pulse"
            cx="54"
            cy="20.5"
            r="1.8"
            {...pen(RED, 0.8)}
            style={{ ...pv({ '--pv-at': '1300ms' }), ...FILL_BOX }}
          />
          <ellipse
            className="pv-new"
            opacity="0"
            cx="40"
            cy="7"
            rx="3"
            ry="1.6"
            fill={MINT}
            stroke={MINT_EDGE}
            strokeWidth="0.5"
            style={{ ...pv({ '--pv-at': '600ms' }), ...FILL_BOX }}
          />
          <path d="M8 34 L12 34 L11.5 38 L8.5 38 Z M12 35 L14.5 32.5" {...pen(VIOLET, 0.6)} />
        </svg>
      );
    default:
      return null;
  }
}
