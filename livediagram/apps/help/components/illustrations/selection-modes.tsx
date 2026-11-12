// Selection-mode illustrations (docs/specs/018-help/help-app.md): the palette's canvas-tool picker
// as the editor actually draws it (a trigger at the start of the palette strip that
// opens a tile grid in three bands), the panels each tool opens while it is
// active, and the isometric orbit button. The per-mode canvas scenes in palette-modes.tsx put PickerTrigger on
// top, so every selection-mode article shows the same picker with its own tool
// chosen.
//
// Labels are lifted from apps/editor: canvas-tool-options.tsx (tool names,
// shortcuts, bands), the *-config.ts catalogues (panel rows and values), and
// TopCenterChrome.tsx (the Format banner).

import { Scene, Label, Cursor } from '@liveworkspace/help-site/art/primitives';
import { IsoCard, iso } from './palette-modes-parts';

// The picker lives in selection-modes-picker.tsx and the tool panels in selection-modes-panels.tsx.
export { PickerTrigger, ToolPicker } from './selection-modes-picker';
export {
  EraserPanelScene,
  FormatPanelScene,
  LaserPanelScene,
  SpotlightPanelScene,
  SpotlightTool,
} from './selection-modes-panels';

// --- Isometric ----------------------------------------------------------------

/** The isometric view with the zoom dock's orbit button: drag it to orbit,
 *  click it to snap back to the default angle. */
export function IsometricOrbit() {
  const a = iso(-70, -30);
  const b = iso(70, 30);
  return (
    <Scene w={420} h={250}>
      <g transform="translate(-110 -40)">
        <line
          x1={a[0]}
          y1={a[1] + 6}
          x2={b[0]}
          y2={b[1] + 6}
          className="stroke-brand-400"
          strokeWidth={2.5}
        />
        <IsoCard cx={-70} cy={-30} label="Web" />
        <IsoCard cx={70} cy={30} accent label="API" />
      </g>
      {/* The zoom dock: zoom out, the percentage, zoom in, then Orbit */}
      <rect
        x={196}
        y={196}
        width={206}
        height={40}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={218} y={217} size={14} weight={600} anchor="middle" tone="body">
        −
      </Label>
      <Label x={256} y={217} size={11} weight={600} anchor="middle" tone="body">
        100%
      </Label>
      <Label x={294} y={217} size={14} weight={600} anchor="middle" tone="body">
        +
      </Label>
      <line x1={314} y1={204} x2={314} y2={228} className="stroke-slate-200" strokeWidth={1.2} />
      <rect x={322} y={201} width={30} height={30} rx={7} className="fill-brand-100" />
      <g
        transform="translate(337 216)"
        className="stroke-brand-600"
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
      >
        <ellipse rx={9} ry={4} />
        <circle r={2} className="fill-brand-600" />
        <path d="M6 -6 l3 2.5 l-3.5 1.5" />
      </g>
      <Cursor x={344} y={222} />
      {/* Its hover card */}
      <rect
        x={236}
        y={124}
        width={166}
        height={60}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={248} y={140} size={11} weight={700} tone="strong">
        Orbit
      </Label>
      <Label x={248} y={156} size={10} tone="muted">
        Drag to orbit, click to
      </Label>
      <Label x={248} y={170} size={10} tone="muted">
        reset the angle.
      </Label>
    </Scene>
  );
}
