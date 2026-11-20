// Canvas-category illustrations (liveworkspace/docs/specs/017-help/help-centre.md): the floor a Space is built on,
// placing and selecting pieces, panning and zooming, painting a style, a multi-colour theme and snapping. Drawn with
// livehuddle's own chrome (./editor-chrome) and furniture (./space-furniture), so every figure shows a Space.

import { Cursor, Label, Scene, SelectionBox } from '@liveworkspace/help-site/art/primitives';
import { BottomBar, Card, CornerCluster, Icon, Strip, TopRow, stripSlot } from './editor-chrome';
import { Desk, OfficeFloor, Plant, Room, Sticky, type StickyTone } from './space-furniture';

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

// Write's flyout rows, as the palette lists them.
const WRITE_ROWS: readonly [string, string, string][] = [
  ['Text', 'A free-standing text label', 'M4 7V4h16v3M9 20h6M12 4v16'],
  [
    'Note',
    'A coloured note card',
    'M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8ZM15 3v4a2 2 0 0 0 2 2h4',
  ],
  ['Image', 'Place an uploaded picture', 'M3 5h18v14H3zM3 16l5-5 5 5M14 14l2-2 5 5'],
];

/** Write's flyout, top-left at (x, y), 170 by 110: Text, Note and Image, `armed` tinted. */
export function WriteFlyout({ x, y, armed = 'Note' }: { x: number; y: number; armed?: string }) {
  return (
    <Card x={x} y={y} w={170} h={110} r={7}>
      <Label x={x + 10} y={y + 14} size={10} weight={650} tone="strong">
        Write
      </Label>
      {WRITE_ROWS.map(([name, line, d], i) => {
        const ry = y + 26 + i * 27;
        const on = name === armed;
        return (
          <g key={name}>
            {on && (
              <rect x={x + 4} y={ry - 3} width={162} height={26} rx={5} className="fill-brand-50" />
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
            <Label x={x + 36} y={ry + 6} size={9.5} weight={600} tone={on ? 'accent' : 'strong'}>
              {name}
            </Label>
            <Label x={x + 36} y={ry + 16} size={9} tone="muted">
              {line}
            </Label>
          </g>
        );
      })}
    </Card>
  );
}

/** Dropping a sticky note from Write's flyout onto the floor: Write pressed on the strip, its rows hanging under it
 *  with Note armed, and the note just placed and still selected. */
export function AddingElements() {
  const sx = 12;
  const fx = stripSlot(sx, 'write') - 30;
  return (
    <Scene w={440} h={220}>
      <Room x={232} y={70} w={196} h={140} name="Team Room" />
      <Strip x={sx} y={8} open="write" />
      <WriteFlyout x={fx} y={40} />
      <path
        d={`M${fx + 150} 112 C 250 110, 270 120, 300 128`}
        className="fill-none stroke-slate-400"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <Sticky x={300} y={112} w={64} h={58} label="Ideas" lines={2} />
      <SelectionBox x={300} y={112} w={64} h={58} />
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
      <Sticky x={52} y={40} w={92} h={74} tone="emerald" label="Stand-up" lines={3} />
      <SelectionBox x={52} y={40} w={92} h={74} />
      <path
        d="M150 64 C 200 34, 240 34, 270 58"
        className="fill-none stroke-slate-400"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <Sticky x={276} y={40} w={92} h={74} tone="emerald" label="Retro" lines={3} />
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
const WALL: readonly [StickyTone, string][] = [
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
        <Sticky
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
