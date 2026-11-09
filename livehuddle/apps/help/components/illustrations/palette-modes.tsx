// Palette-category illustrations (docs/specs/018-help/help-app.md): Edit and Walk (the two sides of the toggle at
// the start of the palette strip), the Format Painter on the selection toolbar, and the palette settings (Panel
// Opacity). Composed only from the shared primitives so the house style holds, except the Avatar sprite, which is
// deliberately pixel art.

import { Scene, Shape, Arrow, SelectionBox, Panel } from '@liveworkspace/help-site/art/primitives';
import { PixelCharacter } from './pixel-character';
import { MenuCard, Strip } from './toolbar-layout';
import { SelectionToolbar } from './user-interface';

// --- Mode scenes ------------------------------------------------------------

/** Edit: the strip with Edit on at its start, and a shape selected with its handles. */
export function EditMode() {
  return (
    <Scene w={420} h={230}>
      <MenuCard x={8} y={16} />
      <Strip x={78} y={16} />
      <Shape x={150} y={124} w={120} h={56} kind="rect" label="Step one" labelTone="strong" />
      <SelectionBox x={150} y={124} w={120} h={56} />
    </Scene>
  );
}

/** The Format Painter: the source selected with Format Painter pressed on its selection toolbar, and its look
 *  being brushed onto another element. */
export function FormatPainterMode() {
  const tx = 24;
  return (
    <Scene w={420} h={220}>
      <SelectionToolbar x={tx} y={30} formatOn />
      <Shape x={48} y={120} w={88} h={52} accent label="Source" />
      <SelectionBox x={48} y={120} w={88} h={52} />
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
      {/* A leader from the pressed button down to the element it took the style from. */}
      <path
        d={`M${tx + 6 + 3 * 30 + 12} 64 V112`}
        className="stroke-brand-300"
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />
    </Scene>
  );
}

/** Avatar mode: the pixel character standing on the
 *  shape being talked about (its feet inside it, which is what rings it), to the
 *  side of the label so both read, at the end of the dashed path it walked. */
export function AvatarMode() {
  return (
    <Scene w={420} h={230}>
      <Shape x={68} y={150} w={76} h={44} label="A" />
      <Shape x={226} y={128} w={140} h={54} label="B" />
      {/* Walked path + the click that started it */}
      <path
        d="M150 178 q76 26 172 2"
        className="stroke-brand-300"
        strokeWidth={2}
        fill="none"
        strokeDasharray="4 5"
        strokeLinecap="round"
      />
      <circle cx={150} cy={178} r={4} className="fill-brand-300/60" />
      {/* "You are here" ring on the shape the avatar arrived at */}
      <rect
        x={222}
        y={124}
        width={148}
        height={62}
        rx={8}
        className="fill-none stroke-brand-400"
        strokeWidth={2}
      />
      {/* The character, feet inside the ringed shape where the path ends */}
      <PixelCharacter fx={334} fy={178} />
    </Scene>
  );
}

/** Panel opacity: a corner panel rendered translucent so the canvas content
 *  behind it stays visible. Pairs with the settings popover illustration to
 *  show what the slider does. */
export function PanelOpacity() {
  return (
    <Scene w={400} h={240}>
      {/* Canvas content the panel floats over. */}
      <Shape x={54} y={104} w={86} h={52} accent label="A" />
      <Shape x={54} y={170} w={86} h={52} kind="circle" label="B" />
      {/* C sits wholly under the panel, in the space below its tiles. */}
      <Shape x={226} y={140} w={96} h={46} label="C" />
      {/* The panel at ~60% opacity: the shape behind it stays
          visible through it. */}
      <g opacity={0.6}>
        <Panel x={196} y={42} w={156} h={150} title="MAP">
          <rect x={210} y={78} width={128} height={10} rx={5} className="fill-slate-200" />
          <rect x={210} y={100} width={36} height={32} rx={6} className="fill-slate-100" />
          <rect x={252} y={100} width={36} height={32} rx={6} className="fill-slate-100" />
          <rect x={294} y={100} width={36} height={32} rx={6} className="fill-slate-100" />
        </Panel>
      </g>
    </Scene>
  );
}
