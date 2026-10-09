// Canvas-category illustrations (docs/specs/018-help/help-app.md): the infinite canvas, placing and
// selecting elements, grouping, themes, templates, links, and annotations.
// Composed only from the shared primitives so the house style holds.

import {
  Scene,
  Shape,
  Arrow,
  SelectionBox,
  Cursor,
  Panel,
  Dialog,
  Tabs,
  Label,
  TextBar,
} from './primitives';
import { MenuCard, Strip } from './toolbar-layout';

/** The canvas with the menu button and the palette strip across the top and a small flow on
 *  it: the editor at a glance. */
export function CanvasOverview() {
  return (
    <Scene w={420} h={240}>
      <MenuCard x={8} y={16} />
      <Strip x={78} y={16} />
      <Shape x={40} y={92} w={84} h={48} kind="rect" label="Start" />
      <Shape x={172} y={92} w={84} h={48} kind="diamond" />
      <Shape x={172} y={172} w={84} h={44} kind="rect" accent label="Done" />
      <Arrow from={[124, 116]} to={[172, 116]} />
      <Arrow from={[214, 140]} to={[214, 172]} />
      <Cursor x={150} y={150} name="You" />
    </Scene>
  );
}

/** Dropping a shape from the palette strip onto the canvas (a curved drag trail from the
 *  square tile to a freshly placed, still-selected shape). */
export function AddingElements() {
  return (
    <Scene w={420} h={200}>
      <Strip x={58} y={16} />
      <Arrow from={[198, 52]} to={[250, 104]} kind="curved" tone="muted" dashed />
      <Shape x={250} y={104} w={96} h={56} kind="rect" />
      <SelectionBox x={250} y={104} w={96} h={56} />
      <Cursor x={300} y={132} colour="brand" />
    </Scene>
  );
}

/** Panning and zooming: shapes on the canvas with the zoom controls and a
 *  grabbing hand cursor. */
