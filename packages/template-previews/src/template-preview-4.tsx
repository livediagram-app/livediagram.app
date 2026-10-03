import type { ReactElement, SVGProps } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';
import { FILL_BOX, Pop, popGroup } from './story-parts';

// Group 4 of 4 (the roadmap / canvas / workshop / hierarchy / UML /
// cloud batch). Static SVG preview tiles (one branch per TemplateKind; see
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
    case 'funnel':
      // Four tiers ramping pale to deep sky, a count rail beside them, and
      // the weakest step's rose chip wired to the drop-off callout.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          {[
            { pts: '3,6 43,6 36,15 10,15', fill: 'rgb(224 242 254)' },
            { pts: '10,18 36,18 31,27 15,27', fill: 'rgb(186 230 253)' },
            { pts: '15,30 31,30 28,39 18,39', fill: 'rgb(125 211 252)' },
            { pts: '18,42 28,42 26.5,48 19.5,48', fill: 'rgb(56 189 248)' },
          ].map((t) => (
            <polygon
              key={t.pts}
              points={t.pts}
              fill={t.fill}
              stroke="rgb(14 165 233)"
              strokeWidth="0.7"
            />
          ))}
          {[10.5, 22.5, 34.5, 45].map((y) => (
            <rect key={y} x="46" y={y - 1.2} width="9" height="2.4" rx="0.6" fill="rgb(51 65 85)" />
          ))}
          {[16.5, 28.5].map((y) => (
            <rect key={y} x="46" y={y - 1} width="7" height="2" rx="1" fill="rgb(226 232 240)" />
          ))}
          <rect x="46" y="39.5" width="7" height="2" rx="1" fill="rgb(253 164 175)" />
          <path
            d="M 54 40.5 L 60 40.5"
            fill="none"
            stroke="rgb(251 113 133)"
            strokeWidth="0.7"
            strokeDasharray="1.2 1"
          />
          <rect
            x="60"
            y="28"
            width="17"
            height="19"
            rx="1.2"
            fill="rgb(255 241 242)"
            stroke="rgb(253 164 175)"
            strokeWidth="0.7"
          />
          <polygon
            points="63,33.5 65,30 67,33.5"
            fill="none"
            stroke="rgb(190 18 60)"
            strokeWidth="0.6"
          />
          {[37, 40.5, 44].map((y) => (
            <rect
              key={y}
              x="62.5"
              y={y - 0.8}
              width="12"
              height="1.6"
              rx="0.5"
              fill="rgb(254 205 211)"
            />
          ))}
          {/* Hover story: prospects drop through the stages on a loop; the
              ones at the edges fall out after the first stage. */}
          {[
            { x: 23, dx: 0, dy: 38, at: 1000 },
            { x: 12, dx: -4, dy: 11, at: 1300 },
            { x: 23, dx: 0, dy: 38, at: 1600 },
            { x: 34, dx: 4, dy: 11, at: 1900 },
            { x: 23, dx: 0, dy: 38, at: 2200 },
          ].map((d) => (
            <circle
              key={d.at}
              className="pv-travel"
              opacity="0"
              cx={d.x}
              cy="8.5"
              r="1.5"
              fill="rgb(2 132 199)"
              style={pv({
                '--pv-dx': `${d.dx}px`,
                '--pv-dy': `${d.dy}px`,
                '--pv-at': `${d.at}ms`,
                '--pv-dur': '1800ms',
              })}
            />
          ))}
        </svg>
      );
    case 'okr-tree':
      // A bold objective over three key-result cards, each with a progress
      // ring and coloured by health (on track, at risk, on track), and two
      // badged initiatives dropping straight from each card's quarters.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <path
            d="M31 10 V13.5 H14 V17 M40 10 V17 M49 10 V13.5 H66 V17"
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth="0.8"
          />
          <rect x="22" y="2" width="36" height="8" rx="1.5" fill="rgb(3 105 161)" />
          {[
            {
              x: 2,
              fill: 'rgb(220 252 231)',
              hue: 'rgb(22 163 74)',
              arc: 'M8 19.8 A3.2 3.2 0 1 1 6.12 25.59',
              at: 900,
            },
            {
              x: 28,
              fill: 'rgb(254 243 199)',
              hue: 'rgb(217 119 6)',
              arc: 'M34 19.8 A3.2 3.2 0 0 1 36.8 24.54',
              at: 1200,
            },
            {
              x: 54,
              fill: 'rgb(220 252 231)',
              hue: 'rgb(22 163 74)',
              arc: 'M60 19.8 A3.2 3.2 0 1 1 56.8 23',
              at: 1500,
            },
          ].map((kr, i) => (
            <g key={kr.x}>
              <path
                d={`M${kr.x + 6} 29 V34 M${kr.x + 18} 29 V34`}
                fill="none"
                stroke="rgb(100 116 139)"
                strokeWidth="0.7"
              />
              <rect
                x={kr.x}
                y="17"
                width="24"
                height="12"
                rx="1.5"
                fill={kr.fill}
                stroke={kr.hue}
                strokeWidth="0.8"
              />
              <circle cx={kr.x + 6} cy="23" r="3.2" fill="none" stroke="white" strokeWidth="1.3" />
              {/* Hover story: each ring fills to where its key result
                  stands this quarter. */}
              <path
                d={kr.arc}
                pathLength="1"
                fill="none"
                stroke={kr.hue}
                strokeWidth="1.3"
                className="pv-draw"
                style={pv({ '--pv-at': `${kr.at}ms`, '--pv-dur': '900ms' })}
              />
              {[20.5, 23, 25.5].map((y, j) => (
                <line
                  key={y}
                  x1={kr.x + 11}
                  y1={y}
                  x2={kr.x + (j === 0 ? 22 : 18)}
                  y2={y}
                  stroke={j === 0 ? kr.hue : 'rgb(148 163 184)'}
                  strokeWidth="0.8"
                />
              ))}
              {[kr.x + 1, kr.x + 13].map((ix, j) => (
                <g key={ix}>
                  <rect
                    x={ix}
                    y="34"
                    width="10"
                    height="6"
                    rx="1"
                    fill="white"
                    stroke="rgb(14 165 233)"
                    strokeWidth="0.7"
                  />
                  <rect
                    x={ix + 6}
                    y="32.8"
                    width="5"
                    height="2"
                    rx="0.6"
                    fill={
                      [
                        ['rgb(22 163 74)', 'rgb(217 119 6)'],
                        ['rgb(217 119 6)', 'rgb(71 85 105)'],
                        ['rgb(22 163 74)', 'rgb(217 119 6)'],
                      ][i]![j]
                    }
                  />
                </g>
              ))}
            </g>
          ))}
          {/* ...then a WIP initiative ships: its badge turns DONE. */}
          <rect
            className="pv-new"
            opacity="0"
            x="21"
            y="32.8"
            width="5"
            height="2"
            rx="0.6"
            fill="rgb(22 163 74)"
            style={pv({ '--pv-at': '2300ms' })}
          />
        </svg>
      );
    case 'sitemap':
      // Home over three hued nav sections, each spanning two pages with a
      // route beneath; footer and utility pages flank Home on dashed lines.
      return (
        <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
          <path
            d="M32 3.75 H25 V3 H18 M32 7.25 H25 V9 H18 M48 3.75 H55 V3 H62 M48 7.25 H55 V9 H62"
            fill="none"
            stroke="rgb(148 163 184)"
            strokeWidth="0.6"
            strokeDasharray="1.2 0.8"
          />
          {[6, 62].map((x) =>
            [1, 7].map((y) => (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y}
                width="12"
                height="4"
                rx="0.8"
                fill="white"
                stroke="rgb(148 163 184)"
                strokeWidth="0.6"
              />
            )),
          )}
          <rect x="32" y="2" width="16" height="7" rx="1.5" fill="rgb(3 105 161)" />
          {[
            [2, 'rgb(224 242 254)', 'rgb(14 165 233)', 'rgb(125 211 252)'],
            [29, 'rgb(209 250 229)', 'rgb(16 185 129)', 'rgb(110 231 183)'],
            [56, 'rgb(237 233 254)', 'rgb(139 92 246)', 'rgb(196 181 253)'],
          ].map(([x, fill, hue, edge]) => (
            <g key={x as number}>
              <rect
                x={x as number}
                y="18"
                width="22"
                height="6"
                rx="1.2"
                fill={fill as string}
                stroke={hue as string}
                strokeWidth="1"
              />
              {[(x as number) + 1, (x as number) + 12].map((px) => (
                <g key={px}>
                  <rect
                    x={px}
                    y="32"
                    width="9"
                    height="5"
                    rx="0.8"
                    fill="white"
                    stroke={edge as string}
                    strokeWidth="0.7"
                  />
                  <line
                    x1={px + 1.5}
                    y1="39.5"
                    x2={px + 7.5}
                    y2="39.5"
                    stroke="rgb(148 163 184)"
                    strokeWidth="0.6"
                  />
                </g>
              ))}
            </g>
          ))}
          {/* Rakes from Home's three exits, then straight drops to pages.
              Hover story: the links wire up from Home down, tier by tier,
              then a visitor's route lights up to its last page. */}
          {[
            ['M36 9 V13.5 H13 V18 M40 9 V18 M44 9 V13.5 H67 V18', 0.8, 900],
            ['M7.5 24 V32 M18.5 24 V32', 0.7, 1300],
            ['M34.5 24 V32 M45.5 24 V32', 0.7, 1450],
            ['M61.5 24 V32 M72.5 24 V32', 0.7, 1600],
          ].map(([d, w, at]) => (
            <path
              key={at}
              d={d as string}
              pathLength="1"
              fill="none"
              stroke="rgb(100 116 139)"
              strokeWidth={w}
              className="pv-draw"
              style={pv({ '--pv-at': `${at}ms`, '--pv-dur': '600ms' })}
            />
          ))}
          <g className="pv-new" opacity="0" style={popGroup(2200)}>
            <path
              d="M44 9 V13.5 H67 V18 M72.5 24 V32"
              pathLength="1"
              fill="none"
              stroke="rgb(139 92 246)"
              strokeWidth="1.6"
              className="pv-draw"
              style={pv({ '--pv-at': '2200ms', '--pv-dur': '900ms' })}
            />
          </g>
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
