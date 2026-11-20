// Canvas-category illustrations (liveworkspace/docs/specs/017-help/help-centre.md): the infinite canvas, placing and
// selecting elements, grouping, themes, templates, links, and annotations.
// Composed only from the shared primitives so the house style holds.

import {
  Scene,
  Shape,
  Arrow,
  SelectionBox,
  Cursor,
  Tabs,
  Label,
} from '@liveworkspace/help-site/art/primitives';
import { CornerCluster, EditorFrame, stripSlot, TopRow, topRowStripX } from './editor-chrome';
import { ElementToolbar, PlusHandles } from './editor-canvas';
import { Flyout, FlyoutGroup, FlyoutTile } from './palette-flyout';
import { ShapeOutline } from './toolbar-layout';

/** The editor at a glance: the whole frame around a small flow, someone's cursor beside it. */
export function CanvasOverview() {
  return (
    <Scene w={540} h={280}>
      <Shape x={120} y={88} w={84} h={46} kind="rect" label="Start" />
      <Shape x={252} y={80} w={66} h={62} kind="diamond" />
      <Shape x={243} y={172} w={84} h={42} kind="rect" accent label="Done" />
      <Arrow from={[204, 111]} to={[252, 111]} />
      <Arrow from={[285, 142]} to={[285, 172]} />
      {/* Left of Done, so the name tag sits clear of its edge. */}
      <Cursor x={200} y={176} name="You" />
      <EditorFrame w={540} h={280} />
    </Scene>
  );
}

/** Dropping a shape from a category's flyout onto the canvas: a drag trail from the Square tile in Shapes' flyout to a
 *  freshly placed shape, still selected, with its + buttons and its toolbar. */
export function AddingElements() {
  const W = 540;
  const cx = stripSlot(topRowStripX(W), 'shapes');
  const fw = 250;
  const fx = Math.round(cx - fw / 2);
  const kinds = ['square', 'circle', 'diamond', 'triangle', 'hexagon'] as const;
  const names = ['Square', 'Circle', 'Diamond', 'Triangle', 'Hexagon'];
  const [sx, sy, sw, sh] = [410, 214, 62, 56];
  return (
    <Scene w={W} h={290}>
      <TopRow w={W} open="shapes" />
      <Flyout
        x={fx}
        y={40}
        w={fw}
        h={124}
        item="shapes"
        blurb="The basics, the flowchart vocabulary, BPMN and more."
      >
        <FlyoutGroup x={fx + 10} y={86} w={fw - 20} name="Basics" />
        {kinds.map((k, i) => (
          <FlyoutTile key={k} x={fx + 11 + i * 46} y={94} w={38} name={names[i]!} hover={i === 0}>
            <ShapeOutline kind={k} />
          </FlyoutTile>
        ))}
      </Flyout>
      <Arrow from={[fx + 30, 132]} to={[sx + 4, sy + 6]} kind="curved" tone="muted" dashed />
      <ElementToolbar x={sx + sw / 2 - 80} y={sy - 13 - 6 - 6 - 21} title="Selected Square" />
      <Shape x={sx} y={sy} w={sw} h={sh} kind="rect" />
      <SelectionBox x={sx} y={sy} w={sw} h={sh} />
      <PlusHandles x={sx} y={sy} w={sw} h={sh} />
      <Cursor x={sx + 34} y={sy + 30} colour="brand" />
    </Scene>
  );
}

/** Panning and zooming: shapes on the canvas, a grabbing hand dragging it, and the zoom card in the corner cluster at
 *  the bottom right. */
export function PanAndZoom() {
  return (
    <Scene w={420} h={220}>
      <Shape x={70} y={44} w={76} h={44} label="A" />
      <Shape x={232} y={98} w={76} h={44} accent label="B" />
      <Arrow from={[146, 66]} to={[232, 120]} kind="elbow" />
      <CornerCluster x={420 - 8 - 211} y={220 - 8 - 24} level="80%" highlight="zoom" />
      {/* Grabbing-hand cursor */}
      <g transform="translate(150 112)">
        <path
          d="M0 6 v-8 a3 3 0 0 1 6 0 v6 m0 -2 a3 3 0 0 1 6 0 v3 m0 -1 a3 3 0 0 1 6 0 v5 a10 10 0 0 1 -10 10 h-2 a10 10 0 0 1 -9 -7 l-3 -7 a3 3 0 0 1 5 -3 l1 2"
          className="fill-white stroke-slate-600"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </Scene>
  );
}

/** A marquee drag selecting several elements at once. */
export function MultiSelect() {
  return (
    <Scene w={420} h={220}>
      <Shape x={56} y={50} w={66} h={40} />
      <Shape x={150} y={96} w={66} h={40} />
      <Shape x={250} y={56} w={66} h={40} kind="circle" />
      <Shape x={120} y={150} w={66} h={32} />
      <rect
        x={40}
        y={38}
        width={200}
        height={156}
        rx={4}
        className="fill-brand-500/10 stroke-brand-500"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <Cursor x={232} y={186} colour="brand" />
    </Scene>
  );
}

/** The format painter: copying one element's style onto another. */
export function FormatPainter() {
  return (
    <Scene w={420} h={200}>
      <Shape x={48} y={66} w={88} h={52} accent label="Styled" />
      <Arrow from={[140, 92]} to={[252, 92]} kind="curved" tone="muted" dashed />
      <Shape x={262} y={66} w={88} h={52} accent label="Painted" />
      {/* Paint-roller / brush cursor */}
      <g transform="translate(196 112)">
        <rect x={-9} y={-9} width={18} height={11} rx={2} className="fill-brand-500" />
        <path d="M0 2 v8" className="stroke-slate-500" strokeWidth={2} />
        <path
          d="M-4 10 h8 v6 h-8 Z"
          className="fill-brand-300 stroke-slate-500"
          strokeWidth={1.5}
        />
      </g>
    </Scene>
  );
}

