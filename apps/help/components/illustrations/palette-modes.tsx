// Palette-category illustrations (docs/specs/018-help/help-app.md): the mode picker (Select, Hand,
// Eraser, Format Painter, Laser, Spotlight, Avatar, Isometric) and the palette
// settings popover (Auto-Attach Arrows, Alignment Guides, Panel Opacity, Reset
// Palette Position). Composed only from the shared primitives so the house style
// holds — except the Avatar sprite, which is deliberately pixel art.

import { Scene, Shape, Arrow, SelectionBox, Panel, Tile, Label } from './primitives';
import {
  EraserGlyph,
  HandGlyph,
  IsoCard,
  LaserGlyph,
  SelectGlyph,
  iso,
} from './palette-modes-parts';
import { PickerTrigger, PixelCharacter } from './selection-modes';

// --- Mode scenes ------------------------------------------------------------

/** Select mode: the picker set to Select and a shape selected with handles. */
export function SelectMode() {
  return (
    <Scene w={420} h={230}>
      <PickerTrigger tool="select" />
      <Shape x={140} y={132} w={120} h={56} kind="rect" label="Step one" labelTone="strong" />
      <SelectionBox x={140} y={132} w={120} h={56} />
    </Scene>
  );
}

/** Hand mode: the picker set to Hand and a grabbing-hand cursor panning the
 *  canvas (a faint drag trail behind it). */
