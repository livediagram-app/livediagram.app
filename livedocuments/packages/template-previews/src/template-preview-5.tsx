import type { ReactElement } from 'react';
import type { TemplateKind } from '@livedocuments/templates';
import { pv } from './motion';
import { PopDot } from './story-parts';

// Group 5: the Storyboard, the Floor Plan and the Project Brief (article). Static SVG preview tiles, one
// branch per TemplateKind; TemplatePreview chains the groups with ??.
export function templatePreviewGroup5(kind: TemplateKind): ReactElement | null {
  switch (kind) {
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
    case 'article':
      // An article (docs/specs/007-editor/article-pages.md): a page of writing, a title over lines
      // with a heading, a bulleted pair and a small chart in the text. Hover story: a new line is
      // written at the foot.
      return (
        <svg width="72" height="40" viewBox="0 0 80 44" aria-hidden>
          <rect
            x="22"
            y="2"
            width="36"
            height="40"
            rx="2"
            fill="rgb(255 255 255)"
            stroke="rgb(203 213 225)"
            strokeWidth="0.9"
          />
          <rect x="27" y="7" width="17" height="3" rx="1" fill="rgb(15 23 42)" />
          <rect x="27" y="12" width="24" height="1.4" rx="0.7" fill="rgb(148 163 184)" />
          <rect x="27" y="15" width="26" height="1.4" rx="0.7" fill="rgb(148 163 184)" />
          <rect x="27" y="19" width="11" height="2" rx="1" fill="rgb(51 65 85)" />
          <circle cx="28" cy="24" r="0.9" fill="rgb(14 165 233)" />
          <rect x="30" y="23.3" width="10" height="1.4" rx="0.7" fill="rgb(148 163 184)" />
          <circle cx="28" cy="27" r="0.9" fill="rgb(14 165 233)" />
          <rect x="30" y="26.3" width="8" height="1.4" rx="0.7" fill="rgb(148 163 184)" />
          <rect x="43" y="22" width="10" height="8" rx="1" fill="rgb(240 249 255)" />
          <rect x="44.5" y="26" width="2" height="3" fill="rgb(56 189 248)" />
          <rect x="47.5" y="24" width="2" height="5" fill="rgb(14 165 233)" />
          <rect x="50.5" y="25" width="2" height="4" fill="rgb(2 132 199)" />
          <rect x="27" y="33" width="26" height="1.4" rx="0.7" fill="rgb(148 163 184)" />
          <path
            className="pv-draw"
            pathLength="1"
            strokeDasharray="0 1"
            d="M27 37.2 L48 37.2"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="1.4"
            strokeLinecap="round"
            style={pv({ '--pv-at': '400ms', '--pv-dur': '900ms' })}
          />
        </svg>
      );
    default:
      return null;
  }
}
