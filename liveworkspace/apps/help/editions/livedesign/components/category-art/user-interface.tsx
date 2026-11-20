import { Stage } from '@liveworkspace/help-site/art/parts';
import { Label } from '@liveworkspace/help-site/art/primitives';
import { EditorFrame } from '../illustrations/editor-frame';
import { APP_PAGES, AppScreens } from '../illustrations/user-interface';

// The numbered callouts on the editor's parts (Panel Layout), in stage units over the scaled window.
const CALLOUTS: [number, number, string][] = [
  [12, 16, '1'],
  [300, 33, '2'],
  [272, 197, '3'],
  [190, 214, '4'],
];

// User Interface: the editor as it is laid out, at a glance: 1 the Pages rail with the logo and menu at its top,
// 2 the palette strip, 3 the corner controls (Undo and Redo, the Theme palette, the zoom) and 4 the bottom bar with
// the tabs and the quick controls, round a tab of phone screens.
export function UserInterfaceArt() {
  const s = 0.56;
  return (
    <Stage>
      <rect
        x={20}
        y={6}
        width={640 * s}
        height={384 * s}
        rx={8}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={0.75}
      />
      <g transform={`translate(20 6) scale(${s})`}>
        <EditorFrame w={640} h={384} pages={APP_PAGES} level="60%" tabs={['App Screens', 'Brand']}>
          <AppScreens x={168} y={80} h={240} />
        </EditorFrame>
      </g>
      {CALLOUTS.map(([x, y, n]) => (
        <g key={n}>
          <circle cx={x} cy={y} r={7} className="fill-brand-600" />
          <Label x={x} y={y + 0.5} size={9} weight={700} anchor="middle" tone="onAccent">
            {n}
          </Label>
        </g>
      ))}
    </Stage>
  );
}
