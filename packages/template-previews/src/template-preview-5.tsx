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
      // A landing page in a browser frame (nav + CTA, a hero beside a
      // product-shot chart, a logo strip, three benefit cards) with
      // numbered pins matching an amber notes rail. Hover story: the review
      // walks the page, each pin pulsing in turn, then the CTA calls for
      // the click.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="2"
            y="3"
            width="58"
            height="44"
            rx="3"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="1.1"
          />
          <line x1="2" y1="9" x2="60" y2="9" stroke="rgb(14 165 233)" strokeWidth="0.8" />
          {[5.5, 8.5, 11.5].map((cx) => (
            <circle key={cx} cx={cx} cy="6" r="1" fill="rgb(148 163 184)" />
          ))}
          <rect x="15" y="4.6" width="41" height="2.8" rx="1.4" fill="rgb(226 232 240)" />
          {/* Nav: brand left, the one CTA right. */}
          <rect x="5" y="11.5" width="8" height="2" rx="0.5" fill="rgb(15 23 42)" />
          <rect x="49" y="11" width="8" height="3" rx="1.5" fill="rgb(3 105 161)" />
          {/* Hero: eyebrow, two-line promise, subcopy, button pair. */}
          <rect x="5" y="16" width="12" height="2" rx="1" fill="rgb(186 230 253)" />
          <rect x="5" y="19.5" width="21" height="2.4" rx="0.5" fill="rgb(15 23 42)" />
          <rect x="5" y="22.6" width="14" height="2.4" rx="0.5" fill="rgb(15 23 42)" />
          <rect x="5" y="26.2" width="19" height="1" rx="0.4" fill="rgb(148 163 184)" />
          <rect
            x="5"
            y="28.6"
            width="9"
            height="3.2"
            rx="1.6"
            fill="rgb(3 105 161)"
            className="pv-pulse"
            style={pv({ '--pv-at': '2300ms' })}
          />
          <rect
            x="15.5"
            y="28.6"
            width="8"
            height="3.2"
            rx="1.6"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="0.5"
            strokeDasharray="1 0.6"
          />
          {/* Product shot: the app's own income chart. */}
          <rect
            x="31"
            y="15.5"
            width="25"
            height="16.5"
            rx="1.2"
            fill="white"
            stroke="rgb(148 163 184)"
            strokeWidth="0.6"
          />
          {[5, 7, 6, 9, 10.5].map((h, i) => (
            <rect
              key={i}
              x={34 + i * 4.2}
              y={29.5 - h}
              width="2.6"
              height={h}
              rx="0.3"
              fill="rgb(14 165 233)"
            />
          ))}
          {/* Logo strip, then the benefit cards. */}
          {[5, 15.4, 25.8, 36.2, 46.6].map((x) => (
            <rect
              key={x}
              x={x}
              y="34"
              width="8.4"
              height="2"
              rx="1"
              fill="white"
              stroke="rgb(148 163 184)"
              strokeWidth="0.4"
            />
          ))}
          {[5, 22.5, 40].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="38.2"
                width="15.5"
                height="6"
                rx="1"
                fill="white"
                stroke="rgb(148 163 184)"
                strokeWidth="0.5"
              />
              <circle
                cx={x + 2.4}
                cy="40.4"
                r="1"
                fill="none"
                stroke="rgb(14 165 233)"
                strokeWidth="0.5"
              />
              <rect x={x + 1.4} y="42.2" width="10" height="0.9" rx="0.3" fill="rgb(148 163 184)" />
            </g>
          ))}
          {/* Pins on the page and the notes rail they match. */}
          {[
            { cx: 27.5, cy: 19.5 },
            { cx: 14, cy: 28.6 },
            { cx: 56, cy: 15.5 },
            { cx: 55.5, cy: 38.2 },
          ].map((p, i) => (
            <circle
              key={i}
              className="pv-pulse"
              cx={p.cx}
              cy={p.cy}
              r="1.4"
              fill="rgb(3 105 161)"
              style={pv({ '--pv-at': `${900 + i * 300}ms` })}
            />
          ))}
          {[5, 15, 25, 35].map((y) => (
            <g key={y}>
              <circle cx="64.5" cy={y + 1.8} r="1.4" fill="rgb(3 105 161)" />
              <rect x="67" y={y} width="11" height="7.5" rx="0.6" fill="rgb(253 230 138)" />
            </g>
          ))}
        </svg>
      );
    case 'storyboard':
      // Six numbered 16:9 shots, each with a shot + timing chip in its
      // corner, a sketch, and an action line over a muted sound line.
      // Hover story: the shots play in order, the character crossing the
      // frame a little further in each one.
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
                width="19"
                height="10.7"
                rx="1.2"
                fill="white"
                stroke="rgb(14 165 233)"
                strokeWidth="0.8"
              />
              <rect
                x={f.x + 10.5}
                y={f.y + 1.2}
                width="7.3"
                height="2"
                rx="1"
                fill="rgb(186 230 253)"
              />
              {i === 5 ? (
                <>
                  <rect
                    x={f.x + 5.5}
                    y={f.y + 4.5}
                    width="8"
                    height="1.8"
                    rx="0.4"
                    fill="rgb(15 23 42)"
                  />
                  <rect
                    x={f.x + 6.5}
                    y={f.y + 7.5}
                    width="6"
                    height="1.8"
                    rx="0.9"
                    fill="rgb(3 105 161)"
                  />
                </>
              ) : (
                <>
                  <circle
                    className="pv-shift"
                    cx={f.x + 5 + i * 1.6}
                    cy={f.y + 6.2}
                    r="1.4"
                    fill="none"
                    stroke="rgb(14 165 233)"
                    strokeWidth="0.6"
                    style={pv({ '--pv-dx': '2px', '--pv-at': `${900 + i * 280}ms` })}
                  />
                  <rect
                    x={f.x + 11}
                    y={f.y + 5}
                    width="5"
                    height="3"
                    rx="1"
                    fill="rgb(254 243 199)"
                  />
                </>
              )}
              <circle cx={f.x + 0.8} cy={f.y + 0.8} r="2.4" fill="rgb(3 105 161)" />
              <rect x={f.x} y={f.y + 12.6} width="15" height="1.4" rx="0.5" fill="rgb(71 85 105)" />
              <rect
                x={f.x}
                y={f.y + 15.2}
                width="11"
                height="1.2"
                rx="0.5"
                fill="rgb(203 213 225)"
              />
            </g>
          ))}
        </svg>
      );
    case 'cloud-architecture':
      // AWS-style groups: a dashed edge box, a dashed teal region holding a
      // purple VPC with two subnets, coloured service tiles along one
      // request row, and the partner apps outside, right.
      return (
        <svg width="72" height="46" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="10"
            y="8"
            width="10"
            height="26"
            fill="none"
            stroke="rgb(148 163 184)"
            strokeWidth="0.6"
            strokeDasharray="1.5 1"
          />
          <rect
            x="22"
            y="4"
            width="46"
            height="42"
            fill="none"
            stroke="rgb(8 145 178)"
            strokeWidth="0.9"
            strokeDasharray="2 1.2"
          />
          <rect
            x="33"
            y="14"
            width="12"
            height="30"
            fill="none"
            stroke="rgb(124 58 237)"
            strokeWidth="0.9"
          />
          {[18, 31].map((y) => (
            <rect
              key={y}
              x="34.5"
              y={y}
              width="9"
              height="11"
              fill="none"
              stroke="rgb(2 132 199)"
              strokeWidth="0.5"
            />
          ))}
          {/* The request row, then the stores below it. */}
          <line x1="7" y1="25" x2="74" y2="25" stroke="rgb(100 116 139)" strokeWidth="0.7" />
          <line x1="39" y1="25" x2="39" y2="36" stroke="rgb(100 116 139)" strokeWidth="0.7" />
          <path
            d="M64 25 L64 11 L71 11 M64 25 L64 39 L71 39"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.7"
          />
          {[
            [15, 16, 'rgb(139 92 246)'],
            [15, 25, 'rgb(139 92 246)'],
            [27, 25, 'rgb(139 92 246)'],
            [27, 37, 'rgb(122 161 22)'],
            [39, 25, 'rgb(237 113 0)'],
            [39, 37, 'rgb(59 72 204)'],
            [50, 12, 'rgb(231 21 123)'],
            [50, 25, 'rgb(231 21 123)'],
            [57, 25, 'rgb(237 113 0)'],
            [57, 37, 'rgb(59 72 204)'],
            [64, 25, 'rgb(231 21 123)'],
          ].map(([x, y, fill]) => (
            <rect
              key={`${x}-${y}`}
              x={(x as number) - 2.6}
              y={(y as number) - 2.6}
              width="5.2"
              height="5.2"
              rx="1"
              fill={fill as string}
            />
          ))}
          {/* The customer app outside left, partner apps outside right. */}
          {[
            [1, 22],
            [71, 8],
            [71, 36],
          ].map(([x, y]) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="8"
              height="6"
              rx="1.2"
              fill="white"
              stroke="rgb(14 165 233)"
              strokeWidth="0.7"
            />
          ))}
          {/* Hover story: an order travels the request row from the app to
              the push service, then the push forks up and down. */}
          {[
            [9, 25, 55, 0, 1000, 2000],
            [64, 22, 0, -11, 3000, 700],
            [64, 28, 0, 11, 3000, 700],
          ].map(([x, y, dx, dy, at, dur]) => (
            <circle
              key={`${at}-${dy}`}
              className="pv-travel"
              opacity="0"
              cx={x}
              cy={y}
              r="1.5"
              fill="rgb(2 132 199)"
              style={pv({
                '--pv-dx': `${dx}px`,
                '--pv-dy': `${dy}px`,
                '--pv-at': `${at}ms`,
                '--pv-dur': `${dur}ms`,
              })}
            />
          ))}
        </svg>
      );
    case 'uml-class':
      // Classes in a plus around Order: a hollow-triangle generalisation
      // pair under the abstract Payment, a filled composition diamond on
      // Order, a hollow aggregation diamond on Restaurant, and open-headed
      // associations.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {[
            { x: 31, y: 2, h: 10 },
            { x: 4, y: 17, h: 13, italic: true },
            { x: 31, y: 17, h: 15, hub: true },
            { x: 58, y: 18, h: 11 },
            { x: 1, y: 39, h: 9, w: 12 },
            { x: 15, y: 39, h: 9, w: 12 },
            { x: 31, y: 38, h: 10 },
            { x: 58, y: 38, h: 10 },
          ].map((c) => (
            <g key={`${c.x}-${c.y}`}>
              <rect
                x={c.x}
                y={c.y}
                width={c.w ?? 18}
                height={c.h}
                rx="1"
                fill={c.hub ? 'rgb(224 242 254)' : 'white'}
                stroke="rgb(14 165 233)"
                strokeWidth="0.8"
                strokeDasharray={c.italic ? '1.6 0.8' : undefined}
              />
              <line
                x1={c.x}
                y1={c.y + 3.4}
                x2={c.x + (c.w ?? 18)}
                y2={c.y + 3.4}
                stroke="rgb(186 230 253)"
                strokeWidth="0.6"
              />
            </g>
          ))}
          <path
            d="M40 12 L40 17 M31 23.5 L22 23.5 M49 23.5 L58 23.5 M40 32 L40 38 M67 29 L67 38 M49 43 L58 43 M7 39 L11 30 M21 39 L15 30"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.8"
          />
          {/* Heads: open Vs for associations, triangles at Payment, a filled
              diamond at Order, a hollow diamond at Restaurant. */}
          <path
            d="M38.6 15.2 L40 17 L41.4 15.2 M23.8 22.1 L22 23.5 L23.8 24.9 M56.2 22.1 L58 23.5 L56.2 24.9 M56.2 41.6 L58 43 L56.2 44.4"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.8"
          />
          <polygon
            points="11,30 9.2,32.6 12.2,33"
            fill="white"
            stroke="rgb(100 116 139)"
            strokeWidth="0.7"
          />
          <polygon
            points="15,30 13.8,33 16.8,32.6"
            fill="white"
            stroke="rgb(100 116 139)"
            strokeWidth="0.7"
          />
          <polygon points="40,32 41.3,33.8 40,35.6 38.7,33.8" fill="rgb(51 65 85)" />
          <polygon
            points="67,29 68.3,30.8 67,32.6 65.7,30.8"
            fill="white"
            stroke="rgb(100 116 139)"
            strokeWidth="0.7"
          />
          {/* Hover story: Order gains an operation, then each subclass an
              attribute of its own. */}
          {[
            [33, 29.6, 11, 1000],
            [3, 44.5, 7, 1500],
            [17, 44.5, 8, 1750],
            [60, 44.5, 10, 2000],
          ].map(([x, y, w, at]) => (
            <Pop
              key={at}
              at={at!}
              x={x}
              y={y}
              width={w}
              height="1.2"
              rx="0.5"
              fill="rgb(100 116 139)"
            />
          ))}
        </svg>
      );
    case 'state-machine':
      // Initial dot → Placed → a composite kitchen state holding three
      // substates → out for delivery → delivered → bullseye, with the two
      // exception states above and below Placed, each to its own final.
      return (
        <svg width="76" height="40" viewBox="0 0 80 40" aria-hidden>
          <circle cx="3" cy="20" r="2" fill="rgb(15 23 42)" />
          {[6, 34].map((y) => (
            <g key={y}>
              <circle cx="3" cy={y} r="2.3" fill="white" stroke="rgb(15 23 42)" strokeWidth="0.8" />
              <circle cx="3" cy={y} r="1.1" fill="rgb(15 23 42)" />
              <rect
                x="8"
                y={y - 3}
                width="11"
                height="6"
                rx="3"
                fill="white"
                stroke="rgb(14 165 233)"
                strokeWidth="0.7"
                strokeDasharray="1.2 0.8"
              />
            </g>
          ))}
          <rect
            x="8"
            y="17"
            width="11"
            height="6"
            rx="3"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.7"
          />
          <rect
            x="22"
            y="13"
            width="31"
            height="13"
            rx="1"
            fill="none"
            stroke="rgb(14 165 233)"
            strokeWidth="0.7"
          />
          {[23.5, 33.5, 43.5].map((x) => (
            <rect
              key={x}
              x={x}
              y="17.5"
              width="8"
              height="5"
              rx="2.5"
              fill="white"
              stroke="rgb(14 165 233)"
              strokeWidth="0.7"
            />
          ))}
          <rect
            x="56"
            y="17"
            width="10"
            height="6"
            rx="3"
            fill="white"
            stroke="rgb(14 165 233)"
            strokeWidth="0.7"
          />
          <rect x="68" y="17" width="7" height="6" rx="3" fill="rgb(3 105 161)" />
          <circle cx="77.6" cy="20" r="1.8" fill="white" stroke="rgb(15 23 42)" strokeWidth="0.7" />
          <circle cx="77.6" cy="20" r="0.9" fill="rgb(15 23 42)" />
          <path
            d="M5 20 L8 20 M19 20 L23.5 20 M31.5 20 L33.5 20 M41.5 20 L43.5 20 M51.5 20 L56 20 M66 20 L68 20 M13.5 17 L13.5 9 M13.5 23 L13.5 31 M8 6 L5.3 6 M8 34 L5.3 34 M37.5 26 L37.5 34 L19 34 M59 17 L59 14 L63 14 L63 17"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.6"
          />
          {/* Hover story: the current-state token leaves the start, rests in
              Placed, then crosses the kitchen into Out for delivery. */}
          <circle
            className="pv-route"
            opacity="0"
            cx="3"
            cy="20"
            r="1.8"
            fill="rgb(245 158 11)"
            stroke="white"
            strokeWidth="0.6"
            style={pv({
              '--pv-dx': '10.5px',
              '--pv-dx2': '58px',
              '--pv-at': '1000ms',
              '--pv-dur': '2400ms',
            })}
          />
        </svg>
      );
    case 'floor-plan':
      // A shell with a corridor through it: three rooms above, three
      // below, each washed in its zone colour, furniture blocked in so the
      // tile reads as a plan rather than as a grid of empty boxes.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {/* Colour zones: day rooms amber, bedrooms violet, bath blue,
              study green, hall slate. */}
          {[
            { x: 2, y: 3, w: 34, h: 18, fill: 'rgb(254 243 199)' },
            { x: 36, y: 3, w: 42, h: 18, fill: 'rgb(237 233 254)' },
            { x: 2, y: 21, w: 76, h: 6, fill: 'rgb(241 245 249)' },
            { x: 2, y: 27, w: 32, h: 20, fill: 'rgb(254 243 199)' },
            { x: 34, y: 27, w: 18, h: 20, fill: 'rgb(224 242 254)' },
            { x: 52, y: 27, w: 26, h: 20, fill: 'rgb(209 250 229)' },
          ].map((z) => (
            <rect key={`${z.x},${z.y}`} x={z.x} y={z.y} width={z.w} height={z.h} fill={z.fill} />
          ))}
          {/* Outer wall, drawn heavier than the partitions. */}
          <rect
            x="2"
            y="3"
            width="76"
            height="44"
            fill="none"
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
      // The starter itself (docs/specs/021-event-storming/event-storming.md Phase 1): one orange domain event on a
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
