import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';
import { Pop } from './story-parts';

// Group 12: the Illustrate templates and the blanks (docs/specs/007-editor/templates-by-mode.md
// "Illustrate templates" and "Three blanks"): Blank Diagram, Blank Illustration, Event Poster, Year in Review, Résumé and
// Recipe Card. Each draws its pages as sheets in their own proportions (A3, A4, Square, 4:5) with
// the designed content sketched in, in the template's own colours. Static SVG preview tiles (one
// branch per TemplateKind; see template-preview.tsx for who renders them); TemplatePreview chains
// the groups with ??.

const NAVY = 'rgb(30 27 75)';
const AMBER = 'rgb(245 158 11)';
const SLATE = 'rgb(148 163 184)';
const INK = 'rgb(15 23 42)';

export function templatePreviewGroup12(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'blank':
      // Blank Diagram (docs/specs/007-editor/templates-by-mode.md "Three blanks"): an empty canvas on
      // a faint dot grid, the first shape just placed and selected, a dashed ghost of the next one
      // with a "+". Framed like Blank Whiteboard's board and Blank Illustration's page, so the
      // three blanks read as a set. Hover story: the connector draws across and the next shape
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
    case 'event-poster':
      // An A3 poster: a navy band with a string of festoon bulbs, the title and the promise, three
      // detail cards over the band's edge, a photo slot, three highlights and an amber foot. Hover
      // story: the festoon lights up bulb by bulb.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect x="25" y="3" width="30" height="44" rx="1.2" fill="rgb(255 251 235)" />
          <rect x="25" y="3" width="30" height="17" rx="1.2" fill={NAVY} />
          {[27, 30.5, 34, 37.5, 41, 44.5, 48, 51.5].map((cx, i) => (
            <circle
              key={cx}
              className="pv-pulse"
              cx={cx}
              cy={5 + 1.4 * (1 - ((cx - 39) / 12) ** 2)}
              r="0.8"
              fill={['rgb(252 211 77)', 'rgb(244 114 182)', 'rgb(94 234 212)'][i % 3]}
              style={pv({ '--pv-at': `${600 + i * 120}ms` })}
            />
          ))}
          <rect x="28" y="9" width="10" height="0.8" rx="0.3" fill="rgb(252 211 77)" />
          <rect x="28" y="10.8" width="19" height="3" rx="0.6" fill="white" />
          <rect x="28" y="15" width="16" height="1" rx="0.4" fill="rgb(199 210 254)" />
          {[28, 36.3, 44.6].map((x) => (
            <g key={x}>
              <rect x={x} y="18" width="7.4" height="5" rx="0.8" fill="white" />
              <circle cx={x + 1.8} cy="19.8" r="1" fill={AMBER} />
              <rect x={x + 1} y="21.4" width="5" height="0.8" rx="0.3" fill={NAVY} />
            </g>
          ))}
          <rect x="28" y="25" width="24" height="10" rx="1" fill="rgb(226 232 240)" />
          <rect x="29.5" y="32.4" width="9" height="1.6" rx="0.8" fill="rgb(252 211 77)" />
          {[28, 36.3, 44.6].map((x, i) => (
            <g key={x}>
              <circle
                cx={x + 1.6}
                cy="38"
                r="1.4"
                fill={['rgb(251 146 60)', 'rgb(129 140 248)', 'rgb(52 211 153)'][i]}
              />
              <rect x={x} y="40.3" width="6.4" height="0.9" rx="0.3" fill={NAVY} />
            </g>
          ))}
          <rect x="25" y="43" width="30" height="4" rx="1.2" fill={AMBER} />
          <rect x="31" y="44.6" width="18" height="0.8" rx="0.3" fill={NAVY} />
        </svg>
      );
    case 'year-in-review':
      // Four A4 pages: the dark cover with the year set huge, the numbers on pastel cards over a
      // bar chart, the timeline of moments, and the warm thank-you with its quote. Hover story:
      // the quarters' bars grow.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect x="3" y="13" width="17" height="24" rx="1" fill="rgb(19 78 74)" />
          <circle cx="5.6" cy="15.8" r="1" fill="rgb(94 234 212)" />
          <rect x="5" y="19" width="12" height="5" rx="0.6" fill="white" />
          <rect x="5" y="25.6" width="9" height="1.2" rx="0.4" fill="rgb(204 251 241)" />
          <rect x="5" y="28.4" width="13" height="6" rx="0.8" fill="rgb(248 250 252)" />
          <rect
            x="22"
            y="13"
            width="17"
            height="24"
            rx="1"
            fill="rgb(248 250 252)"
            stroke="rgb(226 232 240)"
            strokeWidth="0.4"
          />
          <rect x="24" y="15" width="9" height="1.4" rx="0.4" fill={INK} />
          {[
            [24, 18, 'rgb(204 251 241)'],
            [31.2, 18, 'rgb(224 242 254)'],
            [24, 21.6, 'rgb(237 233 254)'],
            [31.2, 21.6, 'rgb(255 228 230)'],
          ].map(([x, y, c]) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="6.6"
              height="3"
              rx="0.6"
              fill={c as string}
            />
          ))}
          {[
            [25, 3],
            [28.5, 4.4],
            [32, 3.6],
            [35.5, 5.6],
          ].map(([x, h], i) => (
            <rect
              key={x}
              className="pv-grow-y"
              x={x}
              y={34.6 - h!}
              width="2.2"
              height={h}
              rx="0.3"
              fill={['rgb(94 234 212)', 'rgb(45 212 191)', 'rgb(20 184 166)', 'rgb(15 118 110)'][i]}
              style={pv({ '--pv-at': `${700 + i * 140}ms` })}
            />
          ))}
          <rect
            x="41"
            y="13"
            width="17"
            height="24"
            rx="1"
            fill="rgb(248 250 252)"
            stroke="rgb(226 232 240)"
            strokeWidth="0.4"
          />
          <rect x="43" y="15" width="11" height="1.4" rx="0.4" fill={INK} />
          <rect x="45.3" y="18.5" width="0.5" height="16" fill="rgb(203 213 225)" />
          {[
            'rgb(13 148 136)',
            'rgb(2 132 199)',
            'rgb(124 58 237)',
            'rgb(217 119 6)',
            'rgb(219 39 119)',
          ].map((c, i) => (
            <g key={c}>
              <rect x="42.5" y={19 + i * 3.2} width="2.2" height="1.2" rx="0.6" fill={c} />
              <circle
                cx="45.55"
                cy={19.6 + i * 3.2}
                r="0.7"
                fill="white"
                stroke={c}
                strokeWidth="0.4"
              />
              <rect
                x="47"
                y={18.7 + i * 3.2}
                width="9"
                height="1.9"
                rx="0.5"
                fill="white"
                stroke="rgb(226 232 240)"
                strokeWidth="0.3"
              />
            </g>
          ))}
          <rect x="60" y="13" width="17" height="24" rx="1" fill="rgb(254 243 199)" />
          <rect x="62" y="15" width="11" height="1.6" rx="0.4" fill={INK} />
          <rect x="62" y="18.4" width="13" height="6" rx="0.8" fill="white" />
          <rect x="63" y="19.4" width="1.6" height="1.4" rx="0.3" fill="rgb(13 148 136)" />
          <rect x="63" y="21.6" width="10" height="0.8" rx="0.3" fill={SLATE} />
          <rect x="62" y="26" width="13" height="6.4" rx="0.8" fill="rgb(253 230 238)" />
          <rect x="62" y="33.6" width="7" height="1.2" rx="0.4" fill={INK} />
        </svg>
      );
    case 'resume':
      // An A4 CV: a navy header with the photo, the name, the role and the contact lines; the
      // profile and the experience on a rail down the main column; skills as chips, education
      // and languages in the tinted side column. Hover story: a new skill chip lands.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="25"
            y="3"
            width="30"
            height="44"
            rx="1.2"
            fill="white"
            stroke="rgb(226 232 240)"
            strokeWidth="0.4"
          />
          <rect x="25" y="3" width="30" height="11" rx="1.2" fill="rgb(30 41 59)" />
          <circle cx="30" cy="8.5" r="3.2" fill="rgb(241 245 249)" />
          <rect x="35" y="5.6" width="13" height="2" rx="0.5" fill="white" />
          <rect x="35" y="8.6" width="9" height="0.9" rx="0.3" fill="rgb(165 180 252)" />
          <rect x="35" y="10.6" width="6" height="0.7" rx="0.3" fill="rgb(203 213 225)" />
          <rect x="43" y="10.6" width="6" height="0.7" rx="0.3" fill="rgb(203 213 225)" />
          <rect x="44" y="14" width="11" height="33" fill="rgb(238 242 255)" />
          <rect x="27.5" y="16.5" width="5" height="0.9" rx="0.3" fill="rgb(79 70 229)" />
          {[18.6, 20.2, 21.8].map((y) => (
            <rect key={y} x="27.5" y={y} width="14" height="0.7" rx="0.3" fill={SLATE} />
          ))}
          <rect x="27.5" y="24.5" width="7" height="0.9" rx="0.3" fill="rgb(79 70 229)" />
          <rect x="28.2" y="27" width="0.4" height="16" fill="rgb(199 210 254)" />
          {[27, 33, 39].map((y) => (
            <g key={y}>
              <circle
                cx="28.4"
                cy={y + 0.4}
                r="0.9"
                fill="white"
                stroke="rgb(79 70 229)"
                strokeWidth="0.5"
              />
              <rect x="30.4" y={y - 0.2} width="10" height="1.1" rx="0.3" fill={INK} />
              <rect x="30.4" y={y + 1.6} width="7" height="0.7" rx="0.3" fill="rgb(129 140 248)" />
              <rect x="30.4" y={y + 3} width="11" height="0.6" rx="0.3" fill={SLATE} />
            </g>
          ))}
          <rect x="46" y="16.5" width="4" height="0.9" rx="0.3" fill="rgb(79 70 229)" />
          {[
            [46, 18.6, 5],
            [51.6, 18.6, 2.6],
            [46, 21, 4],
            [50.6, 21, 3],
          ].map(([x, y, w]) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={w}
              height="1.6"
              rx="0.8"
              fill="white"
              stroke="rgb(165 180 252)"
              strokeWidth="0.3"
            />
          ))}
          <rect
            className="pv-arrive"
            opacity="0"
            x="46"
            y="23.4"
            width="5.4"
            height="1.6"
            rx="0.8"
            fill="rgb(79 70 229)"
            style={pv({ '--pv-from-x': '6px', '--pv-from-y': '-4px', '--pv-at': '900ms' })}
          />
          <rect x="46" y="27.5" width="5" height="0.9" rx="0.3" fill="rgb(79 70 229)" />
          {[29.6, 32.4, 36.6, 38.6, 40.6].map((y, i) => (
            <rect
              key={y}
              x="46"
              y={y}
              width={i % 2 ? 6 : 7.5}
              height="0.7"
              rx="0.3"
              fill={i < 2 ? INK : SLATE}
            />
          ))}
        </svg>
      );
    case 'recipe-card':
      // A Square page for the dish (the name in two colours, a photo slot with a herb, three fact
      // cards) beside a 4:5 page for the method (the ingredients card, five numbered steps on a
      // rail, a tip). Hover story: the steps are worked through, one disc after another.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect x="5" y="7" width="36" height="36" rx="1.4" fill="rgb(255 237 213)" />
          <rect x="8" y="9.6" width="9" height="0.9" rx="0.3" fill="rgb(194 65 12)" />
          <rect x="8" y="11.8" width="20" height="2.4" rx="0.5" fill="rgb(41 37 36)" />
          <rect x="8" y="15" width="18" height="2.4" rx="0.5" fill="rgb(234 88 12)" />
          <rect x="8" y="19" width="30" height="15" rx="1" fill="rgb(248 250 252)" />
          <circle cx="36" cy="19.5" r="2.4" fill="white" />
          <path
            d="M34.8 20.8 Q36 18 37.4 18.2"
            stroke="rgb(22 163 74)"
            strokeWidth="0.7"
            fill="none"
          />
          {[8, 18.3, 28.6].map((x) => (
            <g key={x}>
              <rect x={x} y="35.6" width="9.4" height="4.6" rx="0.8" fill="white" />
              <circle cx={x + 2} cy="37.9" r="1.3" fill="rgb(234 88 12)" />
              <rect x={x + 4} y="37.4" width="4.4" height="0.9" rx="0.3" fill="rgb(41 37 36)" />
            </g>
          ))}
          <rect x="45" y="7.5" width="28" height="35" rx="1.4" fill="rgb(255 247 237)" />
          <rect x="47.5" y="9.6" width="11" height="1.8" rx="0.4" fill="rgb(41 37 36)" />
          <rect
            x="47.5"
            y="13"
            width="23"
            height="8"
            rx="0.8"
            fill="white"
            stroke="rgb(254 215 170)"
            strokeWidth="0.3"
          />
          {[15, 16.8, 18.6].map((y) => (
            <g key={y}>
              <rect x="49" y={y} width="8" height="0.7" rx="0.3" fill={SLATE} />
              <rect x="59.5" y={y} width="8" height="0.7" rx="0.3" fill={SLATE} />
            </g>
          ))}
          <rect x="48.65" y="24" width="0.7" height="12" fill="rgb(254 215 170)" />
          {[24, 27, 30, 33, 36].map((y, i) => (
            <g key={y}>
              <circle
                className="pv-pulse"
                cx="49"
                cy={y}
                r="1.2"
                fill="rgb(234 88 12)"
                style={pv({ '--pv-at': `${600 + i * 220}ms` })}
              />
              <rect
                x="51.5"
                y={y - 0.5}
                width={i % 2 ? 15 : 19}
                height="0.9"
                rx="0.3"
                fill="rgb(87 83 78)"
              />
            </g>
          ))}
          <rect x="47.5" y="38.4" width="23" height="2.6" rx="0.8" fill="rgb(255 237 213)" />
          <circle cx="49.2" cy="39.7" r="0.8" fill="rgb(194 65 12)" />
        </svg>
      );
    default:
      return null;
  }
}
