// Canvas-category illustrations (liveworkspace/docs/specs/017-help/help-centre.md): the floor a Space is built on,
// placing and selecting pieces, panning and zooming, painting a style, a multi-colour theme and snapping. Drawn with
// livehuddle's own chrome (./editor-chrome) and furniture (./space-furniture), so every figure shows a Space.

import { Cursor, Label, Scene, SelectionBox } from '@liveworkspace/help-site/art/primitives';
import { BottomBar, Card, CornerCluster, Icon, Strip, TopRow, stripSlot } from './editor-chrome';
import {
  Chair,
  Desk,
  OfficeFloor,
  Plant,
  Room,
  NoticeBoard,
  type NoteTone,
} from './space-furniture';

/** The hand the canvas shows while you pan, its palm at (x, y). */
export function HandCursor({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(0.8)`}>
      <path
        d="M0 6 v-8 a3 3 0 0 1 6 0 v6 m0 -2 a3 3 0 0 1 6 0 v3 m0 -1 a3 3 0 0 1 6 0 v5 a10 10 0 0 1 -10 10 h-2 a10 10 0 0 1 -9 -7 l-3 -7 a3 3 0 0 1 5 -3 l1 2"
        className="fill-white stroke-slate-700"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** The zoom card alone, top-left at (x, y), reading `level`. */
export function ZoomCard({ x, y, level = '100%' }: { x: number; y: number; level?: string }) {
  return (
    <Card x={x} y={y} w={80} h={24}>
      <Icon prims={[{ t: 'path', d: 'M5 12h14' }]} x={x + 12} y={y + 12} size={8} />
      <Label x={x + 40} y={y + 12.5} size={9} weight={500} tone="strong" anchor="middle">
        {level}
      </Label>
      <Icon prims={[{ t: 'path', d: 'M5 12h14M12 5v14' }]} x={x + 68} y={y + 12} size={8} />
    </Card>
  );
}

/** The whole editor over a small office: the top row, the floor with its rooms, your pointer, the corner cluster
 *  and the bottom bar. */
export function CanvasOverview() {
  return (
    <Scene w={520} h={300}>
      <OfficeFloor x={110} y={56} />
      <Cursor x={300} y={196} name="You" />
      <TopRow w={520} />
      <CornerCluster x={350} y={240} />
      <BottomBar y={274} w={520} />
    </Scene>
  );
}

// Seats' flyout rows, as the palette lists them.
const SEAT_ROWS: readonly [string, string][] = [
  [
    'Chair',
    'M5 9V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 11a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3ZM5 16v3M19 16v3',
  ],
  ['Sofa', 'M4 10V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2M2 12h20v5H2zM5 17v2M19 17v2'],
  ['Desk', 'M4 11h16M6 11v8M18 11v8M9 4h6v5H9zM12 9v2'],
];

/** Seats' flyout, top-left at (x, y), 150 by 110: Chair, Sofa and Desk, `armed` tinted. */
export function SeatsFlyout({ x, y, armed = 'Chair' }: { x: number; y: number; armed?: string }) {
  return (
    <Card x={x} y={y} w={150} h={110} r={7}>
      <Label x={x + 10} y={y + 14} size={10} weight={650} tone="strong">
        Seats
      </Label>
      {SEAT_ROWS.map(([name, d], i) => {
        const ry = y + 26 + i * 27;
        const on = name === armed;
        return (
          <g key={name}>
            {on && (
              <rect x={x + 4} y={ry - 3} width={142} height={26} rx={5} className="fill-brand-50" />
            )}
            <rect
              x={x + 9}
              y={ry}
              width={20}
              height={20}
              rx={5}
              className="fill-white stroke-slate-200"
              strokeWidth={0.75}
            />
            <Icon prims={[{ t: 'path', d }]} x={x + 19} y={ry + 10} size={10} />
            <Label x={x + 36} y={ry + 10} size={9.5} weight={600} tone={on ? 'accent' : 'strong'}>
              {name}
            </Label>
          </g>
        );
      })}
    </Card>
  );
}

/** Dropping a chair from Seats' flyout onto the floor: Seats pressed on the strip, its rows hanging under it with
 *  Chair armed, and the chair just placed and still selected. */
export function AddingElements() {
  const sx = 12;
  const fx = stripSlot(sx, 'seats') - 30;
  return (
    <Scene w={440} h={220}>
      <Room x={232} y={70} w={196} h={140} name="Team Room" />
      <Strip x={sx} y={8} open="seats" />
      <SeatsFlyout x={fx} y={40} />
      <path
        d={`M${fx + 130} 112 C 250 110, 270 120, 304 136`}
        className="fill-none stroke-slate-400"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <Chair cx={322} cy={138} s={2.4} />
      <SelectionBox x={306} y={122} w={32} h={32} />
      <Cursor x={346} y={152} />
    </Scene>
  );
}

/** Panning and zooming: the floor dragged by the hand, the zoom card reading 75%. */
export function PanAndZoom() {
  return (
    <Scene w={420} h={220}>
      <g transform="translate(40 18) scale(0.85)">
        <OfficeFloor x={0} y={0} />
      </g>
      <HandCursor x={226} y={120} />
      <path
        d="M246 132 h40 m-6 -5 l6 5 l-6 5"
        className="fill-none stroke-slate-400"
        strokeWidth={1}
      />
      <ZoomCard x={326} y={186} level="75%" />
    </Scene>
  );
}

/** A marquee drag: the dashed box sweeping across a room, picking up the two desks it fully encloses and leaving the
 *  plant it only clips. */
export function MultiSelect() {
  return (
    <Scene w={420} h={210}>
      <Room x={30} y={24} w={360} h={164} name="Desks" />
      <Desk x={70} y={70} />
      <Desk x={130} y={70} />
      <Desk x={260} y={70} />
      <Plant cx={226} cy={150} />
      <SelectionBox x={66} y={62} w={102} h={40} />
      <rect
        x={56}
        y={52}
        width={172}
        height={92}
        className="fill-brand-500/10 stroke-brand-500"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <Cursor x={228} y={144} />
    </Scene>
  );
}

/** The brush the Format Painter arms, centred on (x, y). */
export function Brush({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-8} y={-9} width={16} height={9} rx={2} className="fill-brand-600" />
      <path d="M0 0 v7" className="stroke-slate-600" strokeWidth={1.6} />
      <rect x={-2.5} y={7} width={5} height={7} rx={1} className="fill-slate-600" />
    </g>
  );
}

/** The format painter: the styled note's look (its green paper) brushed onto the next note clicked. */
export function FormatPainter() {
  return (
    <Scene w={420} h={170}>
      <NoticeBoard x={52} y={40} w={92} h={74} tone="emerald" label="Stand-up" lines={3} />
      <SelectionBox x={52} y={40} w={92} h={74} />
      <path
        d="M150 64 C 200 34, 240 34, 270 58"
        className="fill-none stroke-slate-400"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <NoticeBoard x={276} y={40} w={92} h={74} tone="emerald" label="Retro" lines={3} />
      <Brush x={330} y={102} />
      <Label x={98} y={136} size={9} anchor="middle" tone="muted">
        Picked up
      </Label>
      <Label x={322} y={136} size={9} anchor="middle" tone="muted">
        Painted
      </Label>
    </Scene>
  );
}

// A retro wall: a multi-colour theme gives each new note the palette's next hue.
const WALL: readonly [NoteTone, string][] = [
  ['emerald', 'Wins'],
  ['sky', 'Ideas'],
  ['violet', 'Kudos'],
  ['amber', 'Actions'],
  ['rose', 'Blockers'],
];

/** Multi-colour theme: each note on the wall takes the next hue in turn. */
export function MulticolourTheme() {
  return (
    <Scene w={420} h={150}>
      {WALL.map(([tone, label], i) => (
        <NoticeBoard
          key={label}
          x={22 + i * 78}
          y={34 + (i % 2) * 14}
          w={66}
          h={62}
          tone={tone}
          label={label}
          lines={2}
        />
      ))}
    </Scene>
  );
}

/** Dragging a desk next to another snaps their top edges into line; the dashed guide shows the match. */
export function SnappingGuides() {
  return (
    <Scene w={400} h={170}>
      <Room x={24} y={20} w={352} h={136} name="Desks" />
      <line
        x1={60}
        y1={68}
        x2={330}
        y2={68}
        className="stroke-slate-600"
        strokeWidth={0.9}
        strokeOpacity={0.55}
        strokeDasharray="4 3"
      />
      <Desk x={70} y={68} />
      <Desk x={250} y={68} />
      <SelectionBox x={246} y={62} w={42} h={36} />
      <Cursor x={274} y={88} />
    </Scene>
  );
}
