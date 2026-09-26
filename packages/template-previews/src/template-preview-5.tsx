import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';
import { FILL_BOX, Pop, PopDot } from './story-parts';

// Group 5 of 5 (the wireframe / storyboard / cloud / UML / state / floor plan /
// event storming batch), split out of template-preview-4.tsx when the hover
// stories pushed it past the ~1000-line budget. Static SVG preview tiles, one
// branch per TemplateKind; TemplatePreview chains the groups with ??.
export function templatePreviewGroup5(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'browser-wireframe':
      // Browser chrome over a hero + button and three feature cards.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="4"
            y="3"
            width="72"
            height="44"
            rx="3"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1.2"
          />
          <line x1="4" y1="11" x2="76" y2="11" stroke="rgb(14 165 233)" strokeWidth="0.9" />
          {[9, 13.5, 18].map((cx) => (
            <circle key={cx} cx={cx} cy="7" r="1.4" fill="rgb(148 163 184)" />
          ))}
          <rect x="24" y="5" width="46" height="4" rx="2" fill="rgb(226 232 240)" />
          {/* Hero copy + CTA on the left, image placeholder right. */}
          <rect x="9" y="16" width="26" height="4" rx="1" fill="rgb(15 23 42)" />
          <rect x="9" y="22" width="20" height="2.5" rx="0.8" fill="rgb(148 163 184)" />
          <rect
            x="9"
            y="27"
            width="13"
            height="5"
            rx="2.5"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
            className="pv-pulse"
            style={pv({ '--pv-at': '2100ms' })}
          />
          <rect
            x="44"
            y="15"
            width="27"
            height="18"
            rx="1.5"
            fill="none"
            stroke="rgb(148 163 184)"
            strokeWidth="0.9"
          />
          <circle
            cx="49"
            cy="20"
            r="2"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.7"
          />
          {/* Feature-card row. */}
          {[9, 31, 53].map((x) => (
            <rect
              key={x}
              x={x}
              y="37"
              width="18"
              height="7"
              rx="1.5"
              fill="white"
              stroke="rgb(148 163 184)"
              strokeWidth="0.8"
            />
          ))}
          {/* Hover story: the wireframe fills with content, a picture in the
              hero image, copy in each card, then the CTA calls for a click. */}
          <polyline
            className="pv-new"
            opacity="0"
            points="46,31 53,23 58,28 63,21 69,31"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.9"
            style={pv({ '--pv-at': '1000ms' })}
          />
          {[9, 31, 53].map((x, i) => (
            <Pop
              key={x}
              at={1350 + i * 180}
              x={x + 2.5}
              y="39.5"
              width="12"
              height="1.6"
              rx="0.6"
              fill="rgb(148 163 184)"
            />
          ))}
        </svg>
      );
    case 'storyboard':
      // Six numbered scene frames with caption lines.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {[
            { x: 5, y: 5 },
            { x: 31, y: 5 },
            { x: 57, y: 5 },
            { x: 5, y: 28 },
            { x: 31, y: 28 },
            { x: 57, y: 28 },
          ].map((f, i) => (
            <g key={i}>
              <rect
                x={f.x}
                y={f.y}
                width="18"
                height="12"
                rx="1.5"
                fill="white"
                stroke="rgb(14 165 233)"
                strokeWidth="0.9"
              />
              <circle
                cx={f.x + 1.5}
                cy={f.y + 1.5}
                r="2.6"
                fill="rgb(186 230 253)"
                stroke="rgb(14 165 233)"
                strokeWidth="0.7"
              />
              <rect
                x={f.x + 2}
                y={f.y + 14.5}
                width="14"
                height="2.2"
                rx="0.7"
                fill="rgb(148 163 184)"
              />
              {/* Hover story: the scenes are sketched frame by frame, the
                  character walking a little further across each one. */}
              <circle
                className="pv-new"
                opacity="0"
                cx={f.x + 5 + i * 1.8}
                cy={f.y + 7}
                r="2.2"
                fill="rgb(251 191 36)"
                style={pv({ '--pv-at': `${900 + i * 300}ms` })}
              />
              <line
                className="pv-new"
                opacity="0"
                x1={f.x + 2}
                y1={f.y + 10}
                x2={f.x + 16}
                y2={f.y + 10}
                stroke="rgb(14 165 233)"
                strokeWidth="0.8"
                style={pv({ '--pv-at': `${900 + i * 300}ms` })}
              />
            </g>
          ))}
        </svg>
      );
    case 'cloud-architecture':
      // Edge cloud fanning through services into three data stores.
      return (
        <svg width="72" height="46" viewBox="0 0 80 50" aria-hidden>
          {/* CDN cloud at the edge. */}
          <path
            d="M 32 12 Q 32 6 38 6 Q 40 2 45 3.5 Q 50 2 51 7 Q 56 8 54 12 Z"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* Two service tiles. */}
          <rect
            x="18"
            y="20"
            width="16"
            height="10"
            rx="1.5"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <rect
            x="46"
            y="20"
            width="16"
            height="10"
            rx="1.5"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          {/* Three datastore cylinders. */}
          {[10, 33, 56].map((x) => (
            <g key={x}>
              <path
                d={`M ${x} 39 V 45 Q ${x + 7} 48.5 ${x + 14} 45 V 39`}
                fill="white"
                stroke="rgb(14 165 233)"
                strokeWidth="0.9"
              />
              <ellipse
                cx={x + 7}
                cy="39"
                rx="7"
                ry="2.6"
                fill="rgb(186 230 253)"
                stroke="rgb(14 165 233)"
                strokeWidth="0.9"
              />
            </g>
          ))}
          {/* Fan-out connectors. */}
          <line x1="40" y1="12" x2="27" y2="20" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="44" y1="12" x2="53" y2="20" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="25" y1="30" x2="18" y2="37" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="30" y1="30" x2="38" y2="37" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          <line x1="55" y1="30" x2="61" y2="37" stroke="rgb(100 116 139)" strokeWidth="0.8" />
          {/* Hover story: requests flow on a loop, from the edge into the
              services, then from the services down into the stores. */}
          {[
            [40, 12, -13, 8, 1000],
            [44, 12, 9, 8, 1300],
            [25, 30, -7, 7, 1700],
            [30, 30, 8, 7, 1900],
            [55, 30, 6, 7, 2100],
          ].map(([x, y, dx, dy, at]) => (
            <circle
              key={at}
              className="pv-travel"
              opacity="0"
              cx={x}
              cy={y}
              r="1.8"
              fill="rgb(2 132 199)"
              style={pv({
                '--pv-dx': `${dx}px`,
                '--pv-dy': `${dy}px`,
                '--pv-at': `${at}ms`,
                '--pv-dur': '1300ms',
              })}
            />
          ))}
        </svg>
      );
    case 'uml-class':
      // Three compartmented class boxes with a hollow inheritance triangle.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {/* Parent class. */}
          <g>
            <rect
              x="28"
              y="3"
              width="24"
              height="16"
              rx="1"
              fill="white"
              stroke="rgb(14 165 233)"
              strokeWidth="1"
            />
            <rect
              x="28"
              y="3"
              width="24"
              height="5"
              fill="rgb(186 230 253)"
              stroke="rgb(14 165 233)"
              strokeWidth="0.8"
            />
            <line x1="28" y1="13" x2="52" y2="13" stroke="rgb(14 165 233)" strokeWidth="0.8" />
          </g>
          {/* Two subclasses. */}
          {[8, 48].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="31"
                width="24"
                height="16"
                rx="1"
                fill="white"
                stroke="rgb(14 165 233)"
                strokeWidth="1"
              />
              <rect
                x={x}
                y="31"
                width="24"
                height="5"
                fill="rgb(186 230 253)"
                stroke="rgb(14 165 233)"
                strokeWidth="0.8"
              />
              <line x1={x} y1="41" x2={x + 24} y2="41" stroke="rgb(14 165 233)" strokeWidth="0.8" />
            </g>
          ))}
          {/* Inheritance edges meeting a hollow triangle at the parent. */}
          <line x1="20" y1="31" x2="38" y2="23" stroke="rgb(100 116 139)" strokeWidth="0.9" />
          <line x1="60" y1="31" x2="42" y2="23" stroke="rgb(100 116 139)" strokeWidth="0.9" />
          <polygon
            points="40,19 36.5,24.5 43.5,24.5"
            fill="white"
            stroke="rgb(100 116 139)"
            strokeWidth="0.9"
          />
          {/* Hover story: the parent class gains a method, then each subclass
              gains an attribute and a method of its own. */}
          {[
            [30, 15.3, 14, 1000],
            [10, 37.8, 16, 1400],
            [50, 37.8, 12, 1600],
            [10, 43.3, 12, 1900],
            [50, 43.3, 15, 2100],
          ].map(([x, y, w, at]) => (
            <Pop
              key={at}
              at={at!}
              x={x}
              y={y}
              width={w}
              height="1.5"
              rx="0.6"
              fill="rgb(100 116 139)"
            />
          ))}
        </svg>
      );
    case 'state-machine':
      // Initial dot → two states → bullseye final, event ticks between.
      return (
        <svg width="76" height="40" viewBox="0 0 80 40" aria-hidden>
          <circle cx="7" cy="20" r="3.5" fill="rgb(15 23 42)" />
          <rect
            x="16"
            y="12"
            width="20"
            height="16"
            rx="8"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <rect
            x="46"
            y="12"
            width="20"
            height="16"
            rx="8"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1"
          />
          <circle cx="74" cy="20" r="4.5" fill="white" stroke="rgb(15 23 42)" strokeWidth="1.1" />
          <circle cx="74" cy="20" r="2.2" fill="rgb(15 23 42)" />
          {/* Transitions. */}
          <line x1="10.5" y1="20" x2="15" y2="20" stroke="rgb(100 116 139)" strokeWidth="1" />
          <line x1="36" y1="20" x2="44" y2="20" stroke="rgb(100 116 139)" strokeWidth="1" />
          <polygon points="45.5,20 42.5,18.4 42.5,21.6" fill="rgb(100 116 139)" />
          <line x1="66" y1="20" x2="68.5" y2="20" stroke="rgb(100 116 139)" strokeWidth="1" />
          {/* Hover story: the current-state token leaves the start, rests in
              the first state, then takes the transition into the second. */}
          <circle
            className="pv-route"
            opacity="0"
            cx="7"
            cy="20"
            r="2.6"
            fill="rgb(245 158 11)"
            stroke="white"
            strokeWidth="0.8"
            style={pv({
              '--pv-dx': '19px',
              '--pv-dx2': '49px',
              '--pv-at': '1000ms',
              '--pv-dur': '2000ms',
            })}
          />
        </svg>
      );
    case 'floor-plan':
      // A shell with a corridor through it: three rooms above, three
      // below, furniture blocked in so the tile reads as a plan rather
      // than as a grid of empty boxes.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {/* Outer wall, drawn heavier than the partitions. */}
          <rect
            x="2"
            y="3"
            width="76"
            height="44"
            fill="white"
            stroke="rgb(71 85 105)"
            strokeWidth="1.8"
          />
          {/* Corridor walls + the partitions off them. */}
          <line x1="2" y1="21" x2="78" y2="21" stroke="rgb(71 85 105)" strokeWidth="1" />
          <line x1="2" y1="27" x2="78" y2="27" stroke="rgb(71 85 105)" strokeWidth="1" />
          <line x1="36" y1="3" x2="36" y2="21" stroke="rgb(71 85 105)" strokeWidth="1" />
          <line x1="58" y1="3" x2="58" y2="21" stroke="rgb(71 85 105)" strokeWidth="1" />
          <line x1="34" y1="27" x2="34" y2="47" stroke="rgb(71 85 105)" strokeWidth="1" />
          <line x1="52" y1="27" x2="52" y2="47" stroke="rgb(71 85 105)" strokeWidth="1" />
          {/* Living room: sofa, coffee table, TV on the far wall. */}
          <rect
            x="6"
            y="6"
            width="14"
            height="5"
            rx="1"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect
            x="9"
            y="13.5"
            width="8"
            height="3"
            rx="0.8"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <rect
            x="26"
            y="16"
            width="7"
            height="2.5"
            fill="rgb(14 165 233)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.6"
          />
          {/* Two bedrooms: a double and a single. */}
          <rect
            x="39"
            y="6"
            width="11"
            height="12"
            rx="1"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <line x1="39" y1="9" x2="50" y2="9" stroke="rgb(14 165 233)" strokeWidth="0.7" />
          <rect
            x="61"
            y="6"
            width="8"
            height="11"
            rx="1"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <line x1="61" y1="9" x2="69" y2="9" stroke="rgb(14 165 233)" strokeWidth="0.7" />
          {/* Kitchen: a counter run and a round table. */}
          <rect
            x="5"
            y="30"
            width="13"
            height="3.5"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <circle
            cx="23"
            cy="39"
            r="4"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          {/* Bathroom: tub + toilet. */}
          <rect
            x="37"
            y="30"
            width="12"
            height="6"
            rx="2"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <circle
            cx="39.5"
            cy="42"
            r="2.2"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          {/* Study: desk + chair. */}
          <rect
            x="56"
            y="31"
            width="13"
            height="4"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          <circle
            cx="62"
            cy="39"
            r="2.6"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
          />
          {/* Hover story: furnishing the plan, an armchair is carried in from
              the corridor, then chairs are set round the kitchen table. */}
          <rect
            className="pv-arrive"
            opacity="0"
            x="25"
            y="6"
            width="6"
            height="5"
            rx="1"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.8"
            style={pv({ '--pv-from-y': '17px', '--pv-at': '1000ms' })}
          />
          {[17, 29].map((cx, i) => (
            <PopDot
              key={cx}
              at={1800 + i * 250}
              cx={cx}
              cy="39"
              r="1.6"
              fill="white"
              stroke="rgb(14 165 233)"
              strokeWidth="0.7"
            />
          ))}
        </svg>
      );
    case 'event-storming':
      // The starter itself (spec/139 Phase 1): one orange domain event on a
      // faint timeline, the first thing that happened.
      return (
        <svg width="76" height="40" viewBox="0 0 80 40" aria-hidden>
          <line
            x1="4"
            y1="34"
            x2="76"
            y2="34"
            stroke="rgb(148 163 184)"
            strokeWidth="0.9"
            strokeDasharray="3 2"
          />
          <polygon points="78,34 74,32.2 74,35.8" fill="rgb(148 163 184)" />
          <rect
            x="31"
            y="7"
            width="18"
            height="18"
            rx="1.5"
            fill="rgb(253 186 116)"
            stroke="rgb(249 115 22)"
            strokeWidth="0.9"
            transform="rotate(-3 40 16)"
          />
          {/* "Board Created", scribbled on the note. */}
          <line x1="35" y1="14" x2="45" y2="14" stroke="rgb(154 52 18)" strokeWidth="1" />
          <line x1="35" y1="18" x2="42" y2="18" stroke="rgb(154 52 18)" strokeWidth="1" />
          {/* Hover story: the next domain events are slapped onto the
              timeline, one after the first, one before it. */}
          {[
            [55, 1000],
            [8, 1600],
          ].map(([x, at]) => (
            <g
              key={x}
              className="pv-arrive"
              opacity="0"
              style={{ ...pv({ '--pv-from-y': '-9px', '--pv-at': `${at}ms` }), ...FILL_BOX }}
            >
              <rect
                x={x}
                y="8"
                width="17"
                height="17"
                rx="1.5"
                fill="rgb(253 186 116)"
                stroke="rgb(249 115 22)"
                strokeWidth="0.9"
              />
              <line
                x1={x! + 4}
                y1="14"
                x2={x! + 13}
                y2="14"
                stroke="rgb(154 52 18)"
                strokeWidth="1"
              />
              <line
                x1={x! + 4}
                y1="18"
                x2={x! + 10}
                y2="18"
                stroke="rgb(154 52 18)"
                strokeWidth="1"
              />
            </g>
          ))}
        </svg>
      );
    default:
      return null;
  }
}
