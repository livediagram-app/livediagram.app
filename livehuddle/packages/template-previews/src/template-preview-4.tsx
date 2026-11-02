import type { ReactElement, SVGProps } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { pv } from '@liveworkspace/template-previews/motion';
import { FILL_BOX, Pop } from '@liveworkspace/template-previews/story-parts';

// Group 4 (the roadmap / canvas / workshop batch). Static SVG preview tiles (one branch per TemplateKind; see
// template-preview.tsx for who renders them). Split out of template-preview.tsx to keep
// each file under the ~1000-line budget; TemplatePreview chains the
// groups with ??. Shared palette: sky accents (rgb(14 165 233) stroke,
// rgb(186 230 253) fill), slate connectors (rgb(100 116 139)), amber
// stickies (rgb(254 243 199) / rgb(253 230 138)).
export function templatePreviewGroup4(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'roadmap':
      // One goal pill over three theme swimlanes (violet / blue / green,
      // tinted gutters) crossed by Now / Next / Later columns, each column
      // with a confidence meter that empties to the right. Card borders go
      // thick, normal, dashed. Hover story: the Now cards' status stickers
      // land one after another.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="3"
            y="2"
            width="30"
            height="5"
            rx="2.5"
            fill="rgb(224 242 254)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.5"
          />
          <circle cx="7" cy="4.5" r="1.2" fill="none" stroke="rgb(14 165 233)" strokeWidth="0.5" />
          {[0, 1, 2].map((c) => (
            <g key={c}>
              <rect
                x={17 + c * 20.5}
                y="9.5"
                width="7"
                height="2.2"
                rx="0.6"
                fill="rgb(15 23 42)"
              />
              {[0, 1, 2].map((d) => (
                <circle
                  key={d}
                  cx={30 + c * 20.5 + d * 2.2}
                  cy="10.6"
                  r="0.8"
                  fill={d < 3 - c ? 'rgb(51 65 85)' : 'white'}
                  stroke="rgb(51 65 85)"
                  strokeWidth="0.35"
                />
              ))}
            </g>
          ))}
          {[
            {
              y: 14,
              fill: 'rgb(245 243 255)',
              gutter: 'rgb(237 233 254)',
              stroke: 'rgb(196 181 253)',
            },
            {
              y: 25.5,
              fill: 'rgb(239 246 255)',
              gutter: 'rgb(219 234 254)',
              stroke: 'rgb(147 197 253)',
            },
            {
              y: 37,
              fill: 'rgb(236 253 245)',
              gutter: 'rgb(209 250 229)',
              stroke: 'rgb(110 231 183)',
            },
          ].map((lane) => (
            <g key={lane.y}>
              <rect
                x="3"
                y={lane.y}
                width="74"
                height="10"
                rx="1"
                fill={lane.fill}
                stroke={lane.stroke}
                strokeWidth="0.5"
              />
              <rect x="3" y={lane.y} width="12" height="10" rx="1" fill={lane.gutter} />
              <rect x="5" y={lane.y + 4.2} width="8" height="1.6" rx="0.5" fill={lane.stroke} />
              {[0, 1, 2].map((c) => (
                <g key={c}>
                  <rect
                    x={16.5 + c * 20.5}
                    y={lane.y + 1.5}
                    width="19"
                    height="7"
                    rx="1.2"
                    fill="white"
                    stroke={lane.stroke}
                    strokeWidth={c === 0 ? 0.9 : 0.5}
                    strokeDasharray={c === 2 ? '1.4 0.9' : undefined}
                  />
                  <rect
                    x={18.5 + c * 20.5}
                    y={lane.y + 3}
                    width="9"
                    height="1.3"
                    rx="0.4"
                    fill="rgb(51 65 85)"
                  />
                  <rect
                    x={18.5 + c * 20.5}
                    y={lane.y + 5.6}
                    width="13"
                    height="1.1"
                    rx="0.4"
                    fill="rgb(148 163 184)"
                  />
                </g>
              ))}
            </g>
          ))}
          {[
            { y: 14.8, fill: 'rgb(217 119 6)' },
            { y: 26.3, fill: 'rgb(22 163 74)' },
            { y: 37.8, fill: 'rgb(217 119 6)' },
          ].map((s, i) => (
            <rect
              key={s.y}
              x="30.5"
              y={s.y}
              width="5.5"
              height="2.2"
              rx="1.1"
              fill={s.fill}
              className="pv-pulse"
              style={pv({ '--pv-at': `${900 + i * 450}ms` })}
            />
          ))}
        </svg>
      );
    case 'raci-matrix':
      // Tasks-by-roles grid whose letter cells take their role's tint (R
      // green, A blue, C amber, I slate), over the four-card legend.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="4"
            y="3"
            width="72"
            height="34"
            rx="1.5"
            fill="white"
            stroke="rgb(148 163 184)"
            strokeWidth="0.8"
          />
          <rect x="4" y="3" width="72" height="6.8" fill="rgb(226 232 240)" />
          <rect x="4" y="3" width="20" height="34" fill="rgb(241 245 249)" />
          {(
            [
              ['A', 'C', 'C', 'I'],
              ['A', 'R', 'C', 'I'],
              ['I', 'C', 'A', 'C'],
              ['I', 'I', 'C', 'A'],
            ] as const
          ).map((row, r) =>
            row.map((l, c) => (
              <rect
                key={`${r}-${c}`}
                x={24.4 + c * 13}
                y={10.2 + r * 6.7}
                width="12.2"
                height="5.9"
                fill={
                  l === 'R'
                    ? 'rgb(220 252 231)'
                    : l === 'A'
                      ? 'rgb(219 234 254)'
                      : l === 'C'
                        ? 'rgb(254 243 199)'
                        : 'rgb(241 245 249)'
                }
              />
            )),
          )}
          {[
            ['rgb(220 252 231)', 'rgb(21 128 61)'],
            ['rgb(219 234 254)', 'rgb(29 78 216)'],
            ['rgb(254 243 199)', 'rgb(161 98 7)'],
            ['rgb(241 245 249)', 'rgb(71 85 105)'],
          ].map(([fill, stroke], i) => (
            <rect
              key={fill}
              x={4 + i * 18.4}
              y="40"
              width="16.8"
              height="7"
              rx="1"
              fill={fill}
              stroke={stroke}
              strokeWidth="0.6"
            />
          ))}
          {/* Hover story: the bottom task's grey I is handed to the next
              role, then the third task gains a Responsible (green). */}
          <rect
            x="24.4"
            y="30.3"
            width="12.2"
            height="5.9"
            fill="rgb(203 213 225)"
            className="pv-shift"
            style={pv({ '--pv-dx': '13px', '--pv-at': '1000ms' })}
          />
          <Pop at={1700} x={37.4} y={23.6} width="12.2" height="5.9" fill="rgb(134 239 172)" />
        </svg>
      );
    case 'user-story-map':
      // A journey arrow over three orange activities, each spanning two
      // blue tasks; yellow stories stacked beneath in three release lanes
      // (MVP bold-bordered), the persona in the gutter.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <path
            d="M 16 2.5 L 76 2.5 M 74 1 L 76 2.5 L 74 4"
            fill="none"
            stroke="rgb(148 163 184)"
            strokeWidth="0.7"
          />
          <rect x="2" y="5" width="11" height="11.5" rx="0.8" fill="rgb(233 213 255)" />
          {[0, 1, 2].map((a) => (
            <rect
              key={a}
              x={16 + a * 20.7}
              y="5"
              width="19.4"
              height="5"
              rx="0.6"
              fill="rgb(254 215 170)"
            />
          ))}
          {[0, 1, 2, 3, 4, 5].map((t) => (
            <rect
              key={t}
              x={16 + t * 10.35}
              y="11.5"
              width="9.05"
              height="5"
              rx="0.6"
              fill="rgb(186 230 253)"
            />
          ))}
          {[
            { y: 19, h: 13, stroke: 'rgb(14 165 233)', w: 1 },
            { y: 33.5, h: 7, stroke: 'rgb(125 211 252)', w: 0.6 },
            { y: 42, h: 7, stroke: 'rgb(125 211 252)', w: 0.6 },
          ].map((l) => (
            <g key={l.y}>
              <rect
                x="2"
                y={l.y}
                width="76"
                height={l.h}
                rx="1"
                fill="rgb(240 249 255)"
                stroke={l.stroke}
                strokeWidth={l.w}
              />
              <rect x="2" y={l.y} width="11" height={l.h} rx="1" fill="rgb(224 242 254)" />
            </g>
          ))}
          {/* Stories: two rows in the MVP, one in each later lane. Hover
              story: the fourth column's Release 2 story is promoted into the
              MVP gap, and a new story backfills Release 2. */}
          {[0, 1, 2, 3, 4, 5].map((t) => (
            <g key={t}>
              <Sticky x={16 + t * 10.35} y={20.2} width="9.05" height="5" />
              {t === 0 || t === 4 ? (
                <Sticky x={16 + t * 10.35} y={26.1} width="9.05" height="5" />
              ) : null}
              {t !== 3 ? <Sticky x={16 + t * 10.35} y={34.4} width="9.05" height="5" /> : null}
              <Sticky x={16 + t * 10.35} y={42.9} width="9.05" height="5" />
            </g>
          ))}
          <Sticky
            x={16 + 3 * 10.35}
            y={34.4}
            width="9.05"
            height="5"
            className="pv-shift"
            style={pv({ '--pv-dy': '-8.3px', '--pv-at': '1000ms', '--pv-dur': '800ms' })}
          />
          <Sticky
            x={16 + 3 * 10.35}
            y={34.4}
            width="9.05"
            height="5"
            className="pv-arrive"
            opacity="0"
            style={pv({ '--pv-from-y': '6px', '--pv-at': '1900ms' })}
          />
        </svg>
      );
    case 'affinity-map':
      // Two dashed rose theme frames, each a pink theme note over two blue
      // insight notes over tilted yellow notes, and a loose note to the side.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {[2, 32].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="3"
                width="28"
                height="44"
                rx="2"
                fill="none"
                stroke="rgb(225 29 72)"
                strokeWidth="0.8"
                strokeDasharray="3 2"
              />
              <rect x={x + 2} y="5.5" width="24" height="5" rx="0.6" fill="rgb(254 205 211)" />
              {[0, 1].map((g) => (
                <rect
                  key={g}
                  x={x + 2 + g * 12.5}
                  y="12.5"
                  width="11.5"
                  height="5"
                  rx="0.6"
                  fill="rgb(186 230 253)"
                />
              ))}
            </g>
          ))}
          {[
            { x: 4, y: 20, r: -3 },
            { x: 16.5, y: 20, r: 3 },
            { x: 4, y: 29, r: 3 },
            { x: 34, y: 20, r: 3 },
            { x: 46.5, y: 20, r: -3 },
            { x: 34, y: 29, r: -3 },
          ].map((s, i) => (
            <rect
              key={i}
              x={s.x}
              y={s.y}
              width="11.5"
              height="7"
              rx="0.6"
              fill="rgb(253 230 138)"
              transform={`rotate(${s.r} ${s.x + 5.75} ${s.y + 3.5})`}
            />
          ))}
          {/* Hover story: the loose note is filed under the second theme's
              second insight, then that insight's dot-vote tally pops. The
              tilted note moves inside a <g> so its own rotate() survives. */}
          <g
            className="pv-shift"
            style={{
              ...pv({
                '--pv-dx': '-18.5px',
                '--pv-dy': '9px',
                '--pv-at': '1000ms',
                '--pv-dur': '800ms',
              }),
              ...FILL_BOX,
            }}
          >
            <rect
              x="65"
              y="20"
              width="11.5"
              height="7"
              rx="0.6"
              fill="rgb(253 230 138)"
              transform="rotate(7 70.75 23.5)"
            />
          </g>
          <circle
            className="pv-new"
            opacity="0"
            cx="56.5"
            cy="12.5"
            r="2"
            fill="rgb(15 23 42)"
            style={pv({ '--pv-at': '2000ms' })}
          />
        </svg>
      );
    case 'business-model-canvas':
      // The nine-block Osterwalder grid coloured by area: infrastructure
      // blue, the offer amber (the thick-bordered heart), customers green,
      // finances violet, under a title and the area key.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <rect x="4" y="2.5" width="24" height="2.6" rx="0.6" fill="rgb(51 65 85)" />
          {['rgb(147 197 253)', 'rgb(245 158 11)', 'rgb(134 239 172)', 'rgb(196 181 253)'].map(
            (fill, i) => (
              <rect key={fill} x={49 + i * 7} y="2.5" width="6" height="2.6" rx="1.3" fill={fill} />
            ),
          )}
          {[
            { x: 4, y: 8, h: 27, a: 0 },
            { x: 18.6, y: 8, h: 13, a: 0 },
            { x: 18.6, y: 22, h: 13, a: 0 },
            { x: 47.8, y: 8, h: 13, a: 2 },
            { x: 47.8, y: 22, h: 13, a: 2 },
            { x: 62.4, y: 8, h: 27, a: 2 },
          ].map((b) => (
            <rect
              key={`${b.x}-${b.y}`}
              x={b.x}
              y={b.y}
              width="13.6"
              height={b.h}
              rx="1"
              fill={b.a === 0 ? 'rgb(219 234 254)' : 'rgb(220 252 231)'}
              stroke={b.a === 0 ? 'rgb(147 197 253)' : 'rgb(134 239 172)'}
              strokeWidth="0.6"
            />
          ))}
          <rect
            x="33.2"
            y="8"
            width="13.6"
            height="27"
            rx="1"
            fill="rgb(254 243 199)"
            stroke="rgb(245 158 11)"
            strokeWidth="1.1"
          />
          <rect x="35" y="11.5" width="10" height="7" rx="0.4" fill="rgb(253 230 138)" />
          {[4, 40.5].map((x) => (
            <rect
              key={x}
              x={x}
              y="36.5"
              width="35.5"
              height="10"
              rx="1"
              fill="rgb(237 233 254)"
              stroke="rgb(196 181 253)"
              strokeWidth="0.6"
            />
          ))}
          {/* Hover story: the canvas fills in its numbered order, who it's
              for, what we promise them, how we reach them, how it earns. */}
          {[
            [64, 11.5, 'rgb(187 247 208)', 1000],
            [35, 20.5, 'rgb(253 230 138)', 1300],
            [49.6, 25.5, 'rgb(187 247 208)', 1600],
            [49.6, 11.5, 'rgb(187 247 208)', 1900],
            [42.5, 40, 'rgb(233 213 255)', 2200],
          ].map(([x, y, fill, at]) => (
            <Pop
              key={at}
              at={at as number}
              x={x as number}
              y={y as number}
              width="10"
              height="4.5"
              rx="0.4"
              fill={fill as string}
            />
          ))}
        </svg>
      );
    case 'empathy-map':
      // A persona card over Says / Thinks / Does / Feels, with the Pains /
      // Gains strip underneath; each block's notes take its own hue.
      return (
        <svg width="72" height="44" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="6"
            y="2"
            width="68"
            height="8"
            rx="1.5"
            fill="rgb(248 250 252)"
            stroke="rgb(203 213 225)"
            strokeWidth="0.7"
          />
          <circle
            cx="10.5"
            cy="6"
            r="2.6"
            fill="rgb(186 230 253)"
            stroke="rgb(14 165 233)"
            strokeWidth="0.6"
          />
          <line x1="15" y1="4.8" x2="40" y2="4.8" stroke="rgb(51 65 85)" strokeWidth="1.1" />
          <line x1="15" y1="7.6" x2="55" y2="7.6" stroke="rgb(148 163 184)" strokeWidth="0.6" />
          {[
            {
              x: 6,
              y: 12,
              fill: 'rgb(219 234 254)',
              stroke: 'rgb(147 197 253)',
              note: 'rgb(186 230 253)',
            },
            {
              x: 41,
              y: 12,
              fill: 'rgb(237 233 254)',
              stroke: 'rgb(196 181 253)',
              note: 'rgb(233 213 255)',
            },
            {
              x: 6,
              y: 24,
              fill: 'rgb(220 252 231)',
              stroke: 'rgb(134 239 172)',
              note: 'rgb(187 247 208)',
            },
            {
              x: 41,
              y: 24,
              fill: 'rgb(255 228 230)',
              stroke: 'rgb(253 164 175)',
              note: 'rgb(254 205 211)',
            },
          ].map((q) => (
            <g key={`${q.x}-${q.y}`}>
              <rect
                x={q.x}
                y={q.y}
                width="33"
                height="10.5"
                rx="1.5"
                fill={q.fill}
                stroke={q.stroke}
                strokeWidth="0.7"
              />
              <rect x={q.x + 2} y={q.y + 4.5} width="13.5" height="4.5" rx="0.3" fill={q.note} />
            </g>
          ))}
          {[
            {
              x: 6,
              fill: 'rgb(255 237 213)',
              stroke: 'rgb(253 186 116)',
              note: 'rgb(254 215 170)',
            },
            {
              x: 41,
              fill: 'rgb(204 251 241)',
              stroke: 'rgb(94 234 212)',
              note: 'rgb(153 246 228)',
            },
          ].map((b) => (
            <g key={b.x}>
              <rect
                x={b.x}
                y="37.5"
                width="33"
                height="10"
                rx="1.5"
                fill={b.fill}
                stroke={b.stroke}
                strokeWidth="0.7"
              />
              <rect x={b.x + 2} y="41.5" width="13.5" height="4.5" rx="0.3" fill={b.note} />
              <rect x={b.x + 17.5} y="41.5" width="13.5" height="4.5" rx="0.3" fill={b.note} />
            </g>
          ))}
          {/* Hover story: an observation comes from the persona into each
              quadrant in turn: says, thinks, does, feels. */}
          {[
            [23, 16.5, 1000, 'rgb(186 230 253)'],
            [58, 16.5, 1300, 'rgb(233 213 255)'],
            [23, 28.5, 1600, 'rgb(187 247 208)'],
            [58, 28.5, 1900, 'rgb(254 205 211)'],
          ].map(([x, y, at, fill]) => (
            <rect
              key={at}
              className="pv-arrive"
              opacity="0"
              x={x}
              y={y}
              width="13.5"
              height="4.5"
              rx="0.3"
              fill={fill as string}
              style={pv({
                '--pv-from-x': `${10.5 - (x as number)}px`,
                '--pv-from-y': `${6 - (y as number)}px`,
                '--pv-at': `${at}ms`,
              })}
            />
          ))}
        </svg>
      );
    default:
      return null;
  }
}

// Helpers for the hover stories (preview-motion.css).

// An amber sticky (user story map, affinity map).
function Sticky(props: { x: number; y: number } & Omit<SVGProps<SVGRectElement>, 'x' | 'y'>) {
  return (
    <rect
      width="14"
      height="9"
      rx="1"
      fill="rgb(254 243 199)"
      stroke="rgb(253 230 138)"
      strokeWidth="0.9"
      {...props}
    />
  );
}