export function PanAndZoom() {
  return (
    <Scene w={420} h={220}>
      <Shape x={70} y={54} w={76} h={44} label="A" />
      <Shape x={232} y={108} w={76} h={44} accent label="B" />
      <Arrow from={[146, 76]} to={[232, 130]} kind="elbow" />
      {/* Zoom controls, bottom-right */}
      <Panel x={300} y={168} w={104} h={34}>
        <g transform="translate(0 0)">
          <Label x={316} y={185} size={14} weight={700} tone="muted">
            −
          </Label>
          <Label x={352} y={185} size={11} weight={600} tone="body" anchor="middle">
            100%
          </Label>
          <Label x={388} y={185} size={14} weight={700} tone="muted">
            +
          </Label>
        </g>
      </Panel>
      {/* Grabbing-hand cursor */}
      <g transform="translate(150 120)">
        <path
          d="M0 6 v-8 a3 3 0 0 1 6 0 v6 m0 -2 a3 3 0 0 1 6 0 v3 m0 -1 a3 3 0 0 1 6 0 v5 a10 10 0 0 1 -10 10 h-2 a10 10 0 0 1 -9 -7 l-3 -7 a3 3 0 0 1 5 -3 l1 2"
          className="fill-white stroke-slate-500"
          strokeWidth={2}
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
      <Shape x={120} y={158} w={66} h={36} />
      <rect
        x={40}
        y={38}
        width={200}
        height={150}
        rx={4}
        className="fill-brand-500/10 stroke-brand-500"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <Cursor x={232} y={180} colour="brand" />
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

/** The theme picker: a dialog of theme swatch cards, one applied. */
export function ThemePicker() {
  const themes: [string, string, string][] = [
    ['fill-brand-500', 'fill-brand-100', 'fill-brand-50'],
    ['fill-emerald-500', 'fill-emerald-100', 'fill-emerald-50'],
    ['fill-violet-500', 'fill-violet-100', 'fill-violet-50'],
    ['fill-amber-500', 'fill-amber-100', 'fill-amber-50'],
    ['fill-rose-500', 'fill-rose-100', 'fill-rose-50'],
    ['fill-slate-700', 'fill-slate-300', 'fill-slate-100'],
  ];
  return (
    <Scene w={420} h={240} bg="plain">
      <Dialog x={70} y={18} w={280} h={204} title="Theme" sceneW={420} sceneH={240} scrim={false}>
        {themes.map(([a, b, c], i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const sx = 86 + col * 88;
          const sy = 64 + row * 76;
          const sel = i === 0;
          return (
            <g key={i}>
              <rect
                x={sx}
                y={sy}
                width={76}
                height={60}
                rx={8}
                className={`fill-white ${sel ? 'stroke-brand-500' : 'stroke-slate-200'}`}
                strokeWidth={sel ? 2.5 : 1.5}
              />
              <g className="help-art-as-drawn">
                <rect x={sx + 10} y={sy + 12} width={22} height={16} rx={3} className={a} />
                <rect x={sx + 38} y={sy + 12} width={22} height={16} rx={3} className={b} />
                <rect x={sx + 10} y={sy + 34} width={50} height={14} rx={3} className={c} />
              </g>
            </g>
          );
        })}
      </Dialog>
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
        fill="fill-emerald-500"
        stroke="stroke-emerald-600"
        label="A"
        labelTone="onAccent"
      />
      <Shape
        x={40}
        y={156}
        w={70}
        h={36}
        fill="fill-violet-500"
        stroke="stroke-violet-600"
        label="B"
        labelTone="onAccent"
      />
      <Shape
        x={310}
        y={28}
        w={70}
        h={36}
        fill="fill-amber-500"
        stroke="stroke-amber-600"
        label="C"
        labelTone="onAccent"
      />
      <Shape
        x={310}
        y={156}
        w={70}
        h={36}
        fill="fill-rose-500"
        stroke="stroke-rose-600"
        label="D"
        labelTone="onAccent"
      />
      <Arrow from={[172, 104]} to={[110, 50]} tone="muted" />
      <Arrow from={[172, 120]} to={[110, 170]} tone="muted" />
      <Arrow from={[248, 104]} to={[310, 50]} tone="muted" />
      <Arrow from={[248, 120]} to={[310, 170]} tone="muted" />
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

/** A link card: a bookmarked URL rendered as a card with favicon + title. */
export function LinkCard() {
  return (
    <Scene w={420} h={180}>
      <rect
        x={110}
        y={44}
        width={200}
        height={92}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <rect x={110} y={44} width={200} height={44} rx={10} className="fill-brand-100" />
      <rect x={110} y={78} width={200} height={10} className="fill-brand-100" />
      <circle cx={130} cy={108} r={9} className="fill-brand-500" />
      <Label x={148} y={104} size={12} weight={700} tone="strong">
        livediagram
      </Label>
      <TextBar x={148} y={114} w={120} />
      <TextBar x={148} y={124} w={86} tone="faint" />
    </Scene>
  );
}

/** An annotation marker with its hover note. */
export function Annotation() {
  return (
    <Scene w={420} h={190}>
      <Shape x={70} y={80} w={96} h={52} kind="rect" label="Server" />
      <g transform="translate(158 72)">
        <circle r={11} className="fill-amber-400 stroke-white" strokeWidth={2.5} />
        <Label
          x={0}
          y={1}
          anchor="middle"
          size={13}
          weight={700}
          className="fill-white dark:fill-slate-950"
        >
          i
        </Label>
      </g>
      <g transform="translate(196 50)">
        <rect
          width={168}
          height={56}
          rx={9}
          className="fill-white stroke-amber-300"
          strokeWidth={2}
        />
        <path d="M-8 18 l10 -6 l0 12 Z" className="fill-white stroke-amber-300" strokeWidth={2} />
        <TextBar x={14} y={18} w={132} />
        <TextBar x={14} y={32} w={104} tone="faint" />
      </g>
    </Scene>
  );
}

/** Dragging an element snaps it into line with a neighbour; the dashed guide
 * shows the matched edge. Holding Cmd / Ctrl skips snapping for a free drop. */
export function SnappingGuides() {
  return (
    <Scene w={400} h={200}>
      {/* The dashed brand guide marks the shared top edge A and B aligned to. */}
      <line
        x1={40}
        y1={66}
        x2={344}
        y2={66}
        className="stroke-brand-500"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <Shape x={64} y={66} w={84} h={60} label="A" />
      {/* The dragged element, snapped flush to A's top edge. */}
      <Shape x={236} y={66} w={84} h={60} accent label="B" />
      <Cursor x={300} y={104} />
    </Scene>
  );
}