/** Multi-colour theme: each branch of a hierarchy tinted its own hue. */
export function MulticolourTheme() {
  return (
    <Scene w={420} h={220}>
      <Shape
        x={172}
        y={92}
        w={76}
        h={40}
        fill="fill-slate-100"
        stroke="stroke-slate-400"
        label="Root"
        labelTone="strong"
      />
      <Shape
        x={40}
        y={28}
        w={70}
        h={36}
        fill="fill-emerald-100"
        stroke="stroke-emerald-600"
        label="A"
        labelTone="strong"
      />
      <Shape
        x={40}
        y={156}
        w={70}
        h={36}
        fill="fill-violet-100"
        stroke="stroke-violet-600"
        label="B"
        labelTone="strong"
      />
      <Shape
        x={310}
        y={28}
        w={70}
        h={36}
        fill="fill-amber-100"
        stroke="stroke-amber-600"
        label="C"
        labelTone="strong"
      />
      <Shape
        x={310}
        y={156}
        w={70}
        h={36}
        fill="fill-rose-100"
        stroke="stroke-rose-600"
        label="D"
        labelTone="strong"
      />
      <Arrow
        from={[172, 104]}
        to={[110, 50]}
        colour={{ stroke: 'stroke-emerald-600', fill: 'fill-emerald-600' }}
      />
      <Arrow
        from={[172, 120]}
        to={[110, 170]}
        colour={{ stroke: 'stroke-violet-600', fill: 'fill-violet-600' }}
      />
      <Arrow
        from={[248, 104]}
        to={[310, 50]}
        colour={{ stroke: 'stroke-amber-600', fill: 'fill-amber-600' }}
      />
      <Arrow
        from={[248, 120]}
        to={[310, 170]}
        colour={{ stroke: 'stroke-rose-600', fill: 'fill-rose-600' }}
      />
    </Scene>
  );
}

/** An element linked to another tab: a follow-link badge and a jump to a tab. */
export function ElementLink() {
  return (
    <Scene w={420} h={210}>
      <Tabs x={28} y={24} items={['Overview', 'Detail']} active={0} tabW={72} h={24} />
      <Shape x={48} y={92} w={120} h={56} kind="rect" label="See detail" labelTone="strong" />
      {/* Follow-link badge on the shape */}
      <g transform="translate(160 92)">
        <circle r={11} className="fill-brand-500 stroke-white" strokeWidth={2.5} />
        <path
          d="M-3 1 a4 4 0 0 1 0 -5 l2 -2 a4 4 0 0 1 6 6 l-1 1 M3 -1 a4 4 0 0 1 0 5 l-2 2 a4 4 0 0 1 -6 -6 l1 -1"
          className="stroke-white"
          strokeWidth={1.6}
          fill="none"
        />
      </g>
      <Arrow from={[176, 100]} to={[300, 120]} kind="curved" tone="accent" />
      {/* Target tab card */}
      <rect
        x={300}
        y={104}
        width={96}
        height={64}
        rx={8}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <Tabs x={310} y={114} items={['Detail']} active={0} tabW={56} h={18} />
      <Shape x={314} y={140} w={32} h={20} kind="rect" />
      <Shape x={356} y={140} w={32} h={20} kind="circle" accent />
    </Scene>
  );
}

/** A link card: the page's preview image on top, then the row that follows the link: the
 *  favicon, the page's title, its full address and the arrow. */
export function LinkCard() {
  return (
    <Scene w={420} h={180}>
      <rect
        x={100}
        y={24}
        width={220}
        height={132}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      {/* The preview image: a simple picture in brand tints. */}
      <g className="help-art-as-drawn">
        <path
          d="M101 34 a9 9 0 0 1 9 -9 h200 a9 9 0 0 1 9 9 V104 H101 Z"
          className="fill-brand-100"
        />
        <circle cx={268} cy={50} r={10} className="fill-brand-200" />
        <path d="M101 104 L150 66 L184 90 L214 70 L262 104 Z" className="fill-brand-300" />
      </g>
      <line x1={101} y1={104} x2={319} y2={104} className="stroke-slate-200" strokeWidth={1} />
      <rect x={114} y={118} width={14} height={14} rx={3} className="fill-brand-500" />
      <Label x={138} y={122} size={11.5} weight={700} tone="strong">
        Release notes, v2.4
      </Label>
      <Label x={138} y={139} size={9.5} tone="muted">
        https://example.com/notes
      </Label>
      <path
        d="M292 130 h10 M298 125.5 l4.5 4.5 l-4.5 4.5"
        fill="none"
        className="stroke-slate-400"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Scene>
  );
}

/** Dragging an element snaps it into line with a neighbour; the dashed guide
 * shows the matched edge. Holding Cmd / Ctrl skips snapping for a free drop. */
export function SnappingGuides() {
  return (
    <Scene w={400} h={200}>
      {/* The faint dashed guide, in the theme's element stroke as the app draws it, marks the
          shared top edge A and B aligned to. */}
      <line
        x1={64}
        y1={66}
        x2={320}
        y2={66}
        className="stroke-slate-600"
        strokeWidth={1.2}
        strokeOpacity={0.55}
        strokeDasharray="4 3"
      />
      <Shape x={64} y={66} w={84} h={60} label="A" />
      {/* The dragged element, snapped flush to A's top edge. */}
      <Shape x={236} y={66} w={84} h={44} accent label="B" />
      <Cursor x={288} y={84} />
    </Scene>
  );
}
