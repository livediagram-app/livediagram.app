// Selection-mode illustrations (liveworkspace/docs/specs/017-help/help-centre.md): the palette's canvas-tool picker
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
import { Card, Icon } from './editor-chrome';

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
      {/* The zoom card: zoom out, the level, zoom in, then Orbit on its pale tile. */}
      <Card x={298} y={218} w={114} h={24}>
        <Icon prims={[{ t: 'path', d: 'M5 12h14' }]} x={310} y={230} size={8} />
        <Label x={338} y={230.5} size={9} weight={500} tone="strong" anchor="middle">
          100%
        </Label>
        <Icon prims={[{ t: 'path', d: 'M5 12h14M12 5v14' }]} x={366} y={230} size={8} />
        <line x1={378} y1={218} x2={378} y2={242} className="stroke-slate-100" strokeWidth={0.75} />
        <rect x={382} y={221} width={26} height={18} rx={4} className="fill-brand-100" />
        <g
          transform="translate(395 230) scale(0.75)"
          className="stroke-brand-700"
          strokeWidth={1.4}
          fill="none"
          strokeLinecap="round"
        >
          <ellipse rx={9} ry={4} />
          <circle r={1.6} className="fill-brand-700" />
          <path d="M6 -6 l3 2.5 l-3.5 1.5" />
        </g>
      </Card>
      <Cursor x={400} y={234} />
      {/* Its hover card */}
      <Card x={262} y={160} w={146} h={48}>
        <Label x={272} y={174} size={10} weight={650} tone="strong">
          Orbit
        </Label>
        <Label x={272} y={188} size={9} tone="muted">
          Drag to orbit, click to reset
        </Label>
        <Label x={272} y={199} size={9} tone="muted">
          the angle.
        </Label>
      </Card>
    </Scene>
  );
}