export function HandMode() {
  return (
    <Scene w={420} h={230}>
      <PickerTrigger tool="hand" />
      <Shape x={84} y={108} w={72} h={42} label="A" />
      <Shape x={252} y={150} w={72} h={42} accent label="B" />
      <Arrow from={[156, 129]} to={[252, 171]} kind="elbow" tone="muted" />
      {/* Drag trail */}
      <path
        d="M120 188 q40 -16 88 -8"
        className="stroke-slate-300"
        strokeWidth={2}
        fill="none"
        strokeDasharray="5 5"
        strokeLinecap="round"
      />
      {/* Grabbing-hand cursor */}
      <g transform="translate(196 150)">
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

/** Eraser mode: the picker set to Eraser and a drag across shapes, the ones
 *  already swept fading away. */
export function EraserMode() {
  return (
    <Scene w={420} h={230}>
      <PickerTrigger tool="eraser" />
      {/* Erased (fading) */}
      <Shape x={70} y={118} w={62} h={38} dashed fill="fill-slate-50" stroke="stroke-slate-300" />
      <Shape x={150} y={150} w={62} h={38} dashed fill="fill-slate-50" stroke="stroke-slate-300" />
      {/* Still present */}
      <Shape x={244} y={132} w={62} h={38} kind="circle" label="C" />
      <Shape x={320} y={172} w={62} h={38} accent label="D" />
      {/* Eraser drag path */}
      <path
        d="M96 132 L184 168 L276 150"
        className="stroke-rose-400"
        strokeWidth={2.5}
        fill="none"
        strokeDasharray="6 5"
        strokeLinecap="round"
      />
      {/* Eraser cursor */}
      <g transform="translate(276 150)">
        <rect
          x={-9}
          y={-5}
          width={18}
          height={11}
          rx={2}
          transform="rotate(-30)"
          className="fill-white stroke-slate-500"
          strokeWidth={1.8}
        />
        <rect
          x={-9}
          y={1}
          width={18}
          height={5}
          rx={1}
          transform="rotate(-30)"
          className="fill-rose-300 stroke-slate-500"
          strokeWidth={1.5}
        />
      </g>
    </Scene>
  );
}

/** Format Painter mode: the picker set to Format, copying one shape's style
 *  onto another via a brush cursor. */
export function FormatPainterMode() {
  return (
    <Scene w={420} h={220}>
      <PickerTrigger tool="format" />
      <Shape x={48} y={120} w={88} h={52} accent label="Source" />
      <Arrow from={[140, 146]} to={[252, 146]} kind="curved" tone="muted" dashed />
      <Shape x={262} y={120} w={88} h={52} accent label="Painted" />
      {/* Brush cursor */}
      <g transform="translate(196 166)">
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

/** Laser mode: the picker set to Laser and a fading laser trail across the
 *  canvas, brightening towards the cursor. */
export function LaserMode() {
  return (
    <Scene w={420} h={230}>
      <PickerTrigger tool="laser" />
      <Shape x={84} y={120} w={76} h={44} label="A" />
      <Shape x={264} y={150} w={76} h={44} accent label="B" />
      {/* Fading laser trail: faint tail to bright head */}
      <path
        d="M104 176 q60 -40 140 -10 q30 12 56 -2"
        className="stroke-rose-200"
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M196 162 q30 12 56 -2 q20 -10 44 -4"
        className="stroke-rose-400"
        strokeWidth={3.5}
        fill="none"
        strokeLinecap="round"
      />
      {/* Bright head dot */}
      <circle cx={296} cy={156} r={5} className="fill-rose-500" />
      <circle cx={296} cy={156} r={9} className="fill-rose-400/30" />
    </Scene>
  );
}

/** Avatar mode: the picker set to Avatar, the pixel character standing on the
 *  shape being talked about (ringed), and the dashed path it walked from the
 *  previous shape. */
export function AvatarMode() {
  return (
    <Scene w={420} h={230}>
      <PickerTrigger tool="avatar" />
      <Shape x={68} y={150} w={76} h={44} label="A" />
      <Shape x={248} y={128} w={88} h={50} accent label="B" />
      {/* Walked path + the click that started it */}
      <path
        d="M116 186 q54 6 104 -12"
        className="stroke-brand-300"
        strokeWidth={2}
        fill="none"
        strokeDasharray="4 5"
        strokeLinecap="round"
      />
      <circle cx={116} cy={186} r={4} className="fill-brand-300/60" />
      {/* "You are here" ring on the shape the avatar arrived at */}
      <rect
        x={244}
        y={124}
        width={96}
        height={58}
        rx={8}
        className="fill-none stroke-brand-400"
        strokeWidth={2}
      />
      {/* The character, standing on the ringed shape (feet on its lower edge) */}
      <PixelCharacter fx={272} fy={182} />
    </Scene>
  );
}

/** Isometric mode: the picker set to Isometric and the same shapes tilted into an
 *  isometric, three-dimensional view. */
export function IsometricMode() {
  const a = iso(-70, -30);
  const b = iso(70, 30);
  return (
    <Scene w={420} h={264}>
      <PickerTrigger tool="isometric" />
      <line
        x1={a[0]}
        y1={a[1] + 6}
        x2={b[0]}
        y2={b[1] + 6}
        className="stroke-brand-400"
        strokeWidth={2.5}
      />
      <IsoCard cx={-70} cy={-30} label="A" />
      <IsoCard cx={70} cy={30} accent label="B" />
    </Scene>
  );
}

// --- Palette settings popover -----------------------------------------------

/** The palette gear (settings) popover: a small menu of toggle rows and the
 *  reset action. `highlight` brand-tints one row so an article can point at its
 *  own setting. Reused across the settings articles. */

/** Panel opacity: a floating panel rendered translucent so the canvas content
 *  behind it stays visible. Pairs with the settings popover illustration to
 *  show what the slider does. */
export function PanelOpacity() {
  return (
    <Scene w={400} h={240}>
      {/* Canvas content the panel floats over. */}
      <Shape x={54} y={104} w={86} h={52} accent label="A" />
      <Shape x={150} y={158} w={86} h={52} kind="circle" label="B" />
      <Shape x={252} y={150} w={92} h={52} label="C" />
      {/* The floating panel at ~60% opacity: the shapes behind it stay
          visible through it. */}
      <g opacity={0.6}>
        <Panel x={196} y={42} w={156} h={150} title="PALETTE">
          <rect x={210} y={78} width={128} height={10} rx={5} className="fill-slate-200" />
          <rect x={210} y={100} width={36} height={32} rx={6} className="fill-slate-100" />
          <rect x={252} y={100} width={36} height={32} rx={6} className="fill-slate-100" />
          <rect x={294} y={100} width={36} height={32} rx={6} className="fill-slate-100" />
          <rect x={210} y={144} width={128} height={10} rx={5} className="fill-slate-200" />
          <rect x={210} y={162} width={86} height={10} rx={5} className="fill-slate-200" />
        </Panel>
      </g>
    </Scene>
  );
}

/** Auto-attach arrows: the target is dragged from the right of the source to
 *  its left. Kept where they were, the ends would run the line through the
 *  source, so both move to the sides that now face each other. */
export function AutoAttachArrows() {
  return (
    <Scene w={420} h={220}>
      <Shape x={166} y={86} w={88} h={48} label="Source" />
      {/* Old position (ghost) and the arrow as it was */}
      <Shape x={320} y={86} w={88} h={48} dashed fill="fill-slate-50" stroke="stroke-slate-300" />
      <Arrow from={[254, 110]} to={[320, 110]} tone="muted" dashed />
      {/* Moved shape; both ends now on the facing sides */}
      <Shape x={12} y={86} w={88} h={48} accent label="Target" />
      <Arrow from={[166, 110]} to={[100, 110]} tone="accent" />
      {/* Move trail, over the top */}
      <path
        d="M364 80 Q210 -10 56 80"
        className="stroke-slate-300"
        strokeWidth={2}
        fill="none"
        strokeDasharray="5 5"
        strokeLinecap="round"
      />
    </Scene>
  );
}

/** Reset palette position: the palette snapping back from a drifted spot to its
 *  default top-right corner. */
export function ResetPalettePosition() {
  return (
    <Scene w={420} h={230}>
      {/* Drifted ghost of the palette */}
      <g opacity={0.5}>
        <rect
          x={120}
          y={132}
          width={70}
          height={84}
          rx={10}
          className="fill-white stroke-slate-300"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      </g>
      {/* Snap-back trail */}
      <Arrow from={[190, 150]} to={[316, 44]} kind="curved" tone="accent" dashed />
      {/* Palette back in its default top-right corner */}
      <Panel x={318} y={20} w={84} h={104} title="PALETTE">
        <Tile x={328} y={48} active>
          <SelectGlyph on />
        </Tile>
        <Tile x={362} y={48}>
          <HandGlyph />
        </Tile>
        <Tile x={328} y={84}>
          <EraserGlyph />
        </Tile>
        <Tile x={362} y={84}>
          <LaserGlyph />
        </Tile>
      </Panel>
      <Label x={252} y={92} size={10} weight={700} tone="accent" anchor="middle">
        Snap back
      </Label>
    </Scene>
  );
}
