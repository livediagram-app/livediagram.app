import { Arrow, Shape } from '@liveworkspace/help-site/art/primitives';
import { Callout, Stage, Window } from '@liveworkspace/help-site/art/parts';
import {
  EditorFrame,
  topRowStripX,
} from '@/editions/livediagram/components/illustrations/editor-chrome';

// The editor drawn at full size in the window, then scaled to fit it.
const EW = 540;
const EH = 252;
const K = 368 / EW;

// User Interface: the whole editor laid out in a window, with numbered callouts on its parts: the logo, menu and mode
// switch, the palette strip, Share and Sign In, and the tab bar with the corner cluster along the foot.
export function UserInterfaceArt() {
  const at = (x: number, y: number): [number, number] => [16 + x * K, 33 + y * K];
  const [c1x, c1y] = at(8, 8);
  const [c2x, c2y] = at(topRowStripX(EW), 8);
  const [c3x, c3y] = at(EW - 8, 8);
  const [c4x, c4y] = at(8, EH - 26);
  return (
    <Stage>
      <Window x={14} y={10} w={372} h={200} title="Product launch · livediagram">
        <g transform={`translate(16 33) scale(${K})`}>
          <rect width={EW} height={EH} className="fill-slate-50" />
          <Shape x={170} y={104} w={84} h={44} label="Plan" />
          <Shape x={300} y={104} w={92} h={44} accent label="Launch" />
          <Arrow from={[254, 126]} to={[300, 126]} />
          <EditorFrame w={EW} h={EH} tabs={['Overview', 'Flows']} />
        </g>
      </Window>
      <Callout cx={c1x} cy={c1y} n={1} />
      <Callout cx={c2x} cy={c2y} n={2} />
      <Callout cx={c3x} cy={c3y} n={3} />
      <Callout cx={c4x} cy={c4y} n={4} />
    </Stage>
  );
}
