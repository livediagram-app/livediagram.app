// livediagram on a computer and on a tablet held landscape (docs/specs/017-help: Supported Devices): the real editor,
// drawn with the chrome kit at full size and scaled into the device's screen, so each device shows the same frame as
// the app: the logo and menu with the mode switch, the icon strip, Share and Sign In, the corner cluster and the
// bottom bar.

import { Arrow, Label, Scene, Shape } from '@liveworkspace/help-site/art/primitives';
import { EditorFrame } from './editor-chrome';

// The editor drawn at full size before it is scaled into a screen.
const EW = 540;
const EH = 300;

/** The editor at full size: a small flow under the whole frame. */
function Editor() {
  return (
    <g>
      <rect width={EW} height={EH} className="fill-slate-50" />
      <Shape x={150} y={96} w={84} h={46} label="Start" />
      <Shape x={286} y={88} w={66} h={62} kind="diamond" />
      <Shape x={277} y={186} w={84} h={42} accent label="Done" />
      <Arrow from={[234, 119]} to={[286, 119]} />
      <Arrow from={[319, 150]} to={[319, 186]} />
      <EditorFrame w={EW} h={EH} />
    </g>
  );
}

/** A computer's monitor showing the editor, the whole layout at once. */
export function DesktopEditor() {
  const sx = 34;
  const sy = 22;
  const sw = 352;
  const k = sw / EW;
  const sh = EH * k;
  return (
    <Scene w={420} h={262} bg="plain">
      <rect
        x={sx - 8}
        y={sy - 8}
        width={sw + 16}
        height={sh + 16}
        rx={10}
        className="fill-slate-800"
      />
      <g transform={`translate(${sx} ${sy}) scale(${k})`}>
        <Editor />
      </g>
      <rect x={196} y={sy + sh + 8} width={28} height={14} className="fill-slate-300" />
      <rect x={166} y={sy + sh + 22} width={88} height={6} rx={3} className="fill-slate-300" />
    </Scene>
  );
}

/** A tablet held landscape showing the same editor as a computer. */
export function TabletEditor() {
  const sx = 46;
  const sy = 24;
  const sw = 328;
  const k = sw / EW;
  const sh = EH * k;
  return (
    <Scene w={420} h={250} bg="plain">
      <rect
        x={sx - 14}
        y={sy - 10}
        width={sw + 28}
        height={sh + 20}
        rx={16}
        className="fill-slate-800"
      />
      <circle cx={sx - 7} cy={sy + sh / 2} r={2} className="fill-slate-600" />
      <g transform={`translate(${sx} ${sy}) scale(${k})`}>
        <Editor />
      </g>
      <Label x={210} y={sy + sh + 24} anchor="middle" size={10} weight={500} tone="muted">
        Full layout, as on a computer
      </Label>
    </Scene>
  );
}
