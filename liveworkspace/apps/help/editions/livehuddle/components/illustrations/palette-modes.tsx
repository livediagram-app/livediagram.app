// Palette-category illustrations (liveworkspace/docs/specs/017-help/help-centre.md): Edit and Walk (the two sides of
// the toggle at the start of the palette strip), the Format Painter on the selection toolbar, and the palette
// settings (Panel Opacity). Drawn on livehuddle's own floor with its own chrome; the Avatar is deliberately pixel art.

import { Scene, SelectionBox } from '@liveworkspace/help-site/art/primitives';
import { PixelCharacter } from './pixel-character';
import { TopRow } from './editor-chrome';
import { Desk, MeetingTable, OfficeFloor, Plant, Room, Sticky } from './space-furniture';
import { Brush } from './canvas';
import { MapPanel, SelectionToolbar } from './user-interface';

// --- Mode scenes ------------------------------------------------------------

/** Edit: the strip with Edit on at its start, and a desk selected with its handles. */
export function EditMode() {
  return (
    <Scene w={460} h={210}>
      <Room x={60} y={60} w={340} h={136} name="Desks" />
      <Desk x={110} y={110} />
      <Desk x={196} y={110} />
      <Plant cx={370} cy={176} />
      <SelectionBox x={192} y={102} w={42} h={40} />
      <TopRow w={460} noCorner />
    </Scene>
  );
}

/** The Format Painter: the source note selected with Format Painter pressed on its selection toolbar, and its
 *  look being brushed onto another note. */
export function FormatPainterMode() {
  const tx = 24;
  return (
    <Scene w={420} h={210}>
      <SelectionToolbar x={tx} y={24} formatOn />
      <Sticky x={48} y={110} w={88} h={70} tone="sky" label="Agenda" lines={3} />
      <SelectionBox x={48} y={110} w={88} h={70} />
      <path
        d="M140 136 C 190 106, 230 106, 258 130"
        className="fill-none stroke-slate-400"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <Sticky x={262} y={110} w={88} h={70} tone="sky" label="Notes" lines={3} />
      <Brush x={316} y={170} />
      <path
        d={`M${tx + 6 + 3 * 30 + 12} 58 V102`}
        className="stroke-brand-300"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
    </Scene>
  );
}

/** Walking: your character at the end of the dashed path it walked, standing at the meeting table it was sent
 *  to, the table ringed while you are near it. */
export function AvatarMode() {
  return (
    <Scene w={420} h={210}>
      <Room x={170} y={30} w={230} h={160} name="Meeting Room" />
      <MeetingTable x={220} y={84} w={90} />
      <Plant cx={380} cy={170} />
      <path
        d="M40 180 q90 10 150 -40 t90 -6"
        className="stroke-brand-400"
        strokeWidth={1.5}
        fill="none"
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
      <circle cx={40} cy={180} r={3} className="fill-brand-400" />
      <rect
        x={212}
        y={74}
        width={106}
        height={46}
        rx={8}
        className="fill-none stroke-brand-500"
        strokeWidth={1.2}
        strokeDasharray="4 3"
      />
      <PixelCharacter fx={286} fy={142} px={2} />
    </Scene>
  );
}

/** Panel opacity: the Map at a lower opacity, so the rooms behind it show through. */
export function PanelOpacity() {
  return (
    <Scene w={400} h={210}>
      <g transform="translate(20 20) scale(0.95)">
        <OfficeFloor x={0} y={0} />
      </g>
      <g opacity={0.6}>
        <MapPanel x={14} y={110} />
      </g>
    </Scene>
  );
}
